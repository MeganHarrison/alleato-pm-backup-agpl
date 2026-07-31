#!/usr/bin/env node

/**
 * App Expert Eval Suite Runner
 * ----------------------------
 * Runs docs/ai-plan/evals/app-expert-eval-suite.json directly against the
 * backend read-only App Expert endpoint. This is intentionally separate from
 * the production chat eval runner so the specialist can be evaluated before it
 * is promoted into the full assistant orchestration loop.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const SUITE_PATH = path.join(
  repoRoot,
  "docs/ai-plan/evals/app-expert-eval-suite.json",
);
const BACKEND_URL = (
  process.env.APP_EXPERT_EVAL_BACKEND_URL ||
  process.env.PYTHON_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/u, "");
const ENDPOINT = `${BACKEND_URL}/api/intelligence/app-expert`;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY?.trim();
const CASE_TIMEOUT_MS = Number(process.env.APP_EXPERT_EVAL_CASE_TIMEOUT_MS ?? 120_000);

const args = process.argv.slice(2);
function flagValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const onlyCase = flagValue("--case");
const filterPattern = flagValue("--filter");

if (!ADMIN_API_KEY) {
  console.error("ADMIN_API_KEY is required to call the backend App Expert endpoint.");
  process.exit(1);
}

function assertFiniteTimeout(value) {
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`Invalid APP_EXPERT_EVAL_CASE_TIMEOUT_MS: ${value}`);
    process.exit(1);
  }
}

assertFiniteTimeout(CASE_TIMEOUT_MS);

function nowRunId() {
  return new Date().toISOString().replace(/[:.]/gu, "-");
}

async function postCase(testCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CASE_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-admin-api-key": ADMIN_API_KEY,
      },
      body: JSON.stringify({
        userId: "app-expert-eval",
        sessionId: `app-expert-eval-${testCase.id}`,
        question: testCase.question,
        currentRoute: testCase.currentRoute,
        projectId: testCase.projectId,
      }),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let json = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      json = { raw: bodyText };
    }

    return {
      id: testCase.id,
      status: response.ok ? "passed" : "failed",
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      question: testCase.question,
      expected: testCase.expected,
      mustInclude: testCase.mustInclude,
      mustExclude: testCase.mustExclude,
      preferredTools: testCase.preferredTools,
      response: json,
      failure: response.ok ? null : bodyText.slice(0, 1000),
    };
  } catch (error) {
    return {
      id: testCase.id,
      status: "failed",
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      question: testCase.question,
      expected: testCase.expected,
      mustInclude: testCase.mustInclude,
      mustExclude: testCase.mustExclude,
      preferredTools: testCase.preferredTools,
      response: null,
      failure: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function scoreShape(result) {
  const response = result.response;
  const answer = typeof response?.answer === "string" ? response.answer.trim() : "";
  const sources = Array.isArray(response?.sources) ? response.sources : [];
  const toolTrace = Array.isArray(response?.toolTrace) ? response.toolTrace : [];
  const shapeIssues = [];
  const semanticIssues = [];

  if (!answer) shapeIssues.push("missing answer");
  if (sources.length === 0) shapeIssues.push("missing sources");
  if (toolTrace.length === 0) shapeIssues.push("missing toolTrace");
  if (response?.mode !== "deep_agents" && response?.mode !== "unavailable") {
    shapeIssues.push("invalid mode");
  }

  const observedText = [
    answer,
    JSON.stringify(sources),
    JSON.stringify(toolTrace),
  ].join("\n").toLowerCase();
  const mustInclude = result.expected?.mustInclude ?? result.mustInclude ?? [];
  const mustExclude = result.expected?.mustExclude ?? result.mustExclude ?? [];
  const preferredTools = result.expected?.preferredTools ?? result.preferredTools ?? [];

  for (const expected of mustInclude) {
    if (!observedText.includes(String(expected).toLowerCase())) {
      semanticIssues.push(`missing required text: ${expected}`);
    }
  }
  for (const excluded of mustExclude) {
    if (observedText.includes(String(excluded).toLowerCase())) {
      semanticIssues.push(`included forbidden text: ${excluded}`);
    }
  }
  if (
    /\b(required generated artifacts are missing|artifact status:\s*missing|APP_EXPERT_ARTIFACT_MISSING)\b/iu.test(
      observedText,
    )
  ) {
    semanticIssues.push("reported missing generated artifacts");
  }
  const missingPreferredTools = preferredTools.filter(
    (toolName) => !observedText.includes(String(toolName).toLowerCase()),
  );

  return {
    ...result,
    status:
      result.status === "passed" &&
      shapeIssues.length === 0 &&
      semanticIssues.length === 0
        ? "passed"
        : "failed",
    shapeIssues,
    semanticIssues,
    missingPreferredTools,
  };
}

async function main() {
  const suite = JSON.parse(await fs.readFile(SUITE_PATH, "utf8"));
  const allCases = suite.cases ?? [];
  const effectiveFilter = filterPattern ? new RegExp(filterPattern) : null;
  const cases = allCases.filter((testCase) => {
    if (onlyCase && testCase.id !== onlyCase) return false;
    if (effectiveFilter && !effectiveFilter.test(testCase.id)) return false;
    return true;
  });

  if (cases.length === 0) {
    console.error("No App Expert eval cases matched.");
    process.exit(1);
  }

  const runDir = path.join(
    repoRoot,
    "docs/ai-plan/evals/runs",
    `${nowRunId()}-app-expert`,
  );
  await fs.mkdir(runDir, { recursive: true });

  const results = [];
  for (const testCase of cases) {
    process.stdout.write(`[app-expert] ${testCase.id} ... `);
    const result = scoreShape(await postCase(testCase));
    results.push(result);
    process.stdout.write(`${result.status} (${result.durationMs}ms)\n`);
    await fs.writeFile(
      path.join(runDir, `${testCase.id}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
  }

  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.length - passed;
  const summary = {
    suite: suite.name ?? "app-expert-eval-suite",
    endpoint: ENDPOINT,
    total: results.length,
    passed,
    failed,
    results,
  };

  await fs.writeFile(
    path.join(runDir, "results.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  const failedLines = results
    .filter((result) => result.status !== "passed")
    .map((result) => {
      const issue =
        [...(result.shapeIssues ?? []), ...(result.semanticIssues ?? [])].join("; ") ||
        result.failure ||
        `HTTP ${result.httpStatus}`;
      return `- ${result.id}: ${issue}`;
    });
  const preferredToolGapLines = results
    .filter((result) => (result.missingPreferredTools ?? []).length > 0)
    .map((result) => `- ${result.id}: ${result.missingPreferredTools.join(", ")}`);
  const summaryMd = [
    "# App Expert Eval Run",
    "",
    `Endpoint: ${ENDPOINT}`,
    `Cases: ${results.length}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    "",
    failedLines.length > 0 ? "## Failures" : "## Failures",
    failedLines.length > 0 ? failedLines.join("\n") : "- None",
    "",
    "## Preferred Tool Trace Gaps",
    preferredToolGapLines.length > 0 ? preferredToolGapLines.join("\n") : "- None",
    "",
  ].join("\n");

  await fs.writeFile(path.join(runDir, "summary.md"), summaryMd, "utf8");

  console.log(`Summary: ${path.relative(repoRoot, path.join(runDir, "summary.md"))}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
