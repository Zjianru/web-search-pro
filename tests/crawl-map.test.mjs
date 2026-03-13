import test from "node:test";
import assert from "node:assert/strict";

import { crawlSite } from "../scripts/lib/crawl-runner.mjs";
import { mapSite } from "../scripts/lib/map-runner.mjs";

const PUBLIC_LOOKUP = async () => [{ address: "93.184.216.34", family: 4 }];

function buildFakeRequester(fixtures) {
  return async function requestText(url) {
    const response = fixtures[url];
    if (!response) {
      throw new Error(`fixture missing for ${url}`);
    }
    return {
      status: response.status ?? 200,
      body: response.body,
      contentType: response.contentType ?? "text/html; charset=utf-8",
      redirectUrl: response.redirectUrl ?? "",
    };
  };
}

test("crawl runner follows same-origin links breadth-first and deduplicates normalized URLs", async () => {
  const crawl = await crawlSite(["https://docs.example.com/"], {
    depth: 2,
    maxPages: 10,
    sameOrigin: true,
    maxChars: 500,
    lookupAll: PUBLIC_LOOKUP,
    requestTextFn: buildFakeRequester({
      "https://docs.example.com/": {
        body: `
          <html><head><title>Home</title></head><body>
            <a href="/guide">Guide</a>
            <a href="/guide#intro">Guide duplicate</a>
            <a href="/assets/readme.txt">Readme</a>
            <a href="https://blog.example.org/post">External</a>
          </body></html>
        `,
      },
      "https://docs.example.com/guide": {
        body: `
          <html><head><title>Guide</title></head><body>
            <a href="/guide/install">Install</a>
            <p>Guide body.</p>
          </body></html>
        `,
      },
      "https://docs.example.com/assets/readme.txt": {
        contentType: "text/plain; charset=utf-8",
        body: "plain text asset",
      },
      "https://docs.example.com/guide/install": {
        body: `
          <html><head><title>Install</title></head><body>
            <p>Install body.</p>
          </body></html>
        `,
      },
    }),
  });

  assert.deepEqual(
    crawl.pages.map((page) => page.url),
    [
      "https://docs.example.com/",
      "https://docs.example.com/guide",
      "https://docs.example.com/assets/readme.txt",
      "https://docs.example.com/guide/install",
    ],
  );
  assert.equal(crawl.pages[2].contentType, "text/plain; charset=utf-8");
  assert.equal(crawl.summary.visitedPages, 4);
  assert.equal(crawl.summary.maxPagesReached, false);
  assert.deepEqual(crawl.failed, []);
});

test("map runner honors path filters, depth limits, and edge recording", async () => {
  const graph = await mapSite(["https://docs.example.com/"], {
    depth: 2,
    maxPages: 10,
    sameOrigin: true,
    includePathPrefixes: ["/guide"],
    excludePathPrefixes: ["/guide/private"],
    lookupAll: PUBLIC_LOOKUP,
    requestTextFn: buildFakeRequester({
      "https://docs.example.com/": {
        body: `
          <html><head><title>Home</title></head><body>
            <a href="/guide">Guide</a>
            <a href="/guide/private/secret">Secret</a>
            <a href="/blog">Blog</a>
          </body></html>
        `,
      },
      "https://docs.example.com/guide": {
        body: `
          <html><head><title>Guide</title></head><body>
            <a href="/guide/install">Install</a>
          </body></html>
        `,
      },
      "https://docs.example.com/guide/install": {
        body: `
          <html><head><title>Install</title></head><body></body></html>
        `,
      },
    }),
  });

  assert.deepEqual(
    graph.nodes.map((node) => node.url),
    [
      "https://docs.example.com/",
      "https://docs.example.com/guide",
      "https://docs.example.com/guide/install",
    ],
  );
  assert.deepEqual(graph.edges, [
    {
      from: "https://docs.example.com/",
      to: "https://docs.example.com/guide",
    },
    {
      from: "https://docs.example.com/guide",
      to: "https://docs.example.com/guide/install",
    },
  ]);
  assert.equal(graph.meta.visitedPages, 3);
  assert.equal(graph.meta.maxPagesReached, false);
});
