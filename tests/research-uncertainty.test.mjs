import test from "node:test";
import assert from "node:assert/strict";

import { analyzeResearchEvidence } from "../scripts/lib/research/findings.mjs";

test("analyzeResearchEvidence surfaces stale information and missing official sources", () => {
  const analysis = analyzeResearchEvidence({
    request: {
      constraints: {
        officialSourcesPreferred: true,
        recentInformationPreferred: true,
      },
    },
    subquestions: [
      {
        id: "sq-1",
        question: "What official sources describe OpenClaw product updates?",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        subquestionId: "sq-1",
        claimKey: "community-summary",
        title: "Community post",
        url: "https://blog.example.com/post",
        claims: ["Community writeups summarize older product changes."],
        credibility: "reputable-third-party",
        authority: "reputable-third-party",
        freshness: "stale",
        coverage: "medium",
        conflictsWith: [],
      },
    ],
  });

  assert.ok(
    analysis.uncertainties.some((entry) => entry.type === "stale-information"),
  );
  assert.ok(
    analysis.uncertainties.some((entry) => entry.type === "insufficient-official-sources"),
  );
  assert.ok(
    analysis.uncertainties.some((entry) => entry.priority === "high"),
  );
});
