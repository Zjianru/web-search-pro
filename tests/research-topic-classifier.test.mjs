import test from "node:test";
import assert from "node:assert/strict";

import { classifyResearchTopic } from "../scripts/lib/research/topic-classifier.mjs";

test("classifyResearchTopic detects docs and landscape topics", () => {
  assert.equal(classifyResearchTopic("OpenClaw documentation structure"), "docs");
  assert.equal(classifyResearchTopic("OpenClaw search skill landscape"), "landscape");
});

test("classifyResearchTopic detects latest and comparison topics", () => {
  assert.equal(classifyResearchTopic("OpenClaw latest product updates"), "latest");
  assert.equal(classifyResearchTopic("OpenClaw vs Firecrawl comparison"), "comparison");
});

test("classifyResearchTopic falls back to general topics", () => {
  assert.equal(classifyResearchTopic("OpenClaw"), "general");
});
