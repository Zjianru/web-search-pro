#!/usr/bin/env node

import {
  fail,
  parseDomainList,
  readOptionValue,
  validateDateStr,
} from "./lib/cli-utils.mjs";
import { buildSearchCacheKey, readCacheEntry, writeCacheEntry } from "./lib/cache.mjs";
import { loadRuntimeConfig } from "./lib/config.mjs";
import { executeFederatedSearch } from "./lib/federated-search.mjs";
import {
  loadHealthState,
  recordProviderFailure,
  recordProviderOutcomes,
} from "./lib/health-state.mjs";
import {
  buildPlanOutput,
  buildSearchOutput,
  formatSearchMarkdown,
} from "./lib/output.mjs";
import {
  formatPlanMarkdown,
  planSearchRoute,
  requireSelectedRoute,
  serializePlan,
} from "./lib/planner.mjs";

const SEARCH_ENGINES = new Set(["google", "bing", "baidu", "yandex", "duckduckgo"]);
const ENGINE_NAMES = new Set(["tavily", "exa", "serper", "serpapi", "ddg"]);

function usage(exitCode = 2) {
  console.error(`web-search-pro — Multi-engine AI search with full parameter control

Usage:
  search.mjs "query" [options]

Options:
  --engine <name>           Force engine: tavily|exa|serper|serpapi|ddg (default: auto)
  -n <count>                Number of results (default: 5)
  --deep                    Deep/advanced search mode (Tavily/Exa only)
  --news                    News search mode (Tavily/Serper/SerpAPI only)
  --days <n>                Limit news to last N days (Tavily news only)
  --include-domains <d,...> Only search these domains (comma-separated)
  --exclude-domains <d,...> Exclude these domains (comma-separated)
  --time-range <range>      Time filter: day|week|month|year
  --from <YYYY-MM-DD>       Results published after this date
  --to <YYYY-MM-DD>         Results published before this date
  --search-engine <name>    SerpAPI sub-engine: google|bing|baidu|yandex|duckduckgo
  --country <code>          Country code (e.g., us, cn, de)
  --lang <code>             Language code (e.g., en, zh, de)
  --json                    Output stable JSON schema
  --plan                    Show route plan only (no provider API call)
  --explain-routing         Include route explanation in output

Environment variables:
  WEB_SEARCH_PRO_CONFIG     Optional path to config.json
  TAVILY_API_KEY            Tavily API key
  EXA_API_KEY               Exa API key
  SERPER_API_KEY            Serper API key
  SERPAPI_API_KEY           SerpAPI key`);
  process.exit(exitCode);
}

