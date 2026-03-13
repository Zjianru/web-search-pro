# ClawHub Package Profile

`web-search-pro` has two valid distribution surfaces now:

1. the full GitHub / local OpenClaw source tree
2. a ClawHub-specific publish package

They exist for different reasons and should not be conflated.

## Why A Separate Package Exists

The root cause is not a single scanner false positive. It is a conflict between three facts:

1. The GitHub / local source tree intentionally includes the full `2.1` surface:
   - `render.mjs`
   - `eval.mjs`
   - tests
   - internal research / review tooling
2. ClawHub moderation scans the published folder as a static artifact.
3. The current registry model is weak at expressing:
   - optional provider credentials
   - optional local browser lanes

That creates two moderation mismatches:

- `render` expands the apparent runtime surface with a local browser lane
- test / eval files inflate the static pattern count without improving installed runtime behavior

The correct fix is not to lie in the root `SKILL.md`, and not to remove features from GitHub.
The correct fix is to publish a narrower, registry-friendly package profile.

## What The ClawHub Package Keeps

The ClawHub profile keeps the core retrieval contract:

- `search.mjs`
- `extract.mjs`
- `crawl.mjs`
- `map.mjs`
- `research.mjs`
- `doctor.mjs`
- `bootstrap.mjs`
- `capabilities.mjs`
- `review.mjs`
- `cache.mjs`
- `health.mjs`

These are the parts that matter most for actual agent retrieval.

## What The ClawHub Package Excludes

The ClawHub profile excludes files and lanes that materially widen moderation scope:

- `tests/`
- `test-results/`
- `eval/`
- `scripts/eval.mjs`
- browser-render runtime files
- the explicit `render.mjs` command

This is a packaging decision, not a product denial. The full repository still contains those
features for GitHub users and local OpenClaw users.

## Why `selectedProvider` Still Matters

`selectedProvider` remains the primary route across both distributions.

It means:
- which provider the planner chose as the main route

It does **not** mean:
- the only provider that executed
- the only provider that can contribute results

That is why federated execution still reports `federated.providersUsed`.

## Why Optional Env Disclosure Moves Into The Package

The root repository keeps runtime disclosure in `capabilities.mjs`, `doctor.mjs`,
`bootstrap.mjs`, and `review.mjs`.

The ClawHub package additionally surfaces optional provider env vars in package metadata because
registry review benefits from static visibility even when those env vars are not hard requirements.

That disclosure must stay honest:

- no provider key is required for the baseline
- more keys increase coverage
- optional env disclosure is not the same as eligibility gating

## Packaging Principles

The publish package must satisfy these rules:

1. It must be installable and runnable as a skill on its own.
2. It must present itself as a code-backed Node package, not an instruction-only bundle.
3. It must not promise features that were removed from the package.
4. It must not overstate hard requirements.
5. It must preserve the core retrieval experience.
6. It must shrink scanner noise rather than merely rewording it.

Current hardening choices for the ClawHub package:

- publish `metadata.clawdbot` alongside compatibility `metadata.openclaw`
- declare the code-backed Node install model explicitly
- declare the optional `config.json` read path and `.cache/web-search-pro` state directory
- disclose optional provider env vars without claiming they are all mandatory
- keep the no-key baseline real
- avoid Python helper transports in the shipped runtime path

## Release Rule

When publishing to ClawHub, publish the generated package directory, not the repository root.

The repository root remains the canonical source tree.
