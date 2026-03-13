import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("README front-loads an actionable quick start and federation value explanation", () => {
  const readme = read("README.md");

  assert.match(readme, /## Quick Start \/ 快速开始/);
  assert.match(readme, /Option A: No-key baseline/i);
  assert.match(readme, /Option B: Add one premium provider/i);
  assert.match(readme, /First successful searches/i);
  assert.match(readme, /Then try docs, news, and research/i);
  assert.match(readme, /## Why Federated Search Matters \/ 联邦搜索为什么有价值/);
  assert.match(readme, /resultsRecoveredByFanout/);
  assert.match(readme, /duplicateSavings/);
});

test("SKILL surfaces quick start and federation value for installed agents", () => {
  const skill = read("SKILL.md");

  assert.match(skill, /## Quick Start/);
  assert.match(skill, /No-key baseline/);
  assert.match(skill, /Add one premium provider/i);
  assert.match(skill, /Why Federated Search Matters/i);
  assert.match(skill, /resultsRecoveredByFanout/);
  assert.match(skill, /duplicateSavings/);
});
