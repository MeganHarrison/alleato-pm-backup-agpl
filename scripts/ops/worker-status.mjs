#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const handoffDir = path.join(repoRoot, "docs/ops/handoffs");
const sessionBoardPath = path.join(repoRoot, "docs/ops/orchestration/session-board.md");
const dateArg = process.argv[2];
const today = dateArg || new Date().toISOString().slice(0, 10);

const requiredSections = [
  { name: "Session ID", patterns: [/Session ID/i] },
  { name: "Task ID", patterns: [/Task ID/i] },
  { name: "Linear issue", patterns: [/Linear issue/i, /AAI-\d+/i] },
  { name: "Linear URL", patterns: [/Linear URL/i, /https:\/\/linear\.app\//i] },
  { name: "Current status", patterns: [/Current status/i] },
  { name: "Files changed", patterns: [/Files changed/i, /Owned paths/i] },
  {
    name: "Commands run and outcome",
    patterns: [/Commands run and outcome/i, /^##+\s*Findings/m],
  },
  { name: "Evidence artifacts", patterns: [/Evidence artifacts/i] },
  {
    name: "Top 3 findings",
    patterns: [/Top 3 findings/i, /Top 3 Frontend Gaps/i],
  },
  { name: "Recommended next action", patterns: [/Recommended next action/i] },
  {
    name: "Handoff file path",
    patterns: [/Handoff file path/i, /\/docs\/ops\/handoffs\//i],
  },
  { name: "Linear Updates", patterns: [/Linear Updates/i] },
];

function getWorkerFile(sessionId) {
  return path.join(handoffDir, `${today}-${sessionId}-workstream.md`);
}

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      missing: requiredSections.map((s) => s.name),
      modified: null,
    };
  }

  const text = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const missing = requiredSections
    .filter((section) => !section.patterns.some((p) => p.test(text)))
    .map((section) => section.name);
  return {
    exists: true,
    missing,
    modified: stat.mtime.toISOString(),
  };
}

function parseSessionBoardSessions() {
  if (!fs.existsSync(sessionBoardPath)) {
    return [];
  }

  const board = fs.readFileSync(sessionBoardPath, "utf8");
  return board
    .split(/\r?\n/)
    .filter((line) => /^\|\s*S[A-Z0-9]+/.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        sessionId: cells[0],
        status: cells[5],
        started: cells[6],
        updated: cells[7],
        ownedPaths: cells[4] || "",
      };
    })
    .filter((session) => session.updated === today || session.started === today);
}

const sessions = parseSessionBoardSessions();
if (sessions.length === 0) {
  console.log(`Worker status for ${today}`);
  console.log(`No active sessions found for ${today}.`);
  process.exit(0);
}

const rows = sessions.map((session) => {
  const handoffMatches = [
    ...session.ownedPaths.matchAll(/docs\/ops\/handoffs\/[^`,\s|]+\.md/g),
  ].map((match) => match[0]);
  const boardHandoff =
    handoffMatches.find((handoff) => handoff.includes(`-${session.sessionId}-`)) ||
    handoffMatches.at(-1);
  const file = boardHandoff
    ? path.join(repoRoot, boardHandoff)
    : getWorkerFile(session.sessionId);
  const info = checkFile(file);
  return {
    sessionId: session.sessionId,
    status: session.status,
    file: path.relative(repoRoot, file),
    exists: info.exists,
    complete: info.exists && info.missing.length === 0,
    missingCount: info.missing.length,
    missing: info.missing.join("; "),
    modified: info.modified || "missing",
  };
});

console.log(`Worker status for ${today}`);
console.log(
  "Session | Status | Exists | Complete | Missing Fields | Last Modified | File"
);
console.log(
  "------- | ------ | ------ | -------- | -------------- | ------------- | ----"
);
for (const row of rows) {
  console.log(
    `${row.sessionId} | ${row.status} | ${row.exists ? "yes" : "no"} | ${
      row.complete ? "yes" : "no"
    } | ${row.missingCount} | ${row.modified} | ${row.file}`
  );
}

const incomplete = rows.filter((r) => !r.complete);
if (incomplete.length > 0) {
  console.log("\nNeeds rework:");
  for (const row of incomplete) {
    console.log(`- ${row.sessionId}: ${row.missing || "file missing"}`);
  }
}
