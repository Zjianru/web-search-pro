import test from "node:test";
import assert from "node:assert/strict";

import { curateResearchEntry } from "../scripts/lib/research/noise-filter.mjs";

test("curateResearchEntry drops anti-bot interstitial pages", () => {
  const curated = curateResearchEntry({
    taskKind: "extract",
    entry: {
      title: "Just a moment...",
      url: "https://example.com/docs",
      content: "Verify you are human. Enable JavaScript and cookies to continue.",
      snippet: "Verify you are human.",
    },
    sourceType: "article",
  });

  assert.equal(curated.dropped, true);
  assert.equal(curated.dropReason, "interstitial");
});

test("curateResearchEntry drops link-list pages that do not contain real document body text", () => {
  const curated = curateResearchEntry({
    taskKind: "extract",
    entry: {
      title: "Skills - OpenClaw",
      url: "https://docs.openclaw.ai/tools/skills",
      content: [
        "[ ](https://docs.openclaw.ai/tools/skills#content-area).",
        "* [Tools](https://docs.openclaw.ai/tools).",
        "* [Diffs](https://docs.openclaw.ai/tools/diffs).",
        "* [Skills](https://docs.openclaw.ai/tools/skills).",
        "* [Plugins](https://docs.openclaw.ai/tools/plugin).",
      ].join("\n"),
      snippet: "* [Tools](https://docs.openclaw.ai/tools). * [Skills](https://docs.openclaw.ai/tools/skills).",
    },
    sourceType: "docs",
  });

  assert.equal(curated.dropped, true);
  assert.equal(curated.dropReason, "low-signal");
});
