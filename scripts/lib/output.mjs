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

function attachRouting(payload, plan, includeRouting) {
  if (!includeRouting || !plan) {
    return payload;
  }
  return {
    ...payload,
    routing: serializePlan(plan),
  };
}

export function buildSearchOutput({
  query,
  providerResult,
  plan,
  federation = null,
  includeRouting = false,
}) {
  return attachRouting(
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
        count: providerResult?.results?.length ?? 0,
        answer: providerResult?.answer ?? null,
      },
    },
    plan,
    includeRouting,
  );
}

export function buildPlanOutput({ command, plan, meta = {} }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command,
    selectedProvider: plan?.selected?.provider.id ?? null,
    engine: plan?.selected?.provider.id ?? null,
    results: [],
    failed: [],
    meta,
    routing: serializePlan(plan),
  };
}

export function buildExtractOutput({
  command = "extract",
  providerResult,
  plan,
  includeRouting = false,
  render = null,
}) {
  return attachRouting(
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
    plan,
    includeRouting,
  );
}

export function buildCrawlOutput({ result, plan, includeRouting = false }) {
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

  return attachRouting(payload, plan, includeRouting);
}

export function buildMapOutput({ result, plan, includeRouting = false }) {
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

  return attachRouting(payload, plan, includeRouting);
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
  const federationSummary = formatFederationSummary(payload.federated);
  if (federationSummary) {
    lines.push(`**Federated**: ${federationSummary}`);
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
