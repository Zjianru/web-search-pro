# Search Router V2

## Audience

This document is for contributors working on planner behavior, query-signal coverage, confidence
modeling, and provider growth without collapsing the router into a regex wall.

## Goal

`search-router v2` keeps the current layered routing foundation and closes the main gap with
`web-search-plus` on pure search routing:

- broader query intent coverage
- first-class `confidence` and `topSignals`
- more honest route explanations
- easier provider growth without turning routing into a large regex wall

The design explicitly keeps query signals as one routing input among several others. Query intent
must not replace capability checks, credential checks, runtime checks, health, or federation.

## Why Change

The current search planner in
[`/Users/codez/develop/web-search-pro/scripts/lib/planner.mjs`](/Users/codez/develop/web-search-pro/scripts/lib/planner.mjs)
already has the correct high-level layering:

1. provider capabilities
2. runtime/config policy
3. health and cooldown
4. federation

But its internal representation is still too flat:

- `candidate.issues` mixes hard rejection reasons
- `candidate.reasons` mixes provider facts, user preference, query intent, and health penalties
- `candidate.score` is final but not explainable enough for machine consumers

That structure can choose a provider, but it cannot reliably answer:

- Was the provider selected because the query intent matched?
- Or because every better provider was unavailable?
- Or because a hard requirement narrowed the field to one provider?
- How certain is the router about this choice?

## Non-Goals

- Replacing the current capability registry with a regex-first classifier
- Copying the `web-search-plus` `QueryAnalyzer` pattern wall
- Predicting result quality directly from the router
- Making every search response return full routing diagnostics by default

## Design Principles

1. Hard constraints and soft signals must remain separate.
2. Regex may provide evidence, but must not become the whole router.
3. Default output must stay compact for agent calls.
4. Full diagnostics belong behind `--explain-routing`.
5. Every routing field should be derivable from structured planner state, not reconstructed from
   strings.

## Routing Inputs

### Request

The normalized request is still the source of truth for explicit caller intent:

- `query`: user search text
- `engine`: forced provider id, if any
- `deep`: explicit deep-search requirement
- `news`: explicit news-search requirement
- `days`: explicit news freshness window
- `includeDomains` / `excludeDomains`: domain filtering request
- `searchEngine`: sub-engine request such as `baidu` or `yandex`
- `country` / `lang`: locale request

These are not "signals". They are declared routing requirements or preferences from the caller.

### Provider Facts

Provider registry remains the canonical capability contract:

- `activation`: how a provider becomes eligible
  - `baseline`: no-key fallback provider
  - `credential`: provider requires env-backed credentials
  - `render`: local runtime-backed provider
- `envVars`: env variables disclosed to users and agents for that provider
- `credentialGroups`: complete credential paths that can activate the provider
- `capabilities`: hard feature facts such as `newsSearch`, `deepSearch`, `localeFiltering`
- `routing`: baseline priors and provider-level preference hints

These facts are static, documentable, and testable. They must not be inferred from query text.

Clarification:

- `envVars` is a disclosure surface, not the activation algorithm.
- `credentialGroups` is the activation contract.
  Example: `perplexity` may be credentialed by native access, OpenRouter, Kilo, or a custom
  OpenAI-compatible gateway.
- A provider may expose multiple transport paths while still remaining one product-level provider.
  In that case the routed `provider.id` stays stable and transport-specific differences belong to
  the adapter, not to the router-facing provider identity.

### Runtime Facts

Runtime facts remain separate from provider facts:

- config policy
- runtime availability
- health state
- cooldown state

These facts can suppress or penalize a provider without changing what the provider is capable of.

### Query Signals

`search-router v2` introduces a structured signal layer. Query signals are evidence extracted from
the request, not routing decisions by themselves.

The first version should cover a focused set of categories:

- `direct-answer`: question-style or answer-first queries
- `freshness`: latest/current/recent/update-oriented queries
- `privacy`: private/anonymous/self-hosted/meta-search oriented queries
- `comparison`: vs / compare / benchmark / alternatives style queries
- `discovery`: similar / best / top / list-oriented discovery queries
- `multilingual`: query patterns that imply multilingual routing benefits

