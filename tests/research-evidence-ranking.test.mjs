import test from "node:test";
import assert from "node:assert/strict";

import { normalizeResearchEvidence } from "../scripts/lib/research/evidence-normalize.mjs";

test("normalizeResearchEvidence prioritizes official documents ahead of low-value mirrors", () => {
  const evidence = normalizeResearchEvidence(
    [
      {
        task: {
          id: "task-1",
          subquestionId: "sq-1",
          kind: "search",
        },
        result: {
          selectedProvider: "tavily",
          results: [
            {
              title: "OpenClaw Documentation Overview",
              url: "https://docs.openclaw.ai/overview",
              content: "Official documentation for OpenClaw routing and research packs.",
              providers: ["tavily"],
            },
            {
              title: "OpenClaw notes on Scribd",
              url: "https://www.scribd.com/document/123456789/openclaw",
              content: "Uploaded copy of OpenClaw notes.",
              providers: ["tavily"],
            },
          ],
        },
      },
    ],
    {
      retrievedAt: Date.parse("2026-03-13T00:00:00.000Z"),
    },
  );

  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].sourcePriority, "official");
  assert.equal(evidence[0].selectionReason, "official-source");
  assert.equal(evidence[1].sourcePriority, "low");
});

