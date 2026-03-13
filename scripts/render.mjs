#!/usr/bin/env node

import { fail, readOptionValue } from "./lib/cli-utils.mjs";
import {
  buildCacheTelemetry,
  buildExtractCacheKey,
  readCacheRecord,
  writeCacheEntry,
} from "./lib/cache.mjs";
import { loadRuntimeConfig } from "./lib/config.mjs";
import {
  loadHealthState,
  recordProviderFailure,
  recordProviderSuccess,
} from "./lib/health-state.mjs";
import {
  buildExtractOutput,
  buildPlanOutput,
  finalizeCommandOutput,
  formatExtractMarkdown,
} from "./lib/output.mjs";
import {
  formatPlanMarkdown,
  planExtractRoute,
  requireSelectedRoute,
  serializePlan,
} from "./lib/planner.mjs";

function usage(exitCode = 2) {
  console.error(`web-search-pro render — Render and extract readable content in a local browser

Usage:
  render.mjs "url1" ["url2" ...] [options]

Options:
  --max-chars <n>            Limit extracted readable text per URL
  --render-budget-ms <n>     Browser render budget in milliseconds
  --render-wait-until <mode> Wait mode: domcontentloaded|networkidle
  --json                     Output stable JSON schema
  --plan                     Show route plan only (no browser launch)
  --explain-routing          Include route explanation in output`);
  process.exit(exitCode);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
}

const opts = {
  maxChars: null,
  renderBudgetMs: null,
  renderWaitUntil: null,
  json: false,
  plan: false,
  explainRouting: false,
};
const urls = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-h" || arg === "--help") {
    usage(0);
  }
  if (arg === "--max-chars") {
    opts.maxChars = Number.parseInt(readOptionValue(args, i, "--max-chars"), 10);
    i++;
    continue;
  }
  if (arg === "--render-budget-ms") {
    opts.renderBudgetMs = Number.parseInt(readOptionValue(args, i, "--render-budget-ms"), 10);
    i++;
    continue;
  }
  if (arg === "--render-wait-until") {
    opts.renderWaitUntil = readOptionValue(args, i, "--render-wait-until");
    i++;
    continue;
  }
  if (arg === "--json") {
    opts.json = true;
    continue;
  }
  if (arg === "--plan") {
    opts.plan = true;
    continue;
  }
  if (arg === "--explain-routing") {
    opts.explainRouting = true;
    continue;
  }
  if (!arg.startsWith("-")) {
    urls.push(arg);
    continue;
  }
  fail(`Unknown option: ${arg}`);
}

if (urls.length === 0) {
  fail("No URLs provided");
}
if (opts.maxChars !== null && (!Number.isInteger(opts.maxChars) || opts.maxChars < 100)) {
  fail("--max-chars must be an integer >= 100");
}
if (
  opts.renderBudgetMs !== null &&
  (!Number.isInteger(opts.renderBudgetMs) || opts.renderBudgetMs < 1000)
) {
  fail("--render-budget-ms must be an integer >= 1000");
}

const cwd = process.cwd();
const env = process.env;
const { config } = loadRuntimeConfig({
  cwd,
  env,
  overrides: {
    render: {
      enabled: true,
      policy: "force",
      ...(opts.renderBudgetMs !== null ? { budgetMs: opts.renderBudgetMs } : {}),
      ...(opts.renderWaitUntil ? { waitUntil: opts.renderWaitUntil } : {}),
    },
    ...(opts.maxChars !== null
      ? {
          fetch: {
            maxChars: opts.maxChars,
          },
        }
      : {}),
  },
});
const healthState = await loadHealthState({ cwd, config });
const plan = planExtractRoute(
  {
    engine: "render",
    urls,
    maxChars: config.fetch.maxChars,
  },
  {
    env,
    config,
    healthState,
  },
);

if (opts.plan) {
  if (opts.json) {
    console.log(
      JSON.stringify(
        buildPlanOutput({
          command: "render",
          plan,
          meta: {
            count: 0,
          },
        }),
        null,
        2,
      ),
    );
  } else {
    console.log(formatPlanMarkdown(plan));
  }
  process.exit(plan.selected ? 0 : 1);
}

try {
  const selected = requireSelectedRoute(plan);
  const cacheKey = buildExtractCacheKey({
    command: "render",
    providerId: selected.provider.id,
    urls,
    maxChars: config.fetch.maxChars,
    render: {
      policy: config.render.policy,
      budgetMs: config.render.budgetMs,
      waitUntil: config.render.waitUntil,
      blockTypes: config.render.blockTypes,
      sameOriginOnly: config.render.sameOriginOnly,
    },
  });
  const cacheRecord = await readCacheRecord("extract", cacheKey, { cwd, config });

  if (cacheRecord) {
    const payload = finalizeCommandOutput(cacheRecord.value, {
      plan,
      includeRouting: opts.explainRouting,
      cache: buildCacheTelemetry("extract", {
        config,
        record: cacheRecord,
      }),
    });
    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(formatExtractMarkdown(payload));
    }
    process.exit(0);
  }

  const providerResult = await selected.provider.adapter.extract(urls, {
    maxChars: config.fetch.maxChars,
    render: config.render,
  });
  await recordProviderSuccess(selected.provider.id, { cwd, config, now: Date.now() });

  const cacheWriteNow = Date.now();
  const cachedPayload = buildExtractOutput({
    command: "render",
    providerResult,
    plan,
    includeRouting: false,
    render: providerResult.render ?? null,
    cache: buildCacheTelemetry("extract", {
      config,
      now: cacheWriteNow,
      ttlSeconds: config.cache.extractTtlSeconds,
    }),
  });
  await writeCacheEntry("extract", cacheKey, cachedPayload, {
    cwd,
    config,
    ttlSeconds: config.cache.extractTtlSeconds,
    now: cacheWriteNow,
  });
  const payload = finalizeCommandOutput(cachedPayload, {
    plan,
    includeRouting: opts.explainRouting,
    cache: buildCacheTelemetry("extract", {
      config,
      now: cacheWriteNow,
      ttlSeconds: config.cache.extractTtlSeconds,
    }),
  });

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatExtractMarkdown(payload));
  }
} catch (error) {
  if (plan.selected) {
    await recordProviderFailure(plan.selected.provider.id, error, {
      cwd,
      config,
      now: Date.now(),
    });
  }
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
