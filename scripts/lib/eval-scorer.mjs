const DIMENSIONS = [
  "routing",
  "coverage",
  "freshness",
  "citation",
  "safety",
  "decomposition",
  "planning",
  "evidence",
  "findings",
  "uncertainty",
  "execution",
];

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function normalizeTopSignals(signals) {
  if (!Array.isArray(signals)) {
    return [];
  }
  return signals.map((signal) => ({
    id: signal.id ?? null,
    label: signal.label ?? signal.matched ?? null,
    category: signal.category ?? null,
    delta: signal.delta ?? signal.weight ?? null,
    evidence: signal.evidence ?? null,
  }));
}

function inferSelectionMode(payload, routingSummary, topSignals) {
  if (routingSummary?.selectionMode) {
    return routingSummary.selectionMode;
  }

  const reason = lower(routingSummary?.reason);
  const autoRouted = routingSummary?.auto_routed;
  if (autoRouted === false) {
    return "explicit";
  }
  if (reason === "no_available_providers") {
    return "availability-only";
  }
  if (reason === "similar_url_specified") {
    return "explicit";
  }
  if (topSignals.length > 0 || reason.endsWith("_confidence_match")) {
    return "intent-match";
  }
  if (payload.engine && payload.engine === payload.selectedProvider) {
    return "explicit";
  }
  return "default-ranking";
}

function normalizeRoutingSummary(normalized) {
  const compact = normalized.routingSummary;
  if (compact && typeof compact === "object") {
    return compact;
  }

  const routing =
    (normalized.routing && typeof normalized.routing === "object" ? normalized.routing : null) ??
    (normalized.routing_decision && typeof normalized.routing_decision === "object"
      ? normalized.routing_decision
      : null);
  if (!routing) {
    return {};
  }

  const topSignals = normalizeTopSignals(normalized.top_signals ?? routing.top_signals);
  return {
    selectedProvider:
      routing.provider ?? normalized.selected_provider ?? normalized.selectedProvider ?? null,
    selectionMode: inferSelectionMode(normalized, routing, topSignals),
    confidence: routing.confidence ?? null,
    confidenceLevel: routing.confidence_level ?? null,
    topSignals,
    selectedReason: routing.reason ?? null,
  };
}

function normalizePayload(payload = {}) {
  const normalized = payload && typeof payload === "object" ? payload : {};
  const routingSummary = normalizeRoutingSummary(normalized);
  return {
    selectedProvider:
      normalized.selectedProvider ??
      normalized.selected_provider ??
      routingSummary.selectedProvider ??
      normalized.routing?.provider ??
      normalized.routing_decision?.provider ??
      normalized.engine ??
      null,
    routingSummary,
    results: Array.isArray(normalized.results) ? normalized.results : [],
    nodes: Array.isArray(normalized.nodes) ? normalized.nodes : [],
    edges: Array.isArray(normalized.edges) ? normalized.edges : [],
    failed: Array.isArray(normalized.failed)
      ? normalized.failed
      : Array.isArray(normalized.routing?.fallback_errors)
        ? normalized.routing.fallback_errors
        : [],
    topicType: normalized.topicType ?? null,
    topicSignals: Array.isArray(normalized.topicSignals) ? normalized.topicSignals : [],
    researchAxes: Array.isArray(normalized.researchAxes) ? normalized.researchAxes : [],
    subquestions: Array.isArray(normalized.subquestions) ? normalized.subquestions : [],
    tasks: Array.isArray(normalized.tasks) ? normalized.tasks : [],
    evidence: Array.isArray(normalized.evidence) ? normalized.evidence : [],
    claimClusters: Array.isArray(normalized.claimClusters) ? normalized.claimClusters : [],
    candidateFindings: Array.isArray(normalized.candidateFindings)
      ? normalized.candidateFindings
      : [],
    uncertainties: Array.isArray(normalized.uncertainties) ? normalized.uncertainties : [],
    citations: Array.isArray(normalized.citations) ? normalized.citations : [],
    gapResolutionSummary: normalized.gapResolutionSummary ?? {},
    execution: normalized.execution ?? {},
    meta:
      normalized.meta && typeof normalized.meta === "object"
        ? normalized.meta
        : {
            query: normalized.query ?? null,
          },
    summary: normalized.summary ?? {},
  };
}

