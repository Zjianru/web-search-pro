import test from "node:test";
import assert from "node:assert/strict";

import { loadRuntimeConfig } from "../scripts/lib/config.mjs";
import { runResearch } from "../scripts/lib/research/orchestrator.mjs";
import { normalizeResearchRequest } from "../scripts/lib/research/request.mjs";

test("runResearch builds an evidence pack from task executions", async () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw search skill landscape",
    scope: {
      seedUrls: ["https://example.com/docs"],
    },
  });
  const { config } = loadRuntimeConfig({
    cwd: process.cwd(),
    env: {},
  });

  const payload = await runResearch(request, {
    cwd: process.cwd(),
    env: {},
    config,
    executeTask: async (task) => {
      if (task.kind === "search") {
        return {
          task: { ...task, status: "completed" },
          providersUsed: ["ddg"],
          federated: false,
          result: {
            schemaVersion: "1.0",
            command: "search",
            selectedProvider: "ddg",
            engine: "ddg",
            results: [
              {
                title: `${task.query} result`,
                url: `https://example.com/${task.id}`,
                content: `Evidence for ${task.query}.`,
                sourceType: "web",
                providers: ["ddg"],
              },
            ],
            failed: [],
            meta: {
              query: task.query,
              count: 1,
              answer: null,
            },
          },
        };
      }

      return {
        task: { ...task, status: "completed" },
        providersUsed: ["fetch"],
        federated: false,
        result: {
          schemaVersion: "1.0",
          command: task.kind,
          selectedProvider: "fetch",
          engine: "fetch",
          results: [
            {
              title: `${task.kind} evidence`,
              url: task.urls[0],
              content: `${task.kind} content for ${task.urls[0]}`,
              contentType: "text/html",
            },
          ],
          failed: [],
          meta: {
            count: 1,
          },
          nodes: [],
          edges: [],
        },
      };
    },
  });

  assert.equal(payload.command, "research");
  assert.equal(payload.meta.planOnly, false);
  assert.equal(payload.topicType, "landscape");
  assert.deepEqual(payload.topicSignals, ["landscape"]);
  assert.deepEqual(payload.researchAxes, [
    "baseline-context",
    "official-proof",
    "site-structure",
    "competitive-gap",
  ]);
  assert.ok(payload.evidence.length >= 4);
  assert.ok(payload.claimClusters.length >= 4);
  assert.ok(payload.candidateFindings.length >= 4);
  assert.ok(payload.citations.length >= payload.evidence.length);
  assert.equal(payload.subquestionBriefs.length, payload.subquestions.length);
  assert.deepEqual(payload.execution.providersUsed.sort(), ["ddg", "fetch"]);
  assert.equal(payload.execution.taskCounts.completed, payload.tasks.length);
  assert.equal(payload.gapResolutionSummary.attempted, true);
  assert.ok(payload.gapResolutionSummary.followupTasksPlanned >= 1);
  assert.ok(payload.gapResolutionSummary.followupTasksExecuted >= 1);
});

test("runResearch executes a single round of follow-up tasks for eligible gaps", async () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw search skill landscape",
    budgets: {
      maxSearches: 5,
    },
  });
  const { config } = loadRuntimeConfig({
    cwd: process.cwd(),
    env: {},
  });

  const payload = await runResearch(request, {
    cwd: process.cwd(),
    env: {},
    config,
    executeTask: async (task) => {
      if (task.phase === "followup") {
        return {
          task: { ...task, status: "completed" },
          providersUsed: ["ddg"],
          federated: false,
          result: {
            schemaVersion: "1.0",
            command: "search",
            selectedProvider: "ddg",
            engine: "ddg",
            results: [
              {
                title: "Official docs",
                url: "https://example.com/official",
                content: "Official documentation confirms the provider behavior.",
                sourceType: "docs",
                providers: ["ddg"],
              },
            ],
            failed: [],
            meta: {
              query: task.query,
              count: 1,
              answer: null,
            },
          },
        };
      }

      return {
        task: { ...task, status: "completed" },
        providersUsed: ["ddg"],
        federated: false,
        result: {
          schemaVersion: "1.0",
          command: "search",
          selectedProvider: "ddg",
          engine: "ddg",
          results: [],
          failed: [],
          meta: {
            query: task.query,
            count: 0,
            answer: null,
          },
        },
      };
    },
  });

  assert.equal(payload.gapResolutionSummary.attempted, true);
  assert.ok(payload.gapResolutionSummary.followupTasksPlanned >= 1);
  assert.ok(payload.gapResolutionSummary.followupTasksExecuted >= 1);
  assert.ok(payload.tasks.some((task) => task.phase === "followup"));
  assert.ok(Array.isArray(payload.subquestionBriefs));
});
