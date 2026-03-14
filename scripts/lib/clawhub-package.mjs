import fs from "node:fs";
import path from "node:path";

const OPTIONAL_ENV_DISCLOSURE = {
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
};

const OMIT_PREFIXES = Object.freeze([
  ".git/",
  ".cache/",
  "tests/",
  "test-results/",
  "eval/",
]);

const OMIT_FILES = Object.freeze(
  new Set([
    ".gitignore",
    "CHANGELOG.md",
    "SKILL.md",
    "README.md",
    "scripts/render.mjs",
    "scripts/eval.mjs",
    "scripts/build-clawhub-package.mjs",
    "scripts/engines/render.mjs",
    "scripts/lib/clawhub-package.mjs",
    "scripts/lib/eval-runner.mjs",
    "scripts/lib/eval-scorer.mjs",
    "scripts/lib/render-fetch.mjs",
    "scripts/lib/render-runtime.mjs",
    "scripts/lib/cdp-client.mjs",
    "docs/clawhub-compliance.md",
  ]),
);

const TEXT_TRANSFORMERS = Object.freeze({
  "scripts/lib/providers.mjs": transformProvidersSource,
  "scripts/extract.mjs": transformExtractCliSource,
  "scripts/research.mjs": transformResearchCliSource,
  "scripts/lib/doctor.mjs": transformDoctorSource,
  "scripts/review.mjs": transformReviewSource,
  "scripts/lib/planner.mjs": transformPlannerSource,
});

function replaceOrThrow(source, pattern, replacement, label) {
  const result = source.replace(pattern, replacement);
  if (result === source) {
    throw new Error(`Failed to apply ClawHub package transform: ${label}`);
  }
  return result;
}

function removeExactBlock(source, text, label) {
  if (!source.includes(text)) {
    throw new Error(`Failed to remove expected ClawHub package block: ${label}`);
  }
  return source.replace(text, "");
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function transformProvidersSource(source) {
  let result = normalizeLineEndings(source);

  result = removeExactBlock(
    result,
    'import * as renderEngine from "../engines/render.mjs";\n',
    "providers render engine import",
  );
  result = removeExactBlock(
    result,
    'import { detectRenderRuntime } from "./render-runtime.mjs";\n',
    "providers render runtime import",
  );
  result = replaceOrThrow(
    result,
    /\n  defineProvider\(\{\n    id: "render",[\s\S]*?\n  \}\),\n\]\);/,
    "\n]);",
    "providers render provider removal",
  );
  result = replaceOrThrow(
    result,
    /function resolveProviderRuntime\(provider, options = \{\}\) \{[\s\S]*?\n\}/,
    `function resolveProviderRuntime() {
  return {
    available: true,
    browserFamily: null,
    browserPath: null,
    launcher: null,
  };
}`,
    "providers runtime resolver",
  );
  result = replaceOrThrow(
    result,
    /    browserRender: configured\.some\(\(provider\) => provider\.id === "render"\),/,
    "    browserRender: false,",
    "providers browserRender summary",
  );

  return result;
}

