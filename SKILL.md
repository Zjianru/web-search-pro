---
name: web-search-pro
description: |
  Agent-first web search and retrieval for live web search, news search, docs lookup, code
  lookup, company research, site crawl, site map, and structured evidence packs.
  Includes a real no-key baseline plus optional Tavily, Exa, Querit, Serper, Brave, SerpAPI,
  You.com, SearXNG, and Perplexity / Sonar providers for wider coverage and answer-first routing.
homepage: https://github.com/Zjianru/web-search-pro
metadata: {"openclaw":{"emoji":"🔎","requires":{"bins":["node"]}},"clawdbot":{"emoji":"🔎","requires":{"bins":["node"],"config":["config.json"]},"install":[{"kind":"node","label":"Bundled Node skill runtime","bins":["node"]}],"config":{"stateDirs":[".cache/web-search-pro"],"example":"{\\n  env = {\\n    WEB_SEARCH_PRO_CONFIG = \\\"./config.json\\\";\\n  };\\n}"},"cliHelp":"node {baseDir}/scripts/search.mjs --help"}}
---

# Web Search Pro 2.1

This skill is for agents that need more than one-shot web search.

Use it when the caller needs:

- live web search or current-events lookup
- news search with explainable routing
- official docs, API docs, or code lookup
- company, product, or competitor research
- site crawl, site map, or docs discovery
- a structured evidence pack that can be handed back to an upstream model

This skill is not a narrative report writer. Its job is to search, retrieve, structure, and expose
evidence clearly enough that the upstream model can keep reasoning on top of it.

## Use This Skill When

- the task starts with web search but may continue into extraction or research
- the agent needs to know why a provider was selected
- the agent may need federated search instead of a single provider
- no-key baseline behavior matters for the first run
- runtime diagnostics or capability discovery are part of the workflow

## Do Not Use This Skill When

- the caller only wants the lightest possible single-shot web search wrapper
- the task expects a hosted scraping service
- the task expects the skill itself to write the final polished narrative report
- the caller needs an unlimited no-key search guarantee

## Quick Start

The shortest successful path is:

- start with the no-key baseline
- add one premium provider only when stronger recall or freshness is needed
- then try docs, news, and research flows

### Option A: No-key baseline

No API key is required for the first successful run.

Baseline roles:

- `ddg`: best-effort web search
- `fetch`: no-key extract / crawl / map fallback

```bash
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/bootstrap.mjs --json
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --json
```

What these commands are for:

- `doctor.mjs`: is the runtime usable right now?
- `bootstrap.mjs`: what can the agent rely on right now?
- `search.mjs`: prove the baseline retrieval path succeeds before adding provider credentials

### Option B: Add one premium provider

If only one premium provider is added, start with `TAVILY_API_KEY`.

Reason:

- one credential improves general web search
- one credential improves news search
- one credential improves extract quality

```bash
export TAVILY_API_KEY=tvly-xxxxx
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/search.mjs "latest OpenAI news" --type news --json
```

### First successful searches

```bash
node {baseDir}/scripts/search.mjs "OpenClaw web search" --json
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node {baseDir}/scripts/extract.mjs "https://platform.openai.com/docs" --json
```

### Then try docs, news, and research

```bash
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --preset docs --json
node {baseDir}/scripts/search.mjs "latest OpenAI news" --type news --json
node {baseDir}/scripts/research.mjs "OpenClaw search skill landscape" --plan --json
```

## Runtime Contract

The agent should treat these fields as the primary runtime contract.

### Routing fields

- `selectedProvider`
  The planner's primary route. It does not mean "the only provider used".
- `routingSummary`
  Compact route explanation with `selectionMode`, `confidence`, `topSignals`, alternatives, blocked
  providers, and federation summary.
- `routing.diagnostics`
  Full route diagnostics exposed by `--explain-routing` or `--plan`.

### Federation fields

- `federated.providersUsed`
  Providers that actually returned results when fanout is active.
- `federated.value.additionalProvidersUsed`
  Number of non-primary providers that really contributed.
