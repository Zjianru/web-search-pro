# Changelog

All notable changes to this project will be documented in this file.

This project uses **product versioning** for the skill surface and **schema versioning** for
machine-readable payloads.

## [2.1.0] - 2026-03-14

`2.1.0` is the first feature release on top of the `2.0` retrieval-stack line.

It expands the search and routing substrate instead of just widening the repository surface:
search routing is now more explainable, more provider-complete, and more benchmarkable for agent
workflows. The ClawHub core profile and compliance story are updated in the same release so the
registry-facing package still matches the shipped runtime honestly.

### Added

- `bootstrap.mjs` and a machine-readable runtime bootstrap contract for agents
- `Brave`, `Querit`, `You.com`, `SearXNG`, and `Perplexity / Sonar` provider support
- Perplexity gateway transport support via native, OpenRouter, Kilo, or custom OpenAI-compatible
  gateway paths
- Structured search-route signals with `selectionMode`, `confidence`, and `topSignals`
- Head-to-head benchmark infrastructure plus bundled `head-to-head` and `head-to-head-live` suites
- Release-pack documentation for `2.1.0`

### Changed

- Upgraded the planner from basic provider scoring to a `search-router v2` model with structured
  query signals, compact route transparency, and richer diagnostics
- Exposed cache hit telemetry and TTL / age information directly in search and retrieval outputs
- Expanded provider registry semantics to support credential groups, transport-aware capabilities,
  and provider configuration errors
- Added agent-facing search UX inputs such as `--type` and `--preset`
- Updated `README.md`, `SKILL.md`, ClawHub package docs, and generated ClawHub package copy to
  reflect the current provider set and bootstrap contract

### Benchmarks And Validation

- Added route-first and live head-to-head comparisons against `web-search-plus`
- Improved freshness scoring so live evaluation no longer over-credits a mostly stale result set
- Expanded CLI, provider, router, cache, and eval test coverage to support the new routing model

### ClawHub And Compliance

- Kept the ClawHub publish boundary as a generated core profile instead of the repository root
- Synced generated ClawHub metadata and docs with the new provider set, including gateway-backed
  Perplexity / Sonar access
- Kept `node` as the only hard runtime requirement while surfacing optional provider envs and
  review surfaces more explicitly

## [2.0.1] - 2026-03-13

`2.0.1` is the compliance and packaging follow-up to `2.0.0`.

It does not change the core GitHub / local OpenClaw `2.0` feature set. Instead, it separates the
full source tree from the ClawHub publish artifact so registry-facing metadata and scanner scope
match the shipped runtime more closely.

### Added

- `scripts/build-clawhub-package.mjs` for generating a ClawHub publish package
- `scripts/lib/clawhub-package.mjs` for packaging rules and file transforms
- `docs/clawhub-package.md` documenting the two distribution surfaces
- TDD coverage for the generated ClawHub package contract

### Changed

- Introduced a ClawHub core profile that keeps `search`, `extract`, `crawl`, `map`, `research`,
  `doctor`, `capabilities`, `review`, `cache`, and `health`
- Added optional provider env disclosure to the generated ClawHub package metadata
- Removed `tests`, `eval`, and the explicit browser-render lane from the generated ClawHub package
- Updated `README.md`, `SKILL.md`, and compliance docs to explain the split between the full
  source tree and the ClawHub publish artifact

### Compliance And Safety

- Reduced static scan noise by shrinking the published package boundary
- Kept the root repository honest about the full `2.0` runtime surface
- Kept OpenClaw root metadata unchanged while giving ClawHub a narrower, registry-friendly package
- Preserved the no-key baseline and optional provider disclosure in the generated package

## [2.0.0] - 2026-03-13

`2.0.0` is the major evolution of the original `1.x` line. The repository is no longer just a
multi-provider search supplement; it now behaves as a retrieval stack for agents and upstream
models.

### Added

- No-key baseline retrieval via `ddg` search and `fetch`-based extract / crawl / map
- `crawl.mjs` for same-origin BFS crawl
- `map.mjs` for site-structure discovery
- `render.mjs` and a configurable browser render lane for JS-dependent extraction
- `doctor.mjs`, `capabilities.mjs`, `review.mjs`, `cache.mjs`, and `health.mjs`
- `eval.mjs` with bundled `core` and `research` suites
- `research.mjs` as a structured `plan + evidence pack` layer
- Claim clustering, uncertainty surfacing, and single-round gap-aware follow-up inside research
- Controlled federated retrieval with merge, dedupe, rerank, and compact merge telemetry

### Changed

- Reframed the product from a search supplement into a layered retrieval system
- Preserved the stable JSON `schemaVersion` at `1.0` while expanding payloads additively
- Replaced static engine routing with capability-aware planning, runtime config, and health-aware
  downgrade
- Expanded federation triggers to cover `news`, `ambiguous`, `domain-critical`, `research`, and
  `comparison`
- Reorganized documentation around `Web Search Pro 2.0`
- Rewrote `README.md` and `SKILL.md` to separate product semantics from implementation history

### Security And Compliance

- Kept OpenClaw metadata limited to the real hard requirement: `node`
- Kept provider credentials optional and disclosed through runtime review surfaces
- Added review-focused commands and documentation for ClawHub / OpenClaw moderation
- Made provider health distinguish `degraded` from `cooldown`
- Formalized safe fetch and browser render boundaries

### Upgrade Notes

- Existing `search.mjs` and `extract.mjs` consumers remain valid
- Product version is now `2.0`, but JSON schema remains `1.0`
- New top-level objects such as `federated`, `render`, and `research` data are additive
- `ddg` remains a best-effort baseline and should not be treated as guaranteed infrastructure

## [1.0.2] - 2026-03-05

- Aligned skill metadata with the multi-provider runtime
- Removed over-stated credential requirements from metadata
- Clarified provider-key behavior for ClawHub and OpenClaw

## [1.0.1]

- Hardened search behavior and aligned ClawHub metadata

## [1.0.0]

- Initial multi-engine web search release with provider-specific search and extract flows
