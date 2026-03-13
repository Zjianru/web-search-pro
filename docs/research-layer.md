# Research Layer

`research.mjs` is a structured research orchestration layer built on top of the retrieval stack.

It is intentionally not a long-form report generator. The command is designed for agents and
upstream models that need:
- question decomposition
- explicit retrieval planning
- normalized evidence records
- claim clusters and candidate findings with citations
- surfaced conflicts, gaps, and uncertainties
- a cleaner evidence substrate than raw retrieval output

## Positioning

`research.mjs` sits above the retrieval primitives:
- `search.mjs`
- `extract.mjs`
- `crawl.mjs`
- `map.mjs`

This layer reuses the existing retrieval core rather than replacing it:
- provider routing still belongs to `planner.mjs`
- provider execution still belongs to the provider adapters and retrieval runners
- health and cooldown state still belong to `health-state.mjs`

The research layer is responsible for a different problem:
- turning one broad topic into several executable subquestions
- choosing which retrieval primitive fits each subquestion
- collecting evidence into a stable pack
- removing obvious boilerplate, interstitial, and low-signal document noise
- prioritizing official and primary sources ahead of low-value secondary sources
- connecting evidence to candidate findings
- exposing missing evidence, stale evidence, and source conflicts

## Skill And Model Boundary

`research.mjs` is a model-facing evidence layer, not a narrative answer layer.

The skill is responsible for:
- evidence hygiene
- source prioritization
- claim clustering
- compact research findings
- uncertainty exposure

Upstream models remain responsible for:
- final reasoning across the evidence pack
- narrative synthesis
- user-facing writing style
- final judgment when evidence remains incomplete or conflicting

## Non-goals

Version 1.2 does not aim to:
- generate polished long-form narrative reports
- compete with general-purpose deep-research LLM products on writing quality
- replace the retrieval stack's routing, cache, or health model
- enable browser render by default

## Topic Classification

Each research request is classified into one of these topic types:
- `general`
- `landscape`
- `docs`
- `company`
- `product`
- `latest`
- `comparison`

`topicType` is emitted at the top level of the research pack so upstream models can understand the
primary decomposition mode used for the pack.

## Topic Signals And Research Axes

Version 1.2 keeps `topicType` stable, but adds two higher-quality summaries:
- `topicSignals`
- `researchAxes`

`topicSignals` is a multi-label summary of the topic surface. It can include:
- `docs`
- `company`
- `product`
- `latest`
- `comparison`
- `landscape`
- `timeline`

`researchAxes` is an ordered list of the research dimensions chosen for decomposition. It can
include:
- `baseline-context`
- `recent-change`
- `official-proof`
- `site-structure`
- `competitive-gap`
- `timeline`

## Request Model

The normalized research request has these top-level fields:
- `topic`
- `objective`
- `scope`
- `constraints`
- `budgets`
- `output`

### Defaults

Default values are:
- `objective = "structured research pack"`
- `budgets.maxQuestions = 4`
- `budgets.maxSearches = 8`
- `budgets.maxExtracts = 6`
- `budgets.maxCrawlPages = 12`
- `budgets.allowFederation = true`
- `budgets.allowCrawl = true`
- `budgets.allowRender = false`
- `output.format = "pack"`
- `output.language = "match-input"`

## Core Structures

### `subquestion`

Represents one executable research angle.

Fields:
- `id`
- `question`
- `intent`
- `priority`
- `why`
- `plannedActions`
- `researchAxis`
- `evidenceGoal`

`intent` is constrained to:
- `overview`
- `latest`
- `official-sources`
- `comparison`
- `site-structure`
- `timeline`

`evidenceGoal` is constrained to:
- `official-proof`
- `recent-change`
- `structure-map`
- `comparison-signal`
- `timeline-proof`

### `retrievalTask`

Represents one planned retrieval action for one subquestion.

Fields:
- `id`
- `subquestionId`
- `kind`
- `query`
- `urls`
- `reason`
- `budget`
- `evidencePriority`
- `sourceDiversityTarget`
- `followupEligible`
- `phase`
- `status`

`kind` is one of:
- `search`
- `extract`
- `crawl`
- `map`

`evidencePriority` is one of:
- `official`
- `recent`
- `diverse`
- `structural`

`sourceDiversityTarget` is one of:
- `single-source-ok`
- `multi-source-preferred`

`phase` is one of:
- `primary`
- `followup`

### `evidenceRecord`

Represents one normalized piece of evidence gathered from the retrieval layer.

Fields:
- `id`
- `subquestionId`
- `taskId`
- `title`
- `url`
- `snippet`
- `content`
- `sourceType`
- `providerIds`
- `retrievedAt`
- `publishedDate`
- `authority`
- `credibility`
- `freshness`
- `coverage`
- `documentQuality`
- `boilerplateRatio`
- `hasPrimaryContent`
- `sourcePriority`
- `selectionReason`
- `claimKey`
- `stalenessFlag`
- `claims`
- `conflictsWith`

Field semantics:
- `authority`: `official | primary | reputable-third-party | unknown`
- `freshness`: `current | recent | stale | unknown`
- `coverage`: `high | medium | low`
- `documentQuality`: `high | medium | low`
- `boilerplateRatio`: rough share of removed template or navigation text
- `hasPrimaryContent`: whether meaningful body text remains after cleaning
- `sourcePriority`: `official | preferred | standard | low`
- `selectionReason`: why the evidence survived curation
- `claimKey`: stable normalized key used to cluster evidence into the same claim
- `stalenessFlag`: marks evidence as potentially outdated when recent information is preferred

### `claimCluster`

