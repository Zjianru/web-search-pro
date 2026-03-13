import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { scoreEvalCase } from "./eval-scorer.mjs";
import { SCHEMA_VERSION } from "./output.mjs";

const EVAL_CASES_DIR = path.resolve(process.cwd(), "eval", "cases");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function walkJsonFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkJsonFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalizeEvalCase(rawCase, filePath = "<inline>") {
  if (!isPlainObject(rawCase)) {
    throw new Error(`Invalid eval case in ${filePath}: expected object`);
  }
  if (typeof rawCase.id !== "string" || rawCase.id.trim().length === 0) {
    throw new Error(`Invalid eval case in ${filePath}: missing id`);
  }
  if (typeof rawCase.suite !== "string" || rawCase.suite.trim().length === 0) {
    throw new Error(`Invalid eval case in ${filePath}: missing suite`);
  }
  if (!isPlainObject(rawCase.command) || typeof rawCase.command.name !== "string") {
    throw new Error(`Invalid eval case in ${filePath}: missing command.name`);
  }
  if (rawCase.command.argv !== undefined && !Array.isArray(rawCase.command.argv)) {
    throw new Error(`Invalid eval case in ${filePath}: command.argv must be an array`);
  }

  return {
    id: rawCase.id.trim(),
    suite: rawCase.suite.trim(),
    description: String(rawCase.description ?? "").trim(),
    intent: String(rawCase.intent ?? rawCase.command.name).trim(),
    tags: Array.isArray(rawCase.tags) ? rawCase.tags.map((value) => String(value)) : [],
    command: {
      name: rawCase.command.name.trim(),
      argv: Array.isArray(rawCase.command.argv)
        ? rawCase.command.argv.map((value) => String(value))
        : [],
    },
    constraints: {
      requiresNetwork: rawCase.constraints?.requiresNetwork !== false,
      requiredEnvAll: Array.isArray(rawCase.constraints?.requiredEnvAll)
        ? rawCase.constraints.requiredEnvAll.map((value) => String(value))
        : [],
      requiredEnvAny: Array.isArray(rawCase.constraints?.requiredEnvAny)
        ? rawCase.constraints.requiredEnvAny.map((value) => String(value))
        : [],
    },
    expectedSignals: isPlainObject(rawCase.expectedSignals) ? rawCase.expectedSignals : {},
    scoring: {
      threshold: rawCase.scoring?.threshold ?? 1,
      weights: isPlainObject(rawCase.scoring?.weights) ? rawCase.scoring.weights : {},
    },
  };
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function buildCommandArgs(caseDefinition) {
  const args = [...caseDefinition.command.argv];
  if (!args.includes("--json")) {
    args.push("--json");
  }
  return args;
}

export async function loadBundledEvalCases(options = {}) {
  const baseDir = options.baseDir ?? EVAL_CASES_DIR;
  const files = await walkJsonFiles(baseDir);
  const cases = [];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf8");
    cases.push(normalizeEvalCase(JSON.parse(raw), filePath));
  }

  cases.sort((left, right) => left.id.localeCompare(right.id));
  return cases;
}

export function summarizeEvalInventory(cases) {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: "eval",
    action: "summary",
    totalCases: cases.length,
    bySuite: cases.reduce((acc, entry) => {
      acc[entry.suite] = (acc[entry.suite] ?? 0) + 1;
      return acc;
    }, {}),
    byIntent: cases.reduce((acc, entry) => {
      acc[entry.intent] = (acc[entry.intent] ?? 0) + 1;
      return acc;
    }, {}),
    byCommand: cases.reduce((acc, entry) => {
      acc[entry.command.name] = (acc[entry.command.name] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function filterEvalCases(cases, options = {}) {
  return cases.filter((entry) => {
    if (options.suite && entry.suite !== options.suite) {
      return false;
    }
    if (options.caseId && entry.id !== options.caseId) {
      return false;
    }
    return true;
  });
}

function hasAllEnv(env, keys) {
  return keys.every((key) => typeof env[key] === "string" && env[key].trim().length > 0);
}

function hasAnyEnv(env, keys) {
  return keys.some((key) => typeof env[key] === "string" && env[key].trim().length > 0);
}

function buildBlockedReason(caseDefinition, env) {
  if (
    caseDefinition.constraints.requiresNetwork &&
    env.WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE === "1"
  ) {
    return "Network-dependent eval case skipped by WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE=1";
  }
  if (caseDefinition.constraints.requiredEnvAll.length > 0 && !hasAllEnv(env, caseDefinition.constraints.requiredEnvAll)) {
    return `Missing required env: ${caseDefinition.constraints.requiredEnvAll.join(", ")}`;
  }
  if (caseDefinition.constraints.requiredEnvAny.length > 0 && !hasAnyEnv(env, caseDefinition.constraints.requiredEnvAny)) {
    return `Missing one of required envs: ${caseDefinition.constraints.requiredEnvAny.join(", ")}`;
  }
  return null;
}

async function defaultExecutor(caseDefinition, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = { ...process.env, ...(options.env ?? {}) };
  const result = spawnSync(
    process.execPath,
    [path.join(cwd, "scripts", `${caseDefinition.command.name}.mjs`), ...buildCommandArgs(caseDefinition)],
    {
      cwd,
      env,
      encoding: "utf8",
    },
  );

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    payload: parseJson(result.stdout ?? ""),
  };
}

export async function runEvalCase(caseDefinition, options = {}) {
  const normalizedCase = normalizeEvalCase(caseDefinition);
  const env = options.env ?? process.env;
  const blockedReason = buildBlockedReason(normalizedCase, env);
  if (blockedReason) {
    return {
      id: normalizedCase.id,
      suite: normalizedCase.suite,
      intent: normalizedCase.intent,
      status: "blocked",
      blockedReason,
      score: null,
      threshold: normalizedCase.scoring.threshold,
    };
  }

  const executor = options.executor ?? defaultExecutor;
  const execution = await executor(normalizedCase, options);
  const scored = scoreEvalCase(normalizedCase, execution, { now: options.now });

  return {
    id: normalizedCase.id,
    suite: normalizedCase.suite,
    intent: normalizedCase.intent,
    description: normalizedCase.description,
    status: scored.status,
    score: scored.score,
    threshold: scored.threshold,
    dimensions: scored.dimensions,
    checks: scored.checks,
    exitCode: execution.exitCode,
    stderr: execution.stderr ?? "",
    payload: execution.payload ?? null,
  };
}

export async function runEvalSuite(cases, options = {}) {
  const caseResults = [];

  for (const caseDefinition of cases) {
    caseResults.push(await runEvalCase(caseDefinition, options));
  }

  const statusCounts = caseResults.reduce(
    (acc, entry) => {
      acc[entry.status] = (acc[entry.status] ?? 0) + 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0 },
  );

  const scoredResults = caseResults.filter((entry) => typeof entry.score === "number");
  const averageScore =
    scoredResults.length > 0
      ? scoredResults.reduce((sum, entry) => sum + entry.score, 0) / scoredResults.length
      : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    command: "eval",
    action: "run",
    caseResults,
    statusCounts,
    averageScore,
  };
}
