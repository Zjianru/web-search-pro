# Changelog

All notable changes to this project will be documented in this file.

This project uses **product versioning** for the skill surface and **schema versioning** for
machine-readable payloads.

## [2.1.3] - 2026-03-14

`2.1.3` is the ClawHub metadata-alignment follow-up to `2.1.2`.

It does not change search quality or provider behavior. Instead, it makes the published package
declare its install model and local state/config contract more explicitly so registry review sees
the same runtime shape the bundle actually uses.

### Changed

- Added an explicit `Install Model` section to the root skill and generated ClawHub docs
- Declared `config.json` as the optional config file path in `clawdbot.requires.config`
- Declared `.cache/web-search-pro` as the package state directory in `clawdbot.config.stateDirs`
- Added a direct Node-backed install declaration in `clawdbot.install`
- Updated ClawHub compliance/package docs and TDD coverage for the new metadata contract

### Compatibility

- Product / docs line remains `2.1`
- Release tag advances to `2.1.3`
- Stable machine-readable JSON schema remains `1.0`
- Search / extract / crawl / map / research behavior remains unchanged

## [2.1.2] - 2026-03-14

`2.1.2` is the ClawHub trust-hardening follow-up to `2.1.1`.

It does not widen the search or retrieval surface. Instead, it makes the published runtime more
honest to static review and registry packaging without weakening the actual no-key baseline.

### Changed

- Added `metadata.clawdbot` to the root skill and generated ClawHub package while keeping
  compatibility `metadata.openclaw`
- Updated generated ClawHub README / SKILL copy so the package is explicitly described as a
  code-backed Node runtime, not an instruction-only bundle
- Switched the no-key `ddg` baseline from a Python helper transport to `curl` with built-in
  `fetch` fallback
- Removed the Python helper transport implementation from `http-client.mjs`
- Updated ClawHub compliance and packaging docs to match the current shipped runtime

### Compatibility

- Product / docs line remains `2.1`
- Release tag advances to `2.1.2`
- Stable machine-readable JSON schema remains `1.0`
- Search routing and provider capability semantics remain unchanged

## [2.1.1] - 2026-03-14

`2.1.1` is the first follow-up patch release after `2.1.0`.

It does not widen the architecture again. Instead, it removes first-use friction and makes
federated-search value visible to both users and agents. The retrieval stack is the same, but the
onboarding path and federation output are now much easier to understand from the first run.

### Added

- Explicit quick-start flows for:
  - no-key baseline usage
  - adding exactly one premium provider
  - first successful search / extract / research commands
- Compact federation gain metrics in search output:
  - `federated.value.additionalProvidersUsed`
  - `federated.value.resultsRecoveredByFanout`
  - `federated.value.resultsCorroboratedByFanout`
  - `federated.value.duplicateSavings`
- TDD coverage for docs surfaces and federation-value output

### Changed

- Rewrote `README.md` and `SKILL.md` quick-start sections to front-load the minimum successful
  path instead of only listing commands
- Updated generated ClawHub README / SKILL copy so registry installs expose the same onboarding
  and federation value story as the repository docs
- Improved markdown search output so federated runs now show concrete gain summaries instead of
  only raw / deduped counts

### Compatibility

- Product / docs line remains `2.1`
- Release tag advances to `2.1.1`
- Stable machine-readable JSON schema remains `1.0`
- New federation fields are additive

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
