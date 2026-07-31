#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const toolName = (process.argv[2] || "").trim().toLowerCase();

if (!toolName) {
  console.error("Usage: node scripts/seed-db/ensure-smoke-fixtures.mjs <tool-name>");
  process.exit(1);
}

const repoRoot = process.cwd();

const handlers = {
  commitments: {
    description: "ensure seeded commitment invoice detail fixture",
    cmd: "npm",
    args: ["run", "seed:commitments:invoice-fixture"],
  },
};

const handler = handlers[toolName];

if (!handler) {
  console.log(`[smoke-fixtures] No fixture preflight registered for "${toolName}". Skipping.`);
  process.exit(0);
}

console.log(
  `[smoke-fixtures] Running preflight for "${toolName}" to ${handler.description}...`,
);

const result = spawnSync(handler.cmd, handler.args, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
});

if ((result.status ?? 1) !== 0) {
  console.error(
    `[smoke-fixtures] Preflight failed for "${toolName}". Smoke coverage would be incomplete.`,
  );
  process.exit(result.status ?? 1);
}

console.log(`[smoke-fixtures] Preflight completed for "${toolName}".`);
