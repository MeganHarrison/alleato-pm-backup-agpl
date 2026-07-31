#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const limits = {
  nodeProcesses: Number(process.env.ALLEATO_MAX_NODE_PROCESSES || 60),
  helperProcesses: Number(process.env.ALLEATO_MAX_MCP_HELPERS || 20),
  nodeWorkingSetGb: Number(process.env.ALLEATO_MAX_NODE_WORKING_SET_GB || 16),
};

function fail(message) {
  console.error(`[process-budget] ${message}`);
  process.exitCode = 1;
}

if (process.platform !== "win32") {
  console.log("[process-budget] Windows process accounting is not required on this host.");
  process.exit(0);
}

const query = [
  "$items = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |",
  "Select-Object ProcessId,CommandLine,WorkingSetSize;",
  "$items | ConvertTo-Json -Compress",
].join(" ");

const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", query], {
  encoding: "utf8",
  windowsHide: true,
});

if (result.status !== 0) {
  fail(`could not inspect Node processes: ${(result.stderr || "unknown error").trim()}`);
  process.exit();
}

const raw = result.stdout.trim();
const parsed = raw ? JSON.parse(raw) : [];
const processes = Array.isArray(parsed) ? parsed : [parsed];
const helperPattern = /(agentation-mcp|hostinger-(?:domains|dns|billing|vps)-mcp|run-test-mcp-server|playwright.*mcp)/i;
const helpers = processes.filter((item) => helperPattern.test(item.CommandLine || ""));
const workingSetGb = processes.reduce(
  (total, item) => total + Number(item.WorkingSetSize || 0),
  0,
) / 1024 ** 3;

const summary = {
  nodeProcesses: processes.length,
  helperProcesses: helpers.length,
  nodeWorkingSetGb: Number(workingSetGb.toFixed(2)),
  limits,
};

console.log(JSON.stringify(summary, null, 2));

if (summary.nodeProcesses > limits.nodeProcesses) {
  fail(`Node process count ${summary.nodeProcesses} exceeds ${limits.nodeProcesses}.`);
}
if (summary.helperProcesses > limits.helperProcesses) {
  fail(`MCP/browser helper count ${summary.helperProcesses} exceeds ${limits.helperProcesses}.`);
}
if (summary.nodeWorkingSetGb > limits.nodeWorkingSetGb) {
  fail(`Node working set ${summary.nodeWorkingSetGb} GB exceeds ${limits.nodeWorkingSetGb} GB.`);
}

if (process.exitCode) {
  console.error(
    "[process-budget] Reuse the current browser/server, stop unrelated dev servers, and disable unused repo/global MCP entries before adding agents.",
  );
} else {
  console.log("[process-budget] PASS");
}
