#!/usr/bin/env node

/**
 * Static readiness gate for the AI Assistant operating model.
 *
 * This is intentionally quick: it verifies that the repo has enforceable
 * checks for strategy, safe actions, task management, and source/RAG freshness.
 * Live model quality still belongs to `rag:verify:eval-suite` and
 * `rag:verify:assistant-routing`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readFirstExistingJson(relativePaths, label) {
  const existingPath = relativePaths.find((relativePath) =>
    fs.existsSync(path.join(repoRoot, relativePath)),
  );
  if (!existingPath) {
    throw new Error(
      `${label} not found. Checked: ${relativePaths.join(", ")}`,
    );
  }
  return {
    path: existingPath,
    json: JSON.parse(read(existingPath)),
  };
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const failures = [];
const warnings = [];
const evidence = [];

function pass(message) {
  evidence.push({ status: "pass", message });
}

function warn(message) {
  warnings.push(message);
  evidence.push({ status: "warn", message });
}

function fail(message) {
  failures.push(message);
  evidence.push({ status: "fail", message });
}

function requireCondition(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

const packageJson = readJson("package.json");
const scripts = packageJson.scripts ?? {};
const evalSuiteSource = readFirstExistingJson(
  ["docs/ai-plan/evals/assistant-eval-suite.json"],
  "assistant eval suite",
);
const evalSuite = evalSuiteSource.json;
const evalRunner = read("scripts/verify/verify_ai_assistant_eval_suite.mjs");
const chatHandler = read("frontend/src/app/api/ai-assistant/chat/handler-v2.ts");
const actionTools = read("frontend/src/lib/ai/tools/action-tools.ts");
const sourceHealth = read("frontend/src/lib/ai/source-health.ts");
const integrationHealth = read("scripts/verify/verify_integration_health.py");

const requiredScripts = [
  "rag:verify:assistant-routing",
  "rag:verify:eval-suite",
  "rag:verify:inbox-evals",
  "rag:verify:source-sync-evals",
  "rag:verify:task-action-evals",
  "rag:verify:deep-agents-executive-evals",
  "rag:verify:app-expert-evals",
  "rag:verify:app-expert-smoke",
  "rag:verify:project-intelligence-live-paths",
  "rag:verify:chunk-integrity",
  "rag:verify:repaired-meeting-retrieval",
  "rag:verify:meetings",
  "rag:verify:task-integrity",
  "rag:verify:assistant-operational-readiness",
];

pass(`assistant eval suite loaded from ${evalSuiteSource.path}`);

for (const scriptName of requiredScripts) {
  requireCondition(Boolean(scripts[scriptName]), `package script exists: ${scriptName}`);
}

const requiredEvalCases = [
  "owner-strategy-ulta-action-plan",
  "action-task-preview-no-write",
  "task-register-source-grounded",
  "tasks-list-of-action-items-canonical",
  "tasks-whats-on-my-list",
  "realworld-most-important-tasks",
  "source-freshness-rag-health",
  "realworld-teams-source-freshness",
  "realworld-teams-this-week-signal",
];

for (const bundleName of [
  "inbox-outlook-regression",
  "source-sync-teams-regression",
  "task-action-items-regression",
  "deep-agents-executive-regression",
]) {
  const bundle = evalSuite.evalBundles?.[bundleName];
  requireCondition(Boolean(bundle), `eval bundle exists: ${bundleName}`);
  requireCondition(Boolean(bundle?.filter), `${bundleName} has a runnable filter`);
  requireCondition(
    Array.isArray(bundle?.criteria) && bundle.criteria.length > 0,
    `${bundleName} has explicit agentic-eval criteria`,
  );
}

const casesById = new Map((evalSuite.cases ?? []).map((testCase) => [testCase.id, testCase]));
for (const caseId of requiredEvalCases) {
  const testCase = casesById.get(caseId);
  requireCondition(Boolean(testCase), `eval case exists: ${caseId}`);
  if (!testCase) continue;

  requireCondition(
    Array.isArray(testCase.mustExclude) && testCase.mustExclude.length > 0,
    `${caseId} fails bad answer patterns explicitly`,
  );
  requireCondition(
    Array.isArray(testCase.requiredMetadataPaths) && testCase.requiredMetadataPaths.length > 0,
    `${caseId} requires persisted metadata evidence`,
  );
  requireCondition(
    Array.isArray(testCase.expectedAllToolNames) ||
      Array.isArray(testCase.expectedToolNames) ||
      Array.isArray(testCase.expectedToolFamilies),
    `${caseId} has a tool or source expectation`,
  );
}

for (const field of [
  "expectedAllToolNames",
  "forbiddenToolNames",
  "requiredMetadataPaths",
  "minResponseQualityScore",
  "minSourceQuality",
  "minConfidence",
  "requiredRecentEmailSource",
  "requiredRecentEmailMailbox",
]) {
  requireCondition(evalRunner.includes(field), `eval runner enforces ${field}`);
}

requireCondition(
  chatHandler.includes("planRetrieval") && chatHandler.includes("retrieval_plan"),
  "chat backend records intent planning before routing",
);
requireCondition(
  chatHandler.includes("response_quality") && chatHandler.includes("scoreResponseQuality"),
  "chat backend persists response quality scoring",
);
requireCondition(
  chatHandler.includes("provider_path") && chatHandler.includes("getLanguageModel"),
  "chat backend persists provider/model path",
);
requireCondition(
  chatHandler.includes("tool_trace") && chatHandler.includes("toolName"),
  "chat backend records normalized tool traces",
);
requireCondition(
  chatHandler.includes("fetchDeepAgentExecutiveBriefing") &&
    chatHandler.includes("backendDeepAgentExecutiveBriefing"),
  "chat backend attaches canonical backend Deep Agents executive trace",
);
requireCondition(
  chatHandler.includes("getGeneratedTasksToday") || chatHandler.includes("createStrategistTools"),
  "chat backend has source-backed task/tool routing",
);
requireCondition(
  actionTools.includes("createTask") &&
    actionTools.includes("confirmed") &&
    actionTools.includes("schedule_tasks"),
  "chat backend exposes task action tooling",
);
requireCondition(
  sourceHealth.includes("source_sync_health_snapshots") &&
    sourceHealth.includes("unembedded_count") &&
    sourceHealth.includes("uncompiled_count"),
  "source health checks sync, embedding, and compilation freshness",
);
requireCondition(
  integrationHealth.includes("source_sync_health_snapshots") &&
    integrationHealth.includes("AI ASSISTANT SOURCE HEALTH"),
  "integration health gate includes AI assistant source snapshots",
);

const sourceHealthCase = casesById.get("source-freshness-rag-health");
if (sourceHealthCase && !sourceHealthCase.mustInclude?.includes("packet")) {
  warn("source-freshness-rag-health should keep packet freshness visible in the answer contract");
}

const summary = {
  status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
  generatedAt: new Date().toISOString(),
  totals: {
    checks: evidence.length,
    passed: evidence.filter((item) => item.status === "pass").length,
    warnings: warnings.length,
    failures: failures.length,
  },
  failures,
  warnings,
  evidence,
  nextLiveChecks: [
    "npm run rag:verify:assistant-routing",
    "npm run rag:verify:inbox-evals:prod",
    "npm run rag:verify:source-sync-evals:prod",
    "npm run rag:verify:task-action-evals:prod",
    "npm run rag:verify:deep-agents-executive-evals:prod",
    "npm run rag:verify:app-expert-smoke:prod",
    "npm run rag:verify:app-expert-evals:prod",
    "npm run rag:verify:eval-suite -- --filter \"owner-strategy|action-task|task-register|source-freshness\"",
    "python3 scripts/verify/verify_integration_health.py --skip-env",
    "npm run rag:verify:project-intelligence-live-paths",
    "npm run rag:verify:chunk-integrity -- --days=1",
    "npm run rag:verify:repaired-meeting-retrieval",
  ],
};

if (summary.status === "fail") {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(summary, null, 2));
