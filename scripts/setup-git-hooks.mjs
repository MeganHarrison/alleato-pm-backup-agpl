#!/usr/bin/env node
/**
 * Activate and verify this repo's git hooks.
 *
 * WHY THIS EXISTS (2026-07-23 incident):
 * `core.hooksPath` was set to `.husky/_` — a directory that did not exist, because
 * `husky` was never installed as a dependency. Git silently finds no hooks at a
 * missing hooksPath and runs NOTHING. Every documented guardrail in this repo
 * (root-file guard, lint-staged design-system rules, route checks, RAG docs gate,
 * phantom-table check, commit-author gate, branch-push policy) was dead locally
 * for an unknown period, with zero warning. The visible damage: 25 commits landed
 * directly on `main` — which the workflow forbids — and never reached origin,
 * while the same work merged upstream via PRs, leaving local `main` diverged.
 *
 * Silent no-op guardrails are worse than no guardrails: they create false confidence.
 * This script makes hook activation explicit, idempotent, and verifiable.
 *
 * Usage:
 *   node scripts/setup-git-hooks.mjs          # activate (idempotent) — wired to npm `prepare`
 *   node scripts/setup-git-hooks.mjs --check  # verify only; exit 1 if hooks are NOT live
 */
import { execFileSync } from "node:child_process";
import { existsSync, chmodSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHECK_ONLY = process.argv.includes("--check");

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// Hook files that must be executable and present for the repo's gates to work.
const REQUIRED_HOOKS = ["pre-commit", "commit-msg", "pre-push"];

function fail(msg) {
  console.error(`\n❌ git hooks are NOT active — repo guardrails are silently disabled.\n${msg}`);
  console.error(`\nFix: npm run hooks:install\n`);
  process.exit(1);
}

let repoRoot;
try {
  repoRoot = git("rev-parse", "--show-toplevel");
} catch {
  console.log("Not a git repository — skipping hook setup.");
  process.exit(0);
}

// In a linked worktree, --show-toplevel is the worktree; hooksPath is shared repo config.
const hooksDir = join(repoRoot, ".husky");

if (!existsSync(hooksDir)) {
  if (CHECK_ONLY) fail(`Expected hooks directory is missing: ${hooksDir}`);
  console.log(`No .husky directory at ${hooksDir} — nothing to activate.`);
  process.exit(0);
}

let configured = "";
try {
  configured = git("config", "--get", "core.hooksPath");
} catch {
  configured = "";
}

// Resolve what git would actually use, and whether it exists.
const resolved = configured
  ? configured.startsWith("/")
    ? configured
    : join(repoRoot, configured)
  : join(repoRoot, ".git", "hooks");
const hooksLive = existsSync(resolved) && existsSync(join(resolved, "pre-commit"));

if (CHECK_ONLY) {
  if (!configured) {
    fail(`core.hooksPath is unset, so git uses .git/hooks — which does not contain this repo's .husky hooks.`);
  }
  if (!hooksLive) {
    fail(
      `core.hooksPath = "${configured}"\n` +
        `  resolves to: ${resolved}\n` +
        `  exists: ${existsSync(resolved)}\n` +
        `  This is exactly the 2026-07-23 failure: a hooksPath pointing at a directory\n` +
        `  that does not exist makes git run NO hooks, silently.`,
    );
  }
  const missing = REQUIRED_HOOKS.filter((h) => !existsSync(join(resolved, h)));
  if (missing.length) fail(`Missing hook file(s) in ${resolved}: ${missing.join(", ")}`);
  const notExec = REQUIRED_HOOKS.filter((h) => {
    try {
      return !(statSync(join(resolved, h)).mode & 0o111);
    } catch {
      return true;
    }
  });
  if (notExec.length) fail(`Hook file(s) not executable: ${notExec.join(", ")}`);

  console.log(`✅ git hooks are live — core.hooksPath = ${configured} (${REQUIRED_HOOKS.join(", ")} present & executable)`);
  process.exit(0);
}

// --- activate ---
git("config", "core.hooksPath", ".husky");

// Register the custom merge driver used by .gitattributes (merge=alleato-regen)
// for the auto-generated map files. A driver named in .gitattributes does NOTHING
// unless the local repo config maps the name to a command, so this must run per
// clone — which `prepare` guarantees. The driver regenerates the generated file
// from the merged source tree instead of leaving a hand-mergeable conflict.
// See scripts/dev-tools/merge-regenerate-map.mjs and .gitattributes.
try {
  git("config", "merge.alleato-regen.name", "Regenerate auto-generated map files on conflict");
  git(
    "config",
    "merge.alleato-regen.driver",
    "node scripts/dev-tools/merge-regenerate-map.mjs %A %P",
  );
} catch {
  console.warn("⚠️  Could not register the 'alleato-regen' merge driver (non-fatal).");
}

let fixed = 0;
for (const entry of readdirSync(hooksDir)) {
  const p = join(hooksDir, entry);
  try {
    if (!statSync(p).isFile()) continue;
    chmodSync(p, 0o755);
    fixed += 1;
  } catch {
    /* ignore */
  }
}

const missing = REQUIRED_HOOKS.filter((h) => !existsSync(join(hooksDir, h)));
if (missing.length) {
  console.warn(`⚠️  Expected hook file(s) not found in .husky: ${missing.join(", ")}`);
}

console.log(`✅ git hooks activated — core.hooksPath = .husky (${fixed} hook file(s) made executable)`);
console.log(`   Verify anytime with: npm run hooks:doctor`);
