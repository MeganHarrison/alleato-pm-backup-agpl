#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const decisionIndex = args.indexOf("--decision-file");

if (args.includes("--help")) {
  console.log("Usage: node scripts/verify/verify_code_mode_rpc_guardrail.mjs --decision-file path/to/decision.md");
  process.exit(0);
}

if (decisionIndex < 0 || !args[decisionIndex + 1]) {
  console.error("Code-Mode RPC guardrail failed: --decision-file is required; no historical decision path is assumed.");
  process.exit(1);
}

const decisionPath = path.resolve(repoRoot, args[decisionIndex + 1]);

const requiredDecisionSections = [
  "## Threat Model",
  "## Required Sandbox Decision Before Build",
  "## Minimum Controls For Approval",
  "## Required Escape Tests Before Approval",
  "## Guardrail",
];

const blockedRuntimePaths = [
  "frontend/src/lib/ai/code-mode-rpc",
  "frontend/src/app/api/ai-assistant/code-mode-rpc",
  "frontend/src/app/api/ai-assistant/code-mode",
  "backend/src/services/code_mode_rpc.py",
  "backend/src/services/code_mode_rpc",
];

const runtimeSearchRoots = ["frontend/src", "backend/src"];
const blockedRuntimePatterns = [
  /\bAI_ASSISTANT_CODE_MODE_RPC_ENABLED\b/,
  /\bcodeModeRpc\b/,
  /\bCodeModeRpc\b/,
  /\bcode-mode-rpc\b/,
];

function fail(message, details = []) {
  console.error(`Code-Mode RPC guardrail failed: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage"].includes(entry.name)) {
        continue;
      }
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

if (!fs.existsSync(decisionPath)) {
  fail(`missing decision document at ${path.relative(repoRoot, decisionPath)}`);
}

const decision = fs.readFileSync(decisionPath, "utf8");
const decisionLine = decision.match(/^Decision:\s*(.+)$/m)?.[1]?.trim();
if (!decisionLine) {
  fail("decision document must include a top-level `Decision:` line");
}

const missingSections = requiredDecisionSections.filter(
  (section) => !decision.includes(section),
);
if (missingSections.length > 0) {
  fail("decision document is missing required sections", missingSections);
}

if (!/Hermes source usage:\s*REFERENCE only/i.test(decision)) {
  fail("decision document must record Hermes source usage as REFERENCE only");
}

const approved = /^Approved for implementation$/i.test(decisionLine);
const notApproved =
  /not approved/i.test(decisionLine) || /deferred/i.test(decisionLine);

if (!approved && !notApproved) {
  fail(
    "decision must be either `Approved for implementation` or an explicit not-approved/deferred state",
    [`Decision: ${decisionLine}`],
  );
}

if (!notApproved) {
  console.log("Code-Mode RPC guardrail passed: implementation decision is approved.");
  process.exit(0);
}

const existingBlockedPaths = blockedRuntimePaths.filter((relativePath) =>
  fs.existsSync(path.join(repoRoot, relativePath)),
);
if (existingBlockedPaths.length > 0) {
  fail(
    "runtime paths exist while Code-Mode RPC is not approved",
    existingBlockedPaths,
  );
}

const patternHits = [];
for (const root of runtimeSearchRoots) {
  for (const file of walkFiles(path.join(repoRoot, root))) {
    const relative = path.relative(repoRoot, file);
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of blockedRuntimePatterns) {
      if (pattern.test(content)) {
        patternHits.push(`${relative} matches ${pattern}`);
      }
    }
  }
}

if (patternHits.length > 0) {
  fail(
    "runtime Code-Mode RPC markers exist while the decision is not approved",
    patternHits,
  );
}

console.log(
  "Code-Mode RPC guardrail passed: decision is not approved and no runtime implementation markers were found.",
);
