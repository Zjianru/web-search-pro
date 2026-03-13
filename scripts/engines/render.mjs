import { renderReadableUrls } from "../lib/render-fetch.mjs";
import { detectRenderRuntime } from "../lib/render-runtime.mjs";

export function isAvailable(options = {}) {
  return detectRenderRuntime({ env: options.env }).available;
}

export function name() {
  return "render";
}

export async function search() {
  throw new Error("render engine does not support search. Use ddg or a provider API instead.");
}

export async function extract(urls, opts = {}) {
  const result = await renderReadableUrls(urls, {
    maxChars: opts.maxChars ?? 12000,
    budgetMs: opts.render?.budgetMs,
    waitUntil: opts.render?.waitUntil,
    blockTypes: opts.render?.blockTypes,
    sameOriginOnly: opts.render?.sameOriginOnly,
  });

  return {
    engine: "render",
    results: result.results.map((entry) => ({
      url: entry.url,
      title: entry.title,
      content: entry.content,
      contentType: entry.contentType,
    })),
    failed: result.failed,
    render: {
      used: result.results.length > 0,
      policy: opts.render?.policy ?? "force",
      waitUntil: opts.render?.waitUntil ?? "domcontentloaded",
      budgetMs: opts.render?.budgetMs ?? 8000,
      blockTypes: opts.render?.blockTypes ?? [],
      sameOriginOnly: opts.render?.sameOriginOnly ?? true,
      fallbackAppliedTo: [],
      browserFamily: result.results[0]?.render?.browserFamily ?? null,
      browserPath: result.results[0]?.render?.browserPath ?? null,
      timedOut: result.results.some((entry) => entry.render?.timedOut),
    },
  };
}
