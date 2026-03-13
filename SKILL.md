---
name: web-search-pro
description: |
  Multi-engine retrieval for AI agents. Supports a no-key baseline plus optional Tavily, Exa,
  Serper, and SerpAPI enhancements for deep search, news, extraction, crawl, and site mapping.
  Includes an optional local browser render lane, explainable routing, local cache, provider
  health cooldowns, a structured research layer, and review-friendly self-diagnostics.
homepage: https://github.com/Zjianru/web-search-pro
metadata: {"openclaw":{"emoji":"🔎","requires":{"bins":["node"]}}}
---

# Web Search Pro 2.0

`web-search-pro` is the evolved `2.0` form of the original `1.x` multi-provider search skill.
It is now a retrieval system for agents and upstream models, not just a single search script.
Product / documentation version is `2.0`; machine-readable output schema stays `1.0` because
current JSON changes are additive.

## What It Includes

- `search.mjs`: multi-provider search with explainable routing and optional `federated` fanout
- `extract.mjs`: single-page readable extraction with safe fetch and optional render fallback
- `render.mjs`: forced browser-backed extraction through the local render lane
- `crawl.mjs`: multi-page BFS crawl with safe fetch
- `map.mjs`: site-structure discovery without full content output
- `research.mjs`: structured `plan + evidence pack` generation for upstream models
- `doctor.mjs`, `capabilities.mjs`, `review.mjs`: runtime diagnostics and review output
- `cache.mjs`, `health.mjs`: local cache and provider health inspection
- `eval.mjs`: retrieval and research benchmark harness

No API key is required for the baseline. Optional provider keys unlock enhanced features:

```bash
TAVILY_API_KEY=tvly-xxxxx
EXA_API_KEY=exa-xxxxx
SERPER_API_KEY=xxxxx
SERPAPI_API_KEY=xxxxx
```

## Routing Semantics

The router combines three layers of truth:

1. Provider capability facts
2. Runtime policy from `config.json`
3. Local health state and optional federation

Important variables and fields:

- `selectedProvider`
  The primary route. It does not mean "the only provider used".
- `federated.providersUsed`
  The actual provider set that returned results when fanout is active.
- `federated.fanoutPolicy`
  Whether fanout was `disabled`, `triggered`, or suppressed by explicit primary-only routing.
- `federated.resultStats`
  Compact merge telemetry: raw count, deduped count, and per-provider hit counts.
- `federated.mergeSummary`
  Compact merge telemetry: exact URL dedupe, near-duplicate drops, rerank usage, and answer source.
- `render`
  Execution-time browser fallback or forced render details on `extract.mjs` / `render.mjs`.
- `renderLane`
  Runtime availability and policy summary exposed by `doctor.mjs` and `review.mjs`.

Runtime policy highlights:

- `allowNoKeyBaseline`
  Controls whether `ddg` and `fetch` may participate in routing.
- `fallbackPolicy`
  Reorders valid candidates only after capability checks pass.
- `enableFederation`
  Allows controlled fanout for high-value trigger classes.
- `mergePolicy`
  Controls merged search behavior and is separate from `fallbackPolicy`.
- `render.enabled`
  Enables the browser render lane in config.
- `render.policy`
  Sets whether browser render is off, fallback-only, or forced.

Current federation trigger classes are:
- `news`
- `ambiguous`
- `domain-critical`
- `research`
- `comparison`

## Core Commands

Search:

```bash
node {baseDir}/scripts/search.mjs "query"
node {baseDir}/scripts/search.mjs "query" --deep --plan --json
node {baseDir}/scripts/search.mjs "query" --news --explain-routing
node {baseDir}/scripts/search.mjs "query" --engine serpapi --search-engine baidu
```

Extract and render:

```bash
node {baseDir}/scripts/extract.mjs "https://example.com/article"
node {baseDir}/scripts/extract.mjs "https://example.com/article" --render --render-policy fallback --json
node {baseDir}/scripts/extract.mjs "https://example.com/article" --plan
node {baseDir}/scripts/render.mjs "https://example.com/article" --json
```

Crawl and map:

```bash
node {baseDir}/scripts/crawl.mjs "https://example.com/docs" --depth 2 --max-pages 10
node {baseDir}/scripts/map.mjs "https://example.com/docs" --depth 2 --max-pages 50 --json
```

Research:

```bash
node {baseDir}/scripts/research.mjs "OpenClaw search skill landscape" --json
node {baseDir}/scripts/research.mjs "OpenClaw search skill landscape" --plan --json
```

