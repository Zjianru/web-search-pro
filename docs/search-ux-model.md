# Search UX Model

## Goal

`web-search-pro` already has a strong routing and retrieval foundation. This document defines the
user-facing search contract that sits on top of that foundation so the product is easier to adopt
and easier to grow.

The main product gap is not "can the router select a provider?" The gap is that the entry surface
still looks like an internal multi-provider tool, while high-adoption search skills on ClawHub are
easier to understand in the first 30 seconds.

This model introduces two user-facing concepts:

- `searchType`
- `intentPreset`

These are not replacements for routing. They are cleaner user intent declarations that the router
can consume.

## Design Principles

1. User-facing intent and provider-facing routing must stay separate.
2. `searchType` and `intentPreset` are product inputs, not hidden heuristics.
3. Provider choice remains the planner's responsibility unless `--engine` is explicit.
4. New UX primitives must not break the current additive JSON contract.
5. The UX layer should make the skill feel simpler without making the core architecture simpler
   than it really is.

## Core Variables

### `searchType`

`searchType` declares the kind of result surface the caller wants.

Allowed values in v1 of the UX model:

- `web`
- `news`

Semantics:

- `web` is the default general web search surface.
- `news` means the caller wants current-event/news-style results, not just generally fresh web
  results.

Current shipped scope:

- the CLI currently supports `web | news`
- `images | videos` remain planned UX-model extensions, but they are not part of the shipped
  command contract yet

Important boundary:

- `searchType` is about result modality.
- `news` as a boolean request flag in the planner is an implementation detail that maps from the
  user-facing `searchType="news"` request.

Why this split matters:

- the CLI and docs should speak in user terms
- the planner should still reason in capability terms

### `intentPreset`

`intentPreset` declares a high-level search task preset.

Initial values:

- `general`
- `code`
- `company`
- `docs`
- `research`

Semantics:

- `general`: broad web search with no vertical bias
- `code`: code examples, API docs, implementation references
- `company`: company profiles, org updates, business background
- `docs`: documentation, official references, release notes
- `research`: comparison, synthesis, broad source coverage

Important boundary:

- `intentPreset` is not a provider id
- `intentPreset` is not a hard constraint unless the request also carries explicit hard constraints
- `intentPreset` should influence query signals, federation triggers, and provider bonuses

### `engine`

`engine` remains the explicit provider override.

Examples:

- `exa`
- `querit`
- `brave`
- `serper`

Semantics:

- `engine` is the lowest-level explicit override
- when present, `selectionMode` should be `explicit`
- `intentPreset` and `searchType` still describe the user task, but they no longer decide the
  provider

### `selectionMode`

This variable already exists in the routing model and remains a planner output, not an input.

It answers:

- did the user explicitly force this?
- was it selected because of hard requirements?
- was it selected because intent signals matched?
- was it selected because healthier options were unavailable?

### `outputFormat`

`outputFormat` is a presentation/output contract, not a routing contract.

Initial values:

- `text`
- `markdown`
- `json`

This value may influence CLI rendering, but must not influence provider selection.

## Mapping Rules

### User Input to Planner Request

Mapping rules:

- `searchType="news"` -> planner request `news=true`
- `searchType="web"` -> planner request `news=false`
- `searchType="images"` -> planner request keeps `searchType="images"` and must reject providers
  that do not support image search
- `searchType="videos"` -> planner request keeps `searchType="videos"` and must reject providers
  that do not support video search

### `intentPreset` to Signals

Suggested signal influence:

- `general`
  no additional bias
- `code`
  bonus providers with strong docs/code/discovery coverage
- `company`
  bonus providers useful for entity/company lookups and recent updates
- `docs`
  bonus providers with strong official-source and structured results behavior
- `research`
  bonus providers with comparison and breadth/federation value

Important tradeoff:

- using `intentPreset` gives stronger first-run UX and clearer docs
- overusing `intentPreset` would hide planner behavior behind magic

Recommendation:

- keep presets shallow and explainable
- always surface preset influence in `routing.diagnostics`

## Provider Capability Growth

The provider registry should grow to include modality support explicitly.

Suggested future capability fields:

- `imageSearch`
- `videoSearch`

These should be hard capability facts, just like:

- `newsSearch`
- `deepSearch`
- `localeFiltering`

Why:

- `searchType` must become a real routing constraint
- otherwise the product contract becomes dishonest

## Product Tradeoffs

### Why Add `searchType`

Pros:

- more intuitive first-run UX
- maps directly to how users phrase their need
- aligns with high-adoption DDG-style skills

Cons:

- result schemas will diverge more across modalities
- provider capabilities must become more explicit
- image/video support may initially be uneven

Recommendation:

- adopt `searchType` as a first-class UX primitive now
- fully support `web` and `news` immediately
- add `images` and `videos` behind honest capability gating

### Why Add `intentPreset`

Pros:

- absorbs the strongest UX advantage from Exa-style skills
- reduces prompt burden for common tasks
- gives the router richer declared intent without adding giant regex tables

Cons:

- can become vague if too many presets are added
- can become hidden magic if not exposed in diagnostics

Recommendation:

- ship only a small preset set
- include preset influence in route explanations
- never let presets silently override explicit hard constraints

## CLI Direction

Proposed CLI shape:

```bash
node scripts/search.mjs "query" --type web --preset docs
node scripts/search.mjs "query" --type news
node scripts/search.mjs "query" --preset code --plan --json
```

Compatibility rules:

- `--news` remains valid for compatibility
- `--type news` becomes the preferred UX form
- `--type web` is explicit but optional
- `--engine` continues to bypass automatic provider selection

## Output Direction

Compact default output should expose:

- `searchType`
- `intentPreset`
- `selectedProvider`
- `selectionMode`
- `confidence`
- `topSignals`

Full diagnostics should additionally expose:

- `presetInfluence`
- `signalMatches`
- `hardConstraints`
- `runnerUp`

## Recommendation

Implement in phases:

1. document the UX model
2. add `searchType` and `intentPreset` to normalized search requests
3. support `web` and `news` first
4. expose preset influence in routing diagnostics
5. extend provider capabilities for `images` and `videos`

This keeps the product surface simple without collapsing the layered routing architecture.
