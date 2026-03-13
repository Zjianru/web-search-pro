import test from "node:test";
import assert from "node:assert/strict";

import {
  filterEvalCases,
  loadBundledEvalCases,
  runEvalCase,
  runEvalSuite,
  summarizeEvalInventory,
} from "../scripts/lib/eval-runner.mjs";

test("bundled eval inventory loads unique core and research cases", async () => {
  const cases = await loadBundledEvalCases();
  const ids = cases.map((entry) => entry.id);
  const suites = new Set(cases.map((entry) => entry.suite));

  assert.ok(cases.length >= 10);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(suites.has("core"));
  assert.ok(suites.has("research"));
});

test("eval runner blocks cases when required credentials are missing", async () => {
  const caseDefinition = {
    id: "premium-baidu-001",
    suite: "core",
    command: {
      name: "search",
      argv: ["开源技能平台", "--engine", "serpapi", "--search-engine", "baidu"],
    },
    constraints: {
      requiresNetwork: true,
      requiredEnvAll: ["SERPAPI_API_KEY"],
    },
    expectedSignals: {},
    scoring: {
      threshold: 1,
      weights: {},
    },
  };

  const result = await runEvalCase(caseDefinition, {
    env: {},
    executor: async () => {
      throw new Error("executor should not run when case is blocked");
    },
  });

  assert.equal(result.status, "blocked");
  assert.match(result.blockedReason ?? "", /SERPAPI_API_KEY/);
});

test("eval suite aggregates pass, fail, and blocked counts", async () => {
  const cases = [
    {
      id: "pass-001",
      suite: "core",
      command: {
        name: "search",
        argv: ["OpenClaw web search"],
      },
      expectedSignals: {
        exitCode: 0,
        selectedProviderIn: ["ddg"],
      },
      scoring: {
        threshold: 1,
        weights: {
          routing: 1,
        },
      },
    },
    {
      id: "blocked-001",
      suite: "core",
      command: {
        name: "search",
        argv: ["OpenClaw latest news", "--news"],
      },
      constraints: {
        requiredEnvAll: ["SERPER_API_KEY"],
      },
      expectedSignals: {},
      scoring: {
        threshold: 1,
        weights: {},
      },
    },
    {
      id: "fail-001",
      suite: "core",
      command: {
        name: "crawl",
        argv: ["https://example.com"],
      },
      expectedSignals: {
        minResults: 2,
      },
      scoring: {
        threshold: 1,
        weights: {
          coverage: 1,
        },
      },
    },
  ];

  const summary = await runEvalSuite(cases, {
    env: {},
    executor: async (caseDefinition) => {
      if (caseDefinition.id === "pass-001") {
        return {
          exitCode: 0,
          payload: {
            selectedProvider: "ddg",
            results: [{ url: "https://openclaw.ai" }],
            failed: [],
          },
        };
      }
      return {
        exitCode: 0,
        payload: {
          results: [{ url: "https://example.com" }],
          failed: [],
        },
      };
    },
  });

  assert.equal(summary.statusCounts.pass, 1);
  assert.equal(summary.statusCounts.fail, 1);
  assert.equal(summary.statusCounts.blocked, 1);
  assert.equal(summary.caseResults.length, 3);
});

test("eval inventory summary groups bundled cases by intent", async () => {
  const cases = await loadBundledEvalCases();
  const summary = summarizeEvalInventory(cases);

  assert.equal(summary.totalCases, cases.length);
  assert.ok(summary.byIntent.search >= 1);
  assert.ok(summary.byIntent.crawl >= 1);
  assert.ok(summary.byIntent.map >= 1);
});

test("bundled eval inventory includes research suite coverage", async () => {
  const cases = await loadBundledEvalCases();
  const researchCases = cases.filter((entry) => entry.suite === "research");

  assert.equal(researchCases.length, 20);
  assert.ok(researchCases.every((entry) => entry.command.name === "research"));
});

test("eval runner supports filtering by the research suite", async () => {
  const cases = await loadBundledEvalCases();
  const filtered = filterEvalCases(cases, { suite: "research" });

  assert.equal(filtered.length, 20);
  assert.ok(filtered.every((entry) => entry.suite === "research"));
});
