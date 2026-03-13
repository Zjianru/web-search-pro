import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../scripts/lib/config.mjs";
import { executeExtractFlow } from "../scripts/lib/extract-flow.mjs";

function makeProvider(id) {
  return {
    id,
    label: id,
    capabilities: {
      extract: true,
    },
    adapter: {
      extract: async () => {
        throw new Error(`Unexpected extract invocation for ${id}`);
      },
    },
  };
}

function makePlan() {
  return {
    selected: {
      provider: makeProvider("tavily"),
    },
    candidates: [
      {
        status: "selected",
        provider: makeProvider("tavily"),
      },
      {
        status: "candidate",
        provider: makeProvider("exa"),
      },
      {
        status: "candidate",
        provider: makeProvider("fetch"),
      },
    ],
    render: {
      enabled: true,
      policy: "fallback",
      fallbackAvailable: true,
      provider: makeProvider("render"),
      waitUntil: DEFAULT_CONFIG.render.waitUntil,
      budgetMs: DEFAULT_CONFIG.render.budgetMs,
      blockTypes: DEFAULT_CONFIG.render.blockTypes,
      sameOriginOnly: DEFAULT_CONFIG.render.sameOriginOnly,
    },
  };
}

test("extract flow falls back to the next extract provider when the primary provider throws", async () => {
  const execution = await executeExtractFlow({
    urls: ["https://example.com"],
    plan: makePlan(),
    config: DEFAULT_CONFIG,
    providerExecutors: {
      tavily: async () => {
        throw new Error("Tavily extract failed");
      },
      exa: async (urls) => ({
        engine: "exa",
        results: [
          {
            url: urls[0],
            title: "Recovered by Exa",
            content: "Readable content from Exa",
            contentType: "text/plain",
          },
        ],
        failed: [],
      }),
      render: async () => {
        throw new Error("Render should not be needed after Exa succeeds");
      },
    },
  });

  assert.equal(execution.providerResult.engine, "exa");
  assert.equal(execution.providerResult.results.length, 1);
  assert.equal(execution.providerResult.failed.length, 0);
  assert.deepEqual(
    execution.outcomes.map((entry) => ({
      providerId: entry.providerId,
      status: entry.status,
    })),
    [
      { providerId: "tavily", status: "failure" },
      { providerId: "exa", status: "success" },
    ],
  );
});

test("extract flow uses render only after extract providers leave unresolved urls", async () => {
  const execution = await executeExtractFlow({
    urls: ["https://example.com"],
    plan: makePlan(),
    config: DEFAULT_CONFIG,
    providerExecutors: {
      tavily: async (urls) => ({
        engine: "tavily",
        results: [],
        failed: urls.map((url) => ({ url, error: "Primary provider empty" })),
      }),
      exa: async (urls) => ({
        engine: "exa",
        results: [],
        failed: urls.map((url) => ({ url, error: "Secondary provider empty" })),
      }),
      fetch: async (urls) => ({
        engine: "fetch",
        results: [],
        failed: urls.map((url) => ({ url, error: "Fetch fallback empty" })),
      }),
      render: async (urls) => ({
        engine: "render",
        results: [
          {
            url: urls[0],
            title: "Rendered fallback",
            content: "Rendered fallback content",
            contentType: "text/html",
          },
        ],
        failed: [],
        render: {
          browserFamily: "google-chrome",
          browserPath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          timedOut: false,
        },
      }),
    },
  });

  assert.equal(execution.providerResult.engine, "render");
  assert.equal(execution.providerResult.results.length, 1);
  assert.equal(execution.providerResult.failed.length, 0);
  assert.equal(execution.providerResult.render?.used, true);
  assert.deepEqual(
    execution.outcomes.map((entry) => ({
      providerId: entry.providerId,
      status: entry.status,
    })),
    [
      { providerId: "tavily", status: "success" },
      { providerId: "exa", status: "success" },
      { providerId: "fetch", status: "success" },
      { providerId: "render", status: "success" },
    ],
  );
});
