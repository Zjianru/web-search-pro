#!/usr/bin/env node

import path from "node:path";
import { fail, readOptionValue } from "./lib/cli-utils.mjs";
import { createClawhubPackage } from "./lib/clawhub-package.mjs";

function usage(exitCode = 2) {
  console.error(`web-search-pro build-clawhub-package

Usage:
  build-clawhub-package.mjs [options]

Options:
  --output <dir>    Output directory (default: dist/clawhub/web-search-pro)`);
  process.exit(exitCode);
}

const args = process.argv.slice(2);
let outputDir = path.resolve(process.cwd(), "dist", "clawhub", "web-search-pro");

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-h" || arg === "--help") {
    usage(0);
  }
  if (arg === "--output") {
    outputDir = path.resolve(process.cwd(), readOptionValue(args, i, "--output"));
    i++;
    continue;
  }
  fail(`Unknown option: ${arg}`);
}

createClawhubPackage({
  sourceDir: process.cwd(),
  outputDir,
});

console.log(outputDir);
