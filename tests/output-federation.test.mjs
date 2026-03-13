import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchOutput,
  formatSearchMarkdown,
} from "../scripts/lib/output.mjs";

function makePlan() {
  return {
    request: {
      searchType: "news",
      intentPreset: "general",
    },
    selected: {
      provider: {
        id: "serper",
      },
      summary: "selected for news search coverage",
      reasons: ["news search support"],
      selectionMode: "intent-match",
      confidence: 0.84,
      confidenceLevel: "high",
      topSignals: [
        {
          category: "freshness",
          label: "latest-update intent",
        },
      ],
    },
    candidates: [],
    configuredProviders: ["serper", "tavily"],
    error: null,
  };
}

test("buildSearchOutput exposes federation value using final merged results", () => {
  const payload = buildSearchOutput({
    query: "latest OpenAI news",
    plan: makePlan(),
    providerResult: {
      engine: "federated",
      answer: "OpenAI shipped an update.",
      results: [
        {
          title: "Primary story",
          url: "https://example.com/primary",
          content: "primary coverage",
          providerIds: ["serper"],
        },
        {
          title: "Corroborated story",
          url: "https://example.com/corroborated",
          content: "corroborated coverage",
          providerIds: ["serper", "tavily"],
        },
        {
          title: "Recovered by fanout",
          url: "https://example.com/recovered",
          content: "fanout-only coverage",
          providerIds: ["tavily"],
        },
      ],
      failed: [],
    },
    federation: {
      enabled: true,
      triggered: true,
      reason: "triggered by news",
      fanoutPolicy: "triggered",
      triggerReasons: ["news"],
      primaryProvider: "serper",
      providersPlanned: ["serper", "tavily"],
      providersUsed: ["serper", "tavily"],
      mergePolicy: "balanced",
      resultStats: {
        rawResultCount: 4,
        dedupedResultCount: 3,
        providerHitCounts: {
          serper: 2,
          tavily: 2,
        },
      },
      mergeSummary: {
        dedupedUrls: 1,
        nearDuplicateDrops: 0,
        reranked: true,
        answerProvider: "tavily",
      },
      primarySucceeded: true,
    },
  });

  assert.deepEqual(payload.federated.value, {
    additionalProvidersUsed: 1,
    resultsWithFanoutSupport: 2,
    resultsRecoveredByFanout: 1,
    resultsCorroboratedByFanout: 1,
    duplicateSavings: 1,
    answerProvider: "tavily",
    primarySucceeded: true,
  });
  assert.deepEqual(payload.routingSummary.federation.value, payload.federated.value);
});

test("formatSearchMarkdown renders federation value as a readable gain summary", () => {
  const payload = buildSearchOutput({
    query: "latest OpenAI news",
    plan: makePlan(),
    providerResult: {
      engine: "federated",
      answer: null,
      results: [
        {
          title: "Primary story",
          url: "https://example.com/primary",
          content: "primary coverage",
          providerIds: ["serper"],
        },
        {
          title: "Corroborated story",
          url: "https://example.com/corroborated",
          content: "corroborated coverage",
          providerIds: ["serper", "tavily"],
        },
        {
          title: "Recovered by fanout",
          url: "https://example.com/recovered",
          content: "fanout-only coverage",
          providerIds: ["tavily"],
        },
      ],
      failed: [],
    },
    federation: {
      enabled: true,
      triggered: true,
      reason: "triggered by news",
      fanoutPolicy: "triggered",
      triggerReasons: ["news"],
      primaryProvider: "serper",
      providersPlanned: ["serper", "tavily"],
      providersUsed: ["serper", "tavily"],
      mergePolicy: "balanced",
      resultStats: {
        rawResultCount: 4,
        dedupedResultCount: 3,
        providerHitCounts: {
          serper: 2,
          tavily: 2,
        },
      },
      mergeSummary: {
        dedupedUrls: 1,
        nearDuplicateDrops: 0,
        reranked: true,
        answerProvider: null,
      },
      primarySucceeded: true,
    },
  });

  const markdown = formatSearchMarkdown(payload);
  assert.match(markdown, /\+1 providers/);
  assert.match(markdown, /\+1 recovered result/);
  assert.match(markdown, /1 corroborated result/);
  assert.match(markdown, /1 duplicate collapsed/);
});
