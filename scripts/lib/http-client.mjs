import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let cachedCurlAvailability;
let cachedPythonBinary;

async function hasCurl() {
  if (cachedCurlAvailability !== undefined) {
    return cachedCurlAvailability;
  }

  try {
    await execFileAsync("curl", ["--version"], { maxBuffer: 1024 * 1024 });
    cachedCurlAvailability = true;
  } catch {
    cachedCurlAvailability = false;
  }

  return cachedCurlAvailability;
}

async function getPythonBinary() {
  if (cachedPythonBinary !== undefined) {
    return cachedPythonBinary;
  }

  for (const candidate of ["python3", "python"]) {
    try {
      await execFileAsync(candidate, ["--version"], { maxBuffer: 1024 * 1024 });
      cachedPythonBinary = candidate;
      return cachedPythonBinary;
    } catch {
      // continue
    }
  }

  cachedPythonBinary = null;
  return cachedPythonBinary;
}

async function requestTextViaPython(url, options) {
  const pythonBinary = await getPythonBinary();
  if (!pythonBinary) {
    throw new Error("python transport unavailable");
  }

  const timeoutSeconds = Math.max(1, Math.ceil((options.timeoutMs ?? 20000) / 1000));

  const script = `
import json
import sys
import urllib.request

url = sys.argv[1]
headers = json.loads(sys.argv[2])
body = sys.argv[3]
data = body.encode("utf-8") if body else None
req = urllib.request.Request(
    url,
    data=data,
    headers=headers,
    method=${JSON.stringify(options.method ?? "GET")},
)
with urllib.request.urlopen(req, timeout=${timeoutSeconds}) as response:
    body = response.read().decode("utf-8", "replace")
    print(json.dumps({
        "status": response.status,
        "content_type": response.headers.get("content-type", ""),
        "redirect_url": response.headers.get("location", ""),
        "body": body,
    }))
`;

  const { stdout } = await execFileAsync(
    pythonBinary,
    ["-c", script, url, JSON.stringify(options.headers ?? {}), options.body ?? ""],
    {
      maxBuffer: 10 * 1024 * 1024,
      timeout: options.timeoutMs ?? 20000,
    },
  );
  const payload = JSON.parse(stdout);
  return {
    status: payload.status,
    body: payload.body,
    contentType: payload.content_type,
    redirectUrl: payload.redirect_url,
  };
}

async function requestTextViaCurl(url, options) {
  const marker = "__WEB_SEARCH_PRO_META__";
  const headers = options.headers ?? {};
  const timeoutSeconds = Math.max(1, Math.ceil((options.timeoutMs ?? 20000) / 1000));
  const args = [
    "-sS",
    "--max-redirs",
    "0",
    "--max-time",
    String(timeoutSeconds),
    "-X",
    options.method ?? "GET",
  ];

  for (const [name, value] of Object.entries(headers)) {
    args.push("-H", `${name}: ${value}`);
  }
  if (options.body !== undefined && options.body !== null) {
    args.push("--data", options.body);
  }

  args.push("--write-out", `\n${marker}%{http_code}|%{content_type}|%{redirect_url}`);
  args.push(url);

  const { stdout, stderr } = await execFileAsync("curl", args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: options.timeoutMs ?? 20000,
  });

  const markerIndex = stdout.lastIndexOf(`\n${marker}`);
  if (markerIndex === -1) {
    throw new Error("curl response metadata missing");
  }

  const body = stdout.slice(0, markerIndex);
  const meta = stdout.slice(markerIndex + marker.length + 1).trim();
  const [statusRaw, contentType = "", redirectUrl = ""] = meta.split("|");
  const status = Number.parseInt(statusRaw, 10);

  if (!Number.isInteger(status)) {
    throw new Error(stderr.trim() || "curl returned an invalid status");
  }

  return {
    status,
    body,
    contentType,
    redirectUrl,
  };
}

async function requestTextViaFetch(url, options) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), options.timeoutMs ?? 20000);

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body,
    redirect: "manual",
    signal: abortController.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });

  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type") ?? "",
    redirectUrl: response.headers.get("location") ?? "",
  };
}

export async function requestText(url, options = {}) {
  if (options.transport === "python") {
    return requestTextViaPython(url, options);
  }
  if (options.transport === "fetch") {
    return requestTextViaFetch(url, options);
  }
  if (options.transport === "curl") {
    return requestTextViaCurl(url, options);
  }
  if (await hasCurl()) {
    return requestTextViaCurl(url, options);
  }
  return requestTextViaFetch(url, options);
}
