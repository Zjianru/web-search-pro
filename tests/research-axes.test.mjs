import test from "node:test";
import assert from "node:assert/strict";

import { deriveResearchAxes } from "../scripts/lib/research/research-axes.mjs";

test("deriveResearchAxes prioritizes docs structure before competitive gaps", () => {
  const axes = deriveResearchAxes({
    request: {
      scope: {
        seedUrls: ["https://example.com/docs"],
      },
      output: {
        format: "pack",
      },
    },
    topicType: "docs",
    topicSignals: ["docs", "latest"],
  });

  assert.deepEqual(axes, [
    "baseline-context",
    "official-proof",
    "site-structure",
    "recent-change",
  ]);
});

test("deriveResearchAxes picks timeline instead of recent-change when timeline is requested", () => {
  const axes = deriveResearchAxes({
    request: {
      scope: {
        seedUrls: [],
      },
      output: {
        format: "timeline",
      },
    },
    topicType: "latest",
    topicSignals: ["latest", "timeline"],
  });

  assert.deepEqual(axes, [
    "baseline-context",
    "timeline",
    "official-proof",
    "competitive-gap",
  ]);
});
