import { DEFAULT_CONFIG } from "./config.mjs";
import * as tavily from "../engines/tavily.mjs";
import * as exa from "../engines/exa.mjs";
import * as serper from "../engines/serper.mjs";
import * as serpapi from "../engines/serpapi.mjs";
import * as ddg from "../engines/ddg.mjs";
import * as fetchEngine from "../engines/fetch.mjs";
import * as renderEngine from "../engines/render.mjs";
import { detectRenderRuntime } from "./render-runtime.mjs";

function defineProvider(spec) {
  return Object.freeze({
    ...spec,
    activation: spec.activation ?? "credential",
    envVars: Object.freeze([...spec.envVars]),
    capabilities: Object.freeze({
      ...spec.capabilities,
      subEngines: Object.freeze([...(spec.capabilities.subEngines ?? [])]),
    }),
    limits: Object.freeze({
      search: Object.freeze({ ...(spec.limits.search ?? {}) }),
    }),
    routing: Object.freeze({ ...spec.routing }),
  });
}

const PROVIDERS = Object.freeze([
  defineProvider({
    id: "tavily",
    label: "Tavily",
    activation: "credential",
    envVars: ["TAVILY_API_KEY"],
    adapter: tavily,
    capabilities: {
      search: true,
      extract: true,
      deepSearch: true,
      newsSearch: true,
      newsDays: true,
      crawl: false,
      map: false,
      domainFilterMode: "native",
      dateRange: true,
      timeRange: true,
      localeFiltering: false,
      answerSynthesis: true,
      subEngines: [],
    },
    limits: {
      search: {
        maxResults: 20,
      },
    },
    routing: {
      defaultSearchPriority: 400,
      deepSearchPriority: 220,
      newsSearchPriority: 210,
      extractPriority: 220,
      qualityScore: 5,
      costScore: 5,
      defaultReason: "highest default search priority among configured providers",
    },
  }),
  defineProvider({
    id: "exa",
    label: "Exa",
    activation: "credential",
    envVars: ["EXA_API_KEY"],
    adapter: exa,
    capabilities: {
      search: true,
      extract: true,
      deepSearch: true,
      newsSearch: false,
      newsDays: false,
      crawl: false,
      map: false,
      domainFilterMode: "native",
      dateRange: true,
      timeRange: true,
      localeFiltering: false,
      answerSynthesis: false,
      subEngines: [],
    },
    limits: {
      search: {
        maxResults: 100,
      },
    },
    routing: {
      defaultSearchPriority: 320,
      deepSearchPriority: 180,
      newsSearchPriority: 0,
      extractPriority: 180,
      qualityScore: 4,
      costScore: 4,
      defaultReason: "strong semantic search fallback",
    },
  }),
  defineProvider({
    id: "serper",
    label: "Serper",
    activation: "credential",
    envVars: ["SERPER_API_KEY"],
    adapter: serper,
    capabilities: {
      search: true,
      extract: false,
      deepSearch: false,
      newsSearch: true,
      newsDays: false,
      crawl: false,
      map: false,
      domainFilterMode: "query",
      dateRange: true,
      timeRange: true,
      localeFiltering: true,
      answerSynthesis: true,
      subEngines: [],
    },
    limits: {
      search: {
        maxResults: 100,
      },
    },
    routing: {
      defaultSearchPriority: 240,
      deepSearchPriority: 0,
      newsSearchPriority: 240,
      extractPriority: 0,
      qualityScore: 3,
      costScore: 3,
      defaultReason: "Google SERP fallback with broad result coverage",
    },
  }),
  defineProvider({
    id: "serpapi",
    label: "SerpAPI",
    activation: "credential",
    envVars: ["SERPAPI_API_KEY"],
    adapter: serpapi,
    capabilities: {
      search: true,
      extract: false,
      deepSearch: false,
      newsSearch: true,
      newsDays: false,
      crawl: false,
      map: false,
      domainFilterMode: "query",
      dateRange: true,
      timeRange: true,
      localeFiltering: true,
      answerSynthesis: true,
      subEngines: ["google", "bing", "baidu", "yandex", "duckduckgo"],
    },
    limits: {
      search: {
        maxResults: 100,
      },
    },
    routing: {
      defaultSearchPriority: 180,
      deepSearchPriority: 0,
      newsSearchPriority: 180,
      extractPriority: 0,
      qualityScore: 2,
      costScore: 2,
      defaultReason: "multi-engine fallback with sub-engine coverage",
    },
  }),
  defineProvider({
    id: "ddg",
    label: "DuckDuckGo",
    activation: "baseline",
    envVars: [],
    adapter: ddg,
    capabilities: {
      search: true,
      extract: false,
      deepSearch: false,
      newsSearch: false,
      newsDays: false,
      crawl: false,
      map: false,
      domainFilterMode: "query",
      dateRange: false,
      timeRange: false,
      localeFiltering: false,
      answerSynthesis: false,
      subEngines: [],
    },
    limits: {
      search: {
        maxResults: 20,
      },
    },
    routing: {
      defaultSearchPriority: 60,
      deepSearchPriority: 0,
      newsSearchPriority: 0,
      extractPriority: 0,
      qualityScore: 1,
      costScore: 0,
      defaultReason: "no-key search fallback",
    },
  }),
  defineProvider({
    id: "fetch",
    label: "Safe Fetch",
    activation: "baseline",
    envVars: [],
    adapter: fetchEngine,
    capabilities: {
      search: false,
      extract: true,
      deepSearch: false,
      newsSearch: false,
      newsDays: false,
      crawl: true,
      map: true,
      domainFilterMode: "none",
      dateRange: false,
      timeRange: false,
      localeFiltering: false,
      answerSynthesis: false,
      subEngines: [],
    },
    limits: {
      search: {},
    },
    routing: {
      defaultSearchPriority: 0,
      deepSearchPriority: 0,
      newsSearchPriority: 0,
      extractPriority: 30,
      qualityScore: 1,
      costScore: 0,
      defaultReason: "no-key safe fetch fallback",
    },
  }),
  defineProvider({
    id: "render",
    label: "Browser Render",
    activation: "render",
    envVars: [],
    adapter: renderEngine,
    capabilities: {
      search: false,
      extract: true,
      deepSearch: false,
      newsSearch: false,
      newsDays: false,
      crawl: false,
      map: false,
      domainFilterMode: "none",
      dateRange: false,
      timeRange: false,
      localeFiltering: false,
      answerSynthesis: false,
      subEngines: [],
    },
    limits: {
      search: {},
    },
    routing: {
      defaultSearchPriority: 0,
      deepSearchPriority: 0,
      newsSearchPriority: 0,
      extractPriority: 10,
      qualityScore: 2,
      costScore: 1,
      defaultReason: "local browser render lane for JS-heavy pages",
    },
  }),
]);

