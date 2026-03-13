# ClawHub Compliance

This document explains the current ClawHub / OpenClaw compliance posture of `web-search-pro`.

## Distribution Boundary

`web-search-pro` now distinguishes between:

- the full GitHub / local OpenClaw source tree
- the generated ClawHub publish package

The full repository keeps the entire `2.1` surface, including browser render, eval, and the local
test toolchain. The ClawHub package is intentionally generated as a narrower core profile so the
published artifact stays closer to what registry review can honestly reason about.

Packaging details:
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)

## Why This Exists

Earlier `1.x` moderation friction came from a metadata-model mismatch:

- the runtime supports multiple optional provider credentials
- different features use different providers
- the current metadata model cannot accurately express "one of several optional provider keys,
  depending on feature path"

If metadata overstates credentials, the skill looks over-privileged.  
If metadata hides them entirely, static review sees code access to credentials and outbound calls.

The current posture therefore focuses on three things:

1. honest hard requirements
2. explicit runtime disclosure
3. visible safety boundaries

## Metadata Contract

`SKILL.md` metadata only declares the real hard requirement:

- `node`

It intentionally does **not** declare:

- `always: true`
- `primaryEnv`
- `requires.env`

Reason:

- provider keys are optional
- feature coverage increases as more keys are configured
- there is no accurate `env_any` metadata shape available for this skill model

The generated ClawHub package adds `metadata.clawdbot` alongside compatibility
`metadata.openclaw` so registry review can see the package as a code-backed Node runtime skill
instead of an instruction-only artifact.

## Credential Disclosure

Credential disclosure is moved to runtime review surfaces instead of hard metadata gating.

Use:

- `node scripts/capabilities.mjs --json`
- `node scripts/doctor.mjs --json`
- `node scripts/bootstrap.mjs --json`
- `node scripts/review.mjs --json`

Those commands expose:

- provider matrix
- configured providers
- no-key baseline status
- activation paths such as native / gateway-backed provider lanes
- federation config summary
- render lane summary
- health state, including degraded providers

## No-Key Baseline

The no-key baseline is real, but bounded:

- `ddg` provides best-effort search only
- `fetch` provides extract / crawl / map baseline
- `curl` is the preferred baseline network transport when available

The shipped ClawHub core profile does not rely on Python helper transports.

This is intentionally disclosed as **best-effort**, not guaranteed infrastructure.

If DuckDuckGo returns challenge or anti-bot pages, the system reports a degraded baseline instead
of pretending the provider is healthy.

## Safe Fetch Boundary

Safe fetch is the default non-browser network boundary.

It:

- only allows `http` and `https`
- blocks credential-bearing URLs
- blocks `localhost`, `.local`, `.internal`
- blocks private, loopback, link-local, and metadata IPs
- revalidates redirect targets
- blocks unsupported binary content types
- keeps JavaScript execution disabled

## Browser Render Boundary

Browser render is optional and off by default.

It:

- only runs when enabled or explicitly forced
- uses a local headless browser runtime
- revalidates navigations
- reports anti-bot / challenge interstitial pages as failures instead of empty successes
- can enforce same-origin-only navigation
- blocks configured resource classes
- does not expose browser state across runs

The runtime view of this lane is surfaced through `renderLane` in `doctor.mjs` and `review.mjs`.

## Provider Health Visibility

Provider failures are intentionally split into:

- `degraded`
- `cooldown`

This matters for review:

- a provider can fail without being hidden
- non-cooldown failures still stay visible
- `doctor` and `review` are allowed to tell the truth even when routing is not yet fully penalized

## Review Summary

The compliance story for `web-search-pro 2.1` is:

- metadata declares only real hard runtime requirements
- provider keys are optional and surfaced explicitly at runtime
- gateway-backed provider paths are disclosed without being overstated as hard requirements
- no-key behavior is real but bounded
- network boundaries are explicit
- browser behavior is optional and inspectable
- research output is evidence-pack oriented, not opaque autonomous report generation
