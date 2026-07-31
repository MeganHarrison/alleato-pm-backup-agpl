#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_RETENTION_HOURS = 48;
const DEFAULT_RUN_ROOT = path.join(process.cwd(), "tests", "agent-browser-runs");

function parseArgs(argv) {
  const options = {
    hours: DEFAULT_RETENTION_HOURS,
    runRoot: DEFAULT_RUN_ROOT,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--hours" && argv[i + 1]) {
      options.hours = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--run-root" && argv[i + 1]) {
      options.runRoot = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!Number.isFinite(options.hours) || options.hours <= 0) {
    throw new Error(`Invalid --hours value: ${options.hours}`);
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const cutoffMs = Date.now() - options.hours * 60 * 60 * 1000;

  if (!fs.existsSync(options.runRoot)) {
    console.log(`[agent-browser-cleanup] nothing to clean at ${options.runRoot}`);
    return;
  }

  const entries = fs
    .readdirSync(options.runRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  let removed = 0;
  let kept = 0;

  for (const entry of entries) {
    const fullPath = path.join(options.runRoot, entry.name);
    const stats = fs.statSync(fullPath);

    if (stats.mtimeMs >= cutoffMs) {
      kept += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(`[agent-browser-cleanup] would remove ${fullPath}`);
      removed += 1;
      continue;
    }

    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`[agent-browser-cleanup] removed ${fullPath}`);
    removed += 1;
  }

  console.log(
    `[agent-browser-cleanup] complete removed=${removed} kept=${kept} retention_hours=${options.hours}`,
  );
}

main();