Represents a grouped claim built from one or more evidence records that share the same normalized
claim key inside one subquestion.

Fields:
- `id`
- `subquestionId`
- `claimKey`
- `statement`
- `evidenceIds`
- `providerIds`
- `authority`
- `freshness`
- `coverage`
- `documentQuality`
- `sourcePriority`
- `sourceDiversity`
- `claimConsistency`
- `conflictsWith`
- `hasInternalConflict`
- `hasAuthoritativeEvidence`
- `stalenessFlag`

Field semantics:
- `sourceDiversity`: `high | medium | low`
- `claimConsistency`: `high | medium | low`

### `candidateFinding`

Represents a supported or partially supported conclusion, not a final authoritative answer.

Fields:
- `id`
- `statement`
- `subquestionIds`
- `claimClusterIds`
- `evidenceIds`
- `supportProfile`
- `gapSensitive`
- `confidence`
- `status`

`status` is one of:
- `supported`
- `weakly-supported`
- `conflicted`

`supportProfile` contains:
- `authority`
- `freshness`
- `coverage`
- `documentQuality`
- `sourcePriority`
- `sourceDiversity`
- `claimConsistency`

The research layer intentionally keeps `candidateFindings` more compact than raw evidence. The
goal is not "one evidence record becomes one finding". The goal is to emit a smaller set of
model-facing facts that preserve strong support and visible uncertainty.

### `uncertainty`

Represents evidence gaps or conflicts that should remain explicit for the consuming model.

Fields:
- `id`
- `type`
- `description`
- `subquestionId`
- `relatedEvidenceIds`
- `priority`
- `followupEligible`
- `recommendedNextAction`

`type` is one of:
- `missing-evidence`
- `source-conflict`
- `stale-information`
- `insufficient-official-sources`

### `subquestionBrief`

Represents a compact handoff summary for one subquestion.

Fields:
- `subquestionId`
- `supportedFacts`
- `conflicts`
- `missing`
- `topEvidenceIds`

This structure exists so upstream models can consume the pack without scanning the entire
`evidence[]` array first.

## Pipeline

`research.mjs` runs a fixed pipeline:

1. `decompose`
   Break the topic into 4-6 high-value subquestions.
2. `plan`
   Map each subquestion to one or more retrieval tasks.
3. `retrieve`
   Execute the planned retrieval tasks through the existing retrieval stack.
4. `normalize`
   Convert raw results into `evidenceRecord[]`.
   This step also performs document cleaning, boilerplate filtering, low-signal suppression, and
   source prioritization.
5. `analyze`
   Build `claimClusters[]`, `candidateFindings[]`, `uncertainties[]`, and `citations[]`.
   This step also compacts findings so they remain smaller than the raw evidence set whenever
   possible.
6. `gap-fill`
   Optionally run one controlled follow-up pass for high-value gaps.
7. `finalize`
   Emit a stable evidence pack, including compact `subquestionBriefs[]` for downstream models.

### Execution Trace

`execution` captures how the evidence pack was built:
- task counts by primitive
- provider ids used
- whether federation was used
- whether render was allowed
- whether any budget limits were reached

## Uncertainty Rules

The analyzer emits explicit uncertainty records under these rules:
- `missing-evidence`: no evidence was collected for a subquestion
- `source-conflict`: claim clusters conflict with each other, or one cluster contains internally conflicting evidence
- `stale-information`: every relevant claim cluster is stale while recent information is preferred
- `insufficient-official-sources`: no `official` or `primary` evidence exists while official sources are preferred

Priority rules:
- `insufficient-official-sources`: `high`
- `stale-information`: `high`
- `missing-evidence`: `medium`
- `source-conflict`: `low`

Only `high` and `medium` uncertainties can be follow-up eligible.

## Gap Filling

Version 1.2 adds a single controlled follow-up pass.

Rules:
- follow-up runs at most once
- follow-up can add at most 2 tasks
- follow-up does not bypass `allowFederation`, `allowRender`, `allowCrawl`, or any budget limits
- follow-up never auto-resolves `source-conflict`

Follow-up triggers:
- `insufficient-official-sources`
- `stale-information`
- `missing-evidence`

## Output Contract

`research.mjs --json` emits schema version `1.0` with these top-level fields:
- `schemaVersion`
- `command`
- `topic`
- `topicType`
- `topicSignals`
- `researchAxes`
- `objective`
- `subquestions`
- `tasks`
- `claimClusters`
- `evidence`
- `candidateFindings`
- `uncertainties`
- `citations`
- `subquestionBriefs`
- `gapResolutionSummary`
- `execution`
- `meta`

`gapResolutionSummary` contains:
- `attempted`
- `triggeredBy`
- `followupTasksPlanned`
- `followupTasksExecuted`
- `resolvedUncertaintyIds`
- `remainingUncertaintyIds`

## CLI Shape

```bash
node scripts/research.mjs "OpenClaw search skill landscape" --json
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json
node scripts/research.mjs "OpenClaw search skill landscape" --format pack --max-questions 5
```

`--plan` returns decomposition and retrieval planning only.

## Design Rationale

The research layer intentionally follows a STORM-like approach:
- decompose first
- gather evidence second
- synthesis stays structured

This keeps the skill aligned with its core role: a high-quality research substrate for models,
not a human-facing final-report engine.

## Research Eval

`eval.mjs` includes a dedicated `research` suite for structural regression testing. It does not
grade writing quality; it grades the quality of the pack structure.

Research eval dimensions:
- `decomposition`
- `planning`
- `evidence`
- `findings`
- `uncertainty`
- `execution`
