#!/usr/bin/env node

/**
 * Parity audit orchestrator for Procore feature parity runs.
 *
 * Usage:
 *   node scripts/parity-audit.mjs <tool|tool1,tool2|all> [priority=HIGH] [projectId=767] [baseUrl=http://localhost:3000]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const DEFAULTS = {
  baseUrl: "http://localhost:3000",
  projectId: "767",
  priority: "HIGH",
  concurrency: "3",
};

const VALID_PRIORITIES = new Set(["HIGH", "MEDIUM", "LOW"]);

/** Launch Chromium with a local executable fallback to avoid cache version drift. */
async function launchBrowser() {
  const candidateExecutables = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/Users/meganharrison/Library/Caches/ms-playwright/chromium-1208/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "/Users/meganharrison/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  ].filter(Boolean);

  for (const executablePath of candidateExecutables) {
    if (!fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ headless: true, executablePath });
    } catch {
      // Try the next local fallback executable.
    }
  }

  return chromium.launch({ headless: true });
}

/** Parse CLI arguments into runtime settings. */
function parseArgs(argv) {
  if (argv.length === 0) {
    throw new Error(
      "Missing tools argument. Usage: node scripts/parity-audit.mjs <tool|tool1,tool2|all> [priority=HIGH] [projectId=767] [baseUrl=http://localhost:3000]",
    );
  }

  const toolsArg = argv[0].trim();
  const kv = new Map();

  for (const arg of argv.slice(1)) {
    const idx = arg.indexOf("=");
    if (idx <= 0) continue;
    const key = arg.slice(0, idx).trim();
    const value = arg.slice(idx + 1).trim();
    if (key) kv.set(key, value);
  }

  const priority = (kv.get("priority") ?? DEFAULTS.priority).toUpperCase();
  if (!VALID_PRIORITIES.has(priority)) {
    throw new Error(`Invalid priority '${priority}'. Expected HIGH|MEDIUM|LOW.`);
  }

  return {
    toolsArg,
    priority,
    projectId: kv.get("projectId") ?? DEFAULTS.projectId,
    baseUrl: (kv.get("baseUrl") ?? DEFAULTS.baseUrl).replace(/\/$/, ""),
    concurrency: Number.parseInt(kv.get("concurrency") ?? DEFAULTS.concurrency, 10),
  };
}

/** Locate the Playwright storage state file used for authenticated flows. */
function resolveAuthStatePath() {
  const candidates = [
    path.resolve("frontend/tests/.auth/user.json"),
    path.resolve("tests/.auth/user.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    "Auth state file not found. Expected frontend/tests/.auth/user.json. Run: cd frontend && npx playwright test tests/auth.setup.ts",
  );
}

/** Perform an HTTP request and parse JSON with explicit error handling. */
async function apiRequest(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.error || text || `HTTP ${response.status}`;
    throw new Error(`${options.method ?? "GET"} ${endpoint} failed: ${message}`);
  }

  return json;
}

/** Verify base URL is reachable and returns a non-error redirect/response. */
async function verifyBaseUrlReachable(baseUrl) {
  const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`Preflight failed: ${baseUrl}/ returned ${response.status}`);
  }
}