These categories are intentionally smaller than the `web-search-plus` pattern wall. The design goal
is maintainable, high-value coverage, not maximum regex volume.

Important routing rule:

- hard requirements filter the candidate set first
- query signals still participate after filtering when more than one valid candidate remains

This matters because requests such as `--type news` plus a summary-oriented query, or `--lang zh`
plus a non-Latin query, should not collapse into "hard-requirement only" routing when intent
signals can still differentiate the surviving providers.

## Core Planner State

### `hardConstraints`

`hardConstraints` describe whether the provider is allowed to compete at all.

Suggested shape:

```js
{
  explicitEngineMismatch: false,
  disabledByConfig: false,
  baselineDisallowed: false,
  runtimeUnavailable: false,
  missingCredentials: false,
  missingCapability: [],
  serpapiSubEngineConflict: [],
}
```

Semantics:

- A `true` hard constraint means the provider is rejected.
- Hard constraints are factual and non-negotiable.
- Hard constraints should be preserved in diagnostics even when the provider is rejected early.

### `signalMatches`

`signalMatches` is the structured output of query analysis.

Suggested shape:

```js
[
  {
    id: "direct-answer.question",
    category: "direct-answer",
    label: "Question-style query",
    weight: 140,
    matched: true,
    evidence: "what is openclaw routing",
  }
]
```

Semantics:

- A signal match is evidence, not a selection.
- Multiple signals may match the same query.
- Signal weights express routing affinity, not certainty.

### `contributions`

`contributions` is the new structured score breakdown for a candidate.

Suggested shape:

```js
[
  {
    kind: "base",
    id: "provider.default-priority",
    label: "Provider default search priority",
    delta: 320,
    category: "provider",
    evidence: "exa",
  },
  {
    kind: "constraint",
    id: "request.deep",
    label: "Supports deep search",
    delta: 180,
    category: "capability",
    evidence: "--deep",
  },
  {
    kind: "signal",
    id: "direct-answer.question",
    label: "Question-style query favors cited answers",
    delta: 140,
    category: "intent",
    evidence: "What is OpenClaw routing?",
  }
]
```

Semantics:

- `kind` describes why the delta exists:
  - `base`
  - `constraint`
  - `signal`
  - `preference`
  - `policy`
  - `health-penalty`
  - `fallback`
- `delta` is signed. Positive deltas raise score, negative deltas lower score.
- `contributions` must be structured enough to derive human-readable reasons later.

This is the critical design change. Once contributions exist, `topSignals`, score breakdown,
selection mode, and confidence all become derivable outputs instead of hand-written strings.

### `selectionMode`

`selectionMode` explains the reason class behind the winning route.

Allowed values:

- `explicit`: provider was forced via `--engine`
- `hard-requirement`: explicit request constraints narrowed the route decisively
- `intent-match`: query signals materially drove the route
- `fallback`: a higher-priority route lost due to cooldown or runtime degradation
- `availability-only`: provider won mainly because alternatives were unavailable
- `default-ranking`: provider won on default ranking after constraints passed, without strong intent evidence

This field is necessary because a selected provider may still be a weak choice. Example:
`ddg` selected because no credentialed provider exists should never look like a confident intent
match.

Clarification:

- `hard-requirement` should be used when explicit constraints effectively determine the route
  outcome, such as `--news --days`, `--search-engine baidu`, or a surviving candidate set of one
- `intent-match` should remain valid even when requirements are present, if those requirements only
  narrow the field and query signals still decide the winner among multiple eligible candidates
- `availability-only` should override `hard-requirement` when the surviving route exists mainly
  because otherwise-eligible competitors are unavailable due to credentials, runtime, or config
  state

### `confidence`

`confidence` measures routing certainty, not result quality.

Definition:

- It answers: "How certain is the planner that this provider is the correct route under the current
  environment and request?"
- It does not answer: "How good will the results be?"

The initial confidence model should combine:

1. margin between winner and runner-up
2. whether the winner has meaningful positive intent signals
3. whether the route was limited by availability
4. whether health penalties materially changed the outcome
5. whether the route was decided by explicit or hard requirements

Suggested fields:

```js
{
  value: 0.84,
  level: "high",
  limitedByAvailability: false,
  marginScore: 180,
}
```

