import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNormalizedClaimKey,
  extractClaimFacts,
  normalizeClaimText,
} from "../scripts/lib/research/claim-normalize.mjs";

test("normalizeClaimText standardizes common research phrasing", () => {
  assert.equal(
    normalizeClaimText("Official documentation releases v1.2 updates"),
    "official documentation release version 1.2 release",
  );
});

test("extractClaimFacts keeps numeric facts that should prevent unsafe merges", () => {
  assert.deepEqual(
    extractClaimFacts("The platform supports 12 providers and a 95% success rate in v1.2."),
    ["12", "95%", "v1.2"],
  );
});

test("buildNormalizedClaimKey keeps negative claims separate from positive claims", () => {
  const positive = buildNormalizedClaimKey("The platform supports browser render.");
  const negative = buildNormalizedClaimKey("The platform does not support browser render.");

  assert.notEqual(positive, negative);
});
