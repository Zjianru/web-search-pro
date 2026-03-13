import test from "node:test";
import assert from "node:assert/strict";

import { buildResearchSearchQuery } from "../scripts/lib/research/question-templates.mjs";

test("buildResearchSearchQuery tailors search phrasing by intent", () => {
  assert.equal(
    buildResearchSearchQuery("OpenClaw search skill landscape", "overview", "landscape"),
    "OpenClaw search skill landscape ecosystem overview",
  );
  assert.equal(
    buildResearchSearchQuery("OpenClaw search skill landscape", "latest", "landscape"),
    "OpenClaw search skill landscape latest updates",
  );
  assert.equal(
    buildResearchSearchQuery("OpenClaw search skill landscape", "official-sources", "landscape"),
    "OpenClaw search skill landscape official documentation primary sources",
  );
});

test("buildResearchSearchQuery adapts docs and timeline topics", () => {
  assert.equal(
    buildResearchSearchQuery("OpenClaw documentation structure", "site-structure", "docs"),
    "OpenClaw documentation structure documentation sitemap structure",
  );
  assert.equal(
    buildResearchSearchQuery("OpenClaw release history", "timeline", "latest"),
    "OpenClaw release history release timeline version history",
  );
});
