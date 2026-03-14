[English](README.md) | [中文](README_zh.md)

# Web Search Pro

`web-search-pro` is an OpenClaw search skill and local Node retrieval runtime for agents. It can
search the live web, fetch and extract pages, crawl sites, map docs, and assemble research-ready
evidence packs with explainable routing.

- ClawHub: [web-search-pro](https://clawhub.ai/Zjianru/web-search-pro)
- GitHub: [Zjianru/web-search-pro](https://github.com/Zjianru/web-search-pro)
- OpenClaw archive: [openclaw/skills/tree/main/skills/zjianru/web-search-pro](https://github.com/openclaw/skills/tree/main/skills/zjianru/web-search-pro)

## What It Is

This project sits between a lightweight web-search skill and a full hosted scraping product.

The simplest mental model is:

- a search skill for agents
- a local retrieval runtime
- a bridge from `search` to `extract`, `crawl`, `map`, and `research`

Use it when search is only the beginning of the task and the agent may need to keep collecting,
structuring, and handing off evidence.

## Choose This If

Choose `web-search-pro` if you need:

- live web search and current-events lookup
- news search with explainable routing and visible fallback behavior
- official docs, API docs, and code lookup
- company, product, and competitor research
- site crawl, site map, and docs discovery
- a no-key baseline first, then premium providers only when needed
- structured outputs that an upstream model can keep using

In short: this is for developers who want one skill to cover search, retrieval, and evidence prep.

## Do Not Choose This If

Do not choose `web-search-pro` if you primarily want:

- the lightest possible single-purpose web search wrapper
- a hosted remote scraping SaaS
- a browser-first crawler by default
- a narrative report writer that hides retrieval details
- an unlimited no-key search guarantee

If all you need is lightweight one-shot search, a smaller skill will usually be a better fit.

## Why Developers Pick It

Compared with a plain search skill, the differentiators are:

- **Explainable routing**
  `routingSummary` exposes why a provider was selected, how confident the planner is, and what the
  top signals were.
- **Visible federated gains**
  `federated.value` shows what multi-provider fanout actually recovered, corroborated, or deduped.
- **Search-to-research chain**
  One surface can move from `search` into `extract`, `crawl`, `map`, and `research`.
- **No-key baseline**
  You can evaluate the skill without buying into a provider stack first.
- **Agent-readable diagnostics**
  `doctor.mjs`, `bootstrap.mjs`, `capabilities.mjs`, and `review.mjs` expose runtime state and
  boundaries instead of leaving the model to guess.

## Quick Start

There are two honest ways to approach this project:

- **Install and use it as a skill**
  Start from the ClawHub page or the OpenClaw archive entry if you want to use it inside OpenClaw.
- **Run it from source**
  Use the commands below if you want to evaluate the local runtime directly, inspect outputs, or
  contribute to the repo.

The shortest successful path is:

- start with the no-key baseline
- add one premium provider only when you need stronger recall or fresher results
- then try docs, news, and research flows

### Option A: No-key baseline

No API key is required for the first successful run.

The baseline is:

- `ddg` for best-effort web search
- `fetch` for extract, crawl, and map fallback

```bash
node scripts/doctor.mjs --json
node scripts/bootstrap.mjs --json
node scripts/search.mjs "OpenAI Responses API docs" --json
```

What these commands tell you:

- `doctor.mjs` tells you whether the runtime is usable right now
- `bootstrap.mjs` gives an agent-readable runtime snapshot
- `search.mjs` proves the baseline path works before you add premium providers

### Option B: Add one premium provider

If you only add one premium provider, start with `TAVILY_API_KEY`.

That is the shortest upgrade path because one credential improves:

- general web search
- news search
- extract quality

```bash
export TAVILY_API_KEY=tvly-xxxxx
node scripts/doctor.mjs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
```

### First successful searches

```bash
node scripts/search.mjs "OpenClaw web search" --json
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node scripts/extract.mjs "https://platform.openai.com/docs" --json
```

### Then try docs, news, and research

```bash
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json
```

## Core Commands

| Command | Purpose |
| --- | --- |
| `search.mjs` | Multi-provider search with explainable routing |
| `extract.mjs` | Single-page readable extraction |
| `render.mjs` | Forced browser-backed extraction through the local render lane |
| `crawl.mjs` | Safe BFS crawl |
| `map.mjs` | Site-structure discovery |
| `research.mjs` | Structured `plan + evidence pack` generation |
| `doctor.mjs` | Runtime diagnostics |
| `bootstrap.mjs` | Agent-readable runtime bootstrap contract |
| `capabilities.mjs` | Provider capability snapshot |
| `review.mjs` | Review and moderation summary |
| `cache.mjs` | Cache inspection |
| `health.mjs` | Provider health inspection |
| `eval.mjs` | Retrieval and benchmark harness |

## Why Federated Search Matters

Federation is not just "more providers". It makes multi-provider value visible with compact,
machine-readable gain metrics.

Key fields:

- `federated.providersUsed`
  Providers that actually returned results.
- `federated.value.additionalProvidersUsed`
  How many non-primary providers really contributed.
- `federated.value.resultsRecoveredByFanout`
  Final results that would disappear in primary-only mode.
- `federated.value.resultsCorroboratedByFanout`
  Final results supported by both the primary and at least one fanout provider.
- `federated.value.duplicateSavings`
  Exact or near-duplicate results removed by merge.
- `routingSummary.federation.value`
  The compact federation gain summary exposed alongside route explanation.

Example:

```json
{
  "federated": {
    "providersUsed": ["serper", "tavily"],
    "value": {
      "additionalProvidersUsed": 1,
      "resultsWithFanoutSupport": 2,
      "resultsRecoveredByFanout": 1,
      "resultsCorroboratedByFanout": 1,
      "duplicateSavings": 1,
      "answerProvider": "tavily",
      "primarySucceeded": true
    }
  }
}
```

Interpretation:

- `resultsRecoveredByFanout=1` means federation recovered one final result that primary-only
  search would have missed
- `resultsCorroboratedByFanout=1` means another final result got multi-provider support
- `duplicateSavings=1` means the merge removed one duplicate instead of wasting result slots

## Routing And Output Contract

The router combines five layers of truth:

1. provider capability facts
2. structured query signals
3. runtime policy from `config.json`
4. local health state
5. optional federation

Important fields:

- `selectedProvider`
  The primary route. It is not the same thing as "the only provider used".
- `routingSummary`
  Compact route explanation with `selectionMode`, `confidence`, `topSignals`, alternatives, and
  federation context.
- `routing.diagnostics`
  Full route diagnostics exposed by `--explain-routing` or `--plan`.
- `federated.providersUsed`
  The provider set that actually returned results when fanout is active.
- `federated.value`
  Compact federation gain summary: added providers, recovered results, corroborated results, and
  duplicate savings.
- `cached` / `cache`
  Cache hit plus age / TTL telemetry for agents.
- `renderLane`
  Runtime availability and policy summary for the browser-backed render lane.
- `meta.searchType`
  User-facing result surface selector. Current shipped values are `web | news`.
- `meta.intentPreset`
  User-facing intent preset. Current shipped values are
  `general | code | company | docs | research`.

These are product-layer inputs, not provider ids.

## Providers And Upgrade Paths

No API key is required for the baseline. Optional provider credentials or endpoints unlock stronger
coverage.

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

## Distribution Surfaces

The project has two honest distribution surfaces:

- **GitHub / local source tree**
  The full surface, including `render.mjs`, `eval.mjs`, tests, and the deeper research toolchain.
- **ClawHub publish package**
  A generated core profile built by `scripts/build-clawhub-package.mjs`.

Why this split exists:

- local developers need the full runtime and benchmark surface
- ClawHub moderation benefits from a narrower, more honest publish boundary
- the registry package is still a code-backed Node runtime, not an instruction-only bundle

Detailed notes:

- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)

## Boundaries

`web-search-pro` is strong at:

- capability-aware retrieval
- explainable routing
- safe extract / crawl / map
- structured research packs
- local diagnostics and review surfaces

It is intentionally not:

- a hosted remote scraping service
- a final report writer
- a browser-first crawler by default
- an unlimited no-key search guarantee

## Positioning vs Other Skills

- **vs lightweight `web-search` skills**
  `web-search-pro` is heavier, but it gives you explainable routing, federation visibility, and a
  path into `extract`, `crawl`, `map`, and `research`.
- **vs search-router-first skills such as `web-search-plus`**
  `web-search-pro` is broader as a retrieval stack. The differentiator is not only where to
  search, but what happens after search.
- **vs hosted scrape-first products**
  `web-search-pro` stays local-first, more inspectable, and more explicit about safety boundaries
  and runtime behavior.

## Safety

Safe fetch:

- allows only `http` / `https`
- blocks credential-bearing URLs
- blocks localhost, private, and metadata targets
- revalidates redirects
- keeps JavaScript disabled

Browser render:

- is off by default
- uses a local headless browser only when enabled
- revalidates navigations
- can enforce same-origin-only navigation

Challenge and anti-bot interstitial pages are reported as failures, not silent successes.

## Discovery Keywords

`web search`, `news search`, `latest updates`, `current events`, `docs search`, `API docs`,
`code search`, `company research`, `competitor analysis`, `site crawl`, `site map`,
`multilingual search`, `Baidu search`, `Google-like search`, `answer-first search`,
`cited answers`, `explainable routing`, `no-key baseline`

## Versioning

- Product / docs version: `2.1`
- JSON schema version: `1.0`

`2.x` is the retrieval-stack product line. Machine-readable payloads remain additive and
compatible, so schema stays `1.0`.

## Docs

- [README_zh.md](/Users/codez/develop/web-search-pro/README_zh.md)
- [CHANGELOG.md](/Users/codez/develop/web-search-pro/CHANGELOG.md)
- [docs/search-routing-model.md](/Users/codez/develop/web-search-pro/docs/search-routing-model.md)
- [docs/search-ux-model.md](/Users/codez/develop/web-search-pro/docs/search-ux-model.md)
- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)
- [docs/head-to-head-eval.md](/Users/codez/develop/web-search-pro/docs/head-to-head-eval.md)
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)
- [docs/marketing-launch-kit.md](/Users/codez/develop/web-search-pro/docs/marketing-launch-kit.md)
- [docs/agent-contract-p0.md](/Users/codez/develop/web-search-pro/docs/agent-contract-p0.md)

## License

MIT
