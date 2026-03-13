import { formatPlanMarkdown, serializePlan } from "./planner.mjs";

export const SCHEMA_VERSION = "1.0";

function normalizeSearchResults(results = []) {
  return results.map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    content: item.content ?? "",
    score: item.score ?? null,
    publishedDate: item.publishedDate ?? null,
    date: item.date ?? null,
    sourceType: item.sourceType ?? "web",
    providers: item.providerIds ?? undefined,
  }));
}

function normalizeExtractResults(results = []) {
  return results.map((item) => ({
    url: item.url ?? "",
    title: item.title ?? "",
    content: item.content ?? "",
    contentType: item.contentType ?? "text/plain",
  }));
}

function formatFederationSummary(federation) {
  if (!federation?.triggered) {
    return null;
  }
  const raw = federation.resultStats?.rawResultCount ?? 0;
  const deduped = federation.resultStats?.dedupedResultCount ?? 0;
  return `${federation.providersUsed.join(", ")} (merge=${federation.mergePolicy}; raw=${raw}; deduped=${deduped})`;
}

function countCandidatesByStatus(candidates = []) {
  return candidates.reduce(
    (acc, candidate) => ({
      ...acc,
      [candidate.status]: (acc[candidate.status] ?? 0) + 1,
    }),
    {
      selected: 0,
      candidate: 0,
      rejected: 0,
      skipped: 0,
    },
  );
}

function summarizeCandidate(candidate) {
  return {
    providerId: candidate.provider.id,
    status: candidate.status,
    score: candidate.score ?? null,
    reason: candidate.summary || null,
    reasons: candidate.reasons ?? [],
    issues: candidate.issues ?? [],
    selectionMode: candidate.selectionMode ?? null,
    confidence: candidate.confidence ?? null,
    confidenceLevel: candidate.confidenceLevel ?? null,
  };
}

function summarizeHealthWarnings(candidates = []) {
  return candidates
    .filter((candidate) =>
      ["degraded", "cooldown"].includes(candidate.health?.status),
    )
    .map((candidate) => ({
      providerId: candidate.provider.id,
      status: candidate.health.status,
      cooldownUntil: candidate.health.cooldownUntil ?? null,
      lastError: candidate.health.lastError ?? null,
      reason:
        candidate.health.status === "cooldown"
          ? `${candidate.provider.label} is currently in cooldown`
          : `${candidate.provider.label} has recent degraded health`,
    }));
}

function summarizeFederation(federation) {
  if (!federation) {
    return null;
  }
  return {
    enabled: federation.enabled,
    triggered: federation.triggered,
    reason: federation.reason ?? "",
    fanoutPolicy: federation.fanoutPolicy ?? "disabled",
    triggerReasons: federation.triggerReasons ?? [],
    primaryProvider: federation.primaryProvider ?? null,
    providersPlanned: federation.providersPlanned ?? [],
    providersUsed: federation.providersUsed ?? [],
    mergePolicy: federation.mergePolicy ?? null,
  };
}

export function buildRoutingSummary(plan, federation = null) {
  if (!plan) {
    return null;
  }

  const selectedProviderId = plan.selected?.provider.id ?? null;
  const alternativeCandidates = plan.candidates
    .filter(
      (candidate) =>
        candidate.status !== "rejected" &&
        candidate.status !== "skipped" &&
        candidate.provider.id !== selectedProviderId,
    )
    .slice(0, 3)
    .map(summarizeCandidate);
  const blockedProviders = plan.candidates
    .filter((candidate) => ["rejected", "skipped"].includes(candidate.status))
    .map(summarizeCandidate);

  return {
    searchType: plan.request?.searchType ?? null,
    intentPreset: plan.request?.intentPreset ?? null,
    selectedProvider: selectedProviderId,
    selectedReason: plan.selected?.summary ?? plan.error?.message ?? "",
    selectedReasons: plan.selected?.reasons ?? [],
    selectionMode: plan.selected?.selectionMode ?? null,
    confidence: plan.selected?.confidence ?? null,
    confidenceLevel: plan.selected?.confidenceLevel ?? null,
    topSignals: plan.selected?.topSignals ?? [],
    configuredProviders: plan.configuredProviders ?? [],
    candidateCounts: countCandidatesByStatus(plan.candidates),
    alternatives: alternativeCandidates,
    blockedProviders,
    healthWarnings: summarizeHealthWarnings(plan.candidates),
    federation: summarizeFederation(federation ?? plan.federation ?? null),
    error: plan.error?.message ?? null,
  };
}

