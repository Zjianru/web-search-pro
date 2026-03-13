import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig } from "../scripts/lib/config.mjs";
import { recordProviderFailure } from "../scripts/lib/health-state.mjs";

const ROOT = process.cwd();

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "web-search-pro-cli-"));
}

function runScript(scriptPath, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, scriptPath), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("capabilities command exposes provider capability matrix as JSON", () => {
  const result = runScript("scripts/capabilities.mjs", ["--json"]);
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.command, "capabilities");
  assert.equal(payload.providers.length, 7);
  assert.equal(payload.providers[0].id, "tavily");
  assert.equal(payload.providers[0].env[0].required, false);
  assert.equal(payload.providers.at(-1).id, "render");
});

test("doctor command reports configured providers and available features", () => {
  const cwd = makeTempDir();
  const configPath = path.join(cwd, "config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        cache: {
          dir: path.join(cwd, ".cache-cli"),
        },
      },
      null,
      2,
    ),
  );

  const result = runScript("scripts/doctor.mjs", ["--json"], {
    WEB_SEARCH_PRO_CONFIG: configPath,
    EXA_API_KEY: "exa-key",
    SERPER_API_KEY: "serper-key",
  });
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.command, "doctor");
  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.credentialedProviders, ["exa", "serper"]);
  assert.deepEqual(payload.configuredProviders, ["exa", "serper", "ddg", "fetch"]);
  assert.equal(payload.availableFeatures.deepSearch, true);
  assert.equal(payload.availableFeatures.newsSearch, true);
  assert.equal(payload.availableFeatures.extract, true);
  assert.equal(payload.cache.enabled, true);
  assert.equal(payload.renderLane.policy, "fallback");
  assert.ok(Array.isArray(payload.renderLane.blockTypes));
});

test("doctor reports a ready no-key baseline when no credentials exist", () => {
  const cwd = makeTempDir();
  const configPath = path.join(cwd, "config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        cache: {
          dir: path.join(cwd, ".cache-cli"),
        },
      },
      null,
      2,
    ),
  );

  const result = runScript("scripts/doctor.mjs", ["--json"], {
    WEB_SEARCH_PRO_CONFIG: configPath,
  });
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.configuredProviders, ["ddg", "fetch"]);
  assert.equal(payload.availableFeatures.search, true);
  assert.equal(payload.availableFeatures.extract, true);
  assert.equal(payload.availableFeatures.deepSearch, false);
  assert.equal(payload.safeFetch.blockBinaryDownloads, true);
});

test("search plan mode explains routing without calling a provider API", () => {
  const result = runScript(
    "scripts/search.mjs",
    ["OpenClaw router", "--deep", "--plan", "--json"],
    {
      EXA_API_KEY: "exa-key",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, "1.0");
  assert.equal(payload.command, "search");
  assert.equal(payload.selectedProvider, "exa");
  assert.equal(payload.routing.selected.provider.id, "exa");
  assert.deepEqual(payload.results, []);
});

test("search plan mode exposes federation when enabled in config", () => {
  const cwd = makeTempDir();
  const configPath = path.join(cwd, "config.json");

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        routing: {
          enableFederation: true,
          federationTriggers: ["news"],
          maxFanoutProviders: 2,
          maxPerProvider: 3,
          mergePolicy: "balanced"
        }
      },
      null,
      2,
    ),
  );

  const result = runScript(
    "scripts/search.mjs",
    ["OpenClaw latest news", "--news", "--plan", "--json"],
    {
      WEB_SEARCH_PRO_CONFIG: configPath,
      SERPER_API_KEY: "serper-key",
      TAVILY_API_KEY: "tavily-key",
      SERPAPI_API_KEY: "serpapi-key",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.routing.federation.enabled, true);
  assert.equal(payload.routing.federation.triggered, true);
  assert.equal(payload.routing.federation.fanoutPolicy, "triggered");
  assert.deepEqual(payload.routing.federation.triggerReasons, ["news"]);
  assert.deepEqual(payload.routing.federation.providersPlanned, ["serper", "tavily", "serpapi"]);
});

