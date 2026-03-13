import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../scripts/lib/config.mjs";
import { executeFederatedSearch } from "../scripts/lib/federated-search.mjs";
import { planSearchRoute } from "../scripts/lib/planner.mjs";

function envWith(...keys) {
  return Object.fromEntries(keys.map((key) => [key, `${key}-value`]));
}

function makeConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    routing: {
      ...DEFAULT_CONFIG.routing,
      enableFederation: true,
      federationTriggers: ["news", "ambiguous", "domain-critical", "research", "comparison"],
      maxFanoutProviders: 2,
      maxPerProvider: 3,
      mergePolicy: "balanced",
      ...overrides.routing,
    },
  };
}

test("search plan exposes federation fanout for news queries when enabled", () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      news: true,
      count: 5,
    },
    {
      env: envWith("SERPER_API_KEY", "TAVILY_API_KEY", "SERPAPI_API_KEY"),
      config,
    },
  );

  assert.equal(plan.selected?.provider.id, "serper");
  assert.equal(plan.federation.enabled, true);
  assert.equal(plan.federation.triggered, true);
  assert.equal(plan.federation.fanoutPolicy, "triggered");
  assert.deepEqual(plan.federation.triggerReasons, ["news"]);
  assert.deepEqual(plan.federation.providersPlanned, ["serper", "tavily", "serpapi"]);
});

test("comparison queries trigger federation without widening the selectedProvider contract", () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw vs Firecrawl comparison",
      count: 5,
    },
    {
      env: envWith("TAVILY_API_KEY", "EXA_API_KEY", "SERPAPI_API_KEY"),
      config,
    },
  );

  assert.equal(plan.selected?.provider.id, "tavily");
  assert.equal(plan.federation.triggered, true);
  assert.deepEqual(plan.federation.triggerReasons, ["comparison"]);
  assert.equal(plan.federation.fanoutPolicy, "triggered");
  assert.deepEqual(plan.federation.providersPlanned, ["tavily", "exa", "serpapi"]);
});

test("research-mode searches trigger federation through the request mode rather than query heuristics", () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw docs structure",
      mode: "research",
      count: 5,
    },
    {
      env: envWith("TAVILY_API_KEY", "EXA_API_KEY"),
      config,
    },
  );

  assert.equal(plan.selected?.provider.id, "tavily");
  assert.equal(plan.federation.triggered, true);
  assert.deepEqual(plan.federation.triggerReasons, ["research"]);
  assert.deepEqual(plan.federation.providersPlanned, ["tavily", "exa"]);
});

test("explicit engine keeps federation disabled even when triggers match", () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      news: true,
      engine: "serper",
      count: 5,
    },
    {
      env: envWith("SERPER_API_KEY", "TAVILY_API_KEY"),
      config,
    },
  );

  assert.equal(plan.selected?.provider.id, "serper");
  assert.equal(plan.federation.triggered, false);
  assert.match(plan.federation.reason ?? "", /explicit --engine/i);
});

test("federated execution merges, deduplicates, and reranks provider results", async () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      news: true,
      count: 3,
    },
    {
      env: envWith("SERPER_API_KEY", "TAVILY_API_KEY", "SERPAPI_API_KEY"),
      config,
    },
  );

  const providerExecutors = {
    serper: async () => ({
      engine: "serper",
      answer: null,
      results: [
        {
          title: "Primary result",
          url: "https://example.com/story",
          content: "Primary provider coverage",
          date: "2026-03-13",
        },
        {
          title: "Primary docs",
          url: "https://docs.example.com/openclaw",
          content: "Docs coverage",
        },
      ],
    }),
    tavily: async () => ({
      engine: "tavily",
      answer: "Primary synthesized answer",
      results: [
        {
          title: "Duplicate from Tavily",
          url: "https://example.com/story?utm_source=test",
          content: "Duplicate coverage with alternate query params",
          score: 0.8,
        },
        {
          title: "Secondary unique result",
          url: "https://blog.example.org/openclaw-news",
          content: "Secondary provider result",
          publishedDate: "2026-03-12T00:00:00.000Z",
        },
      ],
    }),
    serpapi: async () => {
      throw new Error("SerpAPI search failed (500): upstream unavailable");
    },
  };

  const execution = await executeFederatedSearch({
    query: "OpenClaw latest news",
    request: plan.request,
    plan,
    config,
    providerExecutors,
  });

  assert.equal(execution.providersUsed.length, 2);
  assert.deepEqual(execution.providersUsed, ["serper", "tavily"]);
  assert.equal(execution.failedProviders.length, 1);
  assert.equal(execution.failedProviders[0].providerId, "serpapi");
  assert.equal(execution.result.answer, "Primary synthesized answer");
  assert.equal(execution.result.results.length, 3);
  assert.equal(execution.result.results[0].url, "https://example.com/story");
  assert.equal(execution.result.results[0].sourceType, "federated");
  assert.equal(execution.federation.fanoutPolicy, "triggered");
  assert.deepEqual(execution.federation.resultStats, {
    rawResultCount: 4,
    dedupedResultCount: 3,
    providerHitCounts: {
      serper: 2,
      tavily: 2,
    },
  });
  assert.deepEqual(execution.federation.mergeSummary, {
    dedupedUrls: 1,
    nearDuplicateDrops: 0,
    reranked: true,
    answerProvider: "tavily",
  });
});