export function finalizeCommandOutput(
  payload,
  { plan = null, includeRouting = false, federation = null, cache = null } = {},
) {
  const next = {
    ...payload,
    ...(plan ? { routingSummary: buildRoutingSummary(plan, federation) } : {}),
    ...(cache ? { cached: cache.hit, cache } : {}),
  };

  if (!includeRouting || !plan) {
    return next;
  }

  return {
    ...next,
    routing: serializePlan(plan),
  };
}

export function buildSearchOutput({
  query,
  providerResult,
  plan,
  federation = null,
  includeRouting = false,
  cache = null,
}) {
  return finalizeCommandOutput(
    {
      schemaVersion: SCHEMA_VERSION,
      command: "search",
      selectedProvider: plan?.selected?.provider.id ?? providerResult?.engine ?? null,
      engine: providerResult?.engine ?? plan?.selected?.provider.id ?? null,
      results: normalizeSearchResults(providerResult?.results ?? []),
      failed: providerResult?.failed ?? [],
      federated: federation,
      meta: {
        query,
        searchType: plan?.request?.searchType ?? null,
        intentPreset: plan?.request?.intentPreset ?? null,
        count: providerResult?.results?.length ?? 0,
        answer: providerResult?.answer ?? null,
      },
    },
    {
      plan,
      includeRouting,
      federation,
      cache,
    },
  );
}

export function buildPlanOutput({ command, plan, meta = {} }) {
  return finalizeCommandOutput(
    {
      schemaVersion: SCHEMA_VERSION,
      command,
      selectedProvider: plan?.selected?.provider.id ?? null,
      engine: plan?.selected?.provider.id ?? null,
      results: [],
      failed: [],
      meta: {
        searchType: plan?.request?.searchType ?? null,
        intentPreset: plan?.request?.intentPreset ?? null,
        ...meta,
      },
    },
    {
      plan,
      includeRouting: true,
      federation: plan?.federation ?? null,
    },
  );
}

export function buildExtractOutput({
  command = "extract",
  providerResult,
  plan,
  includeRouting = false,
  render = null,
  cache = null,
}) {
  return finalizeCommandOutput(
    {
      schemaVersion: SCHEMA_VERSION,
      command,
      selectedProvider: plan?.selected?.provider.id ?? providerResult?.engine ?? null,
      engine: providerResult?.engine ?? plan?.selected?.provider.id ?? null,
      results: normalizeExtractResults(providerResult?.results ?? []),
      failed: providerResult?.failed ?? [],
      render: render ?? providerResult?.render ?? null,
      meta: {
        count: providerResult?.results?.length ?? 0,
      },
    },
    {
      plan,
      includeRouting,
      cache,
    },
  );
}

export function buildCrawlOutput({ result, plan, includeRouting = false, cache = null }) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    command: "crawl",
    selectedProvider: plan?.selected?.provider.id ?? "fetch",
    engine: plan?.selected?.provider.id ?? "fetch",
    results: result.pages.map((page) => ({
      url: page.url,
      title: page.title,
      content: page.content,
      contentType: page.contentType,
      depth: page.depth,
      discoveredFrom: page.discoveredFrom,
    })),
    pages: result.pages,
    failed: result.failed,
    summary: result.summary,
    meta: {
      entryUrls: result.summary.entryUrls,
      visitedPages: result.summary.visitedPages,
      maxPagesReached: result.summary.maxPagesReached,
    },
  };

  return finalizeCommandOutput(payload, { plan, includeRouting, cache });
}

export function buildMapOutput({ result, plan, includeRouting = false, cache = null }) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    command: "map",
    selectedProvider: plan?.selected?.provider.id ?? "fetch",
    engine: plan?.selected?.provider.id ?? "fetch",
    nodes: result.nodes,
    edges: result.edges,
    failed: result.failed,
    meta: result.meta,
  };

  return finalizeCommandOutput(payload, { plan, includeRouting, cache });
}

