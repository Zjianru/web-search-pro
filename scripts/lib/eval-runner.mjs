import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { scoreEvalCase } from "./eval-scorer.mjs";
import { SCHEMA_VERSION } from "./output.mjs";

const EVAL_CASES_DIR = path.resolve(process.cwd(), "eval", "cases");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeEnvMap(env, filePath, label) {
  if (env === undefined) {
    return {};
  }
  if (!isPlainObject(env)) {
    throw new Error(`Invalid eval case in ${filePath}: ${label}.env must be an object`);
  }
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [String(key), String(value)]),
  );
}

function normalizeConfigJson(configJson, filePath, label) {
  if (configJson === undefined) {
    return null;
  }
  if (!isPlainObject(configJson)) {
    throw new Error(`Invalid eval case in ${filePath}: ${label}.configJson must be an object`);
  }
  return JSON.parse(JSON.stringify(configJson));
}

function normalizeConstraints(constraints, filePath, label, defaultRequiresNetwork) {
  if (constraints === undefined) {
    return {
      requiresNetwork: defaultRequiresNetwork,
      requiredEnvAll: [],
      requiredEnvAny: [],
    };
  }
  if (!isPlainObject(constraints)) {
    throw new Error(`Invalid eval case in ${filePath}: ${label} must be an object`);
  }
  return {
    requiresNetwork:
      typeof constraints.requiresNetwork === "boolean"
        ? constraints.requiresNetwork
        : defaultRequiresNetwork,
    requiredEnvAll: Array.isArray(constraints.requiredEnvAll)
      ? constraints.requiredEnvAll.map((value) => String(value))
      : [],
    requiredEnvAny: Array.isArray(constraints.requiredEnvAny)
      ? constraints.requiredEnvAny.map((value) => String(value))
      : [],
  };
}

function normalizeCommand(command, filePath, label = "command") {
  if (!isPlainObject(command) || typeof command.name !== "string") {
    throw new Error(`Invalid eval case in ${filePath}: missing ${label}.name`);
  }
  if (command.argv !== undefined && !Array.isArray(command.argv)) {
    throw new Error(`Invalid eval case in ${filePath}: ${label}.argv must be an array`);
  }
  return {
    name: command.name.trim(),
    argv: Array.isArray(command.argv) ? command.argv.map((value) => String(value)) : [],
    env: normalizeEnvMap(command.env, filePath, label),
    configJson: normalizeConfigJson(command.configJson, filePath, label),
  };
}

function normalizeExternalCommand(command, filePath, label = "externalCommand") {
  if (!isPlainObject(command) || typeof command.bin !== "string") {
    throw new Error(`Invalid eval case in ${filePath}: missing ${label}.bin`);
  }
  if (command.argv !== undefined && !Array.isArray(command.argv)) {
    throw new Error(`Invalid eval case in ${filePath}: ${label}.argv must be an array`);
  }
  if (command.json !== undefined && typeof command.json !== "boolean") {
    throw new Error(`Invalid eval case in ${filePath}: ${label}.json must be a boolean`);
  }
  return {
    cwd: command.cwd ? String(command.cwd) : null,
    bin: command.bin.trim(),
    argv: Array.isArray(command.argv) ? command.argv.map((value) => String(value)) : [],
    json: command.json !== false,
    env: normalizeEnvMap(command.env, filePath, label),
    configJson: normalizeConfigJson(command.configJson, filePath, label),
  };
}