function collectUrls(payload) {
  return [
    ...payload.results.map((entry) => entry.url).filter(Boolean),
    ...payload.nodes.map((entry) => entry.url).filter(Boolean),
  ];
}

function collectSearchableText(payload) {
  return lower(
    [
      ...payload.results.flatMap((entry) => [entry.title, entry.content, entry.url]),
      ...payload.nodes.flatMap((entry) => [entry.title, entry.url]),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRelativeDate(value, now) {
  const normalized = lower(value).trim();
  if (!normalized) {
    return null;
  }
  if (normalized === "today") {
    return new Date(now.getTime());
  }
  if (normalized === "yesterday") {
    return new Date(now.getTime() - 86400000);
  }

  const match = normalized.match(
    /^(\d+)\s+(minute|minutes|min|mins|hour|hours|hr|hrs|day|days|week|weeks|month|months|year|years)\s+ago$/,
  );
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs =
    unit.startsWith("min")
      ? 60000
      : unit.startsWith("hour") || unit.startsWith("hr")
        ? 3600000
        : unit.startsWith("day")
          ? 86400000
          : unit.startsWith("week")
            ? 7 * 86400000
            : unit.startsWith("month")
              ? 30 * 86400000
              : 365 * 86400000;

  return new Date(now.getTime() - amount * unitMs);
}

function parseResultDate(value, now) {
  const absolute = parseDate(value);
  if (absolute) {
    return absolute;
  }
  return parseRelativeDate(value, now);
}

function computeMedian(values = []) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function uniqueDomains(urls) {
  const domains = new Set();
  for (const url of urls) {
    try {
      domains.add(new URL(url).hostname.toLowerCase());
    } catch {
      // Ignore malformed URLs in scoring.
    }
  }
  return domains;
}

function buildCheck(dimension, signal, passed, expected, actual) {
  return {
    dimension,
    signal,
    passed,
    expected,
    actual,
  };
}

function buildSignalChecks(caseDefinition, execution, options = {}) {
  const checks = [];
  const payload = normalizePayload(execution.payload);
  const expected = caseDefinition.expectedSignals ?? {};
  const urls = collectUrls(payload);
  const domains = uniqueDomains(urls);
  const text = collectSearchableText(payload);
  const now = new Date(options.now ?? Date.now());

  if (expected.exitCode !== undefined) {
    checks.push(
      buildCheck(
        "safety",
        "exitCode",
        execution.exitCode === expected.exitCode,
        expected.exitCode,
        execution.exitCode,
      ),
    );
  }

  if (expected.selectedProviderIn?.length) {
    checks.push(
      buildCheck(
        "routing",
        "selectedProviderIn",
        expected.selectedProviderIn.includes(payload.selectedProvider),
        expected.selectedProviderIn,
        payload.selectedProvider,
      ),
    );
  }

  if (expected.selectedProviderNotIn?.length) {
    checks.push(
      buildCheck(
        "routing",
        "selectedProviderNotIn",
        !expected.selectedProviderNotIn.includes(payload.selectedProvider),
        expected.selectedProviderNotIn,
        payload.selectedProvider,
      ),
    );
  }

  if (expected.selectionModeIn?.length) {
    const actual = payload.routingSummary.selectionMode ?? null;
    checks.push(
      buildCheck(
        "routing",
        "selectionModeIn",
        expected.selectionModeIn.includes(actual),
        expected.selectionModeIn,
        actual,
      ),
    );
  }

  if (expected.confidenceLevelIn?.length) {
    const actual = payload.routingSummary.confidenceLevel ?? null;
    checks.push(
      buildCheck(
        "routing",
        "confidenceLevelIn",
        expected.confidenceLevelIn.includes(actual),
        expected.confidenceLevelIn,
        actual,
      ),
    );
  }

  if (expected.confidenceLevelNotIn?.length) {
    const actual = payload.routingSummary.confidenceLevel ?? null;
    checks.push(
      buildCheck(
        "routing",
        "confidenceLevelNotIn",
        !expected.confidenceLevelNotIn.includes(actual),
        expected.confidenceLevelNotIn,
        actual,
      ),
    );
  }

  if (expected.minResults !== undefined) {
    checks.push(
      buildCheck(
        "coverage",
        "minResults",
        payload.results.length >= expected.minResults,
        expected.minResults,
        payload.results.length,
      ),
    );
  }

  if (expected.minNodes !== undefined) {
    checks.push(
      buildCheck(
        "coverage",
        "minNodes",
        payload.nodes.length >= expected.minNodes,
        expected.minNodes,
        payload.nodes.length,
      ),
    );
  }

  if (expected.minEdges !== undefined) {
    checks.push(
      buildCheck(
        "coverage",
        "minEdges",
        payload.edges.length >= expected.minEdges,
        expected.minEdges,
        payload.edges.length,
      ),
    );
  }

  if (expected.mustIncludeDomainsAny?.length) {
    const passed = expected.mustIncludeDomainsAny.some((domain) => domains.has(lower(domain)));
    checks.push(
      buildCheck(
        "coverage",
        "mustIncludeDomainsAny",
        passed,
        expected.mustIncludeDomainsAny,
        Array.from(domains),
      ),
    );
  }

  if (expected.mustIncludeDomainsAll?.length) {
    const passed = expected.mustIncludeDomainsAll.every((domain) => domains.has(lower(domain)));
    checks.push(
      buildCheck(
        "coverage",
        "mustIncludeDomainsAll",
        passed,
        expected.mustIncludeDomainsAll,
        Array.from(domains),
      ),
    );
  }

  if (expected.mustIncludeUrlSubstringsAny?.length) {
    const passed = expected.mustIncludeUrlSubstringsAny.some((value) =>
      urls.some((url) => url.includes(value)),
    );
    checks.push(
      buildCheck(
        "coverage",
        "mustIncludeUrlSubstringsAny",
        passed,
        expected.mustIncludeUrlSubstringsAny,
        urls,
      ),
    );
  }

  if (expected.mustIncludeUrlSubstringsAll?.length) {
    const passed = expected.mustIncludeUrlSubstringsAll.every((value) =>
      urls.some((url) => url.includes(value)),
    );
    checks.push(
      buildCheck(
        "coverage",
        "mustIncludeUrlSubstringsAll",
        passed,
        expected.mustIncludeUrlSubstringsAll,
        urls,
      ),
    );
  }

  if (expected.mustContainTextAny?.length) {
    const passed = expected.mustContainTextAny.some((value) => text.includes(lower(value)));
    checks.push(
      buildCheck(
        "coverage",
        "mustContainTextAny",
        passed,
        expected.mustContainTextAny,
        text.slice(0, 400),
      ),
    );
  }

  if (expected.mustContainTextAll?.length) {
    const passed = expected.mustContainTextAll.every((value) => text.includes(lower(value)));
    checks.push(
      buildCheck(
        "coverage",
        "mustContainTextAll",
        passed,
        expected.mustContainTextAll,
        text.slice(0, 400),
      ),
    );
  }

  if (expected.minDistinctUrls !== undefined) {
    checks.push(
      buildCheck(
        "citation",
        "minDistinctUrls",
        new Set(urls).size >= expected.minDistinctUrls,
        expected.minDistinctUrls,
        new Set(urls).size,
      ),
    );
  }

  if (expected.maxFailed !== undefined) {
    checks.push(
      buildCheck(
        "safety",
        "maxFailed",
        payload.failed.length <= expected.maxFailed,
        expected.maxFailed,
        payload.failed.length,
      ),
    );
  }

  if (expected.expectMaxPagesReached !== undefined) {
    const actual = payload.meta.maxPagesReached ?? payload.summary.maxPagesReached ?? null;
    checks.push(
      buildCheck(
        "safety",
        "expectMaxPagesReached",
        actual === expected.expectMaxPagesReached,
        expected.expectMaxPagesReached,
        actual,
      ),
    );
  }

  if (expected.maxResultAgeDays !== undefined) {
    const ages = payload.results
      .map((entry) => parseResultDate(entry.publishedDate ?? entry.date, now))
      .filter(Boolean)
      .map((date) => Math.floor((now.getTime() - date.getTime()) / 86400000));
    const medianAge = computeMedian(ages);
    checks.push(
      buildCheck(
        "freshness",
        "maxResultAgeDays",
        medianAge !== null && medianAge <= expected.maxResultAgeDays,
        expected.maxResultAgeDays,
        medianAge,
      ),
    );
  }

  if (expected.topicTypeIn?.length) {
    checks.push(
      buildCheck(
        "decomposition",
        "topicTypeIn",
        expected.topicTypeIn.includes(payload.topicType),
        expected.topicTypeIn,
        payload.topicType,
      ),
    );
  }

  if (expected.topicSignalsIncludeAll?.length) {
    const actual = payload.topicSignals.filter(Boolean);
    const passed = expected.topicSignalsIncludeAll.every((value) => actual.includes(value));
    checks.push(
      buildCheck(
        "decomposition",
        "topicSignalsIncludeAll",
        passed,
        expected.topicSignalsIncludeAll,
        actual,
      ),
    );
  }

  if (expected.researchAxesIncludeAll?.length) {
    const actual = payload.researchAxes.filter(Boolean);
    const passed = expected.researchAxesIncludeAll.every((value) => actual.includes(value));
    checks.push(
      buildCheck(
        "decomposition",
        "researchAxesIncludeAll",
        passed,
        expected.researchAxesIncludeAll,
        actual,
      ),
    );
  }

  if (expected.subquestionIntentsIncludeAll?.length) {
    const actual = payload.subquestions.map((entry) => entry.intent).filter(Boolean);
    const passed = expected.subquestionIntentsIncludeAll.every((value) => actual.includes(value));
    checks.push(
      buildCheck(
        "decomposition",
        "subquestionIntentsIncludeAll",
        passed,
        expected.subquestionIntentsIncludeAll,
        actual,
      ),
    );
  }

  if (expected.taskKindsIncludeAll?.length) {
    const actual = payload.tasks.map((entry) => entry.kind).filter(Boolean);
    const passed = expected.taskKindsIncludeAll.every((value) => actual.includes(value));
    checks.push(
      buildCheck(
        "planning",
        "taskKindsIncludeAll",
        passed,
        expected.taskKindsIncludeAll,
        actual,
      ),
    );
  }

  if (expected.minEvidence !== undefined) {
    checks.push(
      buildCheck(
        "evidence",
        "minEvidence",
        payload.evidence.length >= expected.minEvidence,
        expected.minEvidence,
        payload.evidence.length,
      ),
    );
  }

  if (expected.minFindings !== undefined) {
    checks.push(
      buildCheck(
        "findings",
        "minFindings",
        payload.candidateFindings.length >= expected.minFindings,
        expected.minFindings,
        payload.candidateFindings.length,
      ),
    );
  }

  if (expected.minCitations !== undefined) {
    checks.push(
      buildCheck(
        "citation",
        "minCitations",
        payload.citations.length >= expected.minCitations,
        expected.minCitations,
        payload.citations.length,
      ),
    );
  }

  if (expected.requireOfficialEvidence !== undefined) {
    const actual = payload.evidence.some((entry) =>
      ["official", "primary"].includes(String(entry.authority ?? "").toLowerCase()),
    );
    checks.push(
      buildCheck(
        "evidence",
        "requireOfficialEvidence",
        actual === expected.requireOfficialEvidence,
        expected.requireOfficialEvidence,
        actual,
      ),
    );
  }

  if (expected.requireClaimClusters !== undefined) {
    const actual = payload.claimClusters.length > 0;
    checks.push(
      buildCheck(
        "findings",
        "requireClaimClusters",
        actual === expected.requireClaimClusters,
        expected.requireClaimClusters,
        actual,
      ),
    );
  }

  if (expected.requireUncertaintyTypesAny?.length) {
    const actual = payload.uncertainties.map((entry) => entry.type).filter(Boolean);
    const passed = expected.requireUncertaintyTypesAny.some((value) => actual.includes(value));
    checks.push(
      buildCheck(
        "uncertainty",
        "requireUncertaintyTypesAny",
        passed,
        expected.requireUncertaintyTypesAny,
        actual,
      ),
    );
  }

  if (expected.requireProviderUsageAny?.length) {
    const actual = Array.isArray(payload.execution.providersUsed)
      ? payload.execution.providersUsed
      : [];
    const passed = expected.requireProviderUsageAny.some((value) => actual.includes(value));
    checks.push(
      buildCheck(
        "execution",
        "requireProviderUsageAny",
        passed,
        expected.requireProviderUsageAny,
        actual,
      ),
    );
  }

  if (expected.requireGapResolutionAttempted !== undefined) {
    const actual = payload.gapResolutionSummary.attempted === true;
    checks.push(
      buildCheck(
        "execution",
        "requireGapResolutionAttempted",
        actual === expected.requireGapResolutionAttempted,
        expected.requireGapResolutionAttempted,
        actual,
      ),
    );
  }

  if (expected.minFollowupTasksExecuted !== undefined) {
    const actual = payload.gapResolutionSummary.followupTasksExecuted ?? 0;
    checks.push(
      buildCheck(
        "execution",
        "minFollowupTasksExecuted",
        actual >= expected.minFollowupTasksExecuted,
        expected.minFollowupTasksExecuted,
        actual,
      ),
    );
  }

  if (expected.maxFollowupTasksExecuted !== undefined) {
    const actual = payload.gapResolutionSummary.followupTasksExecuted ?? 0;
    checks.push(
      buildCheck(
        "execution",
        "maxFollowupTasksExecuted",
        actual <= expected.maxFollowupTasksExecuted,
        expected.maxFollowupTasksExecuted,
        actual,
      ),
    );
  }

  return checks;
}

function computeDimensionScore(checks, dimension) {
  const filtered = checks.filter((check) => check.dimension === dimension);
  if (filtered.length === 0) {
    return null;
  }
  const passed = filtered.filter((check) => check.passed).length;
  return passed / filtered.length;
}

export function scoreEvalCase(caseDefinition, execution, options = {}) {
  const threshold = caseDefinition.scoring?.threshold ?? 1;
  const weights = caseDefinition.scoring?.weights ?? {};
  const checks = buildSignalChecks(caseDefinition, execution, options);
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const score = computeDimensionScore(checks, dimension);
      return [
        dimension,
        {
          score,
          weight: weights[dimension] ?? 0,
          checks: checks.filter((check) => check.dimension === dimension),
        },
      ];
    }),
  );

  const weightedDimensions = Object.values(dimensions).filter((entry) => entry.score !== null && entry.weight > 0);
  const totalWeight = weightedDimensions.reduce((sum, entry) => sum + entry.weight, 0);
  const score =
    totalWeight > 0
      ? weightedDimensions.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight
      : checks.every((check) => check.passed)
        ? 1
        : 0;

  return {
    status: score >= threshold ? "pass" : "fail",
    score,
    threshold,
    dimensions,
    checks,
  };
}
