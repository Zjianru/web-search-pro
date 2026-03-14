import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("README.md is the English landing page with a language switcher", () => {
  const readme = read("README.md");

  assert.match(readme, /\[English\]\(.*README\.md.*\)\s*\|\s*\[中文\]\(.*README_zh\.md.*\)/);
  assert.match(readme, /## What It Is/);
  assert.match(readme, /## Choose This If/);
  assert.match(readme, /## Do Not Choose This If/);
  assert.match(readme, /## Quick Start/);
  assert.match(readme, /Option A: No-key baseline/i);
  assert.match(readme, /Option B: Add one premium provider/i);
  assert.match(readme, /First successful searches/i);
  assert.match(readme, /Then try docs, news, and research/i);
  assert.match(readme, /## Why Federated Search Matters/);
  assert.match(readme, /resultsRecoveredByFanout/);
  assert.match(readme, /duplicateSavings/);
  assert.doesNotMatch(readme, /这到底是什么|适合什么场景|联邦搜索为什么有价值/);
});

test("README_zh.md is the Chinese landing page with a language switcher", () => {
  const readmeZh = read("README_zh.md");

  assert.match(readmeZh, /\[English\]\(.*README\.md.*\)\s*\|\s*\[中文\]\(.*README_zh\.md.*\)/);
  assert.match(readmeZh, /## 这是什么/);
  assert.match(readmeZh, /## 适合什么场景/);
  assert.match(readmeZh, /## 不适合什么场景/);
  assert.match(readmeZh, /## 快速开始/);
  assert.match(readmeZh, /方案 A：零 key 基线|Option A: No-key baseline/);
  assert.match(readmeZh, /方案 B：增加一个 premium provider|Option B: Add one premium provider/);
  assert.match(readmeZh, /第一批成功命令/);
  assert.match(readmeZh, /然后继续尝试 docs、news 和 research|然后继续尝试 docs, news, and research/);
  assert.match(readmeZh, /## 联邦搜索为什么有价值/);
  assert.match(readmeZh, /resultsRecoveredByFanout/);
  assert.match(readmeZh, /duplicateSavings/);
});

test("SKILL surfaces quick start and federation value for installed agents", () => {
  const skill = read("SKILL.md");

  assert.match(skill, /## Use This Skill When/);
  assert.match(skill, /## Runtime Contract/);
  assert.match(skill, /## Commands By Task/);
  assert.match(skill, /## Quick Start/);
  assert.match(skill, /No-key baseline/);
  assert.match(skill, /Add one premium provider/i);
  assert.match(skill, /Why Federated Search Matters/i);
  assert.match(skill, /resultsRecoveredByFanout/);
  assert.match(skill, /duplicateSavings/);
});

test("core docs declare audience and use clawhub.ai links", () => {
  const marketing = read("docs/marketing-launch-kit.md");
  const clawhubPackage = read("docs/clawhub-package.md");
  const clawhubCompliance = read("docs/clawhub-compliance.md");
  const routing = read("docs/search-routing-model.md");
  const research = read("docs/research-layer.md");

  assert.match(marketing, /## Audience/);
  assert.match(clawhubPackage, /## Audience/);
  assert.match(clawhubCompliance, /## Audience/);
  assert.match(routing, /## Audience/);
  assert.match(research, /## Audience/);

  assert.doesNotMatch(marketing, /www\.clawhub\.com/i);
  assert.match(marketing, /clawhub\.ai/i);
});