function transformExtractCliSource(source) {
  let result = normalizeLineEndings(source);

  result = replaceOrThrow(
    result,
    /const EXTRACT_ENGINES = new Set\(\["tavily", "exa", "fetch", "render"\]\);/,
    'const EXTRACT_ENGINES = new Set(["tavily", "exa", "fetch"]);',
    "extract engine set",
  );
  result = replaceOrThrow(
    result,
    /  --engine <name>              Force engine: tavily\|exa\|fetch\|render \(default: auto\)\n  --max-chars <n>              Limit extracted readable text per URL\n  --render[\s\S]*?  --json                       Output stable JSON schema\n/,
    `  --engine <name>              Force engine: tavily|exa|fetch (default: auto)
  --max-chars <n>              Limit extracted readable text per URL
  --json                       Output stable JSON schema
`,
    "extract usage render options",
  );
  result = replaceOrThrow(
    result,
    /  render: false,\n  renderPolicy: null,\n  renderBudgetMs: null,\n  renderWaitUntil: null,\n/,
    "",
    "extract render opts",
  );
  result = replaceOrThrow(
    result,
    /  if \(arg === "--render"\) \{[\s\S]*?continue;\n  \}\n/,
    "",
    "extract render flag parser",
  );
  result = replaceOrThrow(
    result,
    /if \(\n  opts\.renderBudgetMs !== null &&[\s\S]*?\n\}\n\n/,
    "",
    "extract render budget validation",
  );
  result = replaceOrThrow(
    result,
    /const renderOverrides =[\s\S]*?const \{ config \} = loadRuntimeConfig\(\{\n  cwd,\n  env,\n  overrides: \{\n/,
    `const renderOverrides = {};
const { config } = loadRuntimeConfig({
  cwd,
  env,
  overrides: {
`,
    "extract render overrides",
  );

  return result;
}

function transformResearchCliSource(source) {
  let result = normalizeLineEndings(source);

  result = replaceOrThrow(
    result,
    /  --max-crawl-pages <n>      Maximum crawl pages for research tasks \(default: 12\)\n  --allow-render             Allow the browser render lane inside research\n  --no-crawl                 Disable crawl tasks even when the planner would use them\n/,
    `  --max-crawl-pages <n>      Maximum crawl pages for research tasks (default: 12)
  --no-crawl                 Disable crawl tasks even when the planner would use them
`,
    "research usage allow-render",
  );
  result = removeExactBlock(result, "  allowRender: false,\n", "research allowRender option");
  result = replaceOrThrow(
    result,
    /  if \(arg === "--allow-render"\) \{[\s\S]*?continue;\n  \}\n/,
    "",
    "research allow-render parser",
  );
  result = replaceOrThrow(
    result,
    /    allowRender: cli\.allowRender,\n/,
    "    allowRender: false,\n",
    "research request allowRender default",
  );

  return result;
}

function transformDoctorSource(source) {
  let result = normalizeLineEndings(source);

  result = removeExactBlock(
    result,
    '  const renderProvider = snapshot.providers.find((provider) => provider.id === "render");\n',
    "doctor render provider",
  );
  result = replaceOrThrow(
    result,
    /\n    renderLane: \{[\s\S]*?\n    \},/,
    "",
    "doctor renderLane payload",
  );
  result = replaceOrThrow(
    result,
    /\n  lines\.push\("## Browser Render Lane"\);[\s\S]*?lines\.push\(`- Same-origin only: \$\{report\.renderLane\.sameOriginOnly \? "yes" : "no"\}`\);\n/,
    "",
    "doctor renderLane markdown",
  );

  return result;
}

function transformReviewSource(source) {
  let result = normalizeLineEndings(source);

  result = replaceOrThrow(
    result,
    /\n  lines\.push\("## Browser Render Lane"\);[\s\S]*?lines\.push\(`- Blocked resources: \$\{report\.renderLane\.blockTypes\.join\(", "\) \|\| "none"\}`\);\n/,
    "",
    "review renderLane markdown",
  );
  result = removeExactBlock(result, "  renderLane: doctor.renderLane,\n", "review renderLane payload");

  return result;
}

function transformPlannerSource(source) {
  let result = normalizeLineEndings(source);

  result = replaceOrThrow(
    result,
    /function buildRenderPlan\(plan, config, options = \{\}\) \{\n  const renderProvider = getProvider\("render"\);/,
    `function buildRenderPlan(plan, config, options = {}) {
  const renderProvider = getProvider("render");
  if (!renderProvider) {
    return null;
  }`,
    "planner render provider guard",
  );

  return result;
}

function buildClawhubReadme() {
  return `# Web Search Pro 2.1 Core Profile

\`web-search-pro\` is a search skill and local retrieval runtime for agents. This ClawHub package
ships the narrower core profile: enough to search, extract, crawl, map, and assemble research
packs, while keeping the published artifact review-friendly.

It is a code-backed Node runtime package, not an instruction-only bundle.

## What This Core Profile Is

Use this package when you want:

- live web search and news search
- docs lookup and code lookup
- explainable routing
- visible federated-search gains
- extract, crawl, map, and research flows
- a real no-key baseline before adding premium providers

This package is not the full repository surface. It is the ClawHub install profile that focuses on
the core retrieval path.

## Quick Start

The shortest successful path is:

- Option A: No-key baseline
- Option B: Add one premium provider
- Then try docs, news, and research

### Option A: No-key baseline

No API key is required for the first successful run.

\`\`\`bash
node scripts/doctor.mjs --json
node scripts/bootstrap.mjs --json
node scripts/search.mjs "OpenAI Responses API docs" --json
\`\`\`

### Option B: Add one premium provider

If you only add one premium provider, start with \`TAVILY_API_KEY\`.

\`\`\`bash
export TAVILY_API_KEY=tvly-xxxxx
node scripts/doctor.mjs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
\`\`\`

### First successful searches

\`\`\`bash
node scripts/search.mjs "OpenClaw web search" --json
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node scripts/extract.mjs "https://platform.openai.com/docs" --json
\`\`\`

### Then try docs, news, and research

\`\`\`bash
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json
\`\`\`

## Install Model

ClawHub installs this bundle directly as a code-backed Node skill pack.

- hard runtime requirement: \`node\`
- no remote installer, curl-to-shell bootstrap, or Python helper transport in the baseline path
- optional runtime config file: \`config.json\`
- local state directory: \`.cache/web-search-pro\`

## Why Federated Search Matters

Federation is not just "more providers". It exposes compact gain metrics:

- \`federated.value.additionalProvidersUsed\`
- \`federated.value.resultsRecoveredByFanout\`
- \`federated.value.resultsCorroboratedByFanout\`
- \`federated.value.duplicateSavings\`
- \`routingSummary.federation.value\`

## What This Package Includes

- \`search.mjs\`
- \`extract.mjs\`
- \`crawl.mjs\`
- \`map.mjs\`
- \`research.mjs\`
- \`doctor.mjs\`
- \`bootstrap.mjs\`
- \`capabilities.mjs\`
- \`review.mjs\`
- \`cache.mjs\`
- \`health.mjs\`

## Runtime Contract

- \`selectedProvider\`
  The planner's primary route.
- \`routingSummary\`
  Compact route explanation with confidence and federation summary.
- \`federated.providersUsed\`
  Providers that actually returned results when fanout is active.
- \`federated.value\`
  Compact federation gain summary.
- \`cached\` / \`cache\`
  Cache hit and TTL telemetry for agents.
- \`topicType\`, \`topicSignals\`, \`researchAxes\`
  Compact planning summaries for the model-facing research pack.

## Baseline And Optional Providers

No API key is required for the baseline.

Optional provider credentials or endpoints unlock higher-quality retrieval:

\`\`\`bash
TAVILY_API_KEY=tvly-xxxxx
EXA_API_KEY=exa-xxxxx
QUERIT_API_KEY=xxxxx
SERPER_API_KEY=xxxxx
BRAVE_API_KEY=xxxxx
SERPAPI_API_KEY=xxxxx
YOU_API_KEY=xxxxx
SEARXNG_INSTANCE_URL=https://searx.example.com

# Perplexity / Sonar: choose one transport path
PERPLEXITY_API_KEY=xxxxx
OPENROUTER_API_KEY=xxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1  # optional override
KILOCODE_API_KEY=xxxxx

# Or use a custom OpenAI-compatible gateway
PERPLEXITY_GATEWAY_API_KEY=xxxxx
PERPLEXITY_BASE_URL=https://gateway.example.com/v1
PERPLEXITY_MODEL=perplexity/sonar-pro  # accepts sonar* or perplexity/sonar*
\`\`\`

The baseline remains:

- \`ddg\` for best-effort search
- \`fetch\` for extract / crawl / map fallback

## Core Commands

\`\`\`bash
node scripts/search.mjs "OpenClaw web search" --plan --json
node scripts/extract.mjs "https://example.com/article" --json
node scripts/crawl.mjs "https://example.com/docs" --depth 2 --max-pages 10 --json
node scripts/map.mjs "https://example.com/docs" --depth 2 --max-pages 50 --json
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json
node scripts/doctor.mjs --json
node scripts/bootstrap.mjs --json
node scripts/review.mjs --json
\`\`\`

## Why This Is A Core Profile

The GitHub repository contains the full \`2.1\` source tree, including extra local-only developer
surfaces and validation tooling. The ClawHub publish package intentionally keeps the installed
artifact smaller so the registry package stays honest about its runtime shape.

The shipped core profile runs with Node plus direct network access through \`curl\` or built-in
\`fetch\`; it does not rely on Python helper transports.

Search keywords:

\`web search\`, \`news search\`, \`latest updates\`, \`current events\`, \`docs search\`,
\`API docs\`, \`code search\`, \`company research\`, \`competitor analysis\`, \`site crawl\`,
\`site map\`, \`multilingual search\`, \`Baidu search\`, \`answer-first search\`,
\`cited answers\`, \`explainable routing\`, \`no-key baseline\`

Full source:
- https://github.com/Zjianru/web-search-pro
`;
}

function buildClawhubSkillMarkdown() {
  const optionalRuntimeDisclosure = {
    bins: ["node"],
    config: ["config.json"],
    env: OPTIONAL_ENV_DISCLOSURE,
    note: "No API key is required for the baseline. Optional provider credentials or endpoints widen retrieval coverage.",
  };
  const metadata = {
    openclaw: {
      emoji: "🔎",
      requires: optionalRuntimeDisclosure,
    },
    clawdbot: {
      emoji: "🔎",
      requires: {
        bins: ["node"],
        config: ["config.json"],
        note: optionalRuntimeDisclosure.note,
      },
      install: [
        {
          kind: "node",
          label: "Bundled Node skill runtime",
          bins: ["node"],
        },
      ],
      config: {
        stateDirs: [".cache/web-search-pro"],
        example: `{
  env = {
    WEB_SEARCH_PRO_CONFIG = "./config.json";
  };
}`,
      },
      cliHelp: "node {baseDir}/scripts/search.mjs --help",
    },
  };

  return `---
name: web-search-pro
description: |
  Agent-first web search and retrieval for live web search, news search, docs lookup, code
  lookup, company research, site crawl, site map, and structured evidence packs.
  Includes a no-key baseline plus optional Tavily, Exa, Querit, Serper, Brave, SerpAPI, You.com,
  SearXNG, and Perplexity / Sonar providers for wider coverage and answer-first routing.
homepage: https://github.com/Zjianru/web-search-pro
metadata: ${JSON.stringify(metadata)}
---

# Web Search Pro 2.1 Core Profile

This ClawHub package publishes the core retrieval profile of \`web-search-pro\`.
It is a code-backed Node runtime package, not an instruction-only bundle.

## Use This Skill When

- the caller needs live web search or news search
- the caller needs docs lookup or code lookup
- the caller may continue from search into extract, crawl, map, or research
- the agent needs explainable routing and visible federated-search gains
- the first run needs a real no-key baseline

## Quick Start

The shortest successful path is:

- Option A: No-key baseline
- Option B: Add one premium provider
- Then try docs, news, and research

### Option A: No-key baseline

No API key is required for the first successful run.

\`\`\`bash
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/bootstrap.mjs --json
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --json
\`\`\`

### Option B: Add one premium provider

If you only add one premium provider, start with \`TAVILY_API_KEY\`.

\`\`\`bash
export TAVILY_API_KEY=tvly-xxxxx
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/search.mjs "latest OpenAI news" --type news --json
\`\`\`

### First successful searches

\`\`\`bash
node {baseDir}/scripts/search.mjs "OpenClaw web search" --json
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node {baseDir}/scripts/extract.mjs "https://platform.openai.com/docs" --json
\`\`\`

### Then try docs, news, and research

\`\`\`bash
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --preset docs --json
node {baseDir}/scripts/search.mjs "latest OpenAI news" --type news --json
node {baseDir}/scripts/research.mjs "OpenClaw search skill landscape" --plan --json
\`\`\`

## Install Model

ClawHub installs this bundle directly as a code-backed Node skill pack.

- hard runtime requirement: \`node\`
- no remote installer, curl-to-shell bootstrap, or Python helper transport in the baseline path
- optional runtime config file: \`config.json\`
- local state directory: \`.cache/web-search-pro\`

## Why Federated Search Matters

Federation is not just "more providers". It exposes compact gain metrics:

- \`federated.value.additionalProvidersUsed\`
- \`federated.value.resultsRecoveredByFanout\`
- \`federated.value.resultsCorroboratedByFanout\`
- \`federated.value.duplicateSavings\`
- \`routingSummary.federation.value\`

## Runtime Contract

- \`selectedProvider\`
  The planner's primary route.
- \`routingSummary\`
  Compact route explanation with confidence and federation summary.
- \`routing.diagnostics\`
  Full route diagnostics exposed by \`--explain-routing\` or \`--plan\`.
- \`federated.providersUsed\`
  The providers that actually returned results when fanout is active.
- \`federated.value\`
  Compact federation gain summary for added providers, recovered results, corroboration, and
  duplicate savings.
- \`cached\` / \`cache\`
  Cache hit plus TTL telemetry for agents.
- \`topicType\`, \`topicSignals\`, \`researchAxes\`
  Structured planning summaries for the model-facing research pack.

## Commands By Task

Included commands:

- \`search.mjs\`
- \`extract.mjs\`
- \`crawl.mjs\`
- \`map.mjs\`
- \`research.mjs\`
- \`doctor.mjs\`
- \`bootstrap.mjs\`
- \`capabilities.mjs\`
- \`review.mjs\`
- \`cache.mjs\`
- \`health.mjs\`

Runtime notes:

- Node is the only hard runtime requirement.
- No API key is required for the baseline.
- Optional provider credentials or endpoints widen coverage.
- Baseline outbound requests use \`curl\` when available and fall back to built-in \`fetch\`.

Baseline:

- No API key is required for the baseline.
- \`ddg\` is best-effort no-key search.
- \`fetch\` is the no-key extract / crawl / map fallback.

Optional provider credentials or endpoints unlock stronger coverage:

\`\`\`bash
TAVILY_API_KEY=tvly-xxxxx
EXA_API_KEY=exa-xxxxx
QUERIT_API_KEY=xxxxx
SERPER_API_KEY=xxxxx
BRAVE_API_KEY=xxxxx
SERPAPI_API_KEY=xxxxx
YOU_API_KEY=xxxxx
SEARXNG_INSTANCE_URL=https://searx.example.com

# Perplexity / Sonar: choose one transport path
PERPLEXITY_API_KEY=xxxxx
OPENROUTER_API_KEY=xxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1  # optional override
KILOCODE_API_KEY=xxxxx

# Or use a custom OpenAI-compatible gateway
PERPLEXITY_GATEWAY_API_KEY=xxxxx
PERPLEXITY_BASE_URL=https://gateway.example.com/v1
PERPLEXITY_MODEL=perplexity/sonar-pro  # accepts sonar* or perplexity/sonar*
\`\`\`

Review and diagnostics:

\`\`\`bash
node {baseDir}/scripts/capabilities.mjs --json
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/bootstrap.mjs --json
node {baseDir}/scripts/review.mjs --json
\`\`\`

Search keywords:

\`web search\`, \`news search\`, \`latest updates\`, \`current events\`, \`docs search\`,
\`API docs\`, \`code search\`, \`company research\`, \`competitor analysis\`, \`site crawl\`,
\`site map\`, \`multilingual search\`, \`Baidu search\`, \`answer-first search\`,
\`cited answers\`, \`explainable routing\`, \`no-key baseline\`
`;
}

function buildClawhubComplianceDoc() {
  return `# ClawHub Compliance

This package is the registry-facing core profile of \`web-search-pro\`.

## Audience

This document is for maintainers, reviewers, and security-minded users who need to understand why
the ClawHub package is narrower than the full repository and what the registry-facing trust story
actually is.

## Compliance Posture

The goal of this profile is to keep the published artifact aligned with what the registry can
reason about:

- honest hard requirement disclosure
- explicit optional provider env disclosure
- a narrower runtime surface
- a smaller static scan surface

## Hard Requirements

The only hard runtime requirement is:

- \`node\`

## Optional Provider Credentials

The following env vars are optional and widen retrieval quality:

- \`TAVILY_API_KEY\`
- \`EXA_API_KEY\`
- \`QUERIT_API_KEY\`
- \`SERPER_API_KEY\`
- \`BRAVE_API_KEY\`
- \`SERPAPI_API_KEY\`
- \`YOU_API_KEY\`
- \`PERPLEXITY_API_KEY\`
- \`OPENROUTER_API_KEY\`
- \`KILOCODE_API_KEY\`
- \`PERPLEXITY_GATEWAY_API_KEY\`
- \`PERPLEXITY_BASE_URL\`
- \`SEARXNG_INSTANCE_URL\`

No API key is required for the baseline.

## No-Key Baseline

The baseline is real but bounded:

- \`ddg\` provides best-effort search
- \`fetch\` provides extract / crawl / map fallback

If the no-key baseline degrades, \`doctor.mjs\` and \`review.mjs\` surface that status instead of
pretending the baseline is always healthy.

## Safe Fetch Boundary

Safe Fetch remains the default network boundary:

- only \`http\` and \`https\`
- blocks credential-bearing URLs
- blocks localhost / private / metadata targets
- revalidates redirects
- blocks unsupported binary downloads
- keeps JavaScript execution disabled

## Review Surfaces

Use:

- \`node scripts/capabilities.mjs --json\`
- \`node scripts/doctor.mjs --json\`
- \`node scripts/bootstrap.mjs --json\`
- \`node scripts/review.mjs --json\`

These commands expose:

- configured providers
- no-key baseline status
- activation paths such as native / gateway-backed provider lanes
- federated retrieval summary
- provider health and degradation
`;
}

function shouldOmitPath(relativePath) {
  if (OMIT_FILES.has(relativePath)) {
    return true;
  }
  return OMIT_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function listSourceFiles(rootDir, relativeDir = "") {
  const currentDir = path.join(rootDir, relativeDir);
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (shouldOmitPath(relativePath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(rootDir, relativePath));
      continue;
    }
    files.push(relativePath);
  }

  return files.sort();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function transformTextFile(relativePath, content) {
  const transformer = TEXT_TRANSFORMERS[relativePath];
  return transformer ? transformer(content) : content;
}

export function createClawhubPackage({ sourceDir, outputDir }) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const relativePath of listSourceFiles(sourceDir)) {
    if (relativePath === "LICENSE") {
      const destination = path.join(outputDir, relativePath);
      ensureParentDir(destination);
      fs.copyFileSync(path.join(sourceDir, relativePath), destination);
      continue;
    }
    if (!relativePath.startsWith("scripts/")) {
      continue;
    }

    const sourcePath = path.join(sourceDir, relativePath);
    const destinationPath = path.join(outputDir, relativePath);
    ensureParentDir(destinationPath);
    const content = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(destinationPath, transformTextFile(relativePath, content));
  }

  ensureParentDir(path.join(outputDir, "README.md"));
  fs.writeFileSync(path.join(outputDir, "README.md"), buildClawhubReadme());
  fs.writeFileSync(path.join(outputDir, "SKILL.md"), buildClawhubSkillMarkdown());
  ensureParentDir(path.join(outputDir, "docs", "clawhub-compliance.md"));
  fs.writeFileSync(
    path.join(outputDir, "docs", "clawhub-compliance.md"),
    buildClawhubComplianceDoc(),
  );
}

export const CLAWHUB_PACKAGE_METADATA = Object.freeze({
  optionalEnvDisclosure: OPTIONAL_ENV_DISCLOSURE,
});
