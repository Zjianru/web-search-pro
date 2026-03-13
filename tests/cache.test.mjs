import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig } from "../scripts/lib/config.mjs";
import {
  buildCrawlCacheKey,
  buildSearchCacheKey,
  clearCache,
  getCacheStats,
  readCacheEntry,
  writeCacheEntry,
} from "../scripts/lib/cache.mjs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "web-search-pro-cache-"));
}

test("search cache entries round-trip and expire by TTL", async () => {
  const cwd = makeTempDir();
  const { config } = loadRuntimeConfig({
    cwd,
    env: {},
    overrides: {
      cache: {
        dir: ".cache-test",
        searchTtlSeconds: 1,
      },
    },
  });

  const key = buildSearchCacheKey({
    providerId: "ddg",
    request: {
      query: "OpenClaw routing",
      count: 5,
      includeDomains: ["github.com"],
    },
  });

  const payload = {
    schemaVersion: "1.0",
    command: "search",
    selectedProvider: "ddg",
    results: [{ title: "Result" }],
    failed: [],
    meta: { query: "OpenClaw routing", count: 1, answer: null },
  };

  await writeCacheEntry("search", key, payload, {
    cwd,
    config,
    ttlSeconds: config.cache.searchTtlSeconds,
    now: 1000,
  });

  const hit = await readCacheEntry("search", key, {
    cwd,
    config,
    now: 1500,
  });
  assert.deepEqual(hit, payload);

  const expired = await readCacheEntry("search", key, {
    cwd,
    config,
    now: 2200,
  });
  assert.equal(expired, null);
});

test("cache stats and clear operate on stored entries", async () => {
  const cwd = makeTempDir();
  const { config } = loadRuntimeConfig({
    cwd,
    env: {},
    overrides: {
      cache: {
        dir: ".cache-test",
      },
    },
  });

  await writeCacheEntry(
    "search",
    buildSearchCacheKey({
      providerId: "ddg",
      request: {
        query: "OpenClaw",
        count: 5,
      },
    }),
    { value: "search" },
    {
      cwd,
      config,
      ttlSeconds: config.cache.searchTtlSeconds,
      now: 1000,
    },
  );

  await writeCacheEntry(
    "crawl",
    buildCrawlCacheKey({
      entryUrls: ["https://example.com"],
      depth: 2,
      maxPages: 10,
      sameOrigin: true,
      includePathPrefixes: ["/docs"],
      excludePathPrefixes: [],
    }),
    { value: "crawl" },
    {
      cwd,
      config,
      ttlSeconds: config.cache.crawlTtlSeconds,
      now: 1000,
    },
  );

  const stats = await getCacheStats({ cwd, config, now: 1000 });
  assert.equal(stats.enabled, true);
  assert.equal(stats.entries, 2);
  assert.ok(stats.bytes > 0);

  const cleared = await clearCache({ cwd, config });
  assert.equal(cleared.removedEntries, 2);

  const afterClear = await getCacheStats({ cwd, config, now: 1000 });
  assert.equal(afterClear.entries, 0);
});

test("search cache keys separate federation trigger reasons and fanout policy", () => {
  const baseInput = {
    providerId: "serper",
    request: {
      query: "OpenClaw comparison",
      count: 5,
    },
  };

  const keyWithComparison = buildSearchCacheKey({
    ...baseInput,
    federation: {
      triggered: true,
      mergePolicy: "balanced",
      providersPlanned: ["serper", "tavily"],
      maxPerProvider: 3,
      triggerReasons: ["comparison"],
      fanoutPolicy: "triggered",
    },
  });
  const keyWithResearch = buildSearchCacheKey({
    ...baseInput,
    federation: {
      triggered: true,
      mergePolicy: "balanced",
      providersPlanned: ["serper", "tavily"],
      maxPerProvider: 3,
      triggerReasons: ["research"],
      fanoutPolicy: "triggered",
    },
  });
  const keyPrimaryOnly = buildSearchCacheKey({
    ...baseInput,
    federation: {
      triggered: true,
      mergePolicy: "balanced",
      providersPlanned: ["serper", "tavily"],
      maxPerProvider: 3,
      triggerReasons: ["comparison"],
      fanoutPolicy: "explicit-primary-only",
    },
  });

  assert.notEqual(keyWithComparison, keyWithResearch);
  assert.notEqual(keyWithComparison, keyPrimaryOnly);
});
