import fs from "node:fs";
import path from "node:path";

const EXECUTABLE_FALLBACKS = [
  {
    family: "google-chrome",
    candidates: [
      "google-chrome",
      "google-chrome-stable",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ],
  },
  {
    family: "chromium",
    candidates: [
      "chromium",
      "chromium-browser",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
  },
  {
    family: "edge",
    candidates: [
      "microsoft-edge",
      "microsoft-edge-stable",
      "msedge",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
  },
];

function fileIsExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExecutableOnPath(binaryName, env = process.env) {
  const searchPath = env.PATH ?? "";
  for (const segment of searchPath.split(path.delimiter)) {
    if (!segment) {
      continue;
    }
    const candidate = path.join(segment, binaryName);
    if (fileIsExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveBrowserPath(candidate, env) {
  if (candidate.includes(path.sep)) {
    return fileIsExecutable(candidate) ? candidate : null;
  }
  return resolveExecutableOnPath(candidate, env);
}

export function detectRenderRuntime(options = {}) {
  const env = options.env ?? process.env;

  for (const familyEntry of EXECUTABLE_FALLBACKS) {
    for (const candidate of familyEntry.candidates) {
      const browserPath = resolveBrowserPath(candidate, env);
      if (browserPath) {
        return {
          available: true,
          browserFamily: familyEntry.family,
          browserPath,
          launcher: "chrome-cdp",
        };
      }
    }
  }

  return {
    available: false,
    browserFamily: null,
    browserPath: null,
    launcher: "chrome-cdp",
    reason: "No local Chromium/Chrome/Edge binary detected",
  };
}