function normalizeTarget(rawTarget, filePath) {
  if (!isPlainObject(rawTarget) || typeof rawTarget.id !== "string") {
    throw new Error(`Invalid eval case in ${filePath}: targets entries must include id`);
  }
  if (!rawTarget.command && !rawTarget.externalCommand) {
    throw new Error(
      `Invalid eval case in ${filePath}: target ${rawTarget.id} must include command or externalCommand`,
    );
  }

  return {
    id: rawTarget.id.trim(),
    constraints: normalizeConstraints(
      rawTarget.constraints,
      filePath,
      `target ${rawTarget.id}.constraints`,
      null,
    ),
    command: rawTarget.command
      ? normalizeCommand(rawTarget.command, filePath, `target ${rawTarget.id}.command`)
      : null,
    externalCommand: rawTarget.externalCommand
      ? normalizeExternalCommand(
          rawTarget.externalCommand,
          filePath,
          `target ${rawTarget.id}.externalCommand`,
        )
      : null,
  };
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

export function normalizeEvalCase(rawCase, filePath = "<inline>") {
  if (!isPlainObject(rawCase)) {
    throw new Error(`Invalid eval case in ${filePath}: expected object`);
  }
  if (typeof rawCase.id !== "string" || rawCase.id.trim().length === 0) {
    throw new Error(`Invalid eval case in ${filePath}: missing id`);
  }
  if (typeof rawCase.suite !== "string" || rawCase.suite.trim().length === 0) {
    throw new Error(`Invalid eval case in ${filePath}: missing suite`);
  }
  if (!rawCase.targets && (!isPlainObject(rawCase.command) || typeof rawCase.command.name !== "string")) {
    throw new Error(`Invalid eval case in ${filePath}: missing command.name`);
  }

  const targets = Array.isArray(rawCase.targets)
    ? rawCase.targets.map((target) => normalizeTarget(target, filePath))
    : [];

  return {
    id: rawCase.id.trim(),
    suite: rawCase.suite.trim(),
    description: String(rawCase.description ?? "").trim(),
    intent: String(rawCase.intent ?? rawCase.command.name).trim(),
    tags: Array.isArray(rawCase.tags) ? rawCase.tags.map((value) => String(value)) : [],
    command: rawCase.command
      ? normalizeCommand(rawCase.command, filePath)
      : {
          name: "search",
          argv: [],
        },
    targets,
    constraints: normalizeConstraints(rawCase.constraints, filePath, "constraints", true),
    comparativeMetrics: Array.isArray(rawCase.comparativeMetrics)
      ? rawCase.comparativeMetrics.map((value) => String(value))
      : [],
    comparativeExpectations: isPlainObject(rawCase.comparativeExpectations)
      ? {
          preferredTarget: rawCase.comparativeExpectations.preferredTarget
            ? String(rawCase.comparativeExpectations.preferredTarget)
            : null,
          mustBeatOn: Array.isArray(rawCase.comparativeExpectations.mustBeatOn)
            ? rawCase.comparativeExpectations.mustBeatOn.map((value) => String(value))
            : [],
          allowedTiesOn: Array.isArray(rawCase.comparativeExpectations.allowedTiesOn)
            ? rawCase.comparativeExpectations.allowedTiesOn.map((value) => String(value))
            : [],
        }
      : {
          preferredTarget: null,
          mustBeatOn: [],
          allowedTiesOn: [],
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

function buildExternalCommandArgs(target) {
  const args = [...(target.externalCommand?.argv ?? [])];
  if (target.externalCommand?.json !== false && !args.includes("--json")) {
    args.push("--json");
  }
  return args;
}

function interpolateEnvValue(value, env) {
  return String(value).replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name) => {
    const resolved = env[name];
    return typeof resolved === "string" ? resolved : "";
  });
}

function resolveCommandEnv(command, baseEnv) {
  const overrides = command?.env ?? {};
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [
      key,
      interpolateEnvValue(value, baseEnv),
    ]),
  );
}

function buildExecutionEnv(baseEnv, command) {
  return {
    ...baseEnv,
    ...resolveCommandEnv(command, baseEnv),
  };
}

