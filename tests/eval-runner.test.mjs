import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  filterEvalCases,
  loadBundledEvalCases,
  normalizeEvalCase,
  runEvalCase,
  runEvalSuite,
  summarizeEvalInventory,
} from "../scripts/lib/eval-runner.mjs";

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "web-search-pro-eval-"));
}

test("bundled eval inventory loads unique core, research, head-to-head, and head-to-head-live cases", async () => {
  const cases = await loadBundledEvalCases();
  const ids = cases.map((entry) => entry.id);
  const suites = new Set(cases.map((entry) => entry.suite));

  assert.ok(cases.length >= 10);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(suites.has("core"));
  assert.ok(suites.has("research"));
  assert.ok(suites.has("head-to-head"));
  assert.ok(suites.has("head-to-head-live"));
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

test("bundled head-to-head-live suite covers docs, news, and locale scenarios", async () => {
  const cases = await loadBundledEvalCases();
  const liveIds = new Set(
    cases
      .filter((entry) => entry.suite === "head-to-head-live")
      .map((entry) => entry.id),
  );

  assert.ok(liveIds.has("h2h-live-docs-openai-responses"));
  assert.ok(liveIds.has("h2h-live-news-openai-freshness"));
  assert.ok(liveIds.has("h2h-live-locale-openai-china-news"));
});

test("eval runner normalizes head-to-head case targets and comparative expectations", () => {
  const caseDefinition = normalizeEvalCase({
    id: "h2h-routing-001",
    suite: "head-to-head",
    description: "Compare latest-routing behavior",
    intent: "search",
    targets: [
      {
        id: "web-search-pro",
        command: {
          name: "search",
          argv: ["OpenClaw latest updates", "--plan"],
        },
      },
      {
        id: "web-search-plus",
        externalCommand: {
          cwd: "/Users/codez/develop/web-search-plus",
          bin: "python3",
          argv: ["scripts/search.py", "-q", "OpenClaw latest updates", "--json"],
        },
      },
    ],
    comparativeMetrics: ["routeCorrectness", "confidenceHonesty"],
    comparativeExpectations: {
      preferredTarget: "web-search-pro",
      mustBeatOn: ["confidenceHonesty"],
      allowedTiesOn: ["routeCorrectness"],
    },
    expectedSignals: {
      selectedProviderIn: ["you", "serper", "querit", "brave"],
    },
    scoring: {
      threshold: 0.7,
      weights: {
        routing: 1,
      },
    },
  });

  assert.equal(caseDefinition.suite, "head-to-head");
  assert.equal(caseDefinition.targets.length, 2);
  assert.equal(caseDefinition.targets[0].id, "web-search-pro");
  assert.equal(caseDefinition.targets[1].externalCommand?.bin, "python3");
  assert.equal(caseDefinition.targets[1].externalCommand?.json, true);
  assert.deepEqual(caseDefinition.comparativeMetrics, [
    "routeCorrectness",
    "confidenceHonesty",
  ]);
  assert.equal(caseDefinition.comparativeExpectations.preferredTarget, "web-search-pro");
});

test("eval suite can aggregate target-level head-to-head results", async () => {
  const summary = await runEvalSuite(
    [
      {
        id: "h2h-routing-002",
        suite: "head-to-head",
        intent: "search",
        targets: [
          {
            id: "web-search-pro",
            command: {
              name: "search",
              argv: ["OpenClaw routing", "--plan"],
            },
          },
          {
            id: "web-search-plus",
            externalCommand: {
              cwd: "/Users/codez/develop/web-search-plus",
              bin: "python3",
              argv: ["scripts/search.py", "-q", "OpenClaw routing", "--json"],
            },
          },
        ],
        comparativeMetrics: ["routeCorrectness", "confidenceHonesty"],
        comparativeExpectations: {
          preferredTarget: "web-search-pro",
          mustBeatOn: ["confidenceHonesty"],
        },
        expectedSignals: {
          selectedProviderIn: ["perplexity", "exa"],
        },
        scoring: {
          threshold: 0.5,
          weights: {
            routing: 1,
          },
        },
      },
    ],
    {
      executor: async (_caseDefinition, options) => {
        if (options.target?.id === "web-search-pro") {
          return {
            exitCode: 0,
            payload: {
              selectedProvider: "perplexity",
              routingSummary: {
                confidenceLevel: "high",
              },
              results: [{ url: "https://example.com/a" }],
              failed: [],
            },
          };
        }
        return {
          exitCode: 0,
          payload: {
            selectedProvider: "serper",
            routingSummary: {
              confidenceLevel: "high",
            },
            results: [{ url: "https://example.com/b" }],
            failed: [],
          },
        };
      },
    },
  );

  assert.equal(summary.caseResults.length, 1);
  assert.equal(summary.caseResults[0].targetResults?.length, 2);
  assert.equal(summary.caseResults[0].comparativeResult?.winner, "web-search-pro");
  assert.equal(summary.caseResults[0].comparativeResult?.meetsExpectations, true);
  assert.equal(summary.comparativeSummary?.byMetric.confidenceHonesty.win, 1);
});

test("head-to-head cases fail when preferred target does not beat a mustBeat metric", async () => {
  const summary = await runEvalSuite(
    [
      {
        id: "h2h-routing-003",
        suite: "head-to-head",
        intent: "search",
        targets: [
          {
            id: "web-search-pro",
            command: {
              name: "search",
              argv: ["routing honesty", "--plan"],
            },
          },
          {
            id: "web-search-plus",
            externalCommand: {
              cwd: "/Users/codez/develop/web-search-plus",
              bin: "python3",
              argv: ["scripts/search.py", "-q", "routing honesty", "--json"],
            },
          },
        ],
        comparativeMetrics: ["routeCorrectness", "confidenceHonesty"],
        comparativeExpectations: {
          preferredTarget: "web-search-pro",
          mustBeatOn: ["confidenceHonesty"],
          allowedTiesOn: ["routeCorrectness"],
        },
        expectedSignals: {
          selectedProviderIn: ["querit"],
          selectionModeIn: ["intent-match"],
          confidenceLevelIn: ["high"],
        },
        scoring: {
          threshold: 1,
          weights: {
            routing: 1,
          },
        },
      },
    ],
    {
      executor: async (_caseDefinition, options) => {
        if (options.target?.id === "web-search-pro") {
          return {
            exitCode: 0,
            payload: {
              selectedProvider: "querit",
              routingSummary: {
                selectionMode: "intent-match",
                confidenceLevel: "high",
              },
              results: [],
              failed: [],
            },
          };
        }
        return {
          exitCode: 0,
          payload: {
            selectedProvider: "querit",
            routingSummary: {
              selectionMode: "intent-match",
              confidenceLevel: "high",
            },
            results: [],
            failed: [],
          },
        };
      },
    },
  );

  assert.equal(summary.caseResults[0].comparativeResult?.winner, "tie");
  assert.equal(summary.caseResults[0].comparativeResult?.meetsExpectations, false);
  assert.equal(summary.caseResults[0].status, "fail");
});

test("external head-to-head commands can opt out of automatic --json injection", async () => {
  let observedArgs = null;
  await runEvalSuite(
    [
      {
        id: "h2h-routing-004",
        suite: "head-to-head",
        intent: "search",
        targets: [
          {
            id: "web-search-pro",
            command: {
              name: "search",
              argv: ["routing honesty", "--plan"],
            },
          },
          {
            id: "web-search-plus",
            externalCommand: {
              cwd: "../web-search-plus",
              bin: "python3",
              argv: ["scripts/search.py", "--explain-routing", "-q", "routing honesty"],
              json: false,
            },
          },
        ],
        comparativeMetrics: ["routeCorrectness"],
        comparativeExpectations: {
          preferredTarget: "web-search-pro",
          mustBeatOn: [],
          allowedTiesOn: ["routeCorrectness"],
        },
        expectedSignals: {
          selectedProviderIn: ["querit"],
        },
        scoring: {
          threshold: 1,
          weights: {
            routing: 1,
          },
        },
      },
    ],
    {
      executor: async (_caseDefinition, options) => {
        if (options.target?.id === "web-search-plus") {
          observedArgs = options.target.externalCommand.argv;
        }
        return {
          exitCode: 0,
          payload: {
            selectedProvider: "querit",
            routingSummary: {
              selectionMode: "intent-match",
              confidenceLevel: "high",
            },
            results: [],
            failed: [],
          },
        };
      },
    },
  );

  assert.deepEqual(observedArgs, [
    "scripts/search.py",
    "--explain-routing",
    "-q",
    "routing honesty",
  ]);
});

test("eval runner supports target-specific env remapping and temporary config injection", async () => {
  const tempDir = await makeTempDir();

  try {
    const result = await runEvalCase(
      {
        id: "h2h-routing-005",
        suite: "head-to-head",
        intent: "search",
        description: "Verify target env remapping and temporary config injection",
        targets: [
          {
            id: "web-search-plus",
            externalCommand: {
              cwd: tempDir,
              bin: process.execPath,
              argv: [
                "-e",
                [
                  "const fs = require('node:fs');",
                  "const path = require('node:path');",
                  "const configPath = path.join(process.cwd(), 'config.json');",
                  "const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));",
                  "console.log(JSON.stringify({",
                  "  apiKey: process.env.PERPLEXITY_API_KEY ?? null,",
                  "  model: config.perplexity?.model ?? null,",
                  "  apiUrl: config.perplexity?.api_url ?? null,",
                  "  configPathExists: fs.existsSync(configPath),",
                  "}));",
                ].join(" "),
              ],
              json: false,
              env: {
                PERPLEXITY_API_KEY: "${OPENROUTER_API_KEY}",
              },
              configJson: {
                perplexity: {
                  model: "perplexity/sonar",
                  api_url: "https://openrouter.ai/api/v1/chat/completions",
                },
              },
            },
          },
        ],
        constraints: {
          requiresNetwork: false,
        },
        expectedSignals: {},
        scoring: {
          threshold: 1,
          weights: {},
        },
      },
      {
        env: {
          OPENROUTER_API_KEY: "openrouter-secret",
        },
      },
    );

    assert.equal(result.status, "pass");
    assert.equal(result.targetResults?.[0]?.payload?.apiKey, "openrouter-secret");
    assert.equal(result.targetResults?.[0]?.payload?.model, "perplexity/sonar");
    assert.equal(
      result.targetResults?.[0]?.payload?.apiUrl,
      "https://openrouter.ai/api/v1/chat/completions",
    );
    assert.equal(result.targetResults?.[0]?.payload?.configPathExists, true);
    await assert.rejects(
      () => fs.access(path.join(tempDir, "config.json")),
      /ENOENT/,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("eval runner blocks head-to-head targets on target-specific credential requirements", async () => {
  const result = await runEvalCase(
    {
      id: "h2h-routing-006",
      suite: "head-to-head",
      intent: "search",
      targets: [
        {
          id: "web-search-plus",
          constraints: {
            requiredEnvAll: ["TARGET_ONLY_KEY"],
          },
          externalCommand: {
            cwd: "/tmp",
            bin: process.execPath,
            argv: ["-e", "console.log('{}')"],
            json: false,
          },
        },
      ],
      constraints: {
        requiresNetwork: false,
      },
      expectedSignals: {},
      scoring: {
        threshold: 1,
        weights: {},
      },
    },
    {
      env: {},
      executor: async () => {
        throw new Error("executor should not run for blocked targets");
      },
    },
  );

  assert.equal(result.status, "blocked");
  assert.match(result.blockedReason ?? "", /TARGET_ONLY_KEY/);
  assert.equal(result.targetResults?.[0]?.status, "blocked");
});
