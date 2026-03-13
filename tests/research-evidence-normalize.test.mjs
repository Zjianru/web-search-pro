import test from "node:test";
import assert from "node:assert/strict";

import { normalizeResearchEvidence } from "../scripts/lib/research/evidence-normalize.mjs";

test("normalizeResearchEvidence converts search results into evidence records", () => {
  const records = normalizeResearchEvidence([
    {
      task: {
        id: "task-1",
        subquestionId: "sq-1",
        kind: "search",
      },
      result: {
        selectedProvider: "exa",
        results: [
          {
            title: "OpenClaw docs",
            url: "https://example.com/docs",
            content: "Official OpenClaw docs and references.",
            publishedDate: "2026-03-01",
            sourceType: "web",
            providers: ["exa"],
          },
        ],
      },
    },
  ], {
    retrievedAt: Date.parse("2026-03-13T00:00:00.000Z"),
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].taskId, "task-1");
  assert.equal(records[0].subquestionId, "sq-1");
  assert.equal(records[0].url, "https://example.com/docs");
  assert.equal(records[0].credibility, "official");
  assert.equal(records[0].authority, "official");
  assert.equal(records[0].freshness, "current");
  assert.equal(records[0].coverage, "medium");
  assert.equal(records[0].documentQuality, "high");
  assert.equal(records[0].hasPrimaryContent, true);
  assert.equal(records[0].sourcePriority, "official");
  assert.equal(records[0].selectionReason, "official-source");
  assert.equal(records[0].stalenessFlag, false);
  assert.match(records[0].claimKey, /documentation/);
  assert.deepEqual(records[0].providerIds, ["exa"]);
  assert.ok(records[0].claims.length >= 1);
});

test("normalizeResearchEvidence dedupes repeated URLs across retrieval tasks", () => {
  const records = normalizeResearchEvidence([
    {
      task: {
        id: "task-1",
        subquestionId: "sq-1",
        kind: "search",
      },
      result: {
        selectedProvider: "ddg",
        results: [
          {
            title: "Docs",
            url: "https://example.com/docs",
            content: "Documentation landing page.",
            providers: ["ddg"],
          },
        ],
      },
    },
    {
      task: {
        id: "task-2",
        subquestionId: "sq-1",
        kind: "extract",
      },
      result: {
        selectedProvider: "fetch",
        results: [
          {
            title: "Docs",
            url: "https://example.com/docs",
            content: "Documentation landing page with more detail.",
          },
        ],
      },
    },
  ], {
    retrievedAt: Date.parse("2026-03-13T00:00:00.000Z"),
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].providerIds.sort(), ["ddg", "fetch"]);
  assert.equal(records[0].taskId, "task-2");
  assert.equal(records[0].coverage, "high");
  assert.equal(records[0].documentQuality, "high");
  assert.equal(records[0].hasPrimaryContent, true);
});

test("normalizeResearchEvidence keeps distinct numeric claim facts from merging unsafely", () => {
  const records = normalizeResearchEvidence([
    {
      task: {
        id: "task-1",
        subquestionId: "sq-1",
        kind: "search",
      },
      result: {
        selectedProvider: "ddg",
        results: [
          {
            title: "Provider count",
            url: "https://example.com/providers-a",
            content: "The platform supports 12 providers today.",
          },
        ],
      },
    },
    {
      task: {
        id: "task-2",
        subquestionId: "sq-1",
        kind: "search",
      },
      result: {
        selectedProvider: "ddg",
        results: [
          {
            title: "Provider count",
            url: "https://example.com/providers-b",
            content: "The platform supports 14 providers today.",
          },
        ],
      },
    },
  ], {
    retrievedAt: Date.parse("2026-03-13T00:00:00.000Z"),
  });

  assert.equal(records.length, 2);
  assert.notEqual(records[0].claimKey, records[1].claimKey);
});
