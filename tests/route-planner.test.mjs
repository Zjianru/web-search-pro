import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../scripts/lib/config.mjs";
import { planExtractRoute, planSearchRoute } from "../scripts/lib/planner.mjs";

function envWith(...keys) {
  return Object.fromEntries(keys.map((key) => [key, `${key}-value`]));
}

test("news routing prefers Serper when available", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      mode: "search",
      news: true,
      count: 5,
    },
    { env: envWith("SERPER_API_KEY", "TAVILY_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "serper");
  assert.match(plan.selected?.summary ?? "", /preferred for news/i);
});

test("basic search falls back to ddg when no provider keys exist", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw web search",
      mode: "search",
      count: 5,
    },
    { env: {} },
  );

  assert.equal(plan.selected?.provider.id, "ddg");
  assert.match(plan.selected?.summary ?? "", /no-key/i);
});

test("news plus days requires Tavily and reports missing credentials clearly", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      mode: "search",
      news: true,
      days: 7,
      count: 5,
    },
    { env: envWith("SERPER_API_KEY") },
  );

  assert.equal(plan.selected, null);
  assert.match(plan.error?.message ?? "", /requires TAVILY_API_KEY/i);
});

test("deep search falls back to Exa when Tavily is unavailable", () => {
  const plan = planSearchRoute(
    {
      query: "vector database benchmarks",
      mode: "search",
      deep: true,
      count: 5,
    },
    { env: envWith("EXA_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "exa");
  assert.match(plan.selected?.summary ?? "", /supports deep search/i);
});

test("Baidu routing is pinned to SerpAPI", () => {
  const plan = planSearchRoute(
    {
      query: "开源技能平台",
      mode: "search",
      searchEngine: "baidu",
      count: 5,
    },
    { env: envWith("SERPAPI_API_KEY", "TAVILY_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "serpapi");
  assert.match(plan.selected?.summary ?? "", /sub-engine/i);
});

test("non-google SerpAPI sub-engines reject news mode explicitly", () => {
  const plan = planSearchRoute(
    {
      query: "开源技能平台",
      mode: "search",
      searchEngine: "baidu",
      news: true,
      count: 5,
    },
    { env: envWith("SERPAPI_API_KEY") },
  );

  assert.equal(plan.selected, null);
  assert.match(plan.error?.message ?? "", /news mode only works with the google sub-engine/i);
});

test("domain filtering prefers native providers over query-operator providers", () => {
  const plan = planSearchRoute(
    {
      query: "agent skills",
      mode: "search",
      includeDomains: ["github.com"],
      count: 5,
    },
    { env: envWith("EXA_API_KEY", "SERPER_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "exa");
  assert.match(plan.selected?.summary ?? "", /native domain filtering/i);
});

test("extract routing prefers Tavily and falls back to Exa", () => {
  const preferred = planExtractRoute(
    {
      urls: ["https://example.com/article"],
    },
    { env: envWith("TAVILY_API_KEY", "EXA_API_KEY") },
  );
  assert.equal(preferred.selected?.provider.id, "tavily");

  const fallback = planExtractRoute(
    {
      urls: ["https://example.com/article"],
    },
    { env: envWith("EXA_API_KEY") },
  );
  assert.equal(fallback.selected?.provider.id, "exa");
});

test("extract falls back to safe fetch when no provider keys exist", () => {
  const plan = planExtractRoute(
    {
      urls: ["https://example.com/article"],
    },
    { env: {} },
  );

  assert.equal(plan.selected?.provider.id, "fetch");
  assert.match(plan.selected?.summary ?? "", /no-key/i);
});

test("extract plan exposes browser render as an explicit fallback lane", () => {
  const plan = planExtractRoute(
    {
      urls: ["https://example.com/article"],
    },
    {
      env: {},
      runtimeAvailability: {
        render: true,
      },
      config: {
        ...DEFAULT_CONFIG,
        render: {
          ...DEFAULT_CONFIG.render,
          enabled: true,
          policy: "fallback",
        },
      },
    },
  );

  assert.equal(plan.selected?.provider.id, "fetch");
  assert.equal(plan.render.enabled, true);
  assert.equal(plan.render.policy, "fallback");
  assert.equal(plan.render.provider?.id, "render");
  assert.equal(plan.render.runtimeAvailable, true);
});

test("force render policy selects the browser render lane directly", () => {
  const plan = planExtractRoute(
    {
      urls: ["https://example.com/article"],
    },
    {
      env: {},
      runtimeAvailability: {
        render: true,
      },
      config: {
        ...DEFAULT_CONFIG,
        render: {
          ...DEFAULT_CONFIG.render,
          enabled: true,
          policy: "force",
        },
      },
    },
  );

  assert.equal(plan.selected?.provider.id, "render");
  assert.match(plan.selected?.summary ?? "", /browser render/i);
});

test("routing can disable the no-key baseline explicitly", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw web search",
      mode: "search",
      count: 5,
    },
    {
      env: {},
      config: {
        ...DEFAULT_CONFIG,
        routing: {
          ...DEFAULT_CONFIG.routing,
          allowNoKeyBaseline: false,
        },
      },
    },
  );

  assert.equal(plan.selected, null);
  assert.match(plan.error?.message ?? "", /No search engine configured/i);
});

test("preferred and disabled providers influence routing without bypassing capability checks", () => {
  const preferredPlan = planSearchRoute(
    {
      query: "OpenClaw routing",
      mode: "search",
      count: 5,
    },
    {
      env: envWith("EXA_API_KEY", "SERPAPI_API_KEY"),
      config: {
        ...DEFAULT_CONFIG,
        routing: {
          ...DEFAULT_CONFIG.routing,
          preferredProviders: ["serpapi"],
        },
      },
    },
  );
  assert.equal(preferredPlan.selected?.provider.id, "serpapi");

  const disabledPlan = planSearchRoute(
    {
      query: "agent evaluation",
      mode: "search",
      deep: true,
      count: 5,
    },
    {
      env: envWith("TAVILY_API_KEY", "EXA_API_KEY"),
      config: {
        ...DEFAULT_CONFIG,
        routing: {
          ...DEFAULT_CONFIG.routing,
          disabledProviders: ["tavily"],
        },
      },
    },
  );
  assert.equal(disabledPlan.selected?.provider.id, "exa");
});

test("health cooldown lowers provider priority when alternatives exist", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      mode: "search",
      news: true,
      count: 5,
    },
    {
      env: envWith("SERPER_API_KEY", "TAVILY_API_KEY"),
      config: DEFAULT_CONFIG,
      now: 10_000,
      healthState: {
        providers: {
          serper: {
            consecutiveFailures: 3,
            cooldownUntil: 70_000,
          },
        },
      },
    },
  );

  assert.equal(plan.selected?.provider.id, "tavily");
  assert.match(plan.candidates[1]?.summary ?? "", /cooldown/i);
});