export function buildCapabilitiesOutput(snapshot) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "capabilities",
    ...snapshot,
  };
}

export function buildDoctorOutput(report) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "doctor",
    ...report,
  };
}

export function buildReviewOutput(report) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "review",
    ...report,
  };
}

export function buildCacheOutput(report) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "cache",
    ...report,
  };
}

export function buildHealthOutput(report) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "health",
    ...report,
  };
}

export function buildBootstrapOutput(report) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "bootstrap",
    ...report,
  };
}

function truncateContent(text = "", maxChars = 800) {
  const value = String(text);
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}...`;
}

export function formatSearchMarkdown(payload) {
  const lines = [];

  lines.push(`## Search: ${payload.meta.query}`);
  lines.push(`**Provider**: ${payload.selectedProvider}`);
  if (payload.routingSummary?.selectedReason) {
    lines.push(`**Routing**: ${payload.routingSummary.selectedReason}`);
  }
  const federationSummary = formatFederationSummary(payload.federated);
  if (federationSummary) {
    lines.push(`**Federated**: ${federationSummary}`);
  }
  if (payload.cache) {
    lines.push(
      `**Cache**: ${payload.cache.hit ? "hit" : "miss"} (ttl remaining: ${payload.cache.ttlRemainingSeconds ?? 0}s)`,
    );
  }
  lines.push("");

  if (payload.routing) {
    lines.push(formatPlanMarkdown(payload.routing));
    lines.push("");
  }

  if (payload.meta.answer) {
    lines.push("### Answer");
    lines.push("");
    lines.push(payload.meta.answer);
    lines.push("");
  }

  lines.push(`### Results (${payload.results.length})`);
  lines.push("");

  for (const item of payload.results) {
    const title = item.title || "(untitled)";
    const score = Number.isFinite(item.score) ? ` (${(item.score * 100).toFixed(0)}%)` : "";
    const date = item.date || item.publishedDate || "";
    lines.push(`- **${title}**${score}${date ? ` [${String(date).slice(0, 10)}]` : ""}`);
    lines.push(`  ${item.url}`);
    if (item.content) {
      lines.push(`  ${truncateContent(item.content, 400)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatExtractMarkdown(payload) {
  const lines = [];

  if (payload.routingSummary?.selectedReason) {
    lines.push(`- Routing: ${payload.routingSummary.selectedReason}`);
  }
  if (payload.cache) {
    lines.push(
      `- Cache: ${payload.cache.hit ? "hit" : "miss"} (ttl remaining: ${payload.cache.ttlRemainingSeconds ?? 0}s)`,
    );
    lines.push("");
  }

  if (payload.routing) {
    lines.push(formatPlanMarkdown(payload.routing));
    lines.push("");
  }

  if (payload.render?.used) {
    lines.push(
      `- Browser render: yes (${payload.render.policy ?? "force"}, ${payload.render.browserFamily ?? "local-browser"})`,
    );
    if (payload.render.fallbackAppliedTo?.length) {
      lines.push(`- Render fallback URLs: ${payload.render.fallbackAppliedTo.join(", ")}`);
    }
    lines.push("");
  }

  for (const item of payload.results) {
    lines.push(`# ${item.title || item.url}`);
    lines.push("");
    lines.push(item.url);
    lines.push("");
    lines.push(item.content || "(no content extracted)");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (payload.failed.length > 0) {
    lines.push("## Failed URLs");
    lines.push("");
    for (const failed of payload.failed) {
      lines.push(`- ${failed.url}: ${failed.error}`);
    }
  }

  return lines.join("\n");
}

export function formatCrawlMarkdown(payload) {
  const lines = [];

  lines.push("# Crawl Summary");
  lines.push("");
  lines.push(`- Entry URLs: ${payload.meta.entryUrls.join(", ")}`);
  lines.push(`- Visited pages: ${payload.meta.visitedPages}`);
  lines.push(`- Max pages reached: ${payload.meta.maxPagesReached ? "yes" : "no"}`);
  if (payload.routingSummary?.selectedReason) {
    lines.push(`- Routing: ${payload.routingSummary.selectedReason}`);
  }
  if (payload.cache) {
    lines.push(
      `- Cache: ${payload.cache.hit ? "hit" : "miss"} (ttl remaining: ${payload.cache.ttlRemainingSeconds ?? 0}s)`,
    );
  }
  lines.push("");

  if (payload.routing) {
    lines.push(formatPlanMarkdown(payload.routing));
    lines.push("");
  }

  for (const page of payload.results) {
    lines.push(`## ${page.title || page.url}`);
    lines.push("");
    lines.push(page.url);
    lines.push("");
    lines.push(truncateContent(page.content, 800) || "(no content extracted)");
    lines.push("");
  }

  if (payload.failed.length > 0) {
    lines.push("## Failed URLs");
    lines.push("");
    for (const failed of payload.failed) {
      lines.push(`- ${failed.url}: ${failed.error}`);
    }
  }

  return lines.join("\n");
}

export function formatMapMarkdown(payload) {
  const lines = [];

  lines.push("# Site Map");
  lines.push("");
  lines.push(`- Entry URLs: ${payload.meta.entryUrls.join(", ")}`);
  lines.push(`- Visited pages: ${payload.meta.visitedPages}`);
  lines.push(`- Max pages reached: ${payload.meta.maxPagesReached ? "yes" : "no"}`);
  if (payload.routingSummary?.selectedReason) {
    lines.push(`- Routing: ${payload.routingSummary.selectedReason}`);
  }
  if (payload.cache) {
    lines.push(
      `- Cache: ${payload.cache.hit ? "hit" : "miss"} (ttl remaining: ${payload.cache.ttlRemainingSeconds ?? 0}s)`,
    );
  }
  lines.push("");

  if (payload.routing) {
    lines.push(formatPlanMarkdown(payload.routing));
    lines.push("");
  }

  lines.push("## Nodes");
  lines.push("");
  for (const node of payload.nodes) {
    lines.push(`- ${node.url} (depth=${node.depth})`);
  }

  if (payload.edges.length > 0) {
    lines.push("");
    lines.push("## Edges");
    lines.push("");
    for (const edge of payload.edges) {
      lines.push(`- ${edge.from} -> ${edge.to}`);
    }
  }

  if (payload.failed.length > 0) {
    lines.push("");
    lines.push("## Failed URLs");
    lines.push("");
    for (const failed of payload.failed) {
      lines.push(`- ${failed.url}: ${failed.error}`);
    }
  }

  return lines.join("\n");
}

export function formatBootstrapMarkdown(payload) {
  const lines = [];

  lines.push("# web-search-pro bootstrap");
  lines.push("");
  lines.push(`- Status: ${payload.status}`);
  lines.push(
    `- Configured providers: ${payload.configuredProviders.length > 0 ? payload.configuredProviders.join(", ") : "none"}`,
  );
  lines.push(
    `- Credentialed providers: ${payload.credentialedProviders.length > 0 ? payload.credentialedProviders.join(", ") : "none"}`,
  );
  lines.push(`- No-key baseline: ${payload.routingPolicy.allowNoKeyBaseline ? "enabled" : "disabled"}`);
  lines.push(`- Federation: ${payload.routingPolicy.enableFederation ? "enabled" : "disabled"}`);
  lines.push("");
  lines.push("## Recommended Routes");
  lines.push("");

  for (const [routeId, route] of Object.entries(payload.recommendedRoutes)) {
    lines.push(
      `- ${routeId}: ${route.available ? route.selectedProvider : "unavailable"}${route.reason ? ` (${route.reason})` : ""}`,
    );
  }

  if (payload.missingProviderHints.length > 0) {
    lines.push("");
    lines.push("## Missing Provider Hints");
    lines.push("");
    for (const hint of payload.missingProviderHints) {
      lines.push(
        `- ${hint.providerId}: set ${hint.credentialRequirement ?? hint.envVars.join(", ")} to unlock ${hint.unlocks.join(", ")}`,
      );
    }
  }

  if (payload.nextActions.length > 0) {
    lines.push("");
    lines.push("## Next Actions");
    lines.push("");
    for (const action of payload.nextActions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join("\n");
}
