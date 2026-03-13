import test from "node:test";
import assert from "node:assert/strict";

import {
  isAvailable,
  resolveTransport,
  search,
} from "../scripts/engines/perplexity.mjs";

function withEnv(nextEnv, fn) {
  const previous = {
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    PERPLEXITY_GATEWAY_API_KEY: process.env.PERPLEXITY_GATEWAY_API_KEY,
    PERPLEXITY_BASE_URL: process.env.PERPLEXITY_BASE_URL,
    PERPLEXITY_MODEL: process.env.PERPLEXITY_MODEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    KILOCODE_API_KEY: process.env.KILOCODE_API_KEY,
  };

  for (const [key, value] of Object.entries(previous)) {
    if (Object.prototype.hasOwnProperty.call(nextEnv, key)) {
      if (nextEnv[key] === undefined || nextEnv[key] === null || nextEnv[key] === "") {
        delete process.env[key];
      } else {
        process.env[key] = String(nextEnv[key]);
      }
    } else {
      delete process.env[key];
    }
  }

  const restore = () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  return Promise.resolve()
    .then(fn)
    .finally(restore);
}

function withFetch(mockFetch, fn) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.fetch = previousFetch;
    });
}

test("perplexity native transport stays available with the official API key", async () => {
  await withEnv(
    {
      PERPLEXITY_API_KEY: "native-key",
    },
    async () => {
      assert.equal(isAvailable(), true);
      await withFetch(async (url, init) => {
        assert.equal(String(url), "https://api.perplexity.ai/v1/sonar");
        assert.equal(init?.headers?.Authorization, "Bearer native-key");
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.equal(body.model, "sonar-pro");
        assert.equal(body.web_search_options?.search_language_filter, undefined);
        return {
          ok: true,
          async json() {
            return {
              output_text: "Responses API unifies tool use and multi-turn output.[1]",
              search_results: [
                {
                  title: "Responses Overview",
                  url: "https://developers.openai.com/api/reference/responses/overview/",
                  snippet: "Official reference.",
                  date: "2026-03-10",
                },
              ],
            };
          },
        };
      }, async () => {
        const payload = await search("What is the Responses API?", { count: 3 });
        assert.equal(payload.transport, "native");
        assert.equal(payload.answer?.includes("[1]"), true);
        assert.equal(payload.results[0].title.startsWith("Perplexity Answer:"), true);
        assert.equal(payload.results[1].url, "https://developers.openai.com/api/reference/responses/overview/");
      });
    },
  );
});

test("perplexity gateway transport normalizes OpenRouter annotations into sources", async () => {
  await withEnv(
    {
      OPENROUTER_API_KEY: "openrouter-key",
      OPENROUTER_BASE_URL: "https://openrouter.example/api/v1",
      PERPLEXITY_MODEL: "perplexity/sonar",
    },
    async () => {
      assert.equal(isAvailable(), true);
      await withFetch(async (url, init) => {
        assert.equal(String(url), "https://openrouter.example/api/v1/chat/completions");
        assert.equal(init?.headers?.Authorization, "Bearer openrouter-key");
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.equal(body.model, "perplexity/sonar");
        return {
          ok: true,
          async json() {
            return {
              choices: [
                {
                  message: {
                    content: "The Responses API is OpenAI's unified response endpoint.[1]",
                    annotations: [
                      {
                        type: "url_citation",
                        url_citation: {
                          url: "https://developers.openai.com/api/reference/responses/overview/",
                          title: "Responses Overview | OpenAI API Reference",
                        },
                      },
                      {
                        type: "url_citation",
                        url_citation: {
                          url: "https://openai.com/index/new-tools-and-features-in-the-responses-api/",
                          title: "New tools and features in the Responses API",
                        },
                      },
                    ],
                  },
                },
              ],
            };
          },
        };
      }, async () => {
        const payload = await search("What is the Responses API?", { count: 3 });
        assert.equal(payload.transport, "openrouter");
        assert.equal(payload.results.length, 3);
        assert.equal(payload.results[1].title, "Responses Overview | OpenAI API Reference");
        assert.equal(payload.results[2].url, "https://openai.com/index/new-tools-and-features-in-the-responses-api/");
      });
    },
  );
});

test("perplexity OpenRouter transport falls back to the default base URL", async () => {
  await withEnv(
    {
      OPENROUTER_API_KEY: "openrouter-key",
    },
    async () => {
      const transport = resolveTransport(process.env);
      assert.equal(transport?.id, "openrouter");
      assert.equal(transport?.apiUrl, "https://openrouter.ai/api/v1/chat/completions");

      await withFetch(async (url) => {
        assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
        return {
          ok: true,
          async json() {
            return {
              choices: [
                {
                  message: {
                    content: "Grounded answer.",
                    annotations: [],
                  },
                },
              ],
            };
          },
        };
      }, async () => {
        const payload = await search("What is the Responses API?", { count: 3 });
        assert.equal(payload.transport, "openrouter");
      });
    },
  );
});

test("perplexity native transport normalizes gateway-style Sonar model aliases", async () => {
  await withEnv(
    {
      PERPLEXITY_API_KEY: "native-key",
      PERPLEXITY_MODEL: "perplexity/sonar-pro",
    },
    async () => {
      const transport = resolveTransport(process.env);
      assert.equal(transport?.id, "native");
      assert.equal(transport?.model, "sonar-pro");
    },
  );
});

test("perplexity gateway transports reject non-Perplexity model ids", async () => {
  await withEnv(
    {
      OPENROUTER_API_KEY: "openrouter-key",
      OPENROUTER_BASE_URL: "https://openrouter.example/api/v1",
      PERPLEXITY_MODEL: "openai/gpt-4o-mini",
    },
    async () => {
      assert.throws(
        () => resolveTransport(process.env),
        /Perplexity Sonar model/i,
      );
      assert.equal(isAvailable(), false);
      await assert.rejects(
        () => search("What is the Responses API?"),
        /Perplexity Sonar model/i,
      );
    },
  );
});

test("perplexity generic gateway requires both api key and base url", async () => {
  await withEnv(
    {
      PERPLEXITY_GATEWAY_API_KEY: "gateway-key",
    },
    async () => {
      assert.equal(isAvailable(), false);
      await assert.rejects(
        () => search("What is the Responses API?"),
        /Missing Perplexity credentials/i,
      );
    },
  );
});

test("perplexity kilo-style transport falls back to URL extraction when citations are absent", async () => {
  await withEnv(
    {
      KILOCODE_API_KEY: "kilo-key",
    },
    async () => {
      assert.equal(isAvailable(), true);
      await withFetch(async (url, init) => {
        assert.equal(String(url), "https://api.kilo.ai/api/gateway/chat/completions");
        assert.equal(init?.headers?.Authorization, "Bearer kilo-key");
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.equal(body.model, "perplexity/sonar-pro");
        return {
          ok: true,
          async json() {
            return {
              choices: [
                {
                  message: {
                    content:
                      "OpenAI introduced the Responses API in https://developers.openai.com/api/reference/responses/overview/ and described new tools at https://openai.com/index/new-tools-and-features-in-the-responses-api/ .",
                  },
                },
              ],
            };
          },
        };
      }, async () => {
        const payload = await search("What is the Responses API?", { count: 3 });
        assert.equal(payload.transport, "kilo");
        assert.equal(payload.results.length, 3);
        assert.equal(payload.results[1].url, "https://developers.openai.com/api/reference/responses/overview/");
        assert.equal(payload.results[2].url, "https://openai.com/index/new-tools-and-features-in-the-responses-api/");
      });
    },
  );
});
