# Agent Contract P0

## Audience

This document is for maintainers shaping the agent-facing runtime contract of `web-search-pro`.
Read it when you need to decide what an upstream model can safely infer from `doctor`,
`bootstrap`, provider state, and partial execution outcomes.

## Goal

`web-search-pro` is an agent skill, not a human-first CLI product.

That changes the definition of "P0":

- P0 is not "more providers"
- P0 is not "prettier docs"
- P0 is not "smaller files"

P0 is:

1. can the agent tell whether the skill is usable right now?
2. if not, can the agent tell exactly why?
3. can the agent tell which capabilities are truly available right now?
4. when execution partially fails, can the agent tell what succeeded, what failed, and what to do next?
5. can we prove these contracts stay honest over time?

This document defines the first agent-facing contract upgrade needed to answer those questions.

## Why This Is P0

The current codebase already has most of the underlying facts:

- credential group activation
- transport-specific capability differences
- runtime availability
- provider health
- route explanations
- cache telemetry

But those facts are still surfaced unevenly.

Examples:

- `doctor` and `bootstrap` still mostly talk in terms of "missing provider hints"
- `credentialed` and `configured` are visible, but "configured wrong" is not yet a first-class
  agent contract
- planner understands more than the output contract exposes
- execution results still emphasize final success/failure more than partial recovery structure

For an agent, this is the real failure mode:

- the skill may already know the root cause
- but the output contract does not expose that root cause in a structured enough way

That is why this work is P0.

## Non-Goals

This P0 plan intentionally does **not** prioritize:

- splitting large files
- ClawHub package build refactors
- adding more providers
- changing robots defaults
- adding image/video search

Those may matter later, but they are not the first blocker for agent reliability.

## Current Gaps

### 1. Root Causes Are Still Flattened

The system already distinguishes several different realities, but the agent contract still does not
cleanly separate them:

- `credentialed`
  means a complete credential group is present
- `configurationError`
  means credentials exist, but transport/model/base URL is invalid
- `runtimeAvailable`
  means runtime dependencies are usable
- `missingCapability`
  means the request cannot be satisfied by that provider

Today, these truths are still not surfaced as a single normalized provider state contract.

### 2. Capability Truth Is Still Too Coarse

The project now has the concept of effective capabilities, but not yet a full capability contract
for agents.

Current problems:

- static provider facts and runtime-effective provider facts are not explicitly separated
- `localeFiltering` is still too coarse for agent reasoning
- transport-aware capability deltas exist in code, but are not yet a first-class contract concept

### 3. Partial Failure Is Still Under-described

Current outputs already contain:

- `failed`
- `routingSummary`
- `federated.providersUsed`

But for agent use, this is still not enough.

The agent needs to know:

- did the primary path succeed?
- did fallback save the request?
- which provider failed at which phase?
- was the result a full success or only a partial success?
- what should be retried or changed next?

### 4. Schema Boundaries Are Still Implicit

The project documents `schemaVersion = 1.0`, but in practice the machine contract is still spread
across:

- `output.mjs`
- `doctor.mjs`
- `bootstrap.mjs`
- planner serialization
- tests

That is workable, but not ideal for agent consumers.

### 5. Eval Proves Routing Better Than Contract Honesty

The eval layer is already strong, but the next P0 step is to prove:

- root-cause honesty
- capability honesty
- partial-failure honesty
- recovery honesty

not only route correctness.

## P0 Workstreams

## Workstream A: Provider State Contract

### Goal

Expose one normalized provider state shape across:

- `doctor`
- `bootstrap`
- capability snapshots
- route diagnostics

### Proposed Variables

### `availabilityState`

`availabilityState` answers: can this provider participate right now?

Allowed values:

- `ready`
- `missing-credentials`
- `invalid-configuration`
- `runtime-unavailable`
- `disabled-by-policy`
- `missing-capability`

Semantics:

- `ready`
  provider can compete for at least its current effective capability surface
- `missing-credentials`
  no complete credential path is present
- `invalid-configuration`
  a credential path exists, but transport-specific config is invalid
- `runtime-unavailable`
  local runtime dependency is missing
