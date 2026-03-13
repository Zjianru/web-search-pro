# Changelog

All notable changes to this project will be documented in this file.

This project uses **product versioning** for the skill surface and **schema versioning** for
machine-readable payloads.

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
