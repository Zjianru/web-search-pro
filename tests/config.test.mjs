import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_CONFIG, loadRuntimeConfig } from "../scripts/lib/config.mjs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "web-search-pro-config-"));
}

test("runtime config merges defaults, config file, env, and overrides by precedence", () => {
  const cwd = makeTempDir();
  const configPath = path.join(cwd, "config.json");

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        routing: {
          disabledProviders: ["serper"],
          fallbackPolicy: "quality-first",
          mergePolicy: "diversity-first",
        },
        render: {
          enabled: false,
          policy: "fallback",
        },
        fetch: {
          timeoutMs: 15000,
        },
        crawl: {
          defaultDepth: 2,
        },
      },
      null,
      2,
    ),
  );

  const { config, meta } = loadRuntimeConfig({
    cwd,
    env: {
      WEB_SEARCH_PRO_FETCH_TIMEOUT_MS: "18000",
      WEB_SEARCH_PRO_ROUTING_ALLOW_NO_KEY_BASELINE: "false",
      WEB_SEARCH_PRO_ROUTING_PREFERRED_PROVIDERS: "exa,serpapi",
      WEB_SEARCH_PRO_ROUTING_ENABLE_FEDERATION: "true",
      WEB_SEARCH_PRO_ROUTING_FEDERATION_TRIGGERS: "news,domain-critical,research,comparison",
      WEB_SEARCH_PRO_ROUTING_MAX_FANOUT_PROVIDERS: "3",
      WEB_SEARCH_PRO_ROUTING_MAX_PER_PROVIDER: "4",
      WEB_SEARCH_PRO_RENDER_ENABLED: "true",
      WEB_SEARCH_PRO_RENDER_POLICY: "force",
      WEB_SEARCH_PRO_RENDER_BUDGET_MS: "9000",
      WEB_SEARCH_PRO_RENDER_WAIT_UNTIL: "networkidle",
      WEB_SEARCH_PRO_RENDER_BLOCK_TYPES: "image,font",
      WEB_SEARCH_PRO_RENDER_SAME_ORIGIN_ONLY: "false",
    },
    overrides: {
      fetch: {
        timeoutMs: 21000,
      },
      crawl: {
        defaultDepth: 3,
      },
    },
  });

  assert.equal(config.fetch.timeoutMs, 21000);
  assert.equal(config.crawl.defaultDepth, 3);
  assert.equal(config.routing.allowNoKeyBaseline, false);
  assert.equal(config.routing.fallbackPolicy, "quality-first");
  assert.equal(config.routing.enableFederation, true);
  assert.deepEqual(config.routing.federationTriggers, [
    "news",
    "domain-critical",
    "research",
    "comparison",
  ]);
  assert.equal(config.routing.maxFanoutProviders, 3);
  assert.equal(config.routing.maxPerProvider, 4);
  assert.equal(config.routing.mergePolicy, "diversity-first");
  assert.equal(config.render.enabled, true);
  assert.equal(config.render.policy, "force");
  assert.equal(config.render.budgetMs, 9000);
  assert.equal(config.render.waitUntil, "networkidle");
  assert.deepEqual(config.render.blockTypes, ["image", "font"]);
  assert.equal(config.render.sameOriginOnly, false);
  assert.deepEqual(config.routing.disabledProviders, ["serper"]);
  assert.deepEqual(config.routing.preferredProviders, ["exa", "serpapi"]);
  assert.equal(meta.path, configPath);
  assert.equal(meta.exists, true);
});

test("runtime config falls back to built-in defaults when no config file exists", () => {
  const cwd = makeTempDir();
  const { config, meta } = loadRuntimeConfig({ cwd, env: {} });

  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.equal(meta.exists, false);
  assert.equal(meta.path, path.join(cwd, "config.json"));
});

test("runtime config rejects invalid values with explicit errors", () => {
  const cwd = makeTempDir();
  const configPath = path.join(cwd, "config.json");

  fs.writeFileSync(
    configPath,
    JSON.stringify({
      routing: {
        fallbackPolicy: "mystery-mode",
        mergePolicy: "chaos-mode",
      },
      render: {
        policy: "warp-speed",
      },
    }),
  );

  assert.throws(
    () => loadRuntimeConfig({ cwd, env: {} }),
    /(fallbackPolicy|mergePolicy|render\.policy)/i,
  );
});