async function withTemporaryInternalConfig(command, env, fn) {
  if (!command?.configJson) {
    return fn(env);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "web-search-pro-eval-config-"));
  const configPath = path.join(tempDir, "config.json");
  await fs.writeFile(configPath, `${JSON.stringify(command.configJson, null, 2)}\n`, "utf8");

  try {
    return await fn({
      ...env,
      WEB_SEARCH_PRO_CONFIG: configPath,
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function withTemporaryExternalConfig(command, cwd, fn) {
  if (!command?.configJson) {
    return fn();
  }

  const configPath = path.join(cwd, "config.json");
  let previousConfig = null;
  let existed = false;
  try {
    previousConfig = await fs.readFile(configPath, "utf8");
    existed = true;
  } catch {
    existed = false;
  }

  await fs.writeFile(configPath, `${JSON.stringify(command.configJson, null, 2)}\n`, "utf8");
  try {
    return await fn();
  } finally {
    if (existed) {
      await fs.writeFile(configPath, previousConfig, "utf8");
    } else {
      await fs.rm(configPath, { force: true });
    }
  }
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

function buildBlockedReason(constraintsList, env) {
  for (const constraints of constraintsList) {
    if (!constraints) {
      continue;
    }
    if (constraints.requiresNetwork === true && env.WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE === "1") {
      return "Network-dependent eval case skipped by WEB_SEARCH_PRO_SKIP_NETWORK_SMOKE=1";
    }
    if (constraints.requiredEnvAll.length > 0 && !hasAllEnv(env, constraints.requiredEnvAll)) {
      return `Missing required env: ${constraints.requiredEnvAll.join(", ")}`;
    }
    if (constraints.requiredEnvAny.length > 0 && !hasAnyEnv(env, constraints.requiredEnvAny)) {
      return `Missing one of required envs: ${constraints.requiredEnvAny.join(", ")}`;
    }
  }
  return null;
}

async function defaultExecutor(caseDefinition, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const baseEnv = { ...process.env, ...(options.env ?? {}) };
  const target = options.target ?? null;
  if (target?.externalCommand) {
    const targetCwd = target.externalCommand.cwd
      ? path.resolve(cwd, target.externalCommand.cwd)
      : cwd;
    const env = buildExecutionEnv(baseEnv, target.externalCommand);

    return withTemporaryExternalConfig(target.externalCommand, targetCwd, async () => {
      const result = spawnSync(target.externalCommand.bin, buildExternalCommandArgs(target), {
        cwd: targetCwd,
        env,
        encoding: "utf8",
      });

      return {
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        payload: parseJson(result.stdout ?? ""),
      };
    });
  }

  const command = target?.command ?? caseDefinition.command;
  const env = buildExecutionEnv(baseEnv, command);

  return withTemporaryInternalConfig(command, env, async (effectiveEnv) => {
    const result = spawnSync(
      process.execPath,
      [path.join(cwd, "scripts", `${command.name}.mjs`), ...buildCommandArgs({ command })],
      {
        cwd,
        env: effectiveEnv,
        encoding: "utf8",
      },
    );

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      payload: parseJson(result.stdout ?? ""),
    };
  });
}

function buildTargetScoreIndex(targetResults = []) {
  return Object.fromEntries(targetResults.map((entry) => [entry.targetId, entry]));
}

const METRIC_SIGNAL_MAP = Object.freeze({
  routeCorrectness: ["selectedProviderIn", "selectedProviderNotIn"],
  confidenceHonesty: ["selectionModeIn", "confidenceLevelIn", "confidenceLevelNotIn"],
  providerWinRate: ["selectedProviderIn", "selectedProviderNotIn"],
});

const METRIC_DIMENSION_MAP = Object.freeze({
  routeCorrectness: ["routing"],
  confidenceHonesty: ["routing"],
  providerWinRate: ["routing"],
  fallbackBehavior: ["routing", "safety"],
  freshness: ["freshness"],
  citationQuality: ["citation"],
});

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeMetricScore(metric, targetResult) {
  const signalIds = METRIC_SIGNAL_MAP[metric] ?? [];
  const signalChecks = Array.isArray(targetResult?.checks)
    ? targetResult.checks.filter((check) => signalIds.includes(check.signal))
    : [];

  if (signalChecks.length > 0) {
    const passedCount = signalChecks.filter((check) => check.passed).length;
    return passedCount / signalChecks.length;
  }

  const dimensionScores = (METRIC_DIMENSION_MAP[metric] ?? [])
    .map((dimension) => targetResult?.dimensions?.[dimension]?.score)
    .filter((score) => typeof score === "number");

  if (dimensionScores.length > 0) {
    return average(dimensionScores);
  }

  return targetResult?.score ?? 0;
}

function compareMetric(metric, preferred, competitor) {
  const preferredScore = computeMetricScore(metric, preferred);
  const competitorScore = computeMetricScore(metric, competitor);

  if (preferredScore === competitorScore) {
    return {
      outcome: "tie",
      preferredScore,
      competitorScore,
    };
  }

  return {
    outcome: preferredScore > competitorScore ? "win" : "loss",
    preferredScore,
    competitorScore,
  };
}

function determineWinner(byMetric, preferredTargetId, competitors) {
  const outcomes = Object.values(byMetric).map((entry) => entry.outcome);
  if (outcomes.length === 0 || outcomes.every((outcome) => outcome === "tie")) {
    return "tie";
  }
  if (outcomes.includes("loss")) {
    return competitors.length === 1 ? competitors[0].targetId : "mixed";
  }
  return preferredTargetId;
}

function meetsComparativeExpectations(caseDefinition, byMetric) {
  const mustBeatOn = new Set(caseDefinition.comparativeExpectations.mustBeatOn);
  for (const metric of caseDefinition.comparativeMetrics) {
    const outcome = byMetric[metric]?.outcome ?? "tie";
    if (outcome === "loss") {
      return false;
    }
    if (mustBeatOn.has(metric) && outcome !== "win") {
      return false;
    }
  }
  return true;
}

function buildComparativeSummary(caseResults = []) {
  const headToHeadCases = caseResults.filter(
    (entry) => Array.isArray(entry.targetResults) && entry.targetResults.length > 0,
  );

  if (headToHeadCases.length === 0) {
    return null;
  }

  const targetBuckets = {};
  const caseWinnerCounts = { tie: 0, mixed: 0 };
  const byMetric = {};

  for (const caseResult of headToHeadCases) {
    for (const targetResult of caseResult.targetResults) {
      const bucket = (targetBuckets[targetResult.targetId] ??= {
        caseCount: 0,
        passCount: 0,
        failCount: 0,
        averageScore: null,
        scores: [],
      });
      bucket.caseCount += 1;
      if (targetResult.status === "pass") {
        bucket.passCount += 1;
      } else if (targetResult.status === "fail") {
        bucket.failCount += 1;
      }
      if (typeof targetResult.score === "number") {
        bucket.scores.push(targetResult.score);
      }
    }

    const winner = caseResult.comparativeResult?.winner ?? "tie";
    caseWinnerCounts[winner] = (caseWinnerCounts[winner] ?? 0) + 1;

    for (const [metric, detail] of Object.entries(caseResult.comparativeResult?.byMetric ?? {})) {
      const outcome = detail?.outcome ?? detail;
      const bucket = (byMetric[metric] ??= { win: 0, tie: 0, loss: 0 });
      if (outcome === "win" || outcome === "tie" || outcome === "loss") {
        bucket[outcome] += 1;
      }
    }
  }

  return {
    caseCount: headToHeadCases.length,
    targetSummaries: Object.fromEntries(
      Object.entries(targetBuckets).map(([targetId, bucket]) => [
        targetId,
        {
          caseCount: bucket.caseCount,
          passCount: bucket.passCount,
          failCount: bucket.failCount,
          averageScore: bucket.scores.length > 0 ? average(bucket.scores) : null,
        },
      ]),
    ),
    caseWinnerCounts,
    byMetric,
  };
}

function buildComparativeResult(caseDefinition, targetResults) {
  if (targetResults.length === 0) {
    return null;
  }

  const preferredTargetId = caseDefinition.comparativeExpectations.preferredTarget;
  if (!preferredTargetId) {
    const sorted = [...targetResults].sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
    const tied =
      sorted.length > 1 &&
      typeof sorted[0]?.score === "number" &&
      sorted[0].score === sorted[1].score;
    return {
      winner: tied ? "tie" : sorted[0]?.targetId ?? null,
      meetsExpectations: null,
      byMetric: {},
    };
  }

  const index = buildTargetScoreIndex(targetResults);
  const preferred = index[preferredTargetId];
  if (!preferred) {
    return {
      winner: null,
      meetsExpectations: false,
      byMetric: {},
    };
  }

  const competitors = targetResults.filter((entry) => entry.targetId !== preferredTargetId);
  const byMetric = {};

  for (const metric of caseDefinition.comparativeMetrics) {
    const comparisons = competitors.map((competitor) => {
      const comparison = compareMetric(metric, preferred, competitor);
      return {
        competitorId: competitor.targetId,
        ...comparison,
      };
    });

    const outcomes = comparisons.map((entry) => entry.outcome);
    const preferredScore = comparisons[0]?.preferredScore ?? computeMetricScore(metric, preferred);
    byMetric[metric] = {
      outcome: outcomes.includes("loss")
        ? "loss"
        : outcomes.includes("win")
          ? "win"
          : "tie",
      preferredScore,
      competitorScores: Object.fromEntries(
        comparisons.map((entry) => [entry.competitorId, entry.competitorScore]),
      ),
    };
  }

  const winner = determineWinner(byMetric, preferredTargetId, competitors);
  return {
    winner,
    meetsExpectations: meetsComparativeExpectations(caseDefinition, byMetric),
    byMetric,
  };
}

export async function runEvalCase(caseDefinition, options = {}) {
  const normalizedCase = normalizeEvalCase(caseDefinition);
  const env = { ...process.env, ...(options.env ?? {}) };
  const blockedReason = buildBlockedReason([normalizedCase.constraints], env);
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
  if (normalizedCase.targets.length > 0) {
    const targetResults = [];

    for (const target of normalizedCase.targets) {
      const command = target.externalCommand ?? target.command;
      const targetEnv = buildExecutionEnv(env, command);
      const targetBlockedReason = buildBlockedReason(
        [normalizedCase.constraints, target.constraints],
        targetEnv,
      );
      if (targetBlockedReason) {
        targetResults.push({
          targetId: target.id,
          status: "blocked",
          score: null,
          threshold: normalizedCase.scoring.threshold,
          dimensions: null,
          checks: [],
          exitCode: null,
          stderr: "",
          payload: null,
          blockedReason: targetBlockedReason,
        });
        continue;
      }

      const execution = await executor(normalizedCase, { ...options, target });
      const scored = scoreEvalCase(normalizedCase, execution, { now: options.now });
      targetResults.push({
        targetId: target.id,
        status: scored.status,
        score: scored.score,
        threshold: scored.threshold,
        dimensions: scored.dimensions,
        checks: scored.checks,
        exitCode: execution.exitCode,
        stderr: execution.stderr ?? "",
        payload: execution.payload ?? null,
      });
    }

    if (targetResults.some((entry) => entry.status === "blocked")) {
      return {
        id: normalizedCase.id,
        suite: normalizedCase.suite,
        intent: normalizedCase.intent,
        description: normalizedCase.description,
        status: "blocked",
        blockedReason: targetResults
          .filter((entry) => entry.status === "blocked")
          .map((entry) => `${entry.targetId}: ${entry.blockedReason}`)
          .join("; "),
        score: null,
        threshold: normalizedCase.scoring.threshold,
        targetResults,
        comparativeResult: null,
      };
    }

    const comparativeResult = buildComparativeResult(normalizedCase, targetResults);
    const preferredTargetId = normalizedCase.comparativeExpectations.preferredTarget;
    const preferredTargetResult =
      targetResults.find((entry) => entry.targetId === preferredTargetId) ?? targetResults[0] ?? null;
    const comparativeStatus =
      comparativeResult && comparativeResult.meetsExpectations === false ? "fail" : "pass";

    return {
      id: normalizedCase.id,
      suite: normalizedCase.suite,
      intent: normalizedCase.intent,
      description: normalizedCase.description,
      status:
        preferredTargetResult?.status === "fail" || comparativeStatus === "fail"
          ? "fail"
          : preferredTargetResult?.status ?? "fail",
      score: preferredTargetResult?.score ?? null,
      threshold: normalizedCase.scoring.threshold,
      targetResults,
      comparativeResult,
    };
  }

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
    comparativeSummary: buildComparativeSummary(caseResults),
  };
}
