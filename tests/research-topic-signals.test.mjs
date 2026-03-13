import test from "node:test";
import assert from "node:assert/strict";

import { detectResearchTopicSignals } from "../scripts/lib/research/topic-signals.mjs";

test("detectResearchTopicSignals captures mixed docs and latest topics", () => {
  const signals = detectResearchTopicSignals({
    topic: "OpenClaw documentation latest updates",
    output: {
      format: "pack",
    },
  });

  assert.deepEqual(signals, ["docs", "latest"]);
});

test("detectResearchTopicSignals captures company and comparison signals together", () => {
  const signals = detectResearchTopicSignals({
    topic: "OpenAI company vs Anthropic comparison",
    output: {
      format: "pack",
    },
  });

  assert.deepEqual(signals, ["company", "comparison"]);
});

test("detectResearchTopicSignals adds timeline when the output format requires it", () => {
  const signals = detectResearchTopicSignals({
    topic: "OpenClaw release history",
    output: {
      format: "timeline",
    },
  });

  assert.ok(signals.includes("latest"));
  assert.ok(signals.includes("timeline"));
});
