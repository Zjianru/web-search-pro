import test from "node:test";
import assert from "node:assert/strict";

import { buildClaimClusters } from "../scripts/lib/research/claim-cluster.mjs";

test("buildClaimClusters groups evidence by subquestion and claim key", () => {
  const clusters = buildClaimClusters([
    {
      id: "ev-1",
      subquestionId: "sq-1",
      claimKey: "official-routing",
      claims: ["OpenClaw documents provider routing."],
      authority: "official",
      freshness: "current",
      coverage: "high",
      conflictsWith: [],
    },
    {
      id: "ev-2",
      subquestionId: "sq-1",
      claimKey: "official-routing",
      claims: ["OpenClaw documents provider routing and health."],
      authority: "primary",
      freshness: "recent",
      coverage: "medium",
      conflictsWith: [],
    },
    {
      id: "ev-3",
      subquestionId: "sq-2",
      claimKey: "community-disagreement",
      claims: ["Community sources disagree on provider quality."],
      authority: "reputable-third-party",
      freshness: "recent",
      coverage: "medium",
      conflictsWith: ["ev-4"],
    },
  ]);

  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].evidenceIds.length, 2);
  assert.equal(clusters[0].authority, "official");
  assert.equal(clusters[0].freshness, "current");
  assert.equal(clusters[0].sourceDiversity, "high");
  assert.equal(clusters[0].claimConsistency, "medium");
});
