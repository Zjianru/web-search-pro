import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchGapFillPlan } from "../scripts/lib/research/gap-fill.mjs";
import { normalizeResearchRequest } from "../scripts/lib/research/request.mjs";

test("buildResearchGapFillPlan adds at most two follow-up tasks for high-priority gaps", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw documentation latest updates",
    scope: {
      seedUrls: ["https://example.com/docs"],
    },
  });
  const plan = {
    topicType: "docs",
    topicSignals: ["docs", "latest"],
    researchAxes: ["baseline-context", "official-proof", "site-structure", "recent-change"],
    subquestions: [
      {
        id: "sq-2",
        intent: "official-sources",
        evidenceGoal: "official-proof",
      },
      {
        id: "sq-4",
        intent: "latest",
        evidenceGoal: "recent-change",
      },
    ],
    tasks: [
      { id: "task-1", kind: "search", subquestionId: "sq-1", phase: "primary" },
    ],
  };
  const analysis = {
    uncertainties: [
      {
        id: "unc-sq-2-official",
        type: "insufficient-official-sources",
        priority: "high",
        followupEligible: true,
        subquestionId: "sq-2",
      },
      {
        id: "unc-sq-4-stale",
        type: "stale-information",
        priority: "high",
        followupEligible: true,
        subquestionId: "sq-4",
      },
    ],
  };

  const gapPlan = buildResearchGapFillPlan({
    request,
    plan,
    analysis,
    taskExecutions: [],
  });

  assert.equal(gapPlan.attempted, true);
  assert.deepEqual(gapPlan.triggeredBy, ["insufficient-official-sources", "stale-information"]);
  assert.equal(gapPlan.followupTasks.length, 2);
  assert.ok(gapPlan.followupTasks.every((task) => task.phase === "followup"));
});

test("buildResearchGapFillPlan never auto-follows source conflicts", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw provider disagreements",
  });
  const plan = {
    topicType: "comparison",
    topicSignals: ["comparison"],
    researchAxes: ["baseline-context", "official-proof", "competitive-gap"],
    subquestions: [
      {
        id: "sq-4",
        intent: "comparison",
        evidenceGoal: "comparison-signal",
      },
    ],
    tasks: [],
  };
  const analysis = {
    uncertainties: [
      {
        id: "unc-conflict",
        type: "source-conflict",
        priority: "low",
        followupEligible: false,
        subquestionId: "sq-4",
      },
    ],
  };

  const gapPlan = buildResearchGapFillPlan({
    request,
    plan,
    analysis,
    taskExecutions: [],
  });

  assert.equal(gapPlan.attempted, false);
  assert.deepEqual(gapPlan.followupTasks, []);
});
