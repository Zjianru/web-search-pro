import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchPlan } from "../scripts/lib/research/plan.mjs";
import { normalizeResearchRequest } from "../scripts/lib/research/request.mjs";

test("buildResearchPlan maps subquestions to retrieval primitives", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw search skill landscape",
  });

  const plan = buildResearchPlan(request);

  assert.equal(plan.topicType, "landscape");
  assert.deepEqual(plan.topicSignals, ["landscape"]);
  assert.deepEqual(plan.researchAxes, [
    "baseline-context",
    "recent-change",
    "official-proof",
    "competitive-gap",
  ]);
  assert.equal(plan.subquestions.length, 4);
  assert.equal(plan.tasks.length, 4);
  assert.deepEqual(
    plan.tasks.map((entry) => entry.kind),
    ["search", "search", "search", "search"],
  );
  assert.equal(plan.execution.maxSearches, 8);
  assert.ok(plan.tasks.every((entry) => entry.phase === "primary"));
  assert.ok(plan.tasks.some((entry) => entry.followupEligible === true));
});

test("buildResearchPlan adds map and extract tasks for seed URLs without polluting routing", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw docs structure",
    scope: {
      seedUrls: ["https://example.com/docs"],
    },
  });

  const plan = buildResearchPlan(request);

  assert.equal(plan.topicType, "docs");
  assert.ok(plan.tasks.some((entry) => entry.kind === "map"));
  assert.ok(plan.tasks.some((entry) => entry.kind === "extract"));
  assert.ok(!plan.tasks.some((entry) => entry.kind === "crawl"));
  assert.ok(plan.tasks.every((entry) => entry.status === "planned"));
  assert.ok(plan.tasks.some((entry) => entry.evidencePriority === "structural"));
  assert.ok(plan.tasks.some((entry) => entry.sourceDiversityTarget === "single-source-ok"));
});

test("buildResearchPlan only adds crawl for dossier research with crawl enabled", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw documentation structure",
    scope: {
      seedUrls: ["https://example.com/docs"],
    },
    output: {
      format: "dossier",
    },
    budgets: {
      allowCrawl: true,
    },
  });

  const plan = buildResearchPlan(request);

  assert.ok(plan.tasks.some((entry) => entry.kind === "crawl"));
  assert.ok(plan.tasks.find((entry) => entry.kind === "crawl")?.followupEligible);
});
