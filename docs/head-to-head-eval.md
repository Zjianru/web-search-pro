# Head-to-Head Eval Model

## Goal

This document defines a reproducible evaluation model for comparing `web-search-pro` against other
search skills, especially `web-search-plus`.

The aim is not "marketing proof." The aim is disciplined evidence for claims such as:

- route correctness is better
- confidence output is more honest
- provider win-rate is higher on specific task classes
- fallback behavior is safer and clearer

## Why the Current Eval Is Not Enough

The current eval framework is strong for internal regression checks, but it only scores
`web-search-pro` in isolation.

That means it can answer:

- "did our behavior regress?"

But it cannot answer:

- "are we better than `web-search-plus` on the same case?"

## Design Principles

1. Internal regression eval and competitive eval should share the same scoring engine where
   possible.
2. Competitive eval must be reproducible from local repos and local environment.
3. Cases should encode expected outcomes, not hard-code one implementation's internals.
4. Comparative metrics must distinguish correctness from honesty and richness.
5. Scores should remain decomposable so disagreements can be traced back to case-level evidence.

## New Concepts

### `suite="head-to-head"`

This new suite type groups comparative cases intended to run across multiple systems.

It does not replace the existing `core` and `research` suites.

### `targets`

Each head-to-head case should define one or more runnable targets.

Suggested shape:

```json
{
  "targets": [
    {
      "id": "web-search-pro",
      "command": {
        "name": "search",
        "argv": ["OpenClaw latest AI policy updates", "--plan"]
      }
    },
    {
      "id": "web-search-plus",
      "externalCommand": {
        "cwd": "/Users/codez/develop/web-search-plus",
        "bin": "python3",
        "argv": ["scripts/search.py", "-q", "OpenClaw latest AI policy updates", "--explain", "--json"]
      }
    }
  ]
}
```

Semantics:

- `targets` describe who participates in the comparison
- one target can be the local repo
- another target can be an external local checkout

### `comparativeMetrics`

Each case should define the comparison axes that matter.

Initial metrics:

- `routeCorrectness`
- `confidenceHonesty`
- `providerWinRate`
- `fallbackBehavior`
- `freshness`
- `citationQuality`

These are higher-level evaluation categories built on top of per-target checks.

## Metric Definitions

### `routeCorrectness`

Definition:

- did the system select an appropriate provider for the case?

This is not literal provider equality. It is case-relative correctness.

Example:

- for a multilingual query, `querit` may be considered a stronger correct route than a generic
  SERP provider

### `confidenceHonesty`

Definition:

- did the confidence output reflect the actual certainty of the routing context?

Examples:

- if a no-key baseline won because all premium providers were unavailable, high confidence is
  dishonest
- if a route was forced by `--engine`, high confidence is acceptable

### `providerWinRate`

Definition:

- across a case set, how often did a system select the preferred provider class or one of the
  allowed best routes?

This metric matters most at aggregate level, not a single case.

### `fallbackBehavior`

Definition:

- when preferred providers are degraded, blocked, or missing, did the system degrade gracefully and
  explain the degradation honestly?

### `freshness`

Definition:

- for freshness-sensitive cases, is the median age of the dated evidence recent enough?

### `citationQuality`

Definition:

- did the output preserve enough URL/source grounding to be used safely by an agent?

## Case Schema

Suggested schema additions for head-to-head cases:

```json
{
  "id": "h2h-search-latest-policy",
  "suite": "head-to-head",
  "description": "Latest-policy queries should favor current-information providers and expose honest confidence.",
  "intent": "search",
  "comparativeMetrics": ["routeCorrectness", "confidenceHonesty", "freshness", "citationQuality"],
  "targets": [...],
  "expectedSignals": {
    "selectedProviderIn": ["you", "serper", "querit", "brave"],
    "confidenceLevelNotIn": ["low"],
    "maxResultAgeDays": 14
  },
  "comparativeExpectations": {
    "preferredTarget": "web-search-pro",
    "mustBeatOn": ["confidenceHonesty"],
    "allowedTiesOn": ["freshness", "citationQuality"]
  }
}
```