test("federated execution can recover when the primary provider fails but a fanout succeeds", async () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      news: true,
      count: 2,
    },
    {
      env: envWith("SERPER_API_KEY", "TAVILY_API_KEY"),
      config,
    },
  );

  const execution = await executeFederatedSearch({
    query: "OpenClaw latest news",
    request: plan.request,
    plan,
    config,
    providerExecutors: {
      serper: async () => {
        throw new Error("Serper search failed (500): upstream unavailable");
      },
      tavily: async () => ({
        engine: "tavily",
        answer: "Recovered answer",
        results: [
          {
            title: "Recovered result",
            url: "https://example.com/recovered",
            content: "Recovered content",
          },
        ],
      }),
    },
  });

  assert.equal(execution.primarySucceeded, false);
  assert.deepEqual(execution.providersUsed, ["tavily"]);
  assert.equal(execution.result.results.length, 1);
  assert.equal(execution.failedProviders[0].providerId, "serper");
  assert.equal(execution.federation.mergeSummary.answerProvider, "tavily");
});

test("federated execution preserves structured provider outcomes when every provider fails", async () => {
  const config = makeConfig();
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      news: true,
      count: 2,
    },
    {
      env: envWith("SERPER_API_KEY", "TAVILY_API_KEY"),
      config,
    },
  );

  await assert.rejects(
    () =>
      executeFederatedSearch({
        query: "OpenClaw latest news",
        request: plan.request,
        plan,
        config,
        providerExecutors: {
          serper: async () => {
            throw new Error("Serper search failed (500): upstream unavailable");
          },
          tavily: async () => {
            throw new Error("Tavily search failed (429): rate limited");
          },
        },
      }),
    (error) => {
      assert.equal(error.failedProviders.length, 2);
      assert.equal(error.providerOutcomes.length, 2);
      assert.deepEqual(
        error.providerOutcomes.map((entry) => ({
          providerId: entry.providerId,
          status: entry.status,
          role: entry.role,
        })),
        [
          { providerId: "serper", status: "failure", role: "primary" },
          { providerId: "tavily", status: "failure", role: "fanout" },
        ],
      );
      return true;
    },
  );
});

test("diversity-first merge policy lets a complementary fanout outrank the primary when quality is close", async () => {
  const config = makeConfig({
    routing: {
      mergePolicy: "diversity-first",
    },
  });
  const plan = planSearchRoute(
    {
      query: "OpenClaw vs Firecrawl comparison",
      count: 2,
    },
    {
      env: envWith("TAVILY_API_KEY", "SERPAPI_API_KEY"),
      config,
    },
  );

  const execution = await executeFederatedSearch({
    query: "OpenClaw vs Firecrawl comparison",
    request: plan.request,
    plan,
    config,
    providerExecutors: {
      tavily: async () => ({
        engine: "tavily",
        answer: null,
        results: [
          {
            title: "Comparison overview",
            url: "https://example.com/overview",
            content: "A concise comparison overview.",
            score: 0.79,
          },
        ],
      }),
      serpapi: async () => ({
        engine: "serpapi",
        answer: null,
        results: [
          {
            title: "Comparison overview",
            url: "https://another.example.com/overview",
            content: "A much richer comparison overview with more details and context for a diverse second source.",
            score: 0.78,
          },
        ],
      }),
    },
  });

  assert.equal(execution.result.results[0].providerId, "serpapi");
  assert.equal(execution.federation.mergePolicy, "diversity-first");
});
