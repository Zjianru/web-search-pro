import test from "node:test";
import assert from "node:assert/strict";

import { normalizeResearchRequest } from "../scripts/lib/research/request.mjs";

test("normalizeResearchRequest applies pack defaults for model-facing research", () => {
  const request = normalizeResearchRequest({
    topic: "OpenClaw search skill landscape",
  });

  assert.equal(request.topic, "OpenClaw search skill landscape");
  assert.equal(request.objective, "structured research pack");
  assert.equal(request.output.format, "pack");
  assert.equal(request.output.language, "match-input");
  assert.equal(request.budgets.maxQuestions, 4);
  assert.equal(request.budgets.maxSearches, 8);
  assert.equal(request.budgets.maxExtracts, 6);
  assert.equal(request.budgets.maxCrawlPages, 12);
  assert.equal(request.budgets.allowFederation, true);
  assert.equal(request.budgets.allowCrawl, true);
  assert.equal(request.budgets.allowRender, false);
});

test("normalizeResearchRequest trims values and keeps explicit overrides", () => {
  const request = normalizeResearchRequest({
    topic: "  OpenClaw docs  ",
    objective: "  compare official docs and community writeups  ",
    scope: {
      includeDomains: [" docs.openclaw.ai ", " github.com "],
      seedUrls: [" https://example.com/docs "],
    },
    budgets: {
      maxQuestions: 5,
      maxSearches: 6,
      allowRender: true,
      allowCrawl: false,
    },
    output: {
      format: "brief",
      language: "zh",
    },
  });

  assert.equal(request.topic, "OpenClaw docs");
  assert.equal(request.objective, "compare official docs and community writeups");
  assert.deepEqual(request.scope.includeDomains, ["docs.openclaw.ai", "github.com"]);
  assert.deepEqual(request.scope.seedUrls, ["https://example.com/docs"]);
  assert.equal(request.budgets.maxQuestions, 5);
  assert.equal(request.budgets.maxSearches, 6);
  assert.equal(request.budgets.allowRender, true);
  assert.equal(request.budgets.allowCrawl, false);
  assert.equal(request.output.format, "brief");
  assert.equal(request.output.language, "zh");
});