- `disabled-by-policy`
  config blocks the provider even though it could otherwise run
- `missing-capability`
  provider is generally usable, but not for the current request shape

### `healthState`

`healthState` must remain a separate dimension.

Allowed values:

- `healthy`
- `degraded`
- `cooldown`

Why separate this from `availabilityState`:

- health is runtime quality, not eligibility
- a provider may be `ready` but `degraded`
- collapsing both into one enum would create muddy hybrid states

### `activationPath`

`activationPath` identifies which credential/transport path made the provider usable.

Examples:

- `native`
- `openrouter`
- `kilo`
- `custom-gateway`
- `baseline`
- `render-runtime`

Semantics:

- this is not the provider id
- this explains *how* the provider became active
- it is critical for transport-aware capability honesty

### `blockingReasons`

Structured list of machine-readable reasons why the provider cannot fully participate.

Suggested shape:

```json
[
  {
    "type": "invalid-configuration",
    "field": "PERPLEXITY_MODEL",
    "message": "PERPLEXITY_MODEL must reference a Perplexity Sonar model.",
    "recoverable": true
  }
]
```

Reason types should include:

- `missing-credentials`
- `invalid-configuration`
- `runtime-unavailable`
- `disabled-by-policy`
- `missing-capability`

### `recoveryActions`

Structured next steps for the agent.

Suggested shape:

```json
[
  {
    "type": "set-env",
    "target": "OPENROUTER_API_KEY",
    "message": "Set OPENROUTER_API_KEY to unlock gateway-backed answer-first search."
  }
]
```

Why this matters:

- agents should not have to reverse-engineer recovery steps from prose
- this is the machine equivalent of a setup guide, without building a human wizard

### Recommendation

Make `providerState` a normalized structure in `doctor` and `bootstrap`, then reference it
everywhere else.

Suggested shape:

```json
{
  "providerId": "perplexity",
  "configured": false,
  "credentialed": true,
  "availabilityState": "invalid-configuration",
  "healthState": "healthy",
  "activationPath": "openrouter",
  "blockingReasons": [],
  "recoveryActions": []
}
```

## Workstream B: Capability Contract V2

### Goal

Separate static provider truth from current runtime truth.

### Proposed Variables

### `declaredCapabilities`

Static provider facts independent of the current env/runtime.

Examples:

- `search`
- `deepSearch`
- `newsSearch`
- `answerSynthesis`
- `subEngines`

### `effectiveCapabilities`

The capabilities actually available right now, given:

- activation path
- transport mode
- runtime constraints
- config policy

This is the capability surface agents should use for real planning.

### `capabilityDeltas`

Structured explanation of why effective capabilities differ from declared capabilities.

Suggested shape:

```json
[
  {
    "field": "dateRange",
    "declared": true,
    "effective": false,
    "reason": "gateway transport does not guarantee native date filtering"
  }
]
```

### `languageFiltering` and `countryFiltering`

This document recommends splitting the current coarse `localeFiltering` concept into:

- `languageFiltering`
- `countryFiltering`

Why:

- they are different facts
- they may diverge by provider or transport
- an agent can make better decisions when they are explicit

Tradeoff:

- this adds more capability fields
- but it prevents the router and diagnostics from overstating locale support

### Recommendation

P0 should not try to redesign every capability field.

It should do the smallest high-value step:

1. add `declaredCapabilities`
2. add `effectiveCapabilities`
3. add `capabilityDeltas`
4. split `localeFiltering` into language/country support

That is enough to make the agent contract much more honest.

## Workstream C: Partial Failure And Recovery Contract

### Goal

Expose structured execution outcomes instead of relying mainly on:

- `failed`
- routing prose
- implicit fallback behavior

### Proposed Variables

### `executionStatus`

Allowed values:

- `success`
- `partial-success`
- `failed`

Semantics:

- `success`
  the intended path succeeded without meaningful degradation
- `partial-success`
  the request completed, but fallback/degradation happened
- `failed`
  no usable result was produced

### `providerOutcomes`

Structured provider execution records.

Suggested shape:

```json
[
  {
    "providerId": "serper",
    "role": "primary",
    "phase": "search",
    "status": "failed",
    "retryable": true,
    "errorType": "upstream-http",
    "message": "429 rate limited"
  },
  {
    "providerId": "ddg",
    "role": "fallback",
    "phase": "search",
    "status": "success"
  }
]
```

### `recoveryApplied`

Structured record of what fallback or degradation actually happened.

Examples:

- primary failed, no-key baseline used
- primary selected, federated fanout recovered missing breadth
- extract provider failed, fetch fallback succeeded

### `recoveryHints`

Actionable next steps for the agent after a partial success.

Examples:

- retry later because the premium provider is in cooldown
- add a missing credential for better coverage
- rerun with `--engine x` only if source diversity is not required

### Recommendation

Keep existing `failed` arrays for backward compatibility, but add:

- `execution`
- `providerOutcomes`
- `recoveryApplied`
- `recoveryHints`

This keeps schema `1.0` additive while giving agents a better control surface.

## Workstream D: Schema Tiers

### Goal

Define what an agent can safely rely on without parsing debug internals.

### Tier 1: Stable Agent Contract

These fields should be explicitly documented as stable:

- `schemaVersion`
- `command`
- `selectedProvider`
- `engine`
- `results`
- `failed`
- `meta`
- `routingSummary`
- `cache`
- `execution`
- `providerOutcomes`

For `doctor` / `bootstrap`:

- `configuredProviders`
- `availableFeatures`
- `providers[*].availabilityState`
- `providers[*].healthState`
- `providers[*].declaredCapabilities`
- `providers[*].effectiveCapabilities`
- `providers[*].blockingReasons`
- `providers[*].recoveryActions`

### Tier 2: Rich Runtime Contract

These fields are still agent-usable, but more detailed and situational:

- `federated`
- `recommendedRoutes`
- `routingPolicy`
- `safeFetch`
- `renderLane`

### Tier 3: Debug / Explain Contract

These fields are intentionally richer and may evolve faster:

- `routing`
- full planner candidates
- score breakdowns
- full signal matches

Recommendation:

- keep Tier 1 explicitly stable
- keep Tier 3 clearly marked as explain/debug scope

## Workstream E: P0 Eval Coverage

### Goal

Prove that the new contract is honest, not just present.

### New Metrics

P0 eval should add explicit checks for:

- `diagnosticHonesty`
  does the system distinguish missing credentials from invalid configuration?
- `capabilityHonesty`
  do effective capabilities match the real active transport/runtime?
- `recoveryHonesty`
  does partial success clearly report fallback/degradation?
- `agentRecoveryQuality`
  are recovery actions actionable enough for a downstream agent?

### Required Case Types

P0 eval should cover at least:

1. missing credential vs invalid transport config
2. native vs gateway capability differences
3. partial-success search fallback
4. partial-success extract fallback
5. degraded vs cooldown provider health
6. answer-first live case
7. locale/multilingual live case

## Implementation Order

### Phase 1

Introduce normalized provider state in:

- provider snapshot
- `doctor`
- `bootstrap`

This is the first deliverable because every later contract depends on it.

### Phase 2

Introduce capability contract v2:

- `declaredCapabilities`
- `effectiveCapabilities`
- `capabilityDeltas`
- split locale capability fields

### Phase 3

Introduce partial-failure and recovery contract on command outputs:

- `executionStatus`
- `providerOutcomes`
- `recoveryApplied`
- `recoveryHints`

### Phase 4

Add P0 eval coverage and acceptance gates.

## Acceptance Criteria

P0 is done when:

1. an agent can distinguish:
   - missing credentials
   - invalid configuration
   - runtime unavailable
   - provider health degradation
2. an agent can see both declared and effective capabilities
3. partial success is explicit rather than inferred
4. recovery steps are structured, not only prose
5. the eval suite proves these contracts stay honest

## Recommendation

Start with the provider state contract, not the execution contract.

Reason:

- root-cause diagnosis is the most central agent need
- it already has the strongest implementation footing in the current code
- it will clarify how `doctor`, `bootstrap`, planner diagnostics, and output layers should relate

That makes it the correct first coding phase after this design document.
