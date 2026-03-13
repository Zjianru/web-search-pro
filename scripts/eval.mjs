#!/usr/bin/env node

import { fail, readOptionValue } from "./lib/cli-utils.mjs";
import {
  filterEvalCases,
  loadBundledEvalCases,
  runEvalSuite,
  summarizeEvalInventory,
} from "./lib/eval-runner.mjs";

function usage(exitCode = 2) {
  console.error(`web-search-pro eval

Usage:
  eval.mjs list [--suite <name>] [--json]
  eval.mjs summary [--json]
  eval.mjs run [--suite <name> | --case <id>] [--json]`);
  process.exit(exitCode);
}

function formatListMarkdown(payload) {
  const lines = [];
  lines.push("# web-search-pro eval cases");
  lines.push("");
  lines.push(`- Total cases: ${payload.cases.length}`);
  lines.push("");
  for (const entry of payload.cases) {
    lines.push(`- ${entry.id} [${entry.suite}] (${entry.command.name}) ${entry.description}`);
  }
  return lines.join("\n");
}

function formatSummaryMarkdown(payload) {
  const lines = [];
  lines.push("# web-search-pro eval summary");
  lines.push("");
  lines.push(`- Total cases: ${payload.totalCases}`);
  lines.push(`- Suites: ${Object.entries(payload.bySuite).map(([key, value]) => `${key}=${value}`).join(", ")}`);
  lines.push(`- Intents: ${Object.entries(payload.byIntent).map(([key, value]) => `${key}=${value}`).join(", ")}`);
  return lines.join("\n");
}

function formatRunMarkdown(payload) {
  const lines = [];
  lines.push("# web-search-pro eval run");
  lines.push("");
  lines.push(
    `- Status counts: pass=${payload.statusCounts.pass}, fail=${payload.statusCounts.fail}, blocked=${payload.statusCounts.blocked}`,
  );
  if (payload.averageScore !== null) {
    lines.push(`- Average score: ${payload.averageScore.toFixed(3)}`);
  }
  lines.push("");
  for (const entry of payload.caseResults) {
    lines.push(`- ${entry.id}: ${entry.status}${entry.score !== null ? ` (${entry.score.toFixed(3)})` : ""}`);
    if (entry.blockedReason) {
      lines.push(`  ${entry.blockedReason}`);
    }
  }
  if (payload.comparativeSummary) {
    lines.push("");
    lines.push("## Head-to-Head Summary");
    lines.push("");
    lines.push(`- Head-to-head cases: ${payload.comparativeSummary.caseCount}`);
    lines.push(
      `- Case winners: ${Object.entries(payload.comparativeSummary.caseWinnerCounts)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")}`,
    );
    for (const [targetId, summary] of Object.entries(payload.comparativeSummary.targetSummaries ?? {})) {
      lines.push(
        `- ${targetId}: avg=${summary.averageScore !== null ? summary.averageScore.toFixed(3) : "n/a"}, pass=${summary.passCount}, fail=${summary.failCount}`,
      );
    }
    for (const [metric, outcomes] of Object.entries(payload.comparativeSummary.byMetric ?? {})) {
      lines.push(
        `- ${metric}: win=${outcomes.win ?? 0}, tie=${outcomes.tie ?? 0}, loss=${outcomes.loss ?? 0}`,
      );
    }
  }
  return lines.join("\n");
}

const args = process.argv.slice(2);
const action = args[0];
if (!action || args.includes("-h") || args.includes("--help")) {
  usage(action ? 0 : 2);
}

let suite = null;
let caseId = null;
let json = false;

for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--suite") {
    suite = readOptionValue(args, i, "--suite");
    i++;
    continue;
  }
  if (arg === "--case") {
    caseId = readOptionValue(args, i, "--case");
    i++;
    continue;
  }
  if (arg === "--json") {
    json = true;
    continue;
  }
  fail(`Unknown option: ${arg}`);
}

const cases = await loadBundledEvalCases();

if (action === "list") {
  const filtered = filterEvalCases(cases, { suite, caseId });
  const payload = {
    schemaVersion: "1.0",
    command: "eval",
    action: "list",
    cases: filtered,
  };
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatListMarkdown(payload)}\n`);
  }
  process.exitCode = 0;
} else if (action === "summary") {
  const payload = summarizeEvalInventory(filterEvalCases(cases, { suite, caseId }));
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatSummaryMarkdown(payload)}\n`);
  }
  process.exitCode = 0;
} else if (action === "run") {
  const filtered = filterEvalCases(cases, { suite, caseId });
  if (filtered.length === 0) {
    fail("No eval cases matched the requested filter", 1);
  }
  const payload = await runEvalSuite(filtered, {
    cwd: process.cwd(),
    env: process.env,
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatRunMarkdown(payload)}\n`);
  }
  process.exitCode = payload.statusCounts.fail > 0 ? 1 : 0;
} else {
  usage();
}
