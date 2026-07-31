#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const frontendRoot = path.join(repoRoot, "frontend");
const expectedCommand = "node";
const expectedArgs = [
  "scripts/verify/verify-playwright-runtime-alignment.mjs",
  "--serve",
];

function fail(message) {
  console.error(`[playwright-adapter] ${message}`);
  console.error(
    "[playwright-adapter] The MCP server must start through this preflight and use only frontend/node_modules for Playwright.",
  );
  process.exit(1);
}

function realpath(target) {
  return fs.realpathSync.native(target);
}

const mcpConfig = JSON.parse(
  fs.readFileSync(path.join(repoRoot, ".mcp.json"), "utf8"),
);
const adapter = mcpConfig.mcpServers?.["playwright-test"];

if (!adapter) {
  fail(".mcp.json does not define mcpServers.playwright-test.");
}
if (adapter.command !== expectedCommand) {
  fail(
    `.mcp.json launches ${JSON.stringify(adapter.command)} instead of ${JSON.stringify(expectedCommand)}.`,
  );
}
if (JSON.stringify(adapter.args) !== JSON.stringify(expectedArgs)) {
  fail(
    `.mcp.json must launch ${expectedArgs.join(" ")}; received ${JSON.stringify(adapter.args)}.`,
  );
}

const frontendRequire = createRequire(path.join(frontendRoot, "package.json"));
const testEntry = realpath(frontendRequire.resolve("@playwright/test"));
const directPlaywright = realpath(frontendRequire.resolve("playwright"));
const testRequire = createRequire(testEntry);
const testPlaywright = realpath(testRequire.resolve("playwright"));

if (directPlaywright !== testPlaywright) {
  fail(
    `frontend imports two physical Playwright runtimes: direct=${directPlaywright}, @playwright/test=${testPlaywright}.`,
  );
}

console.error(
  `[playwright-adapter] PASS: MCP bootstrap and frontend test imports share ${directPlaywright}.`,
);

if (!process.argv.includes("--serve")) {
  process.exit(0);
}

const isWindows = process.platform === "win32";
const pnpmCommand = isWindows ? process.env.ComSpec || "cmd.exe" : "pnpm";
const pnpmArgs = isWindows
  ? ["/d", "/s", "/c", "pnpm exec playwright run-test-mcp-server"]
  : ["exec", "playwright", "run-test-mcp-server"];
const child = spawn(
  pnpmCommand,
  pnpmArgs,
  {
    cwd: frontendRoot,
    env: process.env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  fail(`Could not start the frontend Playwright MCP server: ${error.message}`);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
