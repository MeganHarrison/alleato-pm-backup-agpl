#!/usr/bin/env node
/**
 * Audit: Raw External fetch() calls in API routes (Rule 16)
 *
 * Rule 16: API routes MUST use `fetchWithGuardrails` from
 * `@/lib/fetch-with-guardrails` for external HTTP calls, never raw
 * `fetch("https://...")`.
 *
 * Scope:
 *   - frontend/src/app/api/**\/*.{ts,tsx}
 *   - frontend/src/lib/**\/*.{ts,tsx}
 *   - EXCLUDES: frontend/src/lib/fetch-with-guardrails.ts
 *   - EXCLUDES: frontend/src/lib/guardrails/** (the guardrail implementation itself)
 *
 * Output:
 *   <file>:<line>\t<url>\t<line content>
 *
 * Exit 0 always.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SCAN_ROOTS = [
  path.join(REPO_ROOT, "frontend", "src", "app", "api"),
  path.join(REPO_ROOT, "frontend", "src", "lib"),
];

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "__generated__",
  "__tests__",
]);

const EXT_OK = new Set([".ts", ".tsx"]);

const EXCLUDE_REL = new Set([
  path.join("frontend", "src", "lib", "fetch-with-guardrails.ts"),
]);

function isExcluded(rel) {
  if (EXCLUDE_REL.has(rel)) return true;
  // exclude the guardrails implementation files themselves
  if (
    rel.startsWith(path.join("frontend", "src", "lib", "guardrails") + path.sep)
  )
    return true;
  return false;
}

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && EXT_OK.has(path.extname(entry.name))) yield full;
  }
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

async function main() {
  const violations = [];
  // match fetch("https://...") / fetch('https://...') / fetch(`https://...`)
  // also match http:// (rare but still external)
  const reDouble = /\bfetch\s*\(\s*"(https?:\/\/[^"]*)"/g;
  const reSingle = /\bfetch\s*\(\s*'(https?:\/\/[^']*)'/g;
  const reTemplate = /\bfetch\s*\(\s*`(https?:\/\/[^`]*)`/g;

  for (const root of SCAN_ROOTS) {
    for await (const file of walk(root)) {
      const rel = path.relative(REPO_ROOT, file);
      if (isExcluded(rel)) continue;

      let src;
      try {
        src = await fs.readFile(file, "utf8");
      } catch {
        continue;
      }
      const lines = src.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isCommentLine(line)) continue;
        for (const re of [reDouble, reSingle, reTemplate]) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(line)) !== null) {
            violations.push({
              file: rel,
              line: i + 1,
              url: m[1],
              text: line.trim(),
            });
          }
        }
      }
    }
  }

  for (const v of violations) {
    const text = v.text.length > 240 ? v.text.slice(0, 240) + "…" : v.text;
    process.stdout.write(`${v.file}:${v.line}\t${v.url}\t${text}\n`);
  }

  process.stderr.write(`\n--- SUMMARY ---\n`);
  process.stderr.write(`Total: ${violations.length}\n`);
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${err?.stack || err}\n`);
  process.exit(0);
});
