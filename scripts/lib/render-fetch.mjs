import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { CdpClient } from "./cdp-client.mjs";
import { extractLinksFromHtml, extractReadableText } from "./html-text.mjs";
import { requestText } from "./http-client.mjs";
import {
  assertRenderRequestAllowed,
  assertRenderNavigationAllowed,
  normalizeRenderResourceType,
  shouldBlockRenderResource,
} from "./render-safety.mjs";
import { detectRenderRuntime } from "./render-runtime.mjs";

const DEVTOOLS_URL_PATTERN = /DevTools listening on (ws:\/\/\S+)/i;
const QUIET_WINDOW_MS = 500;
const RENDER_PROBE_INTERVAL_MS = 150;
const RENDER_INTERSTITIAL_PATTERNS = [
  /\/cdn-cgi\/challenge-platform\//i,
  /cf-browser-verification/i,
  /please enable javascript and cookies to continue/i,
  /attention required!/i,
];

function buildBrowserArgs(runtime, options) {
  return [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--hide-scrollbars",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--password-store=basic",
    "--use-mock-keychain",
    "--remote-debugging-port=0",
    `--user-data-dir=${runtime.userDataDir}`,
    "about:blank",
  ];
}

async function removeTempDir(dirPath) {
  if (!dirPath) {
    return;
  }
  await fs.rm(dirPath, { recursive: true, force: true });
}

async function waitForDevToolsUrl(browserProcess, timeoutMs) {
  const stderrChunks = [];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the browser DevTools endpoint"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      browserProcess.stderr?.off("data", onData);
      browserProcess.off("exit", onExit);
    }

    function onExit(code) {
      cleanup();
      reject(
        new Error(
          `Browser process exited before DevTools became available${code === null ? "" : ` (${code})`}`,
        ),
      );
    }

    function onData(chunk) {
      const text = chunk.toString("utf8");
      stderrChunks.push(text);
      const match = text.match(DEVTOOLS_URL_PATTERN);
      if (!match) {
        return;
      }
      cleanup();
      resolve(match[1]);
    }

    browserProcess.stderr?.on("data", onData);
    browserProcess.once("exit", onExit);
  });
}

async function listBrowserTargets(port, timeoutMs) {
  const response = await requestText(`http://127.0.0.1:${port}/json/list`, {
    method: "GET",
    timeoutMs,
    transport: "fetch",
  });
  if (response.status !== 200) {
    throw new Error(`Browser target discovery failed (${response.status})`);
  }

  return JSON.parse(response.body);
}

async function openPageTarget(port, timeoutMs) {
  const targets = await listBrowserTargets(port, timeoutMs);
  const pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("Could not find a page target on the local browser");
  }
  return pageTarget.webSocketDebuggerUrl;
}

function extractPortFromDevToolsUrl(wsUrl) {
  const parsed = new URL(wsUrl);
  return Number.parseInt(parsed.port, 10);
}

async function launchBrowser(runtimeInfo, options) {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-search-pro-render-"));
  const browserProcess = spawn(runtimeInfo.browserPath, buildBrowserArgs({ userDataDir }, options), {
    stdio: ["ignore", "ignore", "pipe"],
  });

  try {
    const devToolsUrl = await waitForDevToolsUrl(browserProcess, options.timeoutMs ?? 10000);
    return {
      browserProcess,
      browserFamily: runtimeInfo.browserFamily,
      browserPath: runtimeInfo.browserPath,
      port: extractPortFromDevToolsUrl(devToolsUrl),
      userDataDir,
    };
  } catch (error) {
    browserProcess.kill("SIGKILL");
    await removeTempDir(userDataDir);
    throw error;
  }
}

function createFatalController() {
  let fatalError = null;
  let rejectFatal;
  const fatalPromise = new Promise((_, reject) => {
    rejectFatal = reject;
  });

  return {
    fatalPromise,
    get fatalError() {
      return fatalError;
    },
    fail(error) {
      if (fatalError) {
        return;
      }
      fatalError = error;
      rejectFatal(error);
    },
  };
}

async function raceFatal(promise, fatalPromise) {
  return Promise.race([promise, fatalPromise]);
}

async function probeRenderedDocument(client, fatalPromise) {
  try {
    const evaluation = await raceFatal(
      client.send("Runtime.evaluate", {
        expression: `(() => ({
          url: location.href,
          title: document.title,
          html: document.documentElement ? document.documentElement.outerHTML : "",
          readyState: document.readyState
        }))()`,
        returnByValue: true,
      }),
      fatalPromise,
    );
    return evaluation.result?.value ?? null;
  } catch {
    return null;
  }
}

function isChallengeUrl(url) {
  const value = String(url ?? "");
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.searchParams.has("__cf_chl_rt_tk");
  } catch {
    return value.includes("__cf_chl_rt_tk=");
  }
}

export function detectRenderInterstitial(snapshot = {}) {
  const url = String(snapshot.url ?? "");
  const title = String(snapshot.title ?? "");
  const html = String(snapshot.html ?? "");

  if (isChallengeUrl(url)) {
    return "Browser render hit an anti-bot challenge page";
  }

  const haystack = `${title}\n${html}`;
  if (RENDER_INTERSTITIAL_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return "Browser render hit an anti-bot challenge page";
  }

  return null;
}

