import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { detectRenderRuntime } from "../scripts/lib/render-runtime.mjs";

const ROOT = process.cwd();
const SKIP = process.env.WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE === "1";
const RENDER_RUNTIME = detectRenderRuntime();

function runScript(scriptPath, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, scriptPath), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test(
  "ddg search smoke returns live search results",
  { skip: SKIP ? "WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE=1" : false },
  (t) => {
    const result = runScript("scripts/search.mjs", [
      "OpenClaw web search",
      "--engine",
      "ddg",
      "--json",
    ]);

    if (result.status !== 0 && /DuckDuckGo search failed \(202\)/i.test(result.stderr)) {
      t.skip("DuckDuckGo HTML endpoint returned a 202 challenge page");
      return;
    }

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.command, "search");
    assert.equal(payload.selectedProvider, "ddg");
    assert.ok(payload.results.length > 0);
  },
);

test(
  "crawl smoke extracts readable content from example.com",
  { skip: SKIP ? "WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE=1" : false },
  () => {
    const result = runScript("scripts/crawl.mjs", ["https://example.com", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.command, "crawl");
    assert.ok(payload.results.length >= 1);
    assert.match(payload.results[0].content, /Example Domain/i);
  },
);

test(
  "render smoke extracts rendered DOM from example.com with the browser lane",
  {
    skip: SKIP
      ? "WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE=1"
      : !RENDER_RUNTIME.available
        ? "browser render runtime unavailable"
        : false,
  },
  () => {
    const result = runScript("scripts/render.mjs", ["https://example.com", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.command, "render");
    assert.equal(payload.selectedProvider, "render");
    assert.ok(payload.results.length >= 1);
    assert.match(payload.results[0].content, /Example Domain/i);
  },
);