Interpretation:

- `high`: strong evidence or decisive hard requirement
- `medium`: good route, but alternatives remain plausible
- `low`: winner exists, but selection was mainly fallback or availability-driven

### `topSignals`

`topSignals` is the compact evidence list for the selected provider.

Rules:

- include only positive `signal` contributions
- exclude raw provider defaults
- exclude generic config preferences unless needed for diagnostics
- prefer the 3-5 highest-impact signal contributions

This gives agents a compact "why" without exposing full planner internals.

## Output Model

### Default `routingSummary`

Default JSON should stay compact and stable. It should include:

- `selectedProvider`
- `selectedReason`
- `selectedReasons`
- `selectionMode`
- `confidence`
- `confidenceLevel`
- `topSignals`
- `configuredProviders`
- `candidateCounts`
- `alternatives`
- `blockedProviders`
- `healthWarnings`
- `federation`
- `error`

### Full `routingDiagnostics`

Only emitted when `--explain-routing` is requested.

Suggested additions:

- `signalMatches`
- `scoreBreakdown`
- `hardConstraints`
- `limitedByAvailability`
- `runnerUp`
- `availabilityWarnings`

`limitedByAvailability` should be conservative:

- count only competitors that are otherwise valid for the request
- do not count providers that also fail capability or provider-specific constraints
- this keeps routes like `--search-engine baidu` honestly classified as hard-requirement instead of
  availability-only

This keeps normal agent calls short while preserving deep explainability for debugging.

## Why Not a Large Regex Router

`web-search-plus` gets good short-term routing performance from a very large regex-driven
`QueryAnalyzer`. That approach has real strengths:

- fast to iterate
- easy to add one more intent heuristic
- easy to produce visible `top_signals`

But its maintenance cost grows quickly because the same pattern system starts carrying too many
responsibilities:

- evidence extraction
- provider scoring
- confidence explanation
- provider growth

`search-router v2` deliberately keeps regex in a smaller role:

- regex and heuristics extract evidence into `signalMatches`
- planner logic decides using provider capabilities, policy, health, and contributions
- output formatting derives explanations from structured state

This preserves the current architecture advantage while closing the explainability gap.

## Planned Modules

### `search-signals.mjs`

Responsibilities:

- define signal specs
- analyze request query and request flags
- return structured `signalMatches`

### `routing-confidence.mjs`

Responsibilities:

- compute winner confidence from structured planner state
- compute `selectionMode`
- compute `topSignals`

### `planner.mjs`

Responsibilities after v2:

- evaluate hard constraints
- collect structured contributions
- compute candidate scores
- produce plan-level routing diagnostics

### `output.mjs`

Responsibilities after v2:

- expose compact `routingSummary`
- expose full `routingDiagnostics` only when requested

## Provider Expansion

This v2 work should land before or alongside new providers such as `brave` and `querit`.

Reason:

- new providers are most valuable when the router can explain why they were selected
- adding providers before structured signals would keep increasing planner complexity without
  improving route quality transparency

## Testing Strategy

Implementation follows TDD.

P0 red tests:

1. explicit engine route => `selectionMode=explicit`
2. `--news --days` => `selectionMode=hard-requirement`
3. `--deep` with only one configured deep-capable provider => `selectionMode=availability-only`
4. `--type news` plus a summary/freshness query => constraints filter first, then signal decides
5. `--lang zh` plus a non-Latin query => locale filtering narrows the field, then multilingual signal decides
6. question-style query with `perplexity` => high `confidence`, direct-answer `topSignals`
7. freshness query with `you` => intent-match `selectionMode`
8. privacy query with `searxng` => privacy `topSignals`
9. no-key baseline fallback => `selectionMode=availability-only`, low `confidence`
10. cooldown-driven route change => `selectionMode=fallback`
11. `--explain-routing` => emits full diagnostics, while default JSON stays compact

## Recommendation

Implement in this order:

1. document the routing model
2. lock the output contract with tests
3. add structured signal and contribution internals
4. compute `selectionMode`, `confidence`, and `topSignals`
5. add `brave` and `querit` on top of the new model

This order minimizes architecture churn and prevents the planner from regressing into an opaque
scoring script.
