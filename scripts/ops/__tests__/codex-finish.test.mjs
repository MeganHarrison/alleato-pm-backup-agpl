import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { existingScriptFiles } from "../codex-finish.mjs";

test("existingScriptFiles keeps added/modified .mjs/.js/.cjs files under scripts/ that still exist on disk", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-finish-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts", "kept.mjs"), "export const x = 1;\n");

  const result = existingScriptFiles(["scripts/kept.mjs"], dir);
  assert.deepEqual(result, ["scripts/kept.mjs"]);
});

test("existingScriptFiles drops staged script files that no longer exist (deletions), instead of node --check crashing on a missing file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-finish-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts", "kept.mjs"), "export const x = 1;\n");
  // scripts/deleted.mjs is staged (git diff --cached --name-only reports it)
  // but does not exist on disk -- this is the shape of a deleted file.

  const result = existingScriptFiles(["scripts/kept.mjs", "scripts/deleted.mjs"], dir);
  assert.deepEqual(result, ["scripts/kept.mjs"]);
});

test("existingScriptFiles ignores non-script files and non-.js/.mjs/.cjs extensions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-finish-"));
  const result = existingScriptFiles(["docs/README.md", "frontend/src/app/page.tsx"], dir);
  assert.deepEqual(result, []);
});
