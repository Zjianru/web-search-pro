import test from "node:test";
import assert from "node:assert/strict";

import { assessResearchDocumentQuality } from "../scripts/lib/research/document-quality.mjs";

test("assessResearchDocumentQuality strips boilerplate and preserves primary content", () => {
  const assessment = assessResearchDocumentQuality({
    taskKind: "extract",
    url: "https://example.com/docs/overview",
    title: "OpenClaw Documentation Overview",
    content: [
      "Skip to main content",
      "Search docs",
      "Main navigation",
      "OpenClaw Documentation Overview",
      "The OpenClaw docs explain provider routing, health state, and research packs.",
      "Terms",
      "Privacy",
    ].join("\n"),
  });

  assert.equal(assessment.hasPrimaryContent, true);
  assert.ok(assessment.boilerplateRatio > 0.2);
  assert.equal(assessment.documentQuality, "high");
  assert.match(assessment.cleanedContent, /provider routing, health state, and research packs/i);
  assert.doesNotMatch(assessment.cleanedContent, /skip to main content/i);
  assert.doesNotMatch(assessment.cleanedContent, /main navigation/i);
});

