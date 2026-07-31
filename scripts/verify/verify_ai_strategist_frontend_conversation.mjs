#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const frontendRoot = path.join(repoRoot, "frontend");
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(
  frontendRoot,
  "tests",
  "agent-browser-runs",
  `${runStamp}-ai-strategist-conversation-regression`,
);

const session = `ai-strategist-regression-${Date.now()}`;
const authState = path.join(frontendRoot, "tests", ".auth", "user.json");
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || "http://localhost:3000";

mkdirSync(runDir, { recursive: true });

const env = {
  ...process.env,
  AGENT_BROWSER_STATE: authState,
  AGENT_BROWSER_SESSION: session,
  AGENT_BROWSER_DEFAULT_TIMEOUT: process.env.AGENT_BROWSER_DEFAULT_TIMEOUT || "45000",
};

async function agentBrowser(args, options = {}) {
  const { stdout, stderr } = await execFileAsync("agent-browser", args, {
    cwd: repoRoot,
    env,
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  return `${stdout ?? ""}${stderr ?? ""}`;
}

function latestExcerpt(text, prompt, fallbackChars = 9000) {
  const index = text.lastIndexOf(prompt);
  if (index >= 0) return text.slice(index, index + fallbackChars);
  return text.slice(-fallbackChars);
}

function assertIncludes(excerpt, values, label) {
  const missing = values.filter(
    (value) => !excerpt.toLowerCase().includes(value.toLowerCase()),
  );
  if (missing.length > 0) {
    throw new Error(`${label} missing expected text: ${missing.join(", ")}`);
  }
}

function assertExcludes(excerpt, values, label) {
  const present = values.filter(
    (value) => excerpt.toLowerCase().includes(value.toLowerCase()),
  );
  if (present.length > 0) {
    throw new Error(`${label} included forbidden text: ${present.join(", ")}`);
  }
}

async function pageText() {
  return agentBrowser(["get", "text", "body"]);
}

async function waitForPromptResult({ name, prompt, mustInclude, mustExclude = [] }) {
  const deadline = Date.now() + 100_000;
  let lastExcerpt = "";
  let lastError = null;

  while (Date.now() < deadline) {
    const text = await pageText();
    const excerpt = latestExcerpt(text, prompt);
    lastExcerpt = excerpt;
    try {
      assertIncludes(excerpt, mustInclude, name);
      assertExcludes(excerpt, mustExclude, name);
      return excerpt;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
  }

  writeFileSync(path.join(runDir, `${name}-last-excerpt.txt`), lastExcerpt);
  throw lastError ?? new Error(`${name} did not complete before timeout`);
}

async function submitPrompt({ name, prompt, mustInclude, mustExclude }) {
  await agentBrowser(["wait", "textarea[placeholder*='How can I help']"]);
  await agentBrowser(["fill", "textarea[placeholder*='How can I help']", prompt]);
  await agentBrowser(["focus", "textarea[placeholder*='How can I help']"]);
  await agentBrowser(["press", "Enter"]);
  const excerpt = await waitForPromptResult({
    name,
    prompt,
    mustInclude,
    mustExclude,
  });
  writeFileSync(path.join(runDir, `${name}.txt`), excerpt);
  await agentBrowser([
    "screenshot",
    path.join(runDir, `${name}.png`),
    "--full",
  ]);
  return excerpt;
}

async function main() {
  const results = [];
  let recordingStarted = false;

  try {
    await agentBrowser(["open", `${baseUrl}/ai-assistant`, "--headed"]);
    await agentBrowser(["wait", "textarea[placeholder*='How can I help']"]);
    await agentBrowser(["record", "start", path.join(runDir, "session.webm")])
      .then(() => {
        recordingStarted = true;
      })
      .catch((error) => {
        console.warn(
          `[ai-strategist-regression] video recording skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    await agentBrowser(["screenshot", path.join(runDir, "01-start.png"), "--full"]);

    const briefingPrompt =
      "Give me a CEO-ready update on Vermillion Rise. Start with hard facts: budget, RFIs, change orders, schedule, recent source checks, risks, and one recommended next step.";
    const actionPrompt =
      "Based on that briefing, give me only the three highest-leverage PM actions for today. Use owner, action, due date, why it matters. Do not repeat the full briefing.";
    const sourceQualityPrompt =
      "What is the weakest source or least trustworthy signal in that answer, and what would you verify before telling the owner?";

    results.push({
      name: "briefing",
      excerpt: await submitPrompt({
        name: "02-briefing",
        prompt: briefingPrompt,
        mustInclude: [
          "Hard Facts",
          "Vermillion Rise Warehouse",
          "Sources Checked",
          "Recent Communication Signals",
          "Next Step",
          "Trace (",
        ],
      }),
    });

    results.push({
      name: "actions",
      excerpt: await submitPrompt({
        name: "03-actions",
        prompt: actionPrompt,
        mustInclude: [
          "Highest-Leverage PM Actions",
          "Vermillion Rise Warehouse",
          "Owner:",
          "Action:",
          "Due:",
          "Why it matters:",
          "Next Step",
          "Confidence: high/Sources: high",
          "Trace (",
        ],
        mustExclude: ["Hard Facts"],
      }),
    });

    results.push({
      name: "source-quality",
      excerpt: await submitPrompt({
        name: "04-source-quality",
        prompt: sourceQualityPrompt,
        mustInclude: [
          "Weakest Signal",
          "Vermillion Rise Warehouse",
          "What I Would Verify",
          "Recommendation",
          "Next Step",
          "Confidence: high/Sources: high",
          "Trace (",
        ],
        mustExclude: [
          "Hard Facts",
          "No Teams messages found for \"",
          "Vermillion Rise Warehouse - What is",
        ],
      }),
    });

    const artifacts = [
      ...(recordingStarted ? ["- session.webm"] : ["- session.webm skipped"]),
      "- 02-briefing.png / 02-briefing.txt",
      "- 03-actions.png / 03-actions.txt",
      "- 04-source-quality.png / 04-source-quality.txt",
    ];

    writeFileSync(
      path.join(runDir, "VERIFICATION_SUMMARY.md"),
      [
        "# AI Strategist Frontend Conversation Regression",
        "",
        `Route: ${baseUrl}/ai-assistant`,
        `Session: ${session}`,
        "Status: pass",
        "",
        "Prompts:",
        "- briefing: passed",
        "- actions: passed",
        "- source-quality: passed",
        "",
        "Artifacts:",
        ...artifacts,
        "",
      ].join("\n"),
    );

    console.log(
      JSON.stringify(
        {
          status: "pass",
          runDir: path.relative(repoRoot, runDir),
          prompts: results.map((result) => result.name),
        },
        null,
        2,
      ),
    );
  } finally {
    if (recordingStarted) {
      await agentBrowser(["record", "stop", path.join(runDir, "session.webm")]).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: "fail",
        runDir: path.relative(repoRoot, runDir),
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
