import { DEFAULT_CONFIG } from "./config.mjs";
import { buildFederationPlan } from "./federated-search.mjs";
import { getProviderHealthEntry } from "./health-state.mjs";
import {
  getProvider,
  hasProviderCredentials,
  isProviderRuntimeAvailable,
  listProviders,
} from "./providers.mjs";

function normalizeSearchRequest(request) {
  return {
    query: String(request.query ?? "").trim(),
    engine: request.engine ?? null,
    count: request.count ?? 5,
    deep: request.deep ?? false,
    news: request.news ?? false,
    days: request.days ?? null,
    includeDomains: request.includeDomains ?? null,
    excludeDomains: request.excludeDomains ?? null,
    timeRange: request.timeRange ?? null,
    fromDate: request.fromDate ?? null,
    toDate: request.toDate ?? null,
    searchEngine: request.searchEngine ?? null,
    country: request.country ?? null,
    lang: request.lang ?? null,
    mode: request.mode ?? "search",
  };
}

function normalizeExtractRequest(request) {
  return {
    engine: request.engine ?? null,
    urls: Array.isArray(request.urls) ? request.urls : [],
    maxChars: request.maxChars ?? null,
  };
}

function normalizeDiscoveryRequest(request) {
  return {
    engine: request.engine ?? null,
    urls: Array.isArray(request.urls) ? request.urls : [],
  };
}

function providerIsDisabled(provider, config) {
  return config.routing.disabledProviders.includes(provider.id);
}

function providerUsesNoKeyBaseline(provider) {
  return provider.activation === "baseline";
}

function providerIsAvailable(provider, env, config, options = {}) {
  if (providerIsDisabled(provider, config)) {
    return false;
  }
  if (!isProviderRuntimeAvailable(provider, { ...options, env })) {
    return false;
  }
  if (providerUsesNoKeyBaseline(provider)) {
    return config.routing.allowNoKeyBaseline;
  }
  if (provider.activation === "render") {
    return config.render.enabled && config.render.policy !== "off";
  }
  return hasProviderCredentials(provider, env);
}

function listEffectiveProviders(env, config, options = {}) {
  return listProviders().filter((provider) =>
    providerIsAvailable(provider, env, config, { ...options, env }),
  );
}

function buildCandidateBase(provider, env, config, healthState, now, options = {}) {
  const credentialed = hasProviderCredentials(provider, env);
  const health = getProviderHealthEntry(healthState, provider.id, now);

  return {
    provider,
    configured: providerIsAvailable(provider, env, config, { ...options, env }),
    credentialed,
    runtimeAvailable: isProviderRuntimeAvailable(provider, { ...options, env }),
    health,
    issues: [],
    reasons: [],
    score: null,
    summary: "",
    status: "rejected",
  };
}

function finalizeCandidate(candidate, status) {
  return {
    ...candidate,
    status,
    summary: candidate.summary || candidate.reasons[0] || candidate.issues[0] || "",
  };
}

function applyRoutingPolicy(score, provider, config, candidate) {
  if (config.routing.fallbackPolicy === "quality-first") {
    candidate.reasons.push("quality-first policy favors higher quality providers");
    return score + provider.routing.qualityScore * 40;
  }
  if (config.routing.fallbackPolicy === "cost-first") {
    candidate.reasons.push("cost-first policy favors lower cost providers");
    return score + (10 - provider.routing.costScore) * 40;
  }
  return score;
}

function applyPreferenceBonus(score, provider, config, candidate) {
  if (config.routing.preferredProviders.includes(provider.id)) {
    candidate.reasons.unshift(`preferred via config.routing.preferredProviders (${provider.id})`);
    return score + 280;
  }
  return score;
}

function applyCooldownPenalty(score, provider, candidate) {
  if (candidate.health.status === "cooldown") {
    candidate.reasons.unshift(
      `${provider.label} is in cooldown until ${candidate.health.cooldownUntil}`,
    );
    return score - 1200;
  }
  return score;
}

function evaluateSerpApiSearchEngineConstraints(request) {
  if (!request.searchEngine || request.searchEngine === "google") {
    return [];
  }

  const issues = [];
  if (request.news) {
    issues.push("SerpAPI news mode only works with the google sub-engine");
  }
  if (request.timeRange || request.fromDate || request.toDate) {
    issues.push("SerpAPI date and time filters only work with the google sub-engine");
  }
  return issues;
}

