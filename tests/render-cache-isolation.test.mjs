import test from "node:test";
import assert from "node:assert/strict";

import { buildExtractCacheKey } from "../scripts/lib/cache.mjs";

const RENDER_OPTIONS = {
  policy: "force",
  budgetMs: 8000,
  waitUntil: "domcontentloaded",
  blockTypes: ["image", "font"],
  sameOriginOnly: true,
};

test("extract cache keys separate render and extract command schemas", () => {
  const sharedInput = {
    providerId: "render",
    urls: ["https://example.com"],
    maxChars: 12000,
    render: RENDER_OPTIONS,
  };

  const renderKey = buildExtractCacheKey({
    ...sharedInput,
    command: "render",
  });
  const extractKey = buildExtractCacheKey({
    ...sharedInput,
    command: "extract",
  });

  assert.notEqual(renderKey, extractKey);
});
