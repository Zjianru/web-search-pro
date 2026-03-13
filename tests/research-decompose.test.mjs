import test from "node:test";
import assert from "node:assert/strict";

import { decomposeResearchRequest } from "../scripts/lib/research/decompose.mjs";
import { normalizeResearchRequest } from "../scripts/lib/research/request.mjs";
import { classifyResearchTopic } from "../scripts/lib/research/topic-classifier.mjs";

test("decomposeResearchRequest produces stable STORM-style subquestions", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw search skill landscape",
  });

  const subquestions = decomposeResearchRequest(request);

  assert.equal(classifyResearchTopic(request.topic), "landscape");
  assert.equal(subquestions.length, 4);
  assert.deepEqual(
    subquestions.map((entry) => entry.intent),
    ["overview", "latest", "official-sources", "comparison"],
  );
  assert.ok(subquestions.every((entry) => entry.question.includes("OpenClaw search skill landscape")));
  assert.ok(subquestions.every((entry) => Array.isArray(entry.plannedActions)));
  assert.deepEqual(
    subquestions.map((entry) => entry.researchAxis),
    ["baseline-context", "recent-change", "official-proof", "competitive-gap"],
  );
  assert.deepEqual(
    subquestions.map((entry) => entry.evidenceGoal),
    ["comparison-signal", "recent-change", "official-proof", "comparison-signal"],
  );
});

test("decomposeResearchRequest respects the maxQuestions budget", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw search skill landscape",
    budgets: {
      maxQuestions: 3,
    },
  });

  const subquestions = decomposeResearchRequest(request);

  assert.equal(subquestions.length, 3);
  assert.deepEqual(
    subquestions.map((entry) => entry.id),
    ["sq-1", "sq-2", "sq-3"],
  );
});

test("decomposeResearchRequest uses docs templates when the topic is documentation-oriented", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw documentation structure",
    scope: {
      seedUrls: ["https://example.com/docs"],
    },
  });

  const subquestions = decomposeResearchRequest(request);

  assert.equal(classifyResearchTopic(request.topic), "docs");
  assert.deepEqual(
    subquestions.map((entry) => entry.intent),
    ["overview", "official-sources", "site-structure", "comparison"],
  );
  assert.deepEqual(
    subquestions.map((entry) => entry.researchAxis),
    ["baseline-context", "official-proof", "site-structure", "competitive-gap"],
  );
});