function validateOptions(options) {
  if (options.engine && !ENGINE_NAMES.has(options.engine)) {
    fail(`Unknown engine: ${options.engine}. Available: tavily, exa, serper, serpapi, ddg`);
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    fail("-n must be a positive integer");
  }
  if (options.days !== null && (!Number.isInteger(options.days) || options.days < 1)) {
    fail("--days must be a positive integer");
  }
  if (options.days !== null && !options.news) {
    fail("--days can only be used with --news");
  }
  if (options.timeRange) {
    const validRanges = new Set(["day", "week", "month", "year"]);
    if (!validRanges.has(options.timeRange)) {
      fail("--time-range must be one of: day, week, month, year");
    }
  }
  if (options.fromDate) {
    validateDateStr(options.fromDate, "--from");
  }
  if (options.toDate) {
    validateDateStr(options.toDate, "--to");
  }
  if (options.fromDate && options.toDate && options.fromDate > options.toDate) {
    fail("--from must be earlier than or equal to --to");
  }
  if (options.searchEngine && !SEARCH_ENGINES.has(options.searchEngine)) {
    fail("--search-engine must be one of: google, bing, baidu, yandex, duckduckgo");
  }
  if (options.searchEngine && options.engine && options.engine !== "serpapi") {
    fail("--search-engine can only be used with --engine serpapi");
  }
  if (
    (options.country || options.lang) &&
    options.engine &&
    !["serper", "serpapi"].includes(options.engine)
  ) {
    fail("--country/--lang can only be used with --engine serper or --engine serpapi");
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
}

const opts = {
  engine: null,
  count: 5,
  deep: false,
  news: false,
  days: null,
  includeDomains: null,
  excludeDomains: null,
  timeRange: null,
  fromDate: null,
  toDate: null,
  searchEngine: null,
  country: null,
  lang: null,
  json: false,
  plan: false,
  explainRouting: false,
};
const positionals = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === "-h" || arg === "--help") {
    usage(0);
  }

  switch (arg) {
    case "--engine":
      opts.engine = readOptionValue(args, i, "--engine");
      i++;
      break;
    case "-n":
      opts.count = Number.parseInt(readOptionValue(args, i, "-n"), 10);
      i++;
      break;
    case "--deep":
      opts.deep = true;
      break;
    case "--news":
      opts.news = true;
      break;
    case "--days":
      opts.days = Number.parseInt(readOptionValue(args, i, "--days"), 10);
      i++;
      break;
    case "--include-domains":
      opts.includeDomains = parseDomainList(
        readOptionValue(args, i, "--include-domains"),
        "--include-domains",
      );
      i++;
      break;
    case "--exclude-domains":
      opts.excludeDomains = parseDomainList(
        readOptionValue(args, i, "--exclude-domains"),
        "--exclude-domains",
      );
      i++;
      break;
    case "--time-range":
      opts.timeRange = readOptionValue(args, i, "--time-range");
      i++;
      break;
    case "--from":
      opts.fromDate = readOptionValue(args, i, "--from");
      i++;
      break;
    case "--to":
      opts.toDate = readOptionValue(args, i, "--to");
      i++;
      break;
    case "--search-engine":
      opts.searchEngine = readOptionValue(args, i, "--search-engine");
      i++;
      break;
    case "--country":
      opts.country = readOptionValue(args, i, "--country");
      i++;
      break;
    case "--lang":
      opts.lang = readOptionValue(args, i, "--lang");
      i++;
      break;
    case "--json":
      opts.json = true;
      break;
    case "--plan":
      opts.plan = true;
      break;
    case "--explain-routing":
      opts.explainRouting = true;
      break;
    default:
      if (arg.startsWith("-")) {
        fail(`Unknown option: ${arg}`);
      }
      positionals.push(arg);
  }
}

const query = positionals.join(" ").trim();
if (!query) {
  fail('Missing query. Usage: search.mjs "query" [options]');
}

validateOptions(opts);

const cwd = process.cwd();
const env = process.env;
const { config } = loadRuntimeConfig({ cwd, env });
const healthState = await loadHealthState({ cwd, config });
const plan = planSearchRoute(
  {
    ...opts,
    query,
    mode: "search",
  },
  {
    env,
    config,
    healthState,
    now: Date.now(),
  },
);

if (opts.plan) {
  if (opts.json) {
    console.log(
      JSON.stringify(
        buildPlanOutput({
          command: "search",
          plan,
          meta: {
            query,
            count: 0,
            answer: null,
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
  const cacheKey = buildSearchCacheKey({
    providerId: selected.provider.id,
    request: {
      ...plan.request,
      query,
    },
    federation: plan.federation,
  });
  const cached = await readCacheEntry("search", cacheKey, { cwd, config });

  if (cached) {
    const payload = opts.explainRouting ? { ...cached, routing: serializePlan(plan) } : cached;
    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(formatSearchMarkdown(payload));
    }
    process.exit(0);
  }

  const execution = await executeFederatedSearch({
    query,
    request: {
      ...plan.request,
      query,
    },
    plan,
    config,
  });

  await recordProviderOutcomes(execution.providerOutcomes ?? [], {
    cwd,
    config,
    now: Date.now(),
  });

  const cachedPayload = buildSearchOutput({
    query,
    providerResult: execution.result,
    plan,
    federation: execution.federation,
    includeRouting: false,
  });
  await writeCacheEntry("search", cacheKey, cachedPayload, {
    cwd,
    config,
    ttlSeconds: config.cache.searchTtlSeconds,
    now: Date.now(),
  });
  const payload = opts.explainRouting
    ? { ...cachedPayload, routing: serializePlan(plan) }
    : cachedPayload;

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatSearchMarkdown(payload));
  }
} catch (error) {
  if (error.providerOutcomes?.length) {
    await recordProviderOutcomes(error.providerOutcomes, {
      cwd,
      config,
      now: Date.now(),
    });
  } else if (plan.selected) {
    await recordProviderFailure(plan.selected.provider.id, error, {
      cwd,
      config,
      now: Date.now(),
    });
  }
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