test("search rejects unknown engines before planning", () => {
  const result = runScript("scripts/search.mjs", ["OpenClaw router", "--engine", "unknown"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown engine/i);
});

test("crawl rejects unsafe local targets", () => {
  const result = runScript("scripts/crawl.mjs", ["http://localhost", "--json"]);
  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, "1.0");
  assert.equal(payload.command, "crawl");
  assert.equal(payload.results.length, 0);
  assert.match(payload.failed[0].error, /not allowed/i);
});

test("map rejects unsafe local targets with stable JSON schema", () => {
  const result = runScript("scripts/map.mjs", ["http://localhost", "--json"]);
  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, "1.0");
  assert.equal(payload.command, "map");
  assert.deepEqual(payload.nodes, []);
  assert.match(payload.failed[0].error, /not allowed/i);
});

test("review, cache, and health commands expose JSON reports", () => {
  const cwd = makeTempDir();
  const configPath = path.join(cwd, "config.json");

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        cache: {
          dir: ".cache-cli",
        },
      },
      null,
      2,
    ),
  );

  const env = {
    WEB_SEARCH_PRO_CONFIG: configPath,
  };

  const review = runScript("scripts/review.mjs", ["--json"], env);
  assert.equal(review.status, 0, review.stderr);
  const reviewPayload = JSON.parse(review.stdout);
  assert.equal(reviewPayload.command, "review");
  assert.equal(reviewPayload.renderLane.policy, "fallback");
  assert.equal(reviewPayload.federation.enabled, false);
  assert.deepEqual(reviewPayload.federation.triggers, [
    "news",
    "ambiguous",
    "domain-critical",
    "research",
    "comparison",
  ]);

  const cache = runScript("scripts/cache.mjs", ["stats", "--json"], env);
  assert.equal(cache.status, 0, cache.stderr);
  assert.equal(JSON.parse(cache.stdout).command, "cache");

  const health = runScript("scripts/health.mjs", ["--json"], env);
  assert.equal(health.status, 0, health.stderr);
  assert.equal(JSON.parse(health.stdout).command, "health");
});

test("doctor and review expose degraded no-key baseline providers", async () => {
  const cwd = makeTempDir();
  const cacheDir = path.join(cwd, ".cache-cli");
  const configPath = path.join(cwd, "config.json");

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        cache: {
          dir: cacheDir,
        },
      },
      null,
      2,
    ),
  );

  const env = {
    WEB_SEARCH_PRO_CONFIG: configPath,
  };
  const { config } = loadRuntimeConfig({ cwd: ROOT, env });
  await recordProviderFailure("ddg", new Error("DuckDuckGo search failed (202): challenge page"), {
    cwd: ROOT,
    config,
    now: 1000,
  });

  const doctor = runScript("scripts/doctor.mjs", ["--json"], env);
  assert.equal(doctor.status, 0, doctor.stderr);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.status, "degraded");
  assert.deepEqual(doctorPayload.degradedProviders, ["ddg"]);
  assert.equal(doctorPayload.baselineStatus, "degraded");

  const review = runScript("scripts/review.mjs", ["--json"], env);
  assert.equal(review.status, 0, review.stderr);
  const reviewPayload = JSON.parse(review.stdout);
  assert.equal(reviewPayload.noKeyBaseline.status, "degraded");
  assert.deepEqual(reviewPayload.degradedProviders, ["ddg"]);
});

test("eval command lists bundled cases and inventory summary as JSON", () => {
  const list = runScript("scripts/eval.mjs", ["list", "--json"]);
  assert.equal(list.status, 0, list.stderr);
  const listPayload = JSON.parse(list.stdout);
  assert.equal(listPayload.command, "eval");
  assert.equal(listPayload.action, "list");
  assert.ok(listPayload.cases.length >= 10);

  const summary = runScript("scripts/eval.mjs", ["summary", "--json"]);
  assert.equal(summary.status, 0, summary.stderr);
  const summaryPayload = JSON.parse(summary.stdout);
  assert.equal(summaryPayload.command, "eval");
  assert.equal(summaryPayload.action, "summary");
  assert.ok(summaryPayload.totalCases >= 10);
});