export function assessRenderedDocument(snapshot = {}) {
  const url = String(snapshot.url ?? "");
  const html = String(snapshot.html ?? "");
  const readyState = String(snapshot.readyState ?? "").toLowerCase();
  const interstitialReason = detectRenderInterstitial(snapshot);

  if (interstitialReason) {
    return {
      status: "blocked",
      reason: interstitialReason,
    };
  }

  if (!url || url === "about:blank") {
    return {
      status: "pending",
      reason: "Navigation has not left about:blank yet",
    };
  }

  if ((readyState === "interactive" || readyState === "complete") && html.trim()) {
    return {
      status: "ready",
      reason: "Rendered document is readable",
    };
  }

  return {
    status: "pending",
    reason: "Rendered document is not ready yet",
  };
}

export async function waitForRenderableDocument(client, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const probeIntervalMs = Math.max(1, options.probeIntervalMs ?? RENDER_PROBE_INTERVAL_MS);
  const fatalPromise = options.fatalPromise ?? new Promise(() => {});
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;

  while (Date.now() < deadline) {
    lastSnapshot = await probeRenderedDocument(client, fatalPromise);
    const assessment = assessRenderedDocument(lastSnapshot ?? {});
    if (assessment.status === "blocked") {
      throw new Error(assessment.reason);
    }
    if (assessment.status === "ready") {
      return lastSnapshot;
    }
    await raceFatal(delay(probeIntervalMs), fatalPromise);
  }

  lastSnapshot = await probeRenderedDocument(client, fatalPromise);
  const finalAssessment = assessRenderedDocument(lastSnapshot ?? {});
  if (finalAssessment.status === "blocked") {
    throw new Error(finalAssessment.reason);
  }
  if (finalAssessment.status === "ready") {
    return lastSnapshot;
  }

  throw new Error("Timed out waiting for the page to become renderable");
}

async function waitForNetworkIdle(state, deadline, fatalPromise) {
  let quietSince = state.inflight.size === 0 ? Date.now() : null;

  while (Date.now() < deadline) {
    if (state.inflight.size === 0) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= QUIET_WINDOW_MS) {
        return false;
      }
    } else {
      quietSince = null;
    }
    await raceFatal(delay(100), fatalPromise);
  }

  return true;
}

async function withAsyncHandler(handler, fatalController) {
  try {
    await handler();
  } catch (error) {
    fatalController.fail(error);
  }
}

function isPrimaryDocumentRequest(params, mainFrameId) {
  const resourceType = normalizeRenderResourceType(params?.resourceType);
  return resourceType === "document" && (!mainFrameId || params?.frameId === mainFrameId);
}

export async function decidePausedRenderRequestAction(params, options = {}) {
  const resourceType = normalizeRenderResourceType(params?.resourceType);
  const primaryDocumentRequest = isPrimaryDocumentRequest(params, options.mainFrameId);

  if (shouldBlockRenderResource(resourceType, options.blockTypes ?? [])) {
    return {
      action: "block",
      errorReason: "BlockedByClient",
      resourceType,
      isPrimaryDocumentRequest: primaryDocumentRequest,
      safeUrl: null,
      blockReason: `Blocked ${resourceType || "unknown"} resource by render.blockTypes`,
    };
  }

  try {
    const safe = primaryDocumentRequest
      ? await assertRenderNavigationAllowed(params.request?.url, {
          lookupAll: options.lookupAll,
          sameOriginOnly: options.sameOriginOnly,
          initialOrigin: options.initialOrigin,
        })
      : await assertRenderRequestAllowed(params.request?.url, {
          lookupAll: options.lookupAll,
        });

    return {
      action: "continue",
      errorReason: null,
      resourceType,
      isPrimaryDocumentRequest: primaryDocumentRequest,
      safeUrl: safe.url.toString(),
      blockReason: null,
    };
  } catch (error) {
    if (primaryDocumentRequest) {
      throw error;
    }

    return {
      action: "block",
      errorReason: "BlockedByClient",
      resourceType,
      isPrimaryDocumentRequest: false,
      safeUrl: null,
      blockReason: error.message,
    };
  }
}

