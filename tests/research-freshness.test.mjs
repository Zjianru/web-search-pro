import test from "node:test";
import assert from "node:assert/strict";

import { classifyEvidenceFreshness } from "../scripts/lib/research/evidence-normalize.mjs";

test("classifyEvidenceFreshness scores evidence age buckets", () => {
  const now = Date.parse("2026-03-13T00:00:00.000Z");

  assert.equal(classifyEvidenceFreshness("2026-03-01", now), "current");
  assert.equal(classifyEvidenceFreshness("2025-12-20", now), "recent");
  assert.equal(classifyEvidenceFreshness("2025-01-01", now), "stale");
  assert.equal(classifyEvidenceFreshness(null, now), "unknown");
});
