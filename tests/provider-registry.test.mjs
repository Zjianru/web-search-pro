import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCapabilitySnapshot,
  getProvider,
  hasProviderCredentials,
  listProviders,
} from "../scripts/lib/providers.mjs";

test("provider registry exposes the documented provider set", () => {
  const providers = listProviders();
  assert.deepEqual(providers.map((provider) => provider.id), [
    "tavily",
    "exa",
    "querit",
    "serper",
    "brave",
    "serpapi",
    "you",
    "searxng",
    "perplexity",
    "ddg",
    "fetch",
    "render",
  ]);
});

test("tavily advertises its full search and extract capability surface", () => {
  const provider = getProvider("tavily");
  assert.ok(provider);
  assert.deepEqual(provider.envVars, ["TAVILY_API_KEY"]);
  assert.equal(provider.capabilities.search, true);
  assert.equal(provider.capabilities.extract, true);
  assert.equal(provider.capabilities.deepSearch, true);
  assert.equal(provider.capabilities.newsSearch, true);
  assert.equal(provider.capabilities.newsDays, true);
  assert.equal(provider.capabilities.domainFilterMode, "native");
  assert.equal(provider.capabilities.answerSynthesis, true);
  assert.equal(provider.limits.search.maxResults, 20);
});

test("serpapi keeps sub-engine support and query-operator domain filters explicit", () => {
  const provider = getProvider("serpapi");
  assert.ok(provider);
  assert.deepEqual(provider.envVars, ["SERPAPI_API_KEY"]);
  assert.equal(provider.capabilities.extract, false);
  assert.equal(provider.capabilities.newsSearch, true);
  assert.equal(provider.capabilities.domainFilterMode, "query");
  assert.deepEqual(provider.capabilities.subEngines, [
    "google",
    "bing",
    "baidu",
    "yandex",
    "duckduckgo",
  ]);
});

test("new search providers advertise their distinct activation requirements", () => {
  const querit = getProvider("querit");
  const brave = getProvider("brave");
  const you = getProvider("you");
  const searxng = getProvider("searxng");
  const perplexity = getProvider("perplexity");

  assert.ok(querit);
  assert.ok(brave);
  assert.ok(you);
  assert.ok(searxng);
  assert.ok(perplexity);

  assert.deepEqual(querit.envVars, ["QUERIT_API_KEY"]);
  assert.equal(querit.capabilities.search, true);
  assert.equal(querit.capabilities.localeFiltering, true);
  assert.equal(querit.capabilities.timeRange, true);
  assert.equal(querit.capabilities.dateRange, false);

  assert.deepEqual(brave.envVars, ["BRAVE_API_KEY"]);
  assert.equal(brave.capabilities.search, true);
  assert.equal(brave.capabilities.localeFiltering, true);
  assert.equal(brave.capabilities.timeRange, true);
  assert.equal(brave.capabilities.dateRange, true);
  assert.equal(brave.capabilities.newsSearch, false);

  assert.deepEqual(you.envVars, ["YOU_API_KEY"]);
  assert.equal(you.capabilities.search, true);
  assert.equal(you.capabilities.newsSearch, true);
  assert.equal(you.capabilities.localeFiltering, true);

  assert.deepEqual(searxng.envVars, ["SEARXNG_INSTANCE_URL"]);
  assert.equal(searxng.capabilities.search, true);
  assert.equal(searxng.capabilities.newsSearch, true);
  assert.equal(searxng.capabilities.localeFiltering, false);

  assert.deepEqual(perplexity.envVars, [
    "PERPLEXITY_API_KEY",
    "PERPLEXITY_GATEWAY_API_KEY",
    "PERPLEXITY_BASE_URL",
    "OPENROUTER_API_KEY",
    "KILOCODE_API_KEY",
  ]);
  assert.deepEqual(perplexity.credentialGroups, [
    ["PERPLEXITY_API_KEY"],
    ["PERPLEXITY_GATEWAY_API_KEY", "PERPLEXITY_BASE_URL"],
    ["OPENROUTER_API_KEY"],
    ["KILOCODE_API_KEY"],
  ]);
  assert.equal(perplexity.capabilities.search, true);
  assert.equal(perplexity.capabilities.answerSynthesis, true);
  assert.equal(perplexity.capabilities.extract, false);
  assert.equal(perplexity.capabilities.dateRange, false);
  assert.equal(perplexity.capabilities.timeRange, false);
});

test("provider registry supports credential groups for gateway-backed providers", () => {
  const perplexity = getProvider("perplexity");
  assert.ok(perplexity);

  assert.equal(hasProviderCredentials(perplexity, {}), false);
  assert.equal(
    hasProviderCredentials(perplexity, {
      PERPLEXITY_API_KEY: "native-key",
    }),
    true,
  );
  assert.equal(
    hasProviderCredentials(perplexity, {
      OPENROUTER_API_KEY: "openrouter-key",
    }),
    true,
  );
  assert.equal(
    hasProviderCredentials(perplexity, {
      KILOCODE_API_KEY: "kilo-key",
    }),
    true,
  );
  assert.equal(
    hasProviderCredentials(perplexity, {
      PERPLEXITY_GATEWAY_API_KEY: "gateway-key",
    }),
    false,
  );
  assert.equal(
    hasProviderCredentials(perplexity, {
      PERPLEXITY_GATEWAY_API_KEY: "gateway-key",
      PERPLEXITY_BASE_URL: "https://gateway.example.com/v1/chat/completions",
    }),
    true,
  );
});

test("capability snapshots expose native Perplexity date and time filters when the native transport is configured", () => {
  const snapshot = buildCapabilitySnapshot({
    env: {
      PERPLEXITY_API_KEY: "native-key",
    },
  });

  const perplexity = snapshot.providers.find((provider) => provider.id === "perplexity");
  assert.ok(perplexity);
  assert.equal(perplexity.capabilities.dateRange, true);
  assert.equal(perplexity.capabilities.timeRange, true);
  assert.equal(snapshot.availableFeatures.dateRange, true);
  assert.equal(snapshot.availableFeatures.timeRange, true);
});

test("no-key baseline providers are always available and declare no credentials", () => {
  const ddg = getProvider("ddg");
  const fetchProvider = getProvider("fetch");
  const renderProvider = getProvider("render");

  assert.ok(ddg);
  assert.ok(fetchProvider);
  assert.ok(renderProvider);
  assert.deepEqual(ddg.envVars, []);
  assert.equal(ddg.capabilities.search, true);
  assert.equal(ddg.capabilities.extract, false);
  assert.equal(ddg.capabilities.domainFilterMode, "query");

  assert.deepEqual(fetchProvider.envVars, []);
  assert.equal(fetchProvider.capabilities.search, false);
  assert.equal(fetchProvider.capabilities.extract, true);
  assert.equal(fetchProvider.capabilities.crawl, true);
  assert.equal(fetchProvider.capabilities.map, true);

  assert.deepEqual(renderProvider.envVars, []);
  assert.equal(renderProvider.capabilities.search, false);
  assert.equal(renderProvider.capabilities.extract, true);
  assert.equal(renderProvider.capabilities.crawl, false);
  assert.equal(renderProvider.capabilities.map, false);
});
