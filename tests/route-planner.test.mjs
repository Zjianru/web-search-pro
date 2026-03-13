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
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "freshness"),
    true,
  );
});

test("searchType news maps into news-capable routing", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      mode: "search",
      searchType: "news",
      count: 5,
    },
    { env: envWith("SERPER_API_KEY", "TAVILY_API_KEY") },
  );

  assert.equal(plan.request.searchType, "news");
  assert.equal(plan.request.news, true);
  assert.equal(plan.selected?.provider.id, "serper");
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
  assert.equal(plan.selected?.selectionMode, "hard-requirement");
  assert.equal(plan.diagnostics?.limitedByAvailability, false);
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

test("question-style queries can prefer the answer-first provider", () => {
  const plan = planSearchRoute(
    {
      query: "What is OpenClaw routing?",
      mode: "search",
      count: 5,
    },
    { env: envWith("PERPLEXITY_API_KEY", "SERPER_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "perplexity");
  assert.match(plan.selected?.summary ?? "", /direct answer/i);
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(plan.selected?.confidenceLevel, "high");
  assert.equal(typeof plan.selected?.confidence, "number");
  assert.equal((plan.selected?.confidence ?? 0) > 0.6, true);
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "direct-answer"),
    true,
  );
  assert.equal(
    plan.diagnostics?.signalMatches?.some((signal) => signal.category === "direct-answer"),
    true,
  );
});

test("native Perplexity can satisfy date-range requests", () => {
  const plan = planSearchRoute(
    {
      query: "What changed in the Responses API recently?",
      mode: "search",
      fromDate: "2026-03-01",
      toDate: "2026-03-13",
      count: 5,
    },
    { env: envWith("PERPLEXITY_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "perplexity");
  assert.equal(plan.error, null);
  assert.equal(plan.selected?.provider.capabilities.dateRange, true);
  assert.equal(plan.selected?.provider.capabilities.timeRange, true);
});

test("privacy-oriented queries can prefer SearXNG when configured", () => {
  const plan = planSearchRoute(
    {
      query: "private meta search without tracking",
      mode: "search",
      count: 5,
    },
    { env: envWith("SEARXNG_INSTANCE_URL", "SERPER_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "searxng");
  assert.match(plan.selected?.summary ?? "", /privacy/i);
});

test("summary-oriented current queries can prefer You.com", () => {
  const plan = planSearchRoute(
    {
      query: "summarize current AI regulation updates",
      mode: "search",
      count: 5,
    },
    { env: envWith("YOU_API_KEY", "SERPER_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "you");
  assert.match(plan.selected?.summary ?? "", /LLM-ready|summary-oriented/i);
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "freshness"),
    true,
  );
});

test("multilingual comparison queries can prefer Querit when configured", () => {
  const plan = planSearchRoute(
    {
      query: "比较 多语言 AI 搜索 引擎",
      mode: "search",
      count: 5,
    },
    { env: envWith("QUERIT_API_KEY", "SERPER_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "querit");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "multilingual"),
    true,
  );
});

test("docs preset biases routing toward docs-capable providers without forcing the engine", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw routing reference",
      mode: "search",
      intentPreset: "docs",
      count: 5,
    },
    { env: envWith("EXA_API_KEY", "SERPER_API_KEY") },
  );

  assert.equal(plan.request.intentPreset, "docs");
  assert.equal(plan.selected?.provider.id, "exa");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.diagnostics?.signalMatches?.some((signal) => signal.category === "docs"),
    true,
  );
});

test("code preset can bias routing toward provider coverage useful for implementation lookups", () => {
  const plan = planSearchRoute(
    {
      query: "React useEffectEvent examples",
      mode: "search",
      intentPreset: "code",
      count: 5,
    },
    { env: envWith("EXA_API_KEY", "BRAVE_API_KEY") },
  );

  assert.equal(plan.request.intentPreset, "code");
  assert.equal(plan.selected?.provider.id, "exa");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "code"),
    true,
  );
});

test("discovery-style queries can prefer Brave when configured", () => {
  const plan = planSearchRoute(
    {
      query: "best open source agent tools",
      mode: "search",
      count: 5,
    },
    { env: envWith("BRAVE_API_KEY", "SERPAPI_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "brave");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "discovery"),
    true,
  );
});

test("explicit engine selection is marked as an explicit route", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw routing",
      mode: "search",
      engine: "serpapi",
      count: 5,
    },
    { env: envWith("SERPAPI_API_KEY", "EXA_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "serpapi");
  assert.equal(plan.selected?.selectionMode, "explicit");
  assert.equal(plan.selected?.confidenceLevel, "high");
});

test("news plus days is classified as a hard-requirement route", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw latest news",
      mode: "search",
      news: true,
      days: 7,
      count: 5,
    },
    { env: envWith("TAVILY_API_KEY", "SERPER_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "tavily");
  assert.equal(plan.selected?.selectionMode, "hard-requirement");
  assert.equal(plan.selected?.confidenceLevel, "high");
});

test("news requests still use freshness signals after filtering eligible providers", () => {
  const plan = planSearchRoute(
    {
      query: "latest AI news summary",
      mode: "search",
      news: true,
      count: 5,
    },
    { env: envWith("TAVILY_API_KEY", "SERPER_API_KEY", "YOU_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "you");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "freshness"),
    true,
  );
});

test("locale-constrained multilingual queries still use query signals after filtering", () => {
  const plan = planSearchRoute(
    {
      query: "最新 AI 搜索路由 评测",
      mode: "search",
      lang: "zh",
      count: 5,
    },
    { env: envWith("QUERIT_API_KEY", "SERPER_API_KEY", "BRAVE_API_KEY", "YOU_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "querit");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "multilingual"),
    true,
  );
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
  assert.equal(plan.selected?.selectionMode, "fallback");
  assert.equal(plan.diagnostics?.healthAdjusted, true);
});

test("availability-only fallback is reported honestly for the no-key baseline", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw web search",
      mode: "search",
      count: 5,
    },
    { env: {} },
  );

  assert.equal(plan.selected?.provider.id, "ddg");
  assert.equal(plan.selected?.selectionMode, "availability-only");
  assert.equal(plan.selected?.confidenceLevel, "low");
  assert.equal(plan.diagnostics?.limitedByAvailability, true);
  assert.deepEqual(plan.selected?.topSignals ?? [], []);
});

test("current-change questions favor answer-first providers even with premium search providers configured", () => {
  const plan = planSearchRoute(
    {
      query: "What changed in the OpenAI Responses API recently?",
      mode: "search",
      count: 5,
    },
    {
      env: envWith(
        "TAVILY_API_KEY",
        "EXA_API_KEY",
        "QUERIT_API_KEY",
        "SERPER_API_KEY",
        "YOU_API_KEY",
        "PERPLEXITY_API_KEY",
      ),
    },
  );

  assert.equal(plan.selected?.provider.id, "perplexity");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.notEqual(plan.selected?.confidenceLevel, "low");
});

test("non-Latin queries favor Querit even with premium search providers configured", () => {
  const plan = planSearchRoute(
    {
      query: "最新 AI 搜索路由 评测",
      mode: "search",
      count: 5,
    },
    {
      env: envWith(
        "TAVILY_API_KEY",
        "EXA_API_KEY",
        "QUERIT_API_KEY",
        "SERPER_API_KEY",
        "YOU_API_KEY",
        "PERPLEXITY_API_KEY",
      ),
    },
  );

  assert.equal(plan.selected?.provider.id, "querit");
  assert.equal(plan.selected?.selectionMode, "intent-match");
  assert.equal(plan.selected?.confidenceLevel, "high");
});

test("date-range requests reject providers that do not advertise date filters", () => {
  const plan = planSearchRoute(
    {
      query: "OpenClaw release notes",
      mode: "search",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      count: 5,
    },
    { env: envWith("QUERIT_API_KEY", "BRAVE_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "brave");
  assert.equal(
    plan.candidates.some(
      (candidate) =>
        candidate.provider.id === "querit" &&
        candidate.issues.some((issue) => issue.includes("does not support --from/--to")),
    ),
    true,
  );
});

test("locale-constrained single-provider routes stay honest about availability pressure", () => {
  const plan = planSearchRoute(
    {
      query: "最新 AI 搜索路由 评测",
      mode: "search",
      lang: "zh",
      count: 5,
    },
    { env: envWith("QUERIT_API_KEY") },
  );

  assert.equal(plan.selected?.provider.id, "querit");
  assert.equal(plan.selected?.selectionMode, "availability-only");
  assert.equal(plan.diagnostics?.limitedByAvailability, true);
  assert.equal(
    plan.selected?.topSignals?.some((signal) => signal.category === "multilingual"),
    true,
  );
});
