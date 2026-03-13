import test from "node:test";
import assert from "node:assert/strict";

import { scoreEvalCase } from "../scripts/lib/eval-scorer.mjs";

test("eval scorer passes when routing, coverage, citation, and safety signals all match", () => {
  const caseDefinition = {
    id: "baseline-search-001",
    command: {
      name: "search",
    },
    expectedSignals: {
      exitCode: 0,
      selectedProviderIn: ["ddg"],
      minResults: 2,
      mustIncludeDomainsAny: ["github.com"],
      minDistinctUrls: 2,
      maxFailed: 0,
    },
    scoring: {
      threshold: 0.8,
      weights: {
        routing: 0.2,
        coverage: 0.4,
        citation: 0.2,
        safety: 0.2,
      },
    },
  };

  const execution = {
    exitCode: 0,
    payload: {
      selectedProvider: "ddg",
      results: [
        {
          url: "https://github.com/openclaw/openclaw",
          title: "OpenClaw GitHub",
          content: "OpenClaw docs",
        },
        {
          url: "https://openclaw.ai/docs",
          title: "OpenClaw Docs",
          content: "Agent docs",
        },
      ],
      failed: [],
    },
  };

  const result = scoreEvalCase(caseDefinition, execution);
  assert.equal(result.status, "pass");
  assert.equal(result.score, 1);
  assert.equal(result.dimensions.routing.score, 1);
  assert.equal(result.dimensions.coverage.score, 1);
});

test("eval scorer fails when critical routing and coverage signals do not match", () => {
  const caseDefinition = {
    id: "news-search-001",
    command: {
      name: "search",
    },
    expectedSignals: {
      selectedProviderIn: ["serper"],
      minResults: 3,
      mustIncludeDomainsAll: ["news.ycombinator.com", "github.com"],
      maxFailed: 0,
    },
    scoring: {
      threshold: 0.75,
      weights: {
        routing: 0.3,
        coverage: 0.5,
        safety: 0.2,
      },
    },
  };

  const execution = {
    exitCode: 0,
    payload: {
      selectedProvider: "tavily",
      results: [
        {
          url: "https://example.com/one",
          title: "One",
          content: "missing domains",
        },
      ],
      failed: [{ url: "https://example.com/fail", error: "upstream" }],
    },
  };

  const result = scoreEvalCase(caseDefinition, execution);
  assert.equal(result.status, "fail");
  assert.ok(result.score < 0.75);
  assert.equal(
    result.checks.find((check) => check.signal === "selectedProviderIn")?.passed,
    false,
  );
});

test("eval scorer supports freshness checks from result dates", () => {
  const today = "2026-03-13T00:00:00.000Z";
  const caseDefinition = {
    id: "news-freshness-001",
    command: {
      name: "search",
    },
    expectedSignals: {
      maxResultAgeDays: 7,
    },
    scoring: {
      threshold: 1,
      weights: {
        freshness: 1,
      },
    },
  };

  const execution = {
    exitCode: 0,
    payload: {
      results: [
        {
          url: "https://example.com/news",
          publishedDate: "2026-03-10T00:00:00.000Z",
        },
      ],
      failed: [],
    },
  };

  const result = scoreEvalCase(caseDefinition, execution, { now: today });
  assert.equal(result.status, "pass");
  assert.equal(result.dimensions.freshness.score, 1);
});

test("eval scorer supports research-specific decomposition, evidence, and uncertainty checks", () => {
  const caseDefinition = {
    id: "research-pack-001",
    command: {
      name: "research",
    },
    expectedSignals: {
      exitCode: 0,
      topicTypeIn: ["docs"],
      topicSignalsIncludeAll: ["docs", "latest"],
      researchAxesIncludeAll: ["baseline-context", "official-proof", "site-structure"],
      subquestionIntentsIncludeAll: ["overview", "official-sources", "site-structure"],
      taskKindsIncludeAll: ["search", "extract", "map"],
      minEvidence: 2,
      minFindings: 1,
      minCitations: 2,
      requireOfficialEvidence: true,
      requireClaimClusters: true,
      requireUncertaintyTypesAny: ["insufficient-official-sources", "source-conflict"],
      requireProviderUsageAny: ["fetch"],
      requireGapResolutionAttempted: true,
      minFollowupTasksExecuted: 1,
      maxFollowupTasksExecuted: 2,
    },
    scoring: {
      threshold: 0.7,
      weights: {
        decomposition: 0.2,
        planning: 0.15,
        evidence: 0.25,
        findings: 0.15,
        uncertainty: 0.15,
        execution: 0.1,
      },
    },
  };

  const execution = {
    exitCode: 0,
    payload: {
      topicType: "docs",
      topicSignals: ["docs", "latest"],
      researchAxes: ["baseline-context", "official-proof", "site-structure", "recent-change"],
      subquestions: [
        { intent: "overview" },
        { intent: "official-sources" },
        { intent: "site-structure" },
        { intent: "comparison" },
      ],
      tasks: [
        { kind: "search" },
        { kind: "extract" },
        { kind: "map" },
      ],
      evidence: [
        { authority: "official", url: "https://example.com/docs" },
        { authority: "reputable-third-party", url: "https://blog.example.com/post" },
      ],
      claimClusters: [
        { id: "cluster-1", evidenceIds: ["ev-1"] },
      ],
      candidateFindings: [
        { id: "finding-1", claimClusterIds: ["cluster-1"] },
      ],
      uncertainties: [
        { type: "source-conflict" },
      ],
      citations: [
        { id: "cit-1", url: "https://example.com/docs" },
        { id: "cit-2", url: "https://blog.example.com/post" },
      ],
      execution: {
        providersUsed: ["fetch"],
      },
      gapResolutionSummary: {
        attempted: true,
        followupTasksExecuted: 1,
      },
      failed: [],
    },
  };

  const result = scoreEvalCase(caseDefinition, execution);
  assert.equal(result.status, "pass");
  assert.equal(result.dimensions.decomposition.score, 1);
  assert.equal(result.dimensions.planning.score, 1);
  assert.equal(result.dimensions.evidence.score, 1);
  assert.equal(result.dimensions.uncertainty.score, 1);
  assert.equal(result.dimensions.execution.score, 1);
});

test("eval scorer treats missing JSON payloads as empty results instead of throwing", () => {
  const caseDefinition = {
    id: "empty-payload-001",
    command: {
      name: "search",
    },
    expectedSignals: {
      exitCode: 0,
      minResults: 1,
    },
    scoring: {
      threshold: 0.75,
      weights: {
        safety: 0.5,
        coverage: 0.5,
      },
    },
  };

  const result = scoreEvalCase(caseDefinition, {
    exitCode: 0,
    payload: null,
  });

  assert.equal(result.status, "fail");
  assert.equal(result.dimensions.safety.score, 1);
  assert.equal(result.dimensions.coverage.score, 0);
});
