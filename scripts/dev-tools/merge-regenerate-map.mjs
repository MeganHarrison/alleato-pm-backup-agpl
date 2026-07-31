#!/usr/bin/env node
/**
 * Git merge driver: auto-resolve conflicts in AUTO-GENERATED map files by
 * regenerating them from source instead of asking a human to hand-merge them.
 *
 * WHY THIS EXISTS
 * PROJECT-MAP.md / SYSTEM-MAP.md / system-map.json / app-surface.generated.json
 * are pure filesystem derivations (see generate-project-map.mjs /
 * generate-system-map.mjs). The pre-commit gate forces every branch that
 * touches a route/API/AI-tool to regenerate + stage them, so two branches
 * ALWAYS rewrite the same generated regions and ALWAYS collide on merge/rebase.
 * The conflict is meaningless: the correct content is a deterministic function
 * of the merged source tree. This driver makes `git merge`/`git rebase` resolve
 * it the only correct way — regenerate from the (already-merged) source — so no
 * one hand-resolves a generated file again.
 *
 * REGISTRATION
 * Declared per-file in .gitattributes (`merge=alleato-regen`) and wired to this
 * script by scripts/setup-git-hooks.mjs (runs on `pnpm install` via `prepare`),
 * so every clone gets it with zero manual `git config`.
 *
 * CONTRACT (git invokes it as: node merge-regenerate-map.mjs %A %P)
 *   %A = temp file holding "our" version; git moves it to the real path when we
 *        exit 0, so the MERGED RESULT must end up in this file.
 *   %P = the real pathname of the conflicted file in the repo.
 * On ANY failure we keep "ours" and exit 0 — a generated file must never be left
 * with conflict markers, and the next commit's pre-commit gate will refresh it.
 *
 * NOTE: a local merge driver only runs for LOCAL merges/rebases (GitHub's
 * server-side merge does not execute custom drivers). That is exactly the case
 * that produces the hand-resolution toil, so this is where the value is.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [, , oursTmp, repoPathRaw] = process.argv;

function keepOurs() {
  // Leave %A (our version) untouched and report the conflict "resolved".
  process.exit(0);
}

if (!oursTmp || !repoPathRaw) keepOurs();

// git hands us forward-slash paths even on Windows.
const repoPath = repoPathRaw.replace(/\\/g, "/");

// Each generated file → the generator that (re)produces it. Each generator
// writes BOTH files in its pair, so running it once is enough for either.
const GENERATOR_FOR = {
  "docs/architecture/PROJECT-MAP.md": "generate-project-map.mjs",
  "frontend/src/lib/app-surface/app-surface.generated.json": "generate-project-map.mjs",
  "docs/architecture/SYSTEM-MAP.md": "generate-system-map.mjs",
  "docs/architecture/generated/system-map.json": "generate-system-map.mjs",
};

const generator = GENERATOR_FOR[repoPath];
if (!generator) keepOurs();

let root;
try {
  root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  keepOurs();
}

try {
  // SYSTEM-MAP is composed from PROJECT-MAP + TABLE-LIST, so project must be
  // current first. Running project-map is cheap and idempotent.
  execFileSync("node", [join(root, "scripts", "dev-tools", "generate-project-map.mjs")], {
    cwd: root,
    stdio: "ignore",
  });
  if (generator === "generate-system-map.mjs") {
    execFileSync("node", [join(root, "scripts", "dev-tools", "generate-system-map.mjs")], {
      cwd: root,
      stdio: "ignore",
    });
  }

  const regenerated = join(root, repoPath);
  if (existsSync(regenerated)) {
    copyFileSync(regenerated, oursTmp); // hand the fresh content back to git
  }
  process.exit(0);
} catch {
  keepOurs();
}
