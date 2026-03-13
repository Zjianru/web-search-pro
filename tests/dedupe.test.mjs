import test from "node:test";
import assert from "node:assert/strict";

import { canonicalizeUrl, dedupeFederatedResults } from "../scripts/lib/dedupe.mjs";

test("canonicalizeUrl strips tracking params and hashes while normalizing pathname", () => {
  assert.equal(
    canonicalizeUrl("https://Example.com/docs/?utm_source=test&b=2&a=1#section"),
    "https://example.com/docs?a=1&b=2",
  );
});

test("dedupeFederatedResults removes exact URL duplicates and tracks exact drops", () => {
  const deduped = dedupeFederatedResults([
    {
      title: "OpenClaw docs",
      url: "https://example.com/docs?utm_source=test",
      content: "Primary result",
      providerId: "serper",
      providerIds: ["serper"],
      federationScore: 0.82,
    },
    {
      title: "OpenClaw docs",
      url: "https://example.com/docs",
      content: "Duplicate result",
      providerId: "tavily",
      providerIds: ["tavily"],
      federationScore: 0.75,
    },
  ]);

  assert.equal(deduped.results.length, 1);
  assert.equal(deduped.stats.dedupedUrls, 1);
  assert.equal(deduped.stats.nearDuplicateDrops, 0);
  assert.deepEqual(deduped.results[0].providerIds.sort(), ["serper", "tavily"]);
});

test("dedupeFederatedResults removes strong near duplicates by host and normalized title", () => {
  const deduped = dedupeFederatedResults([
    {
      title: "OpenClaw Release Notes",
      url: "https://docs.example.com/releases/openclaw-1-2",
      content: "OpenClaw release notes for version 1.2 with stability improvements.",
      publishedDate: "2026-03-10T00:00:00.000Z",
      providerId: "tavily",
      providerIds: ["tavily"],
      federationScore: 0.86,
    },
    {
      title: "OpenClaw release notes",
      url: "https://docs.example.com/blog/openclaw-1-2-release",
      content: "OpenClaw release notes for version 1.2 with stability improvements.",
      publishedDate: "2026-03-10T08:00:00.000Z",
      providerId: "serper",
      providerIds: ["serper"],
      federationScore: 0.72,
    },
  ]);

  assert.equal(deduped.results.length, 1);
  assert.equal(deduped.stats.dedupedUrls, 0);
  assert.equal(deduped.stats.nearDuplicateDrops, 1);
});

test("dedupeFederatedResults keeps same-host same-title pages when evidence differs materially", () => {
  const deduped = dedupeFederatedResults([
    {
      title: "OpenClaw Release Notes",
      url: "https://docs.example.com/releases/openclaw-1-2",
      content: "Release notes for version 1.2 focusing on reliability work.",
      publishedDate: "2026-03-10T00:00:00.000Z",
      providerId: "tavily",
      providerIds: ["tavily"],
      federationScore: 0.86,
    },
    {
      title: "OpenClaw Release Notes",
      url: "https://docs.example.com/releases/openclaw-1-1",
      content: "Release notes for version 1.1 focusing on onboarding changes.",
      publishedDate: "2026-01-10T00:00:00.000Z",
      providerId: "serper",
      providerIds: ["serper"],
      federationScore: 0.72,
    },
  ]);

  assert.equal(deduped.results.length, 2);
  assert.equal(deduped.stats.nearDuplicateDrops, 0);
});
