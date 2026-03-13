import test from "node:test";
import assert from "node:assert/strict";

import { getProvider, listProviders } from "../scripts/lib/providers.mjs";

test("provider registry exposes the documented provider set", () => {
  const providers = listProviders();
  assert.deepEqual(providers.map((provider) => provider.id), [
    "tavily",
    "exa",
    "serper",
    "serpapi",
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