- `federated.value.resultsRecoveredByFanout`
  Final results that would disappear in primary-only mode.
- `federated.value.resultsCorroboratedByFanout`
  Final results supported by both the primary and at least one fanout provider.
- `federated.value.duplicateSavings`
  Exact or near-duplicate results removed by merge.

### Cache and execution fields

- `cached`
  Whether the result came from cache.
- `cache`
  Cache age / TTL telemetry for agent decisions.
- `renderLane`
  Runtime availability and policy summary for the browser-backed render lane.
- `failed`
  Failed providers or failed retrieval units for the current command.
- `meta`
  Command-level execution metadata and task input shaping.

### Research fields

- `topicType`
  Primary topic class for the research pack.
- `topicSignals`
  Mixed-topic hints such as `docs + latest`.
- `researchAxes`
  Why the research pack decomposed into a given set of subquestions.
- `claimClusters`
  Evidence grouped by normalized claim.
- `candidateFindings`
  Candidate conclusions with support profile and gap sensitivity.
- `uncertainties`
  Remaining uncertainty and follow-up-sensitive gaps.

## Why Federated Search Matters

Federation is not just "more providers". It makes multi-provider gain visible so an agent can tell
whether fanout improved the final result set.

Important gain metrics:

- `federated.value.additionalProvidersUsed`
- `federated.value.resultsRecoveredByFanout`
- `federated.value.resultsCorroboratedByFanout`
- `federated.value.duplicateSavings`
- `routingSummary.federation.value`

Interpretation:

- recovered results answer "what did fanout rescue?"
- corroborated results answer "what got stronger support?"
- duplicate savings answer "what noise did merge remove?"

## Commands By Task

### Search

```bash
node {baseDir}/scripts/search.mjs "query" --json
node {baseDir}/scripts/search.mjs "query" --plan --json
node {baseDir}/scripts/search.mjs "latest OpenAI news" --type news --json
node {baseDir}/scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node {baseDir}/scripts/search.mjs "query" --engine serpapi --search-engine baidu --json
```

User-facing inputs:

- `searchType`
  Current shipped values are `web | news`.
- `intentPreset`
  Current shipped values are `general | code | company | docs | research`.

Important boundary:

- `searchType` and `intentPreset` shape routing input
- `engine` remains the explicit provider override

### Extract and render

```bash
node {baseDir}/scripts/extract.mjs "https://example.com/article" --json
node {baseDir}/scripts/extract.mjs "https://example.com/article" --render --render-policy fallback --json
node {baseDir}/scripts/extract.mjs "https://example.com/article" --plan
node {baseDir}/scripts/render.mjs "https://example.com/article" --json
```

### Crawl and map

```bash
node {baseDir}/scripts/crawl.mjs "https://example.com/docs" --depth 2 --max-pages 10 --json
node {baseDir}/scripts/map.mjs "https://example.com/docs" --depth 2 --max-pages 50 --json
```

### Research

```bash
node {baseDir}/scripts/research.mjs "OpenClaw search skill landscape" --json
node {baseDir}/scripts/research.mjs "OpenClaw search skill landscape" --plan --json
```

### Runtime inspection

```bash
node {baseDir}/scripts/capabilities.mjs --json
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/bootstrap.mjs --json
node {baseDir}/scripts/review.mjs --json
node {baseDir}/scripts/cache.mjs stats --json
node {baseDir}/scripts/health.mjs --json
```

### Benchmarking

```bash
node {baseDir}/scripts/eval.mjs list --json
node {baseDir}/scripts/eval.mjs run --suite core --json
node {baseDir}/scripts/eval.mjs run --suite research --json
node {baseDir}/scripts/eval.mjs run --suite head-to-head --json
node {baseDir}/scripts/eval.mjs run --suite head-to-head-live --json
```

## Research Pack Boundary

`research.mjs` is a model-facing evidence layer, not a final narrative answer layer.

The skill is responsible for:

- question decomposition
- retrieval planning
- evidence normalization
- source prioritization
- claim clustering
- compact candidate findings
- uncertainty exposure

