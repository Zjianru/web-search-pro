import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

function runResearch(args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, "scripts/research.mjs"), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("research command plan mode emits the structured pack schema", () => {
  const result = runResearch(["OpenClaw search skill landscape", "--plan", "--json"]);
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, "1.0");
  assert.equal(payload.command, "research");
  assert.equal(payload.topic, "OpenClaw search skill landscape");
  assert.equal(payload.topicType, "landscape");
  assert.deepEqual(payload.topicSignals, ["landscape"]);
  assert.deepEqual(payload.researchAxes, [
    "baseline-context",
    "recent-change",
    "official-proof",
    "competitive-gap",
  ]);
  assert.equal(payload.meta.planOnly, true);
  assert.equal(payload.subquestions.length, 4);
  assert.equal(payload.tasks.length, 4);
  assert.ok(payload.subquestions.every((entry) => entry.researchAxis));
  assert.ok(payload.subquestions.every((entry) => entry.evidenceGoal));
  assert.ok(payload.tasks.every((entry) => entry.phase === "primary"));
  assert.deepEqual(payload.evidence, []);
  assert.deepEqual(payload.claimClusters, []);
  assert.deepEqual(payload.candidateFindings, []);
  assert.deepEqual(payload.uncertainties, []);
  assert.deepEqual(payload.subquestionBriefs, []);
  assert.deepEqual(payload.gapResolutionSummary, {
    attempted: false,
    triggeredBy: [],
    followupTasksPlanned: 0,
    followupTasksExecuted: 0,
    resolvedUncertaintyIds: [],
    remainingUncertaintyIds: [],
  });
  assert.ok(Array.isArray(payload.execution.primitivesPlanned));
});

test("research command rejects empty topics", () => {
  const result = runResearch([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
