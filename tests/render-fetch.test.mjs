import test from "node:test";
import assert from "node:assert/strict";

import {
  assessRenderedDocument,
  decidePausedRenderRequestAction,
  renderReadableUrls,
  waitForRenderableDocument,
} from "../scripts/lib/render-fetch.mjs";

test("render readable urls extracts readable content from rendered HTML", async () => {
  const result = await renderReadableUrls(["https://example.com/app"], {
    maxChars: 500,
    executeBrowserRender: async (url) => ({
      url,
      title: "Rendered Example",
      html: `
        <html>
          <head><title>Rendered Example</title></head>
          <body>
            <main>
              <h1>Rendered Example</h1>
              <p>Loaded via JavaScript after hydration.</p>
            </main>
          </body>
        </html>
      `,
      runtime: {
        browserFamily: "chromium",
        browserPath: "/tmp/chromium",
      },
      timedOut: false,
    }),
  });

  assert.equal(result.failed.length, 0);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].title, "Rendered Example");
  assert.match(result.results[0].content, /hydration/i);
  assert.equal(result.results[0].contentType, "text/html");
  assert.equal(result.results[0].render.used, true);
  assert.equal(result.results[0].render.browserFamily, "chromium");
});

test("render readable urls reports per-url render failures without aborting the batch", async () => {
  const result = await renderReadableUrls(
    ["https://example.com/ok", "https://example.com/fail"],
    {
      executeBrowserRender: async (url) => {
        if (url.endsWith("/fail")) {
          throw new Error("Browser runtime unavailable");
        }
        return {
          url,
          title: "Rendered",
          html: "<html><body><p>ok</p></body></html>",
          runtime: {
            browserFamily: "chromium",
            browserPath: "/tmp/chromium",
          },
          timedOut: false,
        };
      },
    },
  );

  assert.equal(result.results.length, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].url, "https://example.com/fail");
  assert.match(result.failed[0].error, /runtime unavailable/i);
});

test("render readable urls treats anti-bot challenge pages as failures", async () => {
  const result = await renderReadableUrls(["https://platform.openai.com/docs/overview"], {
    executeBrowserRender: async (url) => ({
      url: `${url}?__cf_chl_rt_tk=test-token`,
      title: "",
      html: `
        <html>
          <head>
            <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>
          </head>
          <body></body>
        </html>
      `,
      runtime: {
        browserFamily: "chromium",
        browserPath: "/tmp/chromium",
      },
      timedOut: false,
    }),
  });

  assert.equal(result.results.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /anti-bot challenge/i);
});

test("assess rendered document ignores about:blank and accepts an interactive target document", () => {
  const blank = assessRenderedDocument({
    url: "about:blank",
    title: "",
    html: "<html><body></body></html>",
    readyState: "complete",
  });
  assert.equal(blank.status, "pending");

  const ready = assessRenderedDocument({
    url: "https://example.com/app",
    title: "Example App",
    html: "<html><body><main>hydrated</main></body></html>",
    readyState: "interactive",
  });
  assert.equal(ready.status, "ready");
});

test("wait for renderable document falls back to runtime probes when domcontentloaded is not observed", async () => {
  let evaluateCalls = 0;
  const client = {
    waitForEvent() {
      return new Promise(() => {});
    },
    async send(method) {
      assert.equal(method, "Runtime.evaluate");
      evaluateCalls += 1;
      if (evaluateCalls === 1) {
        return {
          result: {
            value: {
              url: "about:blank",
              title: "",
              html: "<html><body></body></html>",
              readyState: "complete",
            },
          },
        };
      }
      return {
        result: {
          value: {
            url: "https://example.com/app",
            title: "Example App",
            html: "<html><body><main>hydrated</main></body></html>",
            readyState: "interactive",
          },
        },
      };
    },
  };

  const snapshot = await waitForRenderableDocument(client, {
    timeoutMs: 200,
    probeIntervalMs: 1,
    fatalPromise: new Promise(() => {}),
  });

  assert.equal(snapshot.url, "https://example.com/app");
  assert.ok(evaluateCalls >= 2);
});

test("wait for renderable document surfaces anti-bot challenge pages instead of timing out", async () => {
  const client = {
    waitForEvent() {
      return new Promise(() => {});
    },
    async send(method) {
      assert.equal(method, "Runtime.evaluate");
      return {
        result: {
          value: {
            url: "https://platform.openai.com/docs/overview?__cf_chl_rt_tk=test-token",
            title: "",
            html: `
              <html>
                <head><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script></head>
                <body></body>
              </html>
            `,
            readyState: "interactive",
          },
        },
      };
    },
  };

  await assert.rejects(
    () =>
      waitForRenderableDocument(client, {
        timeoutMs: 50,
        probeIntervalMs: 1,
        fatalPromise: new Promise(() => {}),
      }),
    /anti-bot challenge/i,
  );
});

test("render request policy blocks unsafe private-network subrequests without failing the page", async () => {
  const decision = await decidePausedRenderRequestAction(
    {
      resourceType: "XHR",
      frameId: "subframe-1",
      request: {
        url: "http://127.0.0.1/admin",
      },
    },
    {
      initialOrigin: "https://example.com",
      mainFrameId: "main-frame",
      sameOriginOnly: true,
    },
  );

  assert.equal(decision.action, "block");
  assert.equal(decision.errorReason, "BlockedByClient");
  assert.equal(decision.isPrimaryDocumentRequest, false);
  assert.match(decision.blockReason ?? "", /not allowed/i);
});

test("render request policy allows safe public subresources even when same-origin is enforced for navigation", async () => {
  const decision = await decidePausedRenderRequestAction(
    {
      resourceType: "Script",
      frameId: "main-frame",
      request: {
        url: "https://cdn.example.net/app.js",
      },
    },
    {
      initialOrigin: "https://example.com",
      mainFrameId: "main-frame",
      sameOriginOnly: true,
      lookupAll: async () => [{ address: "93.184.216.34", family: 4 }],
    },
  );

  assert.equal(decision.action, "continue");
  assert.equal(decision.isPrimaryDocumentRequest, false);
  assert.equal(decision.safeUrl, "https://cdn.example.net/app.js");
});

test("render request policy fails unsafe main-frame navigation redirects", async () => {
  await assert.rejects(
    () =>
      decidePausedRenderRequestAction(
        {
          resourceType: "Document",
          frameId: "main-frame",
          request: {
            url: "http://localhost/redirected",
          },
        },
        {
          initialOrigin: "https://example.com",
          mainFrameId: "main-frame",
          sameOriginOnly: true,
        },
      ),
    /not allowed/i,
  );
});