async function defaultBrowserRender(inputUrl, options = {}) {
  const runtime = options.runtime ?? detectRenderRuntime({ env: options.env });
  if (!runtime.available) {
    throw new Error(
      runtime.reason ??
        "Browser render runtime unavailable. Install a local Chromium, Chrome, or Edge binary.",
    );
  }

  const timeoutMs = Math.max(1000, options.budgetMs ?? 8000);
  const launch = await launchBrowser(runtime, { timeoutMs });
  let client = null;

  try {
    const wsUrl = await openPageTarget(launch.port, timeoutMs);
    client = await CdpClient.connect(wsUrl, { timeoutMs });
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    await client.send("Fetch.enable", {
      patterns: [{ urlPattern: "*", requestStage: "Request" }],
    });

    const initialOrigin = new URL(inputUrl).origin;
    const state = {
      inflight: new Set(),
      finalUrl: inputUrl,
      mainFrameId: null,
    };
    const fatalController = createFatalController();
    const blockTypes = options.blockTypes ?? [];

    const cleanups = [
      client.on("Network.requestWillBeSent", (params) => {
        state.inflight.add(params.requestId);
      }),
      client.on("Network.loadingFinished", (params) => {
        state.inflight.delete(params.requestId);
      }),
      client.on("Network.loadingFailed", (params) => {
        state.inflight.delete(params.requestId);
      }),
      client.on("Page.frameNavigated", (params) => {
        if (params.frame?.parentId) {
          return;
        }
        state.mainFrameId = params.frame.id;
        state.finalUrl = params.frame.url ?? state.finalUrl;
      }),
      client.on("Fetch.requestPaused", (params) => {
        void withAsyncHandler(async () => {
          const decision = await decidePausedRenderRequestAction(params, {
            blockTypes,
            lookupAll: options.lookupAll,
            sameOriginOnly: options.sameOriginOnly,
            initialOrigin,
            mainFrameId: state.mainFrameId,
          });

          if (decision.action === "block") {
            await client.send("Fetch.failRequest", {
              requestId: params.requestId,
              errorReason: decision.errorReason,
            });
            return;
          }

          if (decision.isPrimaryDocumentRequest) {
            state.finalUrl = decision.safeUrl;
          }

          await client.send("Fetch.continueRequest", { requestId: params.requestId });
        }, fatalController);
      }),
    ];

    const navigateResult = await raceFatal(
      client.send("Page.navigate", { url: inputUrl }),
      fatalController.fatalPromise,
    );
    if (navigateResult.errorText) {
      throw new Error(`Browser navigation failed: ${navigateResult.errorText}`);
    }

    const startedAt = Date.now();
    await waitForRenderableDocument(client, {
      timeoutMs,
      fatalPromise: fatalController.fatalPromise,
    });

    let timedOut = false;
    if ((options.waitUntil ?? "domcontentloaded") === "networkidle") {
      timedOut = await waitForNetworkIdle(
        state,
        startedAt + timeoutMs,
        fatalController.fatalPromise,
      );
    } else {
      const remaining = Math.max(0, Math.min(300, startedAt + timeoutMs - Date.now()));
      if (remaining > 0) {
        await raceFatal(delay(remaining), fatalController.fatalPromise);
      }
    }

    if (fatalController.fatalError) {
      throw fatalController.fatalError;
    }

    const evaluation = await raceFatal(
      client.send("Runtime.evaluate", {
        expression: `(() => ({
          url: location.href,
          title: document.title,
          html: document.documentElement.outerHTML
        }))()`,
        returnByValue: true,
      }),
      fatalController.fatalPromise,
    );
    const value = evaluation.result?.value ?? {};
    const safeFinal = await assertRenderNavigationAllowed(value.url ?? state.finalUrl, {
      lookupAll: options.lookupAll,
      sameOriginOnly: options.sameOriginOnly,
      initialOrigin,
    });

    for (const cleanup of cleanups) {
      cleanup();
    }

    return {
      url: safeFinal.url.toString(),
      title: value.title ?? "",
      html: value.html ?? "",
      runtime: {
        browserFamily: launch.browserFamily,
        browserPath: launch.browserPath,
      },
      timedOut,
    };
  } finally {
    client?.close();
    launch.browserProcess.kill("SIGKILL");
    await removeTempDir(launch.userDataDir);
  }
}

export async function renderHtmlSnapshot(inputUrl, options = {}) {
  const executeBrowserRender = options.executeBrowserRender ?? defaultBrowserRender;
  const maxChars = options.maxChars ?? 12000;
  const rendered = await executeBrowserRender(inputUrl, options);
  const interstitialReason = detectRenderInterstitial(rendered);
  if (interstitialReason) {
    throw new Error(interstitialReason);
  }
  const extracted = extractReadableText(rendered.html, { maxChars });

  return {
    url: rendered.url,
    title: rendered.title || extracted.title,
    contentType: "text/html",
    body: rendered.html,
    content: extracted.content,
    links: extractLinksFromHtml(rendered.html, rendered.url),
    isHtml: true,
    render: {
      used: true,
      browserFamily: rendered.runtime?.browserFamily ?? null,
      browserPath: rendered.runtime?.browserPath ?? null,
      timedOut: Boolean(rendered.timedOut),
    },
  };
}

export async function renderReadableUrl(inputUrl, options = {}) {
  const snapshot = await renderHtmlSnapshot(inputUrl, options);
  return {
    url: snapshot.url,
    title: snapshot.title,
    contentType: snapshot.contentType,
    content: snapshot.content,
    render: snapshot.render,
  };
}

export async function renderReadableUrls(urls, options = {}) {
  const results = [];
  const failed = [];

  for (const url of urls) {
    try {
      results.push(await renderReadableUrl(url, options));
    } catch (error) {
      failed.push({
        url,
        error: error.message,
      });
    }
  }

  return { results, failed };
}
