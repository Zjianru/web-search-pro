import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const BUILD_SCRIPT = path.join(ROOT, "scripts", "build-clawhub-package.mjs");

function buildPackage() {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-search-pro-clawhub-"));
  execFileSync("node", [BUILD_SCRIPT, "--output", outputDir], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return outputDir;
}

function runNode(cwd, args) {
  return execFileSync("node", args, {
    cwd,
    encoding: "utf8",
  });
}

function readFile(cwd, relativePath) {
  return fs.readFileSync(path.join(cwd, relativePath), "utf8");
}

test("build-clawhub-package emits a slim publishable package", () => {
  const outputDir = buildPackage();

  assert.equal(fs.existsSync(path.join(outputDir, "tests")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "test-results")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "eval")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "render.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "eval.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "build-clawhub-package.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "lib", "render-fetch.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "lib", "render-runtime.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "lib", "clawhub-package.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "lib", "eval-runner.mjs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "lib", "eval-scorer.mjs")), false);

  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "search.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "extract.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "crawl.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "map.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "research.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "doctor.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "bootstrap.mjs")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "scripts", "review.mjs")), true);
});

test("build-clawhub-package generates registry-facing metadata and docs", () => {
  const outputDir = buildPackage();
  const skill = readFile(outputDir, "SKILL.md");
  const readme = readFile(outputDir, "README.md");

  const metadataMatch = skill.match(/^metadata:\s+(.+)$/m);
  assert.ok(metadataMatch, "generated package must contain metadata");
  const metadata = JSON.parse(metadataMatch[1]);

  assert.deepEqual(metadata.openclaw.requires.bins, ["node"]);
  assert.deepEqual(metadata.openclaw.requires.env, {
    TAVILY_API_KEY: "optional — premium deep search, news, and extract",
    EXA_API_KEY: "optional — semantic search and extract fallback",
    QUERIT_API_KEY: "optional — multilingual AI search with native geo and language filters",
    SERPER_API_KEY: "optional — Google-like search and news",
    BRAVE_API_KEY: "optional — structured web search aligned with existing OpenClaw setups",
    SERPAPI_API_KEY: "optional — multi-engine search including Baidu",
    YOU_API_KEY: "optional — LLM-ready web search with freshness and locale support",
    PERPLEXITY_API_KEY: "optional — native Perplexity Sonar access",
    OPENROUTER_API_KEY: "optional — gateway access to Perplexity/Sonar via OpenRouter",
    KILOCODE_API_KEY: "optional — gateway access to Perplexity/Sonar via Kilo",
    PERPLEXITY_GATEWAY_API_KEY: "optional — custom gateway key for Perplexity/Sonar models",
    PERPLEXITY_BASE_URL: "optional — required with PERPLEXITY_GATEWAY_API_KEY",
    SEARXNG_INSTANCE_URL: "optional — self-hosted privacy-first metasearch endpoint",
  });
  assert.match(String(metadata.openclaw.requires.note ?? ""), /No API key is required/i);

  assert.doesNotMatch(skill, /render\.mjs/);
  assert.doesNotMatch(skill, /renderLane/);
  assert.doesNotMatch(readme, /render\.mjs/);
  assert.doesNotMatch(readme, /renderLane/);
  assert.match(readme, /ClawHub/i);
  assert.match(readme, /optional provider credentials or endpoints/i);
});

test("generated package removes render-facing CLI surface but keeps core runtime healthy", async () => {
  const outputDir = buildPackage();
  const extractHelp = runNode(outputDir, ["scripts/extract.mjs", "--help"]);
  const researchHelp = runNode(outputDir, ["scripts/research.mjs", "--help"]);
  const doctorPayload = JSON.parse(runNode(outputDir, ["scripts/doctor.mjs", "--json"]));
  const bootstrapPayload = JSON.parse(runNode(outputDir, ["scripts/bootstrap.mjs", "--json"]));
  const reviewPayload = JSON.parse(runNode(outputDir, ["scripts/review.mjs", "--json"]));
  const planPayload = JSON.parse(
    runNode(outputDir, ["scripts/search.mjs", "OpenAI platform docs overview", "--plan", "--json"]),
  );

  assert.doesNotMatch(extractHelp, /--render/);
  assert.doesNotMatch(extractHelp, /Force engine: .*render/);
  assert.doesNotMatch(researchHelp, /--allow-render/);

  assert.equal("renderLane" in doctorPayload, false);
  assert.equal(bootstrapPayload.command, "bootstrap");
  assert.equal("renderLane" in reviewPayload, false);
  assert.equal(doctorPayload.status === "ready" || doctorPayload.status === "degraded", true);
  assert.equal(planPayload.command, "search");
  assert.equal(typeof planPayload.selectedProvider, "string");
});