The upstream model remains responsible for:

- final reasoning across the evidence pack
- narrative synthesis
- user-facing writing style
- final judgment when evidence is incomplete or conflicting

Detailed contract:

- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)

## Runtime Config

Default config path:

- `{baseDir}/config.json`

Override path:

- `WEB_SEARCH_PRO_CONFIG=/path/to/config.json`

Config precedence:

`CLI flags > process.env > config.json > built-in defaults`

When the skill is run directly outside OpenClaw, provider keys must already exist in the shell
environment. If OpenClaw launches the skill, its injected runtime environment is sufficient.

Key config areas:

- `routing`
- `cache`
- `health`
- `fetch`
- `crawl`
- `render`

Important routing config fields:

- `routing.allowNoKeyBaseline`
- `routing.enableFederation`
- `routing.federationTriggers`
- `routing.maxFanoutProviders`
- `routing.maxPerProvider`
- `routing.mergePolicy`
- `routing.fallbackPolicy`

Important render config fields:

- `render.enabled`
- `render.policy`
- `render.budgetMs`
- `render.waitUntil`
- `render.blockTypes`
- `render.sameOriginOnly`

## Provider Upgrade Paths

No API key is required for the baseline. Optional provider credentials or endpoints unlock stronger
coverage:

Optional provider credentials or endpoints unlock enhanced features.

```bash
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
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
KILOCODE_API_KEY=xxxxx

# Or use a custom OpenAI-compatible gateway
PERPLEXITY_GATEWAY_API_KEY=xxxxx
PERPLEXITY_BASE_URL=https://gateway.example.com/v1
PERPLEXITY_MODEL=perplexity/sonar-pro
```

Provider roles:

- Tavily: strongest premium default for general search, news, and extract
- Exa: semantic retrieval and extract fallback
- Querit: multilingual AI search with native geo and language filters
- Serper: Google-like search with strong news and locale coverage
- Brave: structured general web search
- SerpAPI: multi-engine routing including Baidu and Yandex
- You.com: LLM-ready web search with freshness and mixed web/news coverage
- SearXNG: self-hosted privacy-first metasearch fallback
- Perplexity / Sonar: answer-first grounded search via native or gateway transport
- DDG: best-effort no-key baseline search
- Fetch: no-key extract / crawl / map baseline
- Render: optional local browser lane

## Validation And Review

The most useful validation surfaces for agents and maintainers are:

- `capabilities.mjs`
  What this environment can truly do right now.
- `doctor.mjs`
  Is the runtime ready, degraded, or blocked?
- `bootstrap.mjs`
  What can an upstream agent safely assume?
- `review.mjs`
  What are the current safety and compliance boundaries?
- `health.mjs`
  Which providers are degraded or cooling down?
- `eval.mjs`
  Has behavior regressed against core, research, or comparative suites?

The bundled `head-to-head` suite focuses on route-first comparisons against a local
`../web-search-plus` checkout.

The bundled `head-to-head-live` suite adds real networked comparisons for freshness and citation
quality under shared provider credentials.

## Review-Safe Guarantees

- metadata only declares `node` as the hard runtime requirement
- provider credentials are optional
- `ddg` is a best-effort no-key baseline, not a guaranteed high-recall provider
- Safe Fetch rejects non-HTTP(S), credential-bearing, local, private, and metadata targets
- redirect targets are revalidated
- Safe Fetch keeps JavaScript execution disabled
- browser render is optional and off by default
- browser render uses a local headless browser only when enabled
- browser render reports anti-bot or challenge interstitials as failures instead of silent success
- provider health distinguishes `degraded` from `cooldown`

## Docs

- [README.md](/Users/codez/develop/web-search-pro/README.md)
- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)
- [docs/search-routing-model.md](/Users/codez/develop/web-search-pro/docs/search-routing-model.md)
- [docs/search-ux-model.md](/Users/codez/develop/web-search-pro/docs/search-ux-model.md)
- [docs/head-to-head-eval.md](/Users/codez/develop/web-search-pro/docs/head-to-head-eval.md)
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)
