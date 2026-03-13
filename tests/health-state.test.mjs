import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig } from "../scripts/lib/config.mjs";
import {
  buildHealthSnapshot,
  classifyProviderError,
  recordProviderFailure,
  recordProviderOutcomes,
  recordProviderSuccess,
} from "../scripts/lib/health-state.mjs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "web-search-pro-health-"));
}

test("health classification distinguishes recording from cooldown counting", () => {
  assert.equal(
    classifyProviderError(new Error("Exa search failed (429): rate limited")).countsTowardCooldown,
    true,
  );
  assert.equal(
    classifyProviderError(new Error("Exa search failed (429): rate limited")).recordFailure,
    true,
  );
  assert.equal(
    classifyProviderError(new Error("Serper search failed (500): upstream error"))
      .countsTowardCooldown,
    true,
  );
  assert.equal(
    classifyProviderError(new Error("DuckDuckGo search failed (202): challenge page"))
      .countsTowardCooldown,
    true,
  );
  assert.equal(
    classifyProviderError(new Error("DuckDuckGo search failed (202): challenge page")).category,
    "challenge",
  );
  assert.equal(
    classifyProviderError(new Error("Tavily search failed (400): invalid query")).recordFailure,
    true,
  );
  assert.equal(
    classifyProviderError(new Error("Tavily search failed (400): invalid query"))
      .countsTowardCooldown,
    false,
  );
  assert.equal(
    classifyProviderError(new Error("fetch failed: unable to verify the first certificate"))
      .countsTowardCooldown,
    true,
  );
});

test("health state enters cooldown after repeated retryable failures", async () => {
  const cwd = makeTempDir();
  const { config } = loadRuntimeConfig({
    cwd,
    env: {},
    overrides: {
      health: {
        cooldownSeconds: 60,
        failureThreshold: 2,
      },
    },
  });

  await recordProviderFailure("exa", new Error("Exa search failed (400): invalid query"), {
    cwd,
    config,
    now: 1000,
  });

  let snapshot = await buildHealthSnapshot({ cwd, config, now: 1000 });
  assert.equal(snapshot.providers.exa.consecutiveFailures, 0);
  assert.equal(snapshot.providers.exa.status, "degraded");
  assert.match(snapshot.providers.exa.lastError ?? "", /invalid query/i);
  assert.equal(snapshot.providers.exa.lastCategory, "client");

  await recordProviderFailure("exa", new Error("Exa search failed (429): rate limited"), {
    cwd,
    config,
    now: 2000,
  });
  await recordProviderFailure("exa", new Error("network socket disconnected"), {
    cwd,
    config,
    now: 3000,
  });

  snapshot = await buildHealthSnapshot({ cwd, config, now: 3000 });
  assert.equal(snapshot.providers.exa.consecutiveFailures, 2);
  assert.equal(snapshot.providers.exa.status, "cooldown");
  assert.equal(snapshot.providers.exa.cooldownUntil, 63000);
  assert.equal(snapshot.providers.exa.lastCategory, "network");
});

test("provider success resets consecutive failures and cooldown", async () => {
  const cwd = makeTempDir();
  const { config } = loadRuntimeConfig({
    cwd,
    env: {},
    overrides: {
      health: {
        cooldownSeconds: 60,
        failureThreshold: 2,
      },
    },
  });

  await recordProviderFailure("serper", new Error("Serper search failed (500): upstream"), {
    cwd,
    config,
    now: 1000,
  });
  await recordProviderFailure("serper", new Error("Serper search failed (502): upstream"), {
    cwd,
    config,
    now: 2000,
  });
  await recordProviderSuccess("serper", {
    cwd,
    config,
    now: 3000,
  });

  const snapshot = await buildHealthSnapshot({ cwd, config, now: 3000 });
  assert.equal(snapshot.providers.serper.consecutiveFailures, 0);
  assert.equal(snapshot.providers.serper.cooldownUntil, null);
  assert.equal(snapshot.providers.serper.status, "healthy");
});

test("non-cooldown failures remain visible as degraded health state", async () => {
  const cwd = makeTempDir();
  const { config } = loadRuntimeConfig({
    cwd,
    env: {},
  });

  await recordProviderFailure("ddg", new Error("DuckDuckGo search failed (400): invalid query"), {
    cwd,
    config,
    now: 1000,
  });

  const snapshot = await buildHealthSnapshot({ cwd, config, now: 1000 });
  assert.equal(snapshot.providers.ddg.consecutiveFailures, 0);
  assert.equal(snapshot.providers.ddg.status, "degraded");
  assert.equal(snapshot.providers.ddg.lastFailureAt, 1000);
  assert.match(snapshot.providers.ddg.lastError ?? "", /invalid query/i);
  assert.equal(snapshot.providers.ddg.lastCategory, "client");
});

test("provider outcomes apply success and failure facts for every provider involved", async () => {
  const cwd = makeTempDir();
  const { config } = loadRuntimeConfig({
    cwd,
    env: {},
    overrides: {
      health: {
        cooldownSeconds: 60,
        failureThreshold: 2,
      },
    },
  });

  await recordProviderOutcomes(
    [
      {
        providerId: "serper",
        status: "failure",
        role: "primary",
        error: new Error("Serper search failed (500): upstream unavailable"),
      },
      {
        providerId: "tavily",
        status: "failure",
        role: "fanout",
        error: new Error("Tavily search failed (429): rate limited"),
      },
      {
        providerId: "ddg",
        status: "success",
        role: "fanout",
      },
    ],
    {
      cwd,
      config,
      now: 2000,
    },
  );

  const snapshot = await buildHealthSnapshot({ cwd, config, now: 2000 });
  assert.equal(snapshot.providers.serper.status, "degraded");
  assert.equal(snapshot.providers.tavily.status, "degraded");
  assert.equal(snapshot.providers.ddg.status, "healthy");
  assert.equal(snapshot.providers.ddg.lastSuccessAt, 2000);
});