export function listProviders() {
  return PROVIDERS;
}

export function getProvider(providerId) {
  return PROVIDERS.find((provider) => provider.id === providerId) ?? null;
}

export function hasProviderCredentials(provider, env = process.env) {
  if (provider.envVars.length === 0) {
    return false;
  }
  return provider.envVars.every(
    (name) => typeof env[name] === "string" && env[name].trim().length > 0,
  );
}

function resolveProviderRuntime(provider, options = {}) {
  if (provider.activation !== "render") {
    return {
      available: true,
      browserFamily: null,
      browserPath: null,
      launcher: null,
    };
  }
  if (typeof options.runtimeAvailability?.[provider.id] === "boolean") {
    return {
      available: options.runtimeAvailability[provider.id],
      browserFamily: null,
      browserPath: null,
      launcher: "chrome-cdp",
    };
  }
  return detectRenderRuntime({ env: options.env });
}

export function isProviderRuntimeAvailable(provider, options = {}) {
  return resolveProviderRuntime(provider, options).available;
}

function isProviderEnabled(provider, env, config, options = {}) {
  if (config.routing.disabledProviders.includes(provider.id)) {
    return false;
  }
  if (!isProviderRuntimeAvailable(provider, options)) {
    return false;
  }
  if (provider.activation === "baseline") {
    return config.routing.allowNoKeyBaseline;
  }
  if (provider.activation === "render") {
    return config.render.enabled && config.render.policy !== "off";
  }
  return hasProviderCredentials(provider, env);
}

export function listConfiguredProviders(env = process.env, config = DEFAULT_CONFIG, options = {}) {
  return PROVIDERS.filter((provider) =>
    isProviderEnabled(provider, env, config, { ...options, env }),
  );
}

export function buildEnvDisclosure(provider) {
  return provider.envVars.map((name) => ({
    name,
    required: false,
    description: `Enables ${provider.label} features when that provider is selected.`,
  }));
}

export function buildAvailableFeatureSummary(providers) {
  const configured = providers ?? [];
  const subEngines = Array.from(
    new Set(configured.flatMap((provider) => provider.capabilities.subEngines)),
  );

  return {
    search: configured.some((provider) => provider.capabilities.search),
    deepSearch: configured.some((provider) => provider.capabilities.deepSearch),
    newsSearch: configured.some((provider) => provider.capabilities.newsSearch),
    newsDays: configured.some((provider) => provider.capabilities.newsDays),
    extract: configured.some((provider) => provider.capabilities.extract),
    crawl: configured.some((provider) => provider.capabilities.crawl),
    map: configured.some((provider) => provider.capabilities.map),
    browserRender: configured.some((provider) => provider.id === "render"),
    nativeDomainFiltering: configured.some(
      (provider) => provider.capabilities.domainFilterMode === "native",
    ),
    localeFiltering: configured.some((provider) => provider.capabilities.localeFiltering),
    answerSynthesis: configured.some((provider) => provider.capabilities.answerSynthesis),
    dateRange: configured.some((provider) => provider.capabilities.dateRange),
    timeRange: configured.some((provider) => provider.capabilities.timeRange),
    subEngines,
  };
}

export function buildCapabilitySnapshot(options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? DEFAULT_CONFIG;
  const configuredProviders = listConfiguredProviders(env, config, options);
  return {
    providers: listProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
      activation: provider.activation,
      configured: isProviderEnabled(provider, env, config, options),
      credentialed: hasProviderCredentials(provider, env),
      runtimeAvailable: isProviderRuntimeAvailable(provider, options),
      runtime: resolveProviderRuntime(provider, options),
      env: buildEnvDisclosure(provider),
      capabilities: provider.capabilities,
      limits: provider.limits,
    })),
    configuredProviders: configuredProviders.map((provider) => provider.id),
    availableFeatures: buildAvailableFeatureSummary(configuredProviders),
  };
}
