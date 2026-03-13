import test from "node:test";
import assert from "node:assert/strict";

import { analyzeResearchEvidence } from "../scripts/lib/research/findings.mjs";

test("analyzeResearchEvidence builds candidate findings, citations, and uncertainties", () => {
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
        question: "What official sources describe OpenClaw search skills?",
      },
      {
        id: "sq-2",
        question: "What conflicts exist across community sources?",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        subquestionId: "sq-1",
        title: "Official docs",
        url: "https://example.com/docs",
        sourceType: "docs",
        credibility: "official",
        authority: "official",
        freshness: "current",
        coverage: "high",
        documentQuality: "high",
        sourcePriority: "official",
        claimKey: "official-routing",
        claims: ["OpenClaw documents provider routing and health behavior."],
        conflictsWith: [],
      },
      {
        id: "ev-2",
        subquestionId: "sq-2",
        title: "Community writeup",
        url: "https://blog.example.com/post",
        sourceType: "blog",
        credibility: "reputable-third-party",
        authority: "reputable-third-party",
        freshness: "recent",
        coverage: "medium",
        documentQuality: "medium",
        sourcePriority: "standard",
        claimKey: "provider-quality-disagreement",
        claims: ["Community writeups disagree on the strongest provider route."],
        conflictsWith: ["ev-3"],
      },
      {
        id: "ev-3",
        subquestionId: "sq-2",
        title: "Forum thread",
        url: "https://forum.example.com/thread",
        sourceType: "blog",
        credibility: "unknown",
        authority: "unknown",
        freshness: "recent",
        coverage: "low",
        documentQuality: "low",
        sourcePriority: "low",
        claimKey: "provider-quality-disagreement",
        claims: ["Forum discussions disagree on the strongest provider route."],
        conflictsWith: ["ev-2"],
      },
    ],
  });

  assert.ok(analysis.claimClusters.length >= 2);
  assert.ok(analysis.candidateFindings.length >= 2);
  assert.equal(analysis.citations.length, 3);
  assert.ok(
    analysis.candidateFindings.some((entry) => Array.isArray(entry.claimClusterIds)),
  );
  assert.ok(
    analysis.candidateFindings.some((entry) => entry.supportProfile?.claimConsistency),
  );
  assert.ok(
    analysis.candidateFindings.some((entry) => typeof entry.gapSensitive === "boolean"),
  );
  assert.ok(
    analysis.candidateFindings.some((entry) => entry.supportProfile?.documentQuality),
  );
  assert.ok(
    analysis.uncertainties.some((entry) => entry.type === "source-conflict"),
  );
  assert.ok(
    analysis.uncertainties.some((entry) => entry.priority === "low"),
  );
});

test("analyzeResearchEvidence surfaces missing evidence as an uncertainty", () => {
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
        question: "What official sources describe OpenClaw search skills?",
      },
    ],
    evidence: [],
  });

  assert.equal(analysis.candidateFindings.length, 0);
  assert.equal(analysis.uncertainties.length, 1);
  assert.equal(analysis.uncertainties[0].type, "missing-evidence");
  assert.equal(analysis.uncertainties[0].priority, "medium");
  assert.equal(analysis.uncertainties[0].followupEligible, true);
});
