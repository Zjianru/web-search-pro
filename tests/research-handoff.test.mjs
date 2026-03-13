import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchOutput } from "../scripts/lib/research/output.mjs";

test("buildResearchOutput emits compact subquestion briefs for model handoff", () => {
  const payload = buildResearchOutput({
    request: {
      topic: "OpenClaw search skill landscape",
      objective: "structured research pack",
      budgets: {
        maxQuestions: 4,
        maxSearches: 8,
        maxExtracts: 6,
        maxCrawlPages: 12,
        allowRender: false,
      },
      output: {
        format: "pack",
        language: "match-input",
      },
    },
    plan: {
      topicType: "landscape",
      topicSignals: ["landscape"],
      researchAxes: ["baseline-context", "official-proof"],
      subquestions: [
        {
          id: "sq-1",
          question: "What is the baseline capability set?",
        },
      ],
      tasks: [],
    },
    evidence: [
      {
        id: "ev-1",
        subquestionId: "sq-1",
      },
      {
        id: "ev-2",
        subquestionId: "sq-1",
      },
    ],
    candidateFindings: [
      {
        id: "finding-1",
        statement: "OpenClaw combines search, extract, crawl, and research features.",
        subquestionIds: ["sq-1"],
        evidenceIds: ["ev-1", "ev-2"],
        status: "supported",
      },
    ],
    uncertainties: [
      {
        id: "unc-1",
        type: "missing-evidence",
        subquestionId: "sq-1",
        description: "Need another official source.",
      },
    ],
    citations: [],
  });

  assert.equal(payload.subquestionBriefs.length, 1);
  assert.equal(payload.subquestionBriefs[0].subquestionId, "sq-1");
  assert.ok(payload.subquestionBriefs[0].supportedFacts.length >= 1);
  assert.ok(payload.subquestionBriefs[0].missing.length >= 1);
  assert.deepEqual(payload.subquestionBriefs[0].topEvidenceIds, ["ev-1", "ev-2"]);
});
