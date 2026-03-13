import test from "node:test";
import assert from "node:assert/strict";

import { parseDuckDuckGoHtml } from "../scripts/lib/ddg-parser.mjs";

const SAMPLE_HTML = `
<div class="result results_links results_links_deep web-result ">
  <div class="links_main links_deep result__body">
    <h2 class="result__title">
      <a
        rel="nofollow"
        class="result__a"
        href="https://docs.openclaw.ai/tools/web"
      >Web Tools - OpenClaw</a>
    </h2>
    <div class="result__extras">
      <div class="result__extras__url">
        <a
          class="result__url"
          href="https://docs.openclaw.ai/tools/web"
        >docs.openclaw.ai/tools/web</a>
      </div>
    </div>
    <a
      class="result__snippet"
      href="https://docs.openclaw.ai/tools/web"
    ><b>OpenClaw</b> ships two lightweight <b>web</b> tools.</a>
  </div>
</div>
`;

test("DuckDuckGo HTML parser extracts title, URL, and snippet", () => {
  const results = parseDuckDuckGoHtml(SAMPLE_HTML, 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Web Tools - OpenClaw");
  assert.equal(results[0].url, "https://docs.openclaw.ai/tools/web");
  assert.match(results[0].content, /OpenClaw ships two lightweight web tools/);
});