function evaluateSearchCandidate(provider, request, env, config, healthState, now, options = {}) {
  const candidate = buildCandidateBase(provider, env, config, healthState, now, options);

  if (request.engine && provider.id !== request.engine) {
    candidate.summary = `Skipped because --engine ${request.engine} was requested`;
    return finalizeCandidate(candidate, "skipped");
  }

  if (providerIsDisabled(provider, config)) {
    candidate.issues.push(`${provider.label} is disabled by config.routing.disabledProviders`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (providerUsesNoKeyBaseline(provider) && !config.routing.allowNoKeyBaseline) {
    candidate.issues.push(`${provider.label} is disabled by routing.allowNoKeyBaseline=false`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (!provider.capabilities.search) {
    candidate.issues.push(`${provider.label} does not support search`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (!candidate.configured) {
    candidate.issues.push(`Missing ${provider.envVars.join(", ")}`);
  }
  if (request.deep && !provider.capabilities.deepSearch) {
    candidate.issues.push(`${provider.label} does not support --deep`);
  }
  if (request.news && !provider.capabilities.newsSearch) {
    candidate.issues.push(`${provider.label} does not support --news`);
  }
  if (request.days !== null && !provider.capabilities.newsDays) {
    candidate.issues.push(`${provider.label} does not support --days`);
  }
  if ((request.country || request.lang) && !provider.capabilities.localeFiltering) {
    candidate.issues.push(`${provider.label} does not support --country/--lang`);
  }
  if (request.searchEngine && !provider.capabilities.subEngines.includes(request.searchEngine)) {
    candidate.issues.push(
      `${provider.label} does not support --search-engine ${request.searchEngine}`,
    );
  }
  if (provider.id === "serpapi") {
    candidate.issues.push(...evaluateSerpApiSearchEngineConstraints(request));
  }

  if (candidate.issues.length > 0) {
    return finalizeCandidate(candidate, "rejected");
  }

  let score = provider.routing.defaultSearchPriority;

  if (request.engine === provider.id) {
    score += 1000;
    candidate.reasons.push(`selected explicitly via --engine ${provider.id}`);
  }
  if (request.searchEngine) {
    score += 700;
    candidate.reasons.unshift(`supports requested sub-engine ${request.searchEngine}`);
  }

  if (request.news && request.days !== null) {
    score = 1000 + provider.routing.defaultSearchPriority;
    candidate.reasons.unshift("required because --news --days is Tavily-only");
  } else if (request.news) {
    score = provider.routing.newsSearchPriority || provider.routing.defaultSearchPriority;
    if (provider.id === "serper") {
      candidate.reasons.unshift("preferred for news coverage");
    } else if (provider.id === "tavily") {
      candidate.reasons.unshift("supports news search with AI-optimized ranking");
    } else if (provider.id === "serpapi") {
      candidate.reasons.unshift("supports news search as a multi-engine fallback");
    }
  }

  if (request.deep) {
    score = provider.routing.deepSearchPriority || provider.routing.defaultSearchPriority;
    if (provider.id === "tavily") {
      candidate.reasons.unshift("supports deep search with advanced mode");
    } else if (provider.id === "exa") {
      candidate.reasons.unshift("supports deep search as the strongest fallback");
    }
  }

  if (request.includeDomains?.length || request.excludeDomains?.length) {
    if (provider.capabilities.domainFilterMode === "native") {
      score += 140;
      candidate.reasons.unshift("supports native domain filtering");
    } else if (provider.capabilities.domainFilterMode === "query") {
      score += 40;
      candidate.reasons.push("uses query-operator domain filtering fallback");
    }
  }

  if (request.country || request.lang) {
    score += 90;
    candidate.reasons.unshift("supports locale-specific filtering");
  }

  if (provider.id === "ddg" && !request.deep && !request.news) {
    candidate.reasons.unshift("no-key baseline search fallback");
  }

  score = applyPreferenceBonus(score, provider, config, candidate);
  score = applyRoutingPolicy(score, provider, config, candidate);
  score = applyCooldownPenalty(score, provider, candidate);

  if (candidate.reasons.length === 0) {
    candidate.reasons.push(provider.routing.defaultReason);
  }

  candidate.score = score;
  return finalizeCandidate(candidate, "candidate");
}

function evaluateExtractCandidate(provider, request, env, config, healthState, now, options = {}) {
  const candidate = buildCandidateBase(provider, env, config, healthState, now, options);

  if (request.engine && provider.id !== request.engine) {
    candidate.summary = `Skipped because --engine ${request.engine} was requested`;
    return finalizeCandidate(candidate, "skipped");
  }

  if (providerIsDisabled(provider, config)) {
    candidate.issues.push(`${provider.label} is disabled by config.routing.disabledProviders`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (providerUsesNoKeyBaseline(provider) && !config.routing.allowNoKeyBaseline) {
    candidate.issues.push(`${provider.label} is disabled by routing.allowNoKeyBaseline=false`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (provider.activation === "render") {
    if (!config.render.enabled) {
      candidate.issues.push("Browser render lane is disabled by config.render.enabled=false");
      return finalizeCandidate(candidate, "rejected");
    }
    if (config.render.policy === "off") {
      candidate.issues.push("Browser render lane is disabled by config.render.policy=off");
      return finalizeCandidate(candidate, "rejected");
    }
    if (!candidate.runtimeAvailable) {
      candidate.issues.push("Browser render runtime is unavailable on this machine");
      return finalizeCandidate(candidate, "rejected");
    }
  }
  if (!provider.capabilities.extract) {
    candidate.issues.push(`${provider.label} does not support extraction`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (!candidate.configured && provider.activation !== "render") {
    candidate.issues.push(`Missing ${provider.envVars.join(", ")}`);
    return finalizeCandidate(candidate, "rejected");
  }

  let score = provider.routing.extractPriority;
  if (request.engine === provider.id) {
    score += 1000;
    candidate.reasons.push(`selected explicitly via --engine ${provider.id}`);
  }
  if (provider.id === "tavily") {
    candidate.reasons.unshift("preferred extract provider");
  } else if (provider.id === "exa") {
    candidate.reasons.unshift("fallback extract provider");
  } else if (provider.id === "fetch") {
    candidate.reasons.unshift("no-key safe fetch fallback");
  } else if (provider.id === "render") {
    if (config.render.policy === "force") {
      score += 2000;
      candidate.reasons.unshift("browser render forced via config.render.policy=force");
    } else {
      candidate.reasons.unshift("browser render lane available as a JS-capable fallback");
    }
  }

  score = applyPreferenceBonus(score, provider, config, candidate);
  score = applyRoutingPolicy(score, provider, config, candidate);
  score = applyCooldownPenalty(score, provider, candidate);
  candidate.score = score;
  return finalizeCandidate(candidate, "candidate");
}

function evaluateDiscoveryCandidate(provider, request, env, config, healthState, now, capability) {
  const candidate = buildCandidateBase(provider, env, config, healthState, now);

  if (request.engine && provider.id !== request.engine) {
    candidate.summary = `Skipped because --engine ${request.engine} was requested`;
    return finalizeCandidate(candidate, "skipped");
  }

  if (providerIsDisabled(provider, config)) {
    candidate.issues.push(`${provider.label} is disabled by config.routing.disabledProviders`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (providerUsesNoKeyBaseline(provider) && !config.routing.allowNoKeyBaseline) {
    candidate.issues.push(`${provider.label} is disabled by routing.allowNoKeyBaseline=false`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (!provider.capabilities[capability]) {
    candidate.issues.push(`${provider.label} does not support ${capability}`);
    return finalizeCandidate(candidate, "rejected");
  }
  if (!candidate.configured) {
    candidate.issues.push(`Missing ${provider.envVars.join(", ")}`);
    return finalizeCandidate(candidate, "rejected");
  }

  let score = capability === "crawl" ? provider.routing.extractPriority : 20;
  if (provider.id === "fetch") {
    candidate.reasons.unshift(`no-key ${capability} baseline`);
  }

  score = applyPreferenceBonus(score, provider, config, candidate);
  score = applyRoutingPolicy(score, provider, config, candidate);
  score = applyCooldownPenalty(score, provider, candidate);
  candidate.score = score;
  return finalizeCandidate(candidate, "candidate");
}

function findCandidate(candidates, providerId) {
  return candidates.find((candidate) => candidate.provider.id === providerId) ?? null;
}

function buildSearchRouteError(request, candidates, config) {
  if (request.engine) {
    const forcedCandidate = findCandidate(candidates, request.engine);
    if (forcedCandidate?.issues.length) {
      return forcedCandidate.issues[0];
    }
    return `Engine ${request.engine} selected but requirements are not satisfied.`;
  }
  if (!config.routing.allowNoKeyBaseline) {
    return [
      "No search engine configured.",
      "Set at least one API key or enable routing.allowNoKeyBaseline.",
    ].join(" ");
  }
  if (request.searchEngine) {
    const serpApiCandidate = findCandidate(candidates, "serpapi");
    const unsupportedSearchEngineIssue = serpApiCandidate?.issues.find(
      (issue) =>
        issue.includes("news mode only works with the google sub-engine") ||
        issue.includes("date and time filters only work with the google sub-engine"),
    );
    if (unsupportedSearchEngineIssue) {
      return unsupportedSearchEngineIssue;
    }
    return `--search-engine ${request.searchEngine} requires SERPAPI_API_KEY`;
  }
  if (request.news && request.days !== null) {
    return "--news --days requires TAVILY_API_KEY";
  }
  if (request.news) {
    return "--news requires SERPER_API_KEY, TAVILY_API_KEY, or SERPAPI_API_KEY";
  }
  if (request.deep) {
    return "--deep requires TAVILY_API_KEY or EXA_API_KEY";
  }
  if (request.country || request.lang) {
    return "--country/--lang requires SERPER_API_KEY or SERPAPI_API_KEY";
  }
  return [
    "No search engine configured.",
    "Set at least one API key: TAVILY_API_KEY, EXA_API_KEY, SERPER_API_KEY, or SERPAPI_API_KEY",
  ].join(" ");
}

function buildExtractRouteError(request, config, candidates) {
  if (request.engine) {
    const forcedCandidate = findCandidate(candidates, request.engine);
    if (forcedCandidate?.issues.length) {
      return forcedCandidate.issues[0];
    }
    return `${request.engine} API key not configured or provider does not support extraction`;
  }
  if (!config.routing.allowNoKeyBaseline) {
    return "No extract engine available. Enable routing.allowNoKeyBaseline or set TAVILY_API_KEY / EXA_API_KEY";
  }
  const renderCandidate = findCandidate(candidates, "render");
  if (renderCandidate?.issues.length && config.render.enabled) {
    return renderCandidate.issues[0];
  }
  return "No extract engine available. Set TAVILY_API_KEY or EXA_API_KEY";
}

function buildDiscoveryRouteError(command, request, config) {
  if (request.engine) {
    return `${request.engine} does not support ${command} or is not configured`;
  }
  if (!config.routing.allowNoKeyBaseline) {
    return `${command} requires routing.allowNoKeyBaseline=true because the current implementation uses Safe Fetch`;
  }
  return `${command} requires the Safe Fetch baseline provider`;
}

function sortCandidates(a, b) {
  const order = { selected: 0, candidate: 1, rejected: 2, skipped: 3 };
  if (order[a.status] !== order[b.status]) {
    return order[a.status] - order[b.status];
  }
  return (b.score ?? -1) - (a.score ?? -1);
}

function buildPlan(command, request, candidates, env, config, options = {}) {
  const selected = [...candidates]
    .filter((candidate) => candidate.status === "candidate")
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];

  return {
    command,
    request,
    configuredProviders: listEffectiveProviders(env, config, options).map((provider) => provider.id),
    selected: selected ? { ...selected, status: "selected" } : null,
    candidates: candidates
      .map((candidate) =>
        candidate === selected ? { ...candidate, status: "selected" } : candidate,
      )
      .sort(sortCandidates),
  };
}

function buildRenderPlan(plan, config, options = {}) {
  const renderProvider = getProvider("render");
  const runtimeAvailable = renderProvider
    ? isProviderRuntimeAvailable(renderProvider, {
        env: options.env,
        runtimeAvailability: options.runtimeAvailability,
      })
    : false;
  const selectedRender = plan.selected?.provider.id === "render";

  let reason = null;
  if (!config.render.enabled) {
    reason = "render.enabled=false";
  } else if (config.render.policy === "off") {
    reason = "render.policy=off";
  } else if (!runtimeAvailable) {
    reason = "browser runtime unavailable";
  } else if (selectedRender) {
    reason = "browser render selected as the primary extract lane";
  } else if (config.render.policy === "fallback") {
    reason = "browser render available to recover failed or empty extractions";
  } else if (config.render.policy === "force") {
    reason = "browser render is forced as the primary extract lane";
  }

  return {
    enabled: config.render.enabled,
    policy: config.render.policy,
    runtimeAvailable,
    provider: renderProvider,
    waitUntil: config.render.waitUntil,
    budgetMs: config.render.budgetMs,
    blockTypes: config.render.blockTypes,
    sameOriginOnly: config.render.sameOriginOnly,
    fallbackAvailable:
      config.render.enabled &&
      config.render.policy === "fallback" &&
      runtimeAvailable &&
      !selectedRender,
    reason,
  };
}

export function planSearchRoute(requestInput, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? DEFAULT_CONFIG;
  const now = options.now ?? Date.now();
  const healthState = options.healthState ?? { providers: {} };
  const request = normalizeSearchRequest(requestInput);

  const providers = request.engine
    ? listProviders().filter((provider) => provider.id === request.engine)
    : listProviders();
  const candidates = providers.map((provider) =>
    evaluateSearchCandidate(provider, request, env, config, healthState, now, options),
  );
  const plan = buildPlan("search", request, candidates, env, config, options);

  return {
    ...plan,
    federation: buildFederationPlan(plan, config),
    error: plan.selected ? null : { message: buildSearchRouteError(request, plan.candidates, config) },
  };
}

export function planExtractRoute(requestInput, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? DEFAULT_CONFIG;
  const now = options.now ?? Date.now();
  const healthState = options.healthState ?? { providers: {} };
  const request = normalizeExtractRequest(requestInput);

  const providers = request.engine
    ? listProviders().filter((provider) => provider.id === request.engine)
    : listProviders().filter((provider) => provider.capabilities.extract);
  const candidates = providers.map((provider) =>
    evaluateExtractCandidate(provider, request, env, config, healthState, now, options),
  );
  const plan = buildPlan("extract", request, candidates, env, config, options);

  return {
    ...plan,
    render: buildRenderPlan(plan, config, options),
    error: plan.selected
      ? null
      : { message: buildExtractRouteError(request, config, plan.candidates) },
  };
}

function planDiscoveryRoute(command, capability, requestInput, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? DEFAULT_CONFIG;
  const now = options.now ?? Date.now();
  const healthState = options.healthState ?? { providers: {} };
  const request = normalizeDiscoveryRequest(requestInput);

  const providers = request.engine
    ? listProviders().filter((provider) => provider.id === request.engine)
    : listProviders().filter((provider) => provider.capabilities[capability]);
  const candidates = providers.map((provider) =>
    evaluateDiscoveryCandidate(provider, request, env, config, healthState, now, capability),
  );
  const plan = buildPlan(command, request, candidates, env, config);

  return {
    ...plan,
    error: plan.selected ? null : { message: buildDiscoveryRouteError(command, request, config) },
  };
}

export function planCrawlRoute(requestInput, options = {}) {
  return planDiscoveryRoute("crawl", "crawl", requestInput, options);
}

export function planMapRoute(requestInput, options = {}) {
  return planDiscoveryRoute("map", "map", requestInput, options);
}

export function requireSelectedRoute(plan) {
  if (!plan.selected) {
    throw new Error(plan.error?.message ?? "No route selected");
  }
  return plan.selected;
}

function serializeProvider(provider) {
  return {
    id: provider.id,
    label: provider.label,
    envVars: provider.envVars,
    capabilities: provider.capabilities,
    limits: provider.limits,
  };
}

export function serializePlan(plan) {
  return {
    ...plan,
    render: plan.render
      ? {
          ...plan.render,
          provider: plan.render.provider ? serializeProvider(plan.render.provider) : null,
        }
      : undefined,
    selected: plan.selected
      ? {
          ...plan.selected,
          provider: serializeProvider(plan.selected.provider),
        }
      : null,
    candidates: plan.candidates.map((candidate) => ({
      ...candidate,
      provider: serializeProvider(candidate.provider),
    })),
  };
}

export function formatPlanMarkdown(plan) {
  const lines = [];
  const selected = plan.selected;

  lines.push(`# ${plan.command} route plan`);
  lines.push("");

  if (selected) {
    lines.push(`- Selected provider: ${selected.provider.id}`);
    lines.push(`- Why: ${selected.summary}`);
  } else {
    lines.push("- No provider selected");
    lines.push(`- Error: ${plan.error?.message ?? "Unknown routing error"}`);
  }

  if (plan.configuredProviders.length > 0) {
    lines.push(`- Configured providers: ${plan.configuredProviders.join(", ")}`);
  } else {
    lines.push("- Configured providers: none");
  }

  if (plan.render) {
    lines.push(
      `- Browser render lane: ${plan.render.enabled ? "enabled" : "disabled"} (policy=${plan.render.policy}, runtime=${plan.render.runtimeAvailable ? "ready" : "missing"})`,
    );
  }

  lines.push("");
  lines.push("## Candidates");
  lines.push("");

  for (const candidate of plan.candidates) {
    lines.push(
      `- ${candidate.provider.id}: ${candidate.status} - ${candidate.summary || "no summary"}`,
    );
  }

  return lines.join("\n");
}
