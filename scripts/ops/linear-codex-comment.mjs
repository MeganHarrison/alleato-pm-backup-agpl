#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const filteredArgs = args.filter((arg) => arg !== "--check");
const handoffArg = filteredArgs[0];

if (!handoffArg) {
  console.error(
    "Usage: node scripts/ops/linear-codex-comment.mjs [--check] docs/ops/handoffs/<file>.md"
  );
  process.exit(2);
}

const repoRoot = process.cwd();
const handoffPath = path.resolve(repoRoot, handoffArg);

if (!fs.existsSync(handoffPath)) {
  console.error(`Handoff not found: ${handoffPath}`);
  process.exit(2);
}

const text = fs.readFileSync(handoffPath, "utf8");
const relativeHandoff = path.relative(repoRoot, handoffPath);

function getIntakeValue(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*\\d+\\)\\s*${escaped}:\\s*(.+?)\\s*$`, "im");
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

function getSection(title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^##\\s+${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+|$)`,
    "im"
  );
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

function normalizeList(value) {
  if (!value) return "- Not recorded";
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "- Not recorded";
  if (lines.length === 1) return `- ${lines[0].replace(/^[-*]\s*/, "")}`;
  return lines.map((line) => `- ${line.replace(/^[-*]\s*/, "")}`).join("\n");
}

const sessionId = getIntakeValue("Session ID");
const taskId = getIntakeValue("Task ID");
const linearIssue = getIntakeValue("Linear issue");
const linearUrl = getIntakeValue("Linear URL");
const status = getIntakeValue("Current status");
const filesChanged = getIntakeValue("Files changed (absolute paths)");
const commands = getIntakeValue("Commands run and outcome (pass/fail counts)");
const evidence = getIntakeValue("Evidence artifacts (screenshot/video/report/log paths)");
const findings = getIntakeValue("Top 3 findings (frontend-visible issues first)");
const nextAction = getIntakeValue("Recommended next action (one line)");
const handoffFilePath = getIntakeValue("Handoff file path");
const migrationLedgerEvidence = getIntakeValue("Migration ledger evidence");

const linearUpdates = getSection("Linear Updates");
const currentStatus = getSection("Current Status");
const knownPitfalls = getSection("Known Pitfalls");

const failures = [];
const migrationTouched = /supabase\/migrations\/\d{14}_[^\s;,)]+\.sql/.test(text);
if (!sessionId) failures.push("Missing Session ID");
if (!taskId) failures.push("Missing Task ID");
if (!/^AAI-\d+$/i.test(linearIssue)) {
  failures.push("Missing Linear issue in AAI-### format");
}
if (!/^https:\/\/linear\.app\//i.test(linearUrl)) {
  failures.push("Missing Linear URL");
}
if (!status) failures.push("Missing Current status");
if (!filesChanged) failures.push("Missing files changed");
if (!commands) failures.push("Missing commands run and outcome");
if (!evidence) failures.push("Missing evidence artifacts");
if (!nextAction) failures.push("Missing recommended next action");
if (!handoffFilePath && !relativeHandoff) failures.push("Missing handoff file path");
if (migrationTouched && !migrationLedgerEvidence) {
  failures.push("Missing migration ledger evidence for touched Supabase migration");
}
if (!linearUpdates || /Kickoff comment:\s*$/im.test(linearUpdates)) {
  failures.push("Missing Linear update evidence");
}

if (failures.length > 0) {
  console.error("Linear Codex handoff check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (checkOnly) {
  console.log(`Linear Codex handoff check passed: ${relativeHandoff}`);
  process.exit(0);
}

const body = [
  "## Codex Update",
  "",
  `Status: ${status}`,
  `Session: ${sessionId}`,
  `Task: ${linearIssue}`,
  `Handoff: ${handoffFilePath || relativeHandoff}`,
  "",
  "What changed:",
  normalizeList(currentStatus || findings),
  "",
  "Evidence:",
  normalizeList(evidence),
  "",
  "Commands:",
  normalizeList(commands),
  "",
  "Migration ledger evidence:",
  normalizeList(migrationLedgerEvidence || (migrationTouched ? "" : "Not applicable")),
  "",
  "Risks / blockers:",
  normalizeList(knownPitfalls),
  "",
  "Next action:",
  normalizeList(nextAction),
].join("\n");

console.log(body);
