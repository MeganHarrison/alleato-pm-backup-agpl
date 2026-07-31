#!/usr/bin/env node
// Self-improving CLAUDE.md reflection hook (Stop hook).
//
// Ported from the "AI Layer" reference implementation
// (coleam00/helpline, .claude/hooks/reflect_claude_md.py) and adapted to this
// repo: Node instead of Python, and it audits BOTH ./CLAUDE.md and the
// .claude/rules/*.md gate files against the session's uncommitted changes.
//
// While the session context is still fresh, it diffs what changed, asks a
// headless `claude -p` whether the governing conventions still hold, and writes
// findings to .claude/claude-md-review.md. If the CLI is unavailable it falls
// back to a deterministic "re-check these files" note so drift is still flagged.
//
// Fires on Stop. Spawned detached by .claude/settings.json so session end is
// never blocked. A recursion lock (ALLEATO_REFLECT_LOCK) makes the nested
// headless Claude — and the SessionStart/SessionEnd hooks it would otherwise
// trigger — no-op, so there is no infinite loop.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REFLECT_LOCK = "ALLEATO_REFLECT_LOCK";
const MAX_DIFF_CHARS = 12_000;
const MAX_CLAUDE_MD_CHARS = 24_000;
const CLAUDE_TIMEOUT_MS = 120_000;

// Recursion guard — the nested `claude -p` we spawn would otherwise re-trigger
// this same Stop hook. Bail immediately when the lock is set.
if (process.env[REFLECT_LOCK] === "1") {
  process.exit(0);
}

const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const reviewPath = join(repoRoot, ".claude", "claude-md-review.md");

/** Map a changed path to the gate rules most likely to govern it. */
function relevantGates(file) {
  const gates = new Set();
  const f = file.toLowerCase();
  if (/\/page\.tsx$/.test(f) || f.includes("frontend/src/app/")) {
    gates.add("PAGE-LAYOUT-GATE.md");
    gates.add("DESIGN-SYSTEM-GATE.md");
  }
  if (f.includes("table")) gates.add("TABLE-PAGE-GATE.md");
  if (f.includes("[") && f.includes("]/")) gates.add("DETAIL-PAGE-GATE.md");
  if (f.includes("form")) gates.add("FORM-FK-VALIDATION-GATE.md");
  if (
    f.includes("supabase/migrations") ||
    f.includes("frontend/src/lib/ai/") ||
    f.includes("backend/src/services/pipeline") ||
    f.includes("alleato-ai/")
  ) {
    gates.add("RAG-DOCS-GATE.md");
  }
  if (f.includes("/api/")) gates.add("REUSE-FIRST-GATE.md");
  if (/^[^/]+\.(md|js|ts|py|sh|html)$/.test(file)) gates.add("FILE-ORGANIZATION-GATE.md");
  return [...gates];
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return "";
  }
}

function readCapped(absPath, cap) {
  if (!existsSync(absPath)) return "";
  const text = readFileSync(absPath, "utf8");
  return text.length > cap ? `${text.slice(0, cap)}\n... (truncated for the reflection)` : text;
}

// 1. What changed this session (tracked + untracked).
const porcelain = git(["status", "--porcelain"]).trim();
if (!porcelain) {
  process.exit(0); // Nothing changed — nothing to reflect on.
}

const changedFiles = [];
const untrackedFiles = [];
for (const line of porcelain.split("\n")) {
  const status = line.slice(0, 2);
  const file = line.slice(3).trim();
  if (!file) continue;
  if (status.includes("?")) untrackedFiles.push(file);
  else changedFiles.push(file);
}

// 2. Diff scoped to touched, tracked files, capped.
let diff = changedFiles.length ? git(["diff", "HEAD", "--", ...changedFiles]) : "";
if (diff.length > MAX_DIFF_CHARS) {
  diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n... (diff truncated for the reflection)`;
}

// 3. Governing conventions: repo CLAUDE.md + a compact index of the gate rules.
const claudeMd = readCapped(join(repoRoot, "CLAUDE.md"), MAX_CLAUDE_MD_CHARS);
const rulesDir = join(repoRoot, ".claude", "rules");
let gateIndex = "";
try {
  const gateFiles = execFileSync("ls", ["-1", rulesDir], { encoding: "utf8" })
    .split("\n")
    .filter((n) => n.endsWith(".md") || n.endsWith(".mdc"));
  gateIndex = gateFiles
    .map((name) => {
      const first = readCapped(join(rulesDir, name), 400)
        .split("\n")
        .find((l) => l.startsWith("**Trigger:") || l.startsWith("# ") || l.trim().length > 0);
      return `- ${name}: ${first ? first.replace(/^#\s*/, "").trim() : ""}`;
    })
    .join("\n");
} catch {
  gateIndex = "(rules directory unavailable)";
}

const allChanged = [...changedFiles, ...untrackedFiles];
const gateHints = [...new Set(allChanged.flatMap(relevantGates))];

const prompt = `You are auditing whether this codebase's CLAUDE.md and .claude/rules gate files still match reality after a coding session. Report drift only — do not restate the diff.

## Files changed this session
${allChanged.map((f) => `- ${f}`).join("\n") || "(none)"}

## Diff (may be truncated)
\`\`\`diff
${diff || "(no tracked diff; changes may be untracked files)"}
\`\`\`

## Governing conventions — CLAUDE.md (may be truncated)
${claudeMd || "(CLAUDE.md not found)"}

## Gate rules index (.claude/rules)
${gateIndex}

## Your task
For each governing convention that the diff appears to VIOLATE, or that appears OUTDATED or MISSING given these changes, output one markdown bullet:
- \`path:line\` — <what drifted, one clause> — <concrete proposed edit to CLAUDE.md or the specific gate file>
If a governing file is fully consistent with the changes, do not mention it. If nothing drifted at all, output exactly: "No change needed."
Be concise and actionable. Only flag real drift.`;

function writeReview(body) {
  const header = `# CLAUDE.md review — ${new Date().toISOString()}`;
  const changedBlock = `\n\n## Files changed this session\n${allChanged.map((f) => `- ${f}`).join("\n") || "- (none)"}\n`;
  writeFileSync(reviewPath, `${header}${changedBlock}\n${body}\n`, "utf8");
}

// 4. Ask headless Claude to reflect; fall back deterministically on failure.
try {
  const out = execFileSync("claude", ["-p", "--model", "sonnet"], {
    cwd: repoRoot,
    input: prompt,
    encoding: "utf8",
    timeout: CLAUDE_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, [REFLECT_LOCK]: "1" },
  });
  writeReview(out.trim() || "No change needed.");
} catch (err) {
  const hints = gateHints.length
    ? `\nLikely-relevant gates to re-check manually:\n${gateHints.map((g) => `- .claude/rules/${g}`).join("\n")}`
    : "";
  writeReview(
    `> Automated reflection unavailable (${(err && err.message) || "claude CLI error"}).\n> Deterministic fallback — review the changed files against the governing conventions manually.${hints}`,
  );
}

process.exit(0);