## Scoring Model

Head-to-head scoring should happen in two layers.

### Layer 1: Per-target scoring

Each target is scored using the existing style of dimension checks.

This keeps reuse high and avoids inventing a second incompatible scoring system.

### Layer 2: Comparative scoring

Comparative scoring then evaluates:

- whether the preferred target beat the comparator on the required metrics
- whether ties are acceptable on selected metrics
- whether any metric loss is explainable by environment constraints

Suggested output:

```json
{
  "targetResults": [
    {
      "targetId": "web-search-pro",
      "status": "pass",
      "score": 0.91
    },
    {
      "targetId": "web-search-plus",
      "status": "pass",
      "score": 0.78
    }
  ],
  "comparativeResult": {
    "winner": "web-search-pro",
    "byMetric": {
      "routeCorrectness": "win",
      "confidenceHonesty": "win",
      "freshness": "tie",
      "citationQuality": "tie"
    }
  }
}
```

## Phase 1 Bundled Suite

The initial bundled `head-to-head` suite is intentionally routing-first.

Current behavior:

- local `web-search-pro` target runs `search --plan --json`
- local `web-search-plus` target runs `search.py --explain-routing`
- cases are `requiresNetwork=false`
- cases are gated only by provider-env availability

Why start here:

- route correctness and confidence honesty are the current strategic gap
- planner/explain output is reproducible and cheap to run
- this avoids mixing routing evaluation with live-result volatility too early

What phase 1 can prove:

- `routeCorrectness`
- `confidenceHonesty`
- `providerWinRate`

What phase 1 does not yet prove:

- `freshness`
- `citationQuality`
- live fallback behavior under upstream failures

Those should be added in a later networked head-to-head suite.

## Phase 2 Live Suite

The next suite should be `suite="head-to-head-live"`.

Purpose:

- compare real result freshness
- compare citation richness and URL grounding
- grow into live fallback-behavior evaluation

Constraints:

- cases must be `requiresNetwork=true`
- cases must be gated by real provider envs
- route expectations should stay broad enough to avoid overfitting a single provider id
- freshness-sensitive cases should prefer queries where providers actually emit dates
- fallback-behavior cases should be added only after degraded-provider simulation is standardized

Recommended initial live case groups:

1. latest news freshness
2. docs/reference citation quality
3. locale-sensitive multilingual search quality

The initial bundled live suite should therefore start with:

- at least one freshness-sensitive `news` case
- at least one citation-quality-sensitive `docs` case
- at least one multilingual or locale-sensitive live case
- shared-provider env gating so both targets can run under the same local credential set

Recommended later live case groups:

1. answer-first current-event grounding when both targets can share an answer-first provider env
2. fallback behavior under degraded or cooled-down providers

## Target Execution Model

Targets should support two execution styles:

- local built-in command execution
- external local command execution

This is necessary because `web-search-plus` is a separate repo with a different runtime.

Suggested target fields:

- `command`
  existing internal command model
- `externalCommand.cwd`
  working directory for the external repo
- `externalCommand.bin`
  executable to run
- `externalCommand.argv`
  full argv
- `constraints.requiredEnvAll`
  env dependencies shared with the case

## Recommended First Case Groups

P0 case groups:

1. baseline no-key search
2. question/direct-answer routing
3. freshness/latest routing
4. multilingual routing
5. privacy-oriented routing
6. deep-search routing
7. locale-specific routing
8. degraded/cooldown fallback routing

Why these first:

- they map directly to your current competitive claims
- they cover both route quality and route honesty

## Recommendation

Implement in phases:

1. document the head-to-head schema
2. teach the eval runner to load `targets` and external commands
3. add head-to-head scoring helpers
4. add an initial `head-to-head` suite comparing `web-search-pro` and `web-search-plus`
5. publish aggregate metrics such as provider win-rate and confidence honesty rate

This turns competitive claims into testable engineering evidence instead of intuition.