## Research Pack Semantics

`research.mjs` is not a human-facing final report writer. It is a model-facing structured
`plan + evidence pack` layer built on `search`, `extract`, `crawl`, and `map`.

Boundary:
- the skill is responsible for cleaner evidence, source prioritization, claim clustering, and
  compact findings
- the upstream model is responsible for final reasoning and narrative output

Current research output semantics:

- `topicType`
  Primary topic class: `general | landscape | docs | company | product | latest | comparison`
- `topicSignals`
  Mixed-topic hints such as `docs + latest`
- `researchAxes`
  Why this research pack asks a set of subquestions
- `subquestion.intent`
  Constrained to `overview | latest | official-sources | comparison | site-structure | timeline`
- `subquestions`
  Add `researchAxis` and `evidenceGoal`
- `tasks`
  Add `evidencePriority`, `sourceDiversityTarget`, `followupEligible`, and `phase`
- `evidence`
  Add `authority`, `freshness`, `coverage`, `documentQuality`, `boilerplateRatio`,
  `hasPrimaryContent`, `sourcePriority`, `selectionReason`, `claimKey`, and `stalenessFlag`
- `claimClusters`
  Add `sourceDiversity` and `claimConsistency`
- `candidateFindings`
  Add `supportProfile` and `gapSensitive`
- `uncertainties`
  Add `priority` and `followupEligible`
- `subquestionBriefs`
  Compact model-facing handoff summaries per subquestion with top evidence ids
- `gapResolutionSummary`
  Reports the single-round follow-up result for missing or stale evidence gaps

Detailed contract:
- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)

## Runtime Config

Default config path: `{baseDir}/config.json`  
Override path: `WEB_SEARCH_PRO_CONFIG=/path/to/config.json`

Config precedence:

`CLI flags > process.env > config.json > built-in defaults`

When this skill is run directly outside OpenClaw, provider keys must already exist in the current shell environment.  
If OpenClaw launches the skill, its injected runtime environment is sufficient.

Key config areas:

- `routing`
- `cache`
- `health`
- `fetch`
- `crawl`
- `render`

Federation-related config fields:

- `routing.enableFederation`
- `routing.federationTriggers`
- `routing.maxFanoutProviders`
- `routing.maxPerProvider`
- `routing.mergePolicy`

Browser-render config fields:

- `render.enabled`
- `render.policy`
- `render.budgetMs`
- `render.waitUntil`
- `render.blockTypes`
- `render.sameOriginOnly`

## Validation and Review

```bash
node {baseDir}/scripts/capabilities.mjs --json
node {baseDir}/scripts/doctor.mjs --json
node {baseDir}/scripts/review.mjs --json
node {baseDir}/scripts/cache.mjs stats --json
node {baseDir}/scripts/health.mjs --json
node {baseDir}/scripts/eval.mjs list --json
node {baseDir}/scripts/eval.mjs run --suite core --json
node {baseDir}/scripts/eval.mjs run --suite research --json
```

Review-safe guarantees:

- Metadata only declares `node`
- Provider credentials are optional and disclosed through `capabilities.mjs` and `review.mjs`
- `ddg` is a best-effort no-key baseline; challenge pages surface as degraded health, not hidden success
- Safe Fetch rejects non-HTTP(S), credential-bearing, local, private, and metadata targets
- Redirect targets are revalidated
- Safe Fetch keeps JavaScript execution disabled
- Browser render is optional, off by default, and uses a local headless browser only when enabled
- Browser render revalidates navigations and can enforce same-origin-only execution
- Browser render reports anti-bot / challenge interstitial pages as failures instead of empty successes
- Provider health distinguishes `degraded` from `cooldown`

## Output

Stable JSON schema version remains `1.0`.

- `search`, `extract`, `crawl`, `render`
  emit `schemaVersion`, `command`, `selectedProvider`, `engine`, `results`, `failed`, `meta`
- `map`
  emits `schemaVersion`, `command`, `selectedProvider`, `engine`, `nodes`, `edges`, `failed`, `meta`
- `search`
  adds top-level `federated` when fanout is active
- `extract` / `render`
  add top-level `render` when browser execution is relevant
- `research`
  adds `topicType`, `topicSignals`, `researchAxes`, `claimClusters`, `candidateFindings`,
  `uncertainties`, and `execution`

Use `--json` for programmatic access and `--plan` when the caller wants routing or research plans
without executing the full retrieval path.
