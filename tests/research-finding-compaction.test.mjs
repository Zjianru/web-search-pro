import test from "node:test";
import assert from "node:assert/strict";

import { analyzeResearchEvidence } from "../scripts/lib/research/findings.mjs";

test("analyzeResearchEvidence compacts many evidence records into fewer model-facing findings", () => {
  const evidence = [
    {
      id: "ev-1",
      subquestionId: "sq-1",
      title: "Official docs overview",
      url: "https://docs.example.com/overview",
      sourceType: "docs",
      authority: "official",
      credibility: "official",
      freshness: "current",
      coverage: "high",
      documentQuality: "high",
      sourcePriority: "official",
      claimKey: "routing-health-pack",
      claims: ["OpenClaw docs describe routing, health, and research packs."],
      conflictsWith: [],
    },
    {
      id: "ev-2",
      subquestionId: "sq-1",
      title: "Reference page",
      url: "https://docs.example.com/reference",
      sourceType: "docs",
      authority: "official",
      credibility: "official",
      freshness: "current",
      coverage: "high",
      documentQuality: "high",
      sourcePriority: "official",
      claimKey: "routing-health-pack",
      claims: ["OpenClaw docs describe routing, health, and research packs."],
      conflictsWith: [],
    },
    {
      id: "ev-3",
      subquestionId: "sq-1",
      title: "Navigation links",
      url: "https://mirror.example.com/nav",
      sourceType: "article",
      authority: "unknown",
      credibility: "unknown",
      freshness: "unknown",
      coverage: "low",
      documentQuality: "low",
      sourcePriority: "low",
      claimKey: "nav-links",
      claims: ["Navigation links and menu items."],
      conflictsWith: [],
    },
    {
      id: "ev-4",
      subquestionId: "sq-1",
      title: "Community repost",
      url: "https://community.example.com/post",
      sourceType: "blog",
      authority: "reputable-third-party",
      credibility: "reputable-third-party",
      freshness: "recent",
      coverage: "medium",
      documentQuality: "medium",
      sourcePriority: "standard",
      claimKey: "routing-health-pack",
      claims: ["Community writeups repeat the docs summary for routing and health."],
      conflictsWith: [],
    },
  ];

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
        question: "What do the official materials say?",
      },
    ],
    evidence,
  });

  assert.ok(analysis.candidateFindings.length < evidence.length);
  assert.ok(
    analysis.candidateFindings.every((entry) => entry.evidenceIds.length >= 1),
  );
});

test("analyzeResearchEvidence does not promote title-only official anchors into findings", () => {
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
        question: "What do the official materials say?",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        subquestionId: "sq-1",
        title: "Skills - OpenClaw",
        url: "https://docs.example.com/skills",
        sourceType: "docs",
        authority: "official",
        credibility: "official",
        freshness: "unknown",
        coverage: "medium",
        documentQuality: "medium",
        sourcePriority: "official",
        claimKey: "skills-page-anchor",
        claims: [],
        conflictsWith: [],
      },
    ],
  });

  assert.equal(analysis.candidateFindings.length, 0);
  assert.equal(analysis.subquestionBriefs[0].supportedFacts.length, 0);
});
