import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SKILL_PATH = path.resolve(process.cwd(), "SKILL.md");
const content = fs.readFileSync(SKILL_PATH, "utf8");

function getMetadataObject(markdown) {
  const match = markdown.match(/^metadata:\s+(.+)$/m);
  assert.ok(match, "metadata frontmatter line must exist");
  return JSON.parse(match[1]);
}

test("skill metadata does not overstate credential requirements", () => {
  const metadata = getMetadataObject(content);
  const openclaw = metadata.openclaw ?? {};
  const clawdbot = metadata.clawdbot ?? {};

  assert.deepEqual(openclaw.requires?.bins ?? [], ["node"]);
  assert.equal(openclaw.always, undefined);
  assert.equal(openclaw.primaryEnv, undefined);
  assert.deepEqual(openclaw.requires?.env ?? [], []);

  assert.deepEqual(clawdbot.requires?.bins ?? [], ["node"]);
  assert.deepEqual(clawdbot.requires?.env ?? [], []);
  assert.equal(typeof clawdbot.cliHelp, "string");
  assert.match(clawdbot.cliHelp, /search\.mjs --help/);
});

test("skill documentation explains the no-key baseline and optional provider keys", () => {
  assert.match(content, /No API key is required for the baseline/i);
  assert.match(content, /Optional provider credentials or endpoints unlock enhanced features/i);
  assert.match(content, /doctor\.mjs/);
  assert.match(content, /bootstrap\.mjs/);
  assert.match(content, /capabilities\.mjs/);
  assert.match(content, /review\.mjs/);
  assert.match(content, /cache\.mjs/);
  assert.match(content, /health\.mjs/);
  assert.match(content, /eval\.mjs/);
  assert.match(content, /enableFederation/);
  assert.match(content, /federated/);
  assert.match(content, /render\.mjs/);
  assert.match(content, /render\.enabled/);
  assert.match(content, /render\.policy/);
  assert.match(content, /renderLane/);
  assert.match(content, /headless browser/i);
  assert.match(content, /map\.mjs/);
  assert.match(content, /config\.json/);
  assert.match(content, /--plan/);
});