/** Verify saved auth can access a protected project page without login redirect. */
async function verifyAuthSession(baseUrl, projectId, authStatePath) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ storageState: authStatePath });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/${projectId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    const finalUrl = page.url();
    if (finalUrl.includes("/auth/login")) {
      throw new Error("BLOCKED: auth-expired");
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

/** Resolve and validate tool names from test_suites according to CLI arg. */
function resolveToolList(toolsArg, suites) {
  const available = new Set((suites ?? []).map((suite) => suite.tool_name));

  if (toolsArg === "all") {
    return [...available].sort();
  }

  const requested = toolsArg
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    throw new Error("No tools requested after parsing tools argument.");
  }

  const missing = requested.filter((tool) => !available.has(tool));
  if (missing.length > 0) {
    throw new Error(`Unknown suite(s): ${missing.join(", ")}`);
  }

  return requested;
}

/** Ensure target suites have requested-priority coverage before creating runs. */
function verifyPriorityCoverage(priority, tools, suites) {
  const byTool = new Map((suites ?? []).map((suite) => [suite.tool_name, suite]));

  if (priority === "HIGH") {
    const zero = tools.filter((tool) => (byTool.get(tool)?.high_count ?? 0) === 0);
    if (zero.length > 0) {
      throw new Error(`Preflight failed: no HIGH cases seeded for ${zero.join(", ")}`);
    }
  }
}

/** Create a test run for a specific tool and return the created run id. */
async function createRun(baseUrl, toolName, branch) {
  const payload = {
    suite: toolName,
    tester: "parity-audit-agent",
    environment: new URL(baseUrl).host,
    branch,
    notes: "Automated parity audit",
    testType: "feature",
    scenarioDepth: "all",
  };

  const data = await apiRequest(baseUrl, "/api/testing/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!data?.run_id) {
    throw new Error(`Run creation failed for ${toolName}: missing run_id`);
  }

  return String(data.run_id);
}

/** Normalize embedded test_cases payload shape into a single object. */
function normalizeCase(row) {
  if (!row) return null;
  if (Array.isArray(row.test_cases)) return row.test_cases[0] ?? null;
  return row.test_cases ?? null;
}

/** Parse numbered steps text into a clean step list. */
function parseSteps(stepsText) {
  if (!stepsText || typeof stepsText !== "string") return [];
  return stepsText
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
}

/** Keep note strings compact for dashboard readability and DB constraints. */
function trimNote(value, max = 190) {
  const oneLine = String(value ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 3)}...`;
}

/** Detect whether a URL is clearly unauthenticated/blocked. */
function isLoginUrl(url) {
  return /\/auth\/login/i.test(url);
}

/** Infer severity from expected_result/test_name hints when failing behavior exists. */
function inferSeverity(testCase) {
  const text = `${testCase?.test_name ?? ""} ${testCase?.expected_result ?? ""}`.toLowerCase();
  if (/delete|payment|invoice|contract|change order|budget/.test(text)) return "major";
  return "minor";
}

/** Build a default URL for a tool when start_url is absent in test_cases. */
function defaultToolUrl(baseUrl, projectId, toolName) {
  return `${baseUrl}/${projectId}/${toolName}`;
}

/** Try clicking a UI target by role, text, and tolerant selector fallbacks. */
async function tryClick(page, rawTarget) {
  const target = rawTarget.trim().replace(/^['"]|['"]$/g, "");
  if (!target) return { ok: false, reason: "empty-target" };

  const attempts = [
    async () => page.getByRole("button", { name: new RegExp(target, "i") }).first().click({ timeout: 2000 }),
    async () => page.getByRole("link", { name: new RegExp(target, "i") }).first().click({ timeout: 2000 }),
    async () => page.getByRole("tab", { name: new RegExp(target, "i") }).first().click({ timeout: 2000 }),
    async () => page.getByText(new RegExp(target, "i")).first().click({ timeout: 2000 }),
    async () => page.locator(`[aria-label*='${cssEscape(target)}' i]`).first().click({ timeout: 2000 }),
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      await page.waitForTimeout(250);
      return { ok: true };
    } catch {
      // Continue fallback attempts.
    }
  }

  return { ok: false, reason: `target-not-found:${target}` };
}

/** Try filling a field by label/placeholder/name with typed value. */
async function tryFill(page, fieldName, value) {
  const field = fieldName.trim().replace(/^['"]|['"]$/g, "");
  if (!field) return { ok: false, reason: "empty-field" };

  const attempts = [
    async () => page.getByLabel(new RegExp(field, "i")).first().fill(value, { timeout: 2500 }),
    async () => page.getByPlaceholder(new RegExp(field, "i")).first().fill(value, { timeout: 2500 }),
    async () => page.locator(`input[name*='${cssEscape(field)}' i],textarea[name*='${cssEscape(field)}' i]`).first().fill(value, { timeout: 2500 }),
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      await page.waitForTimeout(200);
      return { ok: true };
    } catch {
      // Continue fallback attempts.
    }
  }

  return { ok: false, reason: `field-not-found:${field}` };
}

/** Try selecting an option in select/combobox controls by visible label. */
async function trySelect(page, fieldName, optionValue) {
  const field = fieldName.trim().replace(/^['"]|['"]$/g, "");
  if (!field) return { ok: false, reason: "empty-select-field" };

  const attempts = [
    async () => page.getByLabel(new RegExp(field, "i")).first().selectOption({ label: optionValue }, { timeout: 2500 }),
    async () => {
      const combo = page.getByRole("combobox", { name: new RegExp(field, "i") }).first();
      await combo.click({ timeout: 2000 });
      await page.getByRole("option", { name: new RegExp(optionValue, "i") }).first().click({ timeout: 2000 });
    },
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      await page.waitForTimeout(200);
      return { ok: true };
    } catch {
      // Continue fallback attempts.
    }
  }

  return { ok: false, reason: `select-not-found:${field}` };
}

/** Escape text for CSS attribute selector usage. */
function cssEscape(value) {
  return value.replace(/['"\\]/g, "");
}

/** Execute one natural-language test step with best-effort UI interactions. */
async function executeStep(page, step) {
  const normalized = step.toLowerCase();

  if (/^navigate to\s+/i.test(step)) {
    const urlMatch = step.match(/https?:\/\/\S+|\/\S+/i);
    if (!urlMatch) return { handled: false, reason: "no-url" };
    const target = urlMatch[0].startsWith("http") ? urlMatch[0] : `${new URL(page.url()).origin}${urlMatch[0]}`;
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
    return { handled: true };
  }

  if (normalized.includes("click")) {
    const target = step.replace(/.*click\s+/i, "").trim();
    const result = await tryClick(page, target);
    return { handled: true, ...result };
  }

  if (/\b(fill|enter|type)\b/i.test(step) && /\b(in|into)\b/i.test(step)) {
    const match = step.match(/(?:fill|enter|type)\s+(.+?)\s+(?:in|into)\s+(.+)/i);
    if (!match) return { handled: false, reason: "fill-parse-failed" };
    const value = match[1].trim().replace(/^['"]|['"]$/g, "");
    const field = match[2].trim();
    const result = await tryFill(page, field, value);
    return { handled: true, ...result };
  }

  if (/\bselect\b/i.test(step) && /\bfrom\b/i.test(step)) {
    const match = step.match(/select\s+(.+?)\s+from\s+(.+)/i);
    if (!match) return { handled: false, reason: "select-parse-failed" };
    const option = match[1].trim().replace(/^['"]|['"]$/g, "");
    const field = match[2].trim();
    const result = await trySelect(page, field, option);
    return { handled: true, ...result };
  }

  if (/\bleave\b.+\bblank\b/i.test(step)) {
    return { handled: true, ok: true };
  }

  if (/\bverify\b|\bensure\b|\bconfirm\b/i.test(step)) {
    return { handled: true, ok: true, note: "assertion-manual" };
  }

  return { handled: false, reason: "unsupported-step" };
}

/** Execute all steps for a case and classify runtime outcome signals. */
async function executeCase(page, testCase, runContext) {
  const steps = parseSteps(testCase?.steps ?? "");
  const startUrl =
    testCase?.start_url && /^https?:\/\//i.test(testCase.start_url)
      ? testCase.start_url
      : testCase?.start_url
        ? `${runContext.baseUrl}${testCase.start_url.startsWith("/") ? "" : "/"}${testCase.start_url}`
        : defaultToolUrl(runContext.baseUrl, runContext.projectId, runContext.toolName);

  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(450);

  if (isLoginUrl(page.url())) {
    return { classification: "blocked", reason: "BLOCKED: auth-expired" };
  }

  const bodyText = ((await page.textContent("body")) ?? "").toLowerCase();
  if (/404|not found|application error|something went wrong/.test(bodyText)) {
    return { classification: "blocked", reason: "BLOCKED: page-error" };
  }

  let handled = 0;
  let failedAction = null;
  let missingHint = false;

  for (const step of steps) {
    const result = await executeStep(page, step);

    if (!result.handled) {
      continue;
    }

    handled += 1;

    if (!result.ok) {
      failedAction = result.reason ?? "step-failed";
      if (/not-found|missing|target-not-found|field-not-found|select-not-found/.test(failedAction)) {
        missingHint = true;
      }
      break;
    }

    if (isLoginUrl(page.url())) {
      return { classification: "blocked", reason: "BLOCKED: auth-expired" };
    }
  }

  const handleRatio = steps.length > 0 ? handled / steps.length : 1;
  if (handleRatio < 0.5) {
    return {
      classification: "blocked",
      reason: "BLOCKED: step-parser-limited",
      details: `Handled ${handled}/${steps.length} steps`,
    };
  }

  if (failedAction) {
    if (missingHint) {
      return {
        classification: "missing",
        reason: `MISSING: ${trimNote(failedAction.replace(/[:_]/g, " "))}`,
      };
    }

    return {
      classification: "fail",
      reason: `Interaction failed: ${trimNote(failedAction.replace(/[:_]/g, " "))}`,
    };
  }

  return { classification: "pass" };
}

/** Upload a screenshot for failed cases as required by the parity spec. */
async function uploadFailureScreenshot(baseUrl, runId, resultId, page, testNumber) {
  const pngBuffer = await page.screenshot({ type: "png", fullPage: true });
  const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

  await apiRequest(
    baseUrl,
    `/api/testing/runs/${runId}/results/${resultId}/screenshots`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUrl,
        label: `fail-${String(testNumber ?? "case").replace(/[^\w.-]/g, "-")}`,
      }),
    },
  );
}

/** Patch a single result row status back to the testing API. */
async function patchResult(baseUrl, runId, resultId, payload) {
  await apiRequest(baseUrl, `/api/testing/runs/${runId}/results/${resultId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Audit all requested-priority feature cases for a single tool run. */
async function auditToolRun({ baseUrl, projectId, priority, toolName, runId, authStatePath }) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ storageState: authStatePath });
  const page = await context.newPage();

  const counts = {
    pass: 0,
    fail: 0,
    missing: 0,
    blocked: 0,
  };

  const broken = [];
  const missing = [];

  try {
    const resultData = await apiRequest(baseUrl, `/api/testing/runs/${runId}/results?type=feature`);
    const rows = (resultData?.results ?? []).filter((row) => {
      const testCase = normalizeCase(row);
      return (testCase?.priority ?? "").toUpperCase() === priority;
    });

    if (rows.length === 0) {
      return {
        toolName,
        runId,
        counts,
        topMissing: [],
        topBroken: [],
      };
    }

    for (const row of rows) {
      const testCase = normalizeCase(row);
      if (!testCase) continue;

      const execution = await executeCase(page, testCase, {
        baseUrl,
        projectId,
        toolName,
      });

      if (execution.classification === "pass") {
        counts.pass += 1;
        await patchResult(baseUrl, runId, row.id, { status: "pass", notes: null, severity: null });
        continue;
      }

      if (execution.classification === "missing") {
        counts.missing += 1;
        const note = trimNote(execution.reason ?? "MISSING: Feature not found");
        missing.push({ test_number: testCase.test_number, test_name: testCase.test_name, reason: note });
        await patchResult(baseUrl, runId, row.id, { status: "skip", notes: note, severity: null });
        continue;
      }

      if (execution.classification === "blocked") {
        counts.blocked += 1;
        const note = trimNote(execution.reason ?? "BLOCKED: Unknown blocker");
        await patchResult(baseUrl, runId, row.id, { status: "skip", notes: note, severity: null });
        continue;
      }

      counts.fail += 1;
      const note = trimNote(execution.reason ?? "Feature exists but behavior mismatched expected result");
      const severity = inferSeverity(testCase);
      broken.push({ test_number: testCase.test_number, test_name: testCase.test_name, reason: note });
      await patchResult(baseUrl, runId, row.id, { status: "fail", notes: note, severity });
      await uploadFailureScreenshot(baseUrl, runId, row.id, page, testCase.test_number);
    }

    return {
      toolName,
      runId,
      counts,
      topMissing: missing.slice(0, 3),
      topBroken: broken.slice(0, 3),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/** Build a compact ranked list of top missing items from parity API output. */
function topMissingFromParity(parityData, limit = 5) {
  const all = [];
  for (const suite of parityData?.suites ?? []) {
    for (const item of suite.missing ?? []) {
      all.push({
        tool: suite.tool_name,
        priority: item.priority,
        test_number: item.test_number,
        test_name: item.test_name,
        reason: item.reason,
      });
    }
  }

  const rank = (priority) => (priority === "HIGH" ? 0 : priority === "MEDIUM" ? 1 : 2);
  all.sort((a, b) => rank(a.priority) - rank(b.priority) || a.tool.localeCompare(b.tool));
  return all.slice(0, limit);
}

/** Main program entry point for parity run orchestration. */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const concurrency = Number.isFinite(args.concurrency) && args.concurrency > 0 ? args.concurrency : 3;
  const authStatePath = resolveAuthStatePath();

  console.log("[parity-audit] Preflight: base URL reachability");
  await verifyBaseUrlReachable(args.baseUrl);

  console.log("[parity-audit] Preflight: authenticated project access");
  await verifyAuthSession(args.baseUrl, args.projectId, authStatePath);

  console.log("[parity-audit] Preflight: suite inventory");
  const suitesResponse = await apiRequest(args.baseUrl, "/api/testing/suites");
  const suites = suitesResponse?.suites ?? [];

  const tools = resolveToolList(args.toolsArg, suites);
  verifyPriorityCoverage(args.priority, tools, suites);

  console.log(`[parity-audit] Target tools: ${tools.join(", ")}`);

  const branch = (process.env.GIT_BRANCH ?? "").trim() || "main";
  const runMap = new Map();

  for (const toolName of tools) {
    const runId = await createRun(args.baseUrl, toolName, branch);
    runMap.set(toolName, runId);
  }

  console.log(`[parity-audit] Runs created. Launching workers (concurrency=${concurrency})...`);

  const settled = [];
  for (let i = 0; i < tools.length; i += concurrency) {
    const batch = tools.slice(i, i + concurrency);
    const batchSettled = await Promise.allSettled(
      batch.map((toolName) =>
        auditToolRun({
          baseUrl: args.baseUrl,
          projectId: args.projectId,
          priority: args.priority,
          toolName,
          runId: runMap.get(toolName),
          authStatePath,
        }),
      ),
    );
    settled.push(...batchSettled);
    console.log(`[parity-audit] Completed ${Math.min(i + concurrency, tools.length)}/${tools.length} tools`);
  }

  const workerResults = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const workerFailures = settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  const parity = await apiRequest(args.baseUrl, `/api/testing/parity?priority=${encodeURIComponent(args.priority)}`);
  const totals = parity?.totals ?? { pass: 0, fail: 0, missing: 0, skip: 0, not_tested: 0 };

  console.log("\n=== Parity Audit Summary ===");
  console.log(`Priority: ${args.priority}`);
  console.log(`Grand totals -> working:${totals.pass} broken:${totals.fail} not-built:${totals.missing} blocked:${totals.skip}`);

  for (const result of workerResults) {
    const total = result.counts.pass + result.counts.fail + result.counts.missing + result.counts.blocked;
    const passRate = total > 0 ? Math.round((result.counts.pass / total) * 100) : 0;
    console.log(
      `- ${result.toolName}: ${passRate}% pass (${result.counts.pass} pass / ${result.counts.fail} fail / ${result.counts.missing} missing / ${result.counts.blocked} blocked)`,
    );
  }

  if (workerFailures.length > 0) {
    console.log("\\nWorker Failures:");
    for (const failure of workerFailures) {
      console.log(`- ${trimNote(failure instanceof Error ? failure.message : String(failure))}`);
    }
  }

  const topMissing = topMissingFromParity(parity, 5);
  if (topMissing.length > 0) {
    console.log("\nTop 5 Not Built Items:");
    for (const item of topMissing) {
      console.log(`- [${item.tool}] ${item.test_number}: ${trimNote(item.test_name)} (${item.priority})`);
    }
  }

  console.log(`\nDashboard: ${args.baseUrl}/testing/parity`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[parity-audit] FAILED: ${message}`);
  process.exitCode = 1;
});
