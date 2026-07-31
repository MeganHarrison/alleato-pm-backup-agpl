#!/usr/bin/env node
/**
 * Audit: Raw Internal fetch() calls (Rule 13)
 *
 * Rule 13: Pages, components, and hooks MUST use `apiFetch` from
 * `@/lib/api-client`, never raw `fetch("/api/...")`.
 *
 * Scope:
 *   - frontend/src/**\/*.{ts,tsx}
 *   - EXCLUDES: frontend/src/lib/api-client.ts (the wrapper itself)
 *   - EXCLUDES: frontend/src/app/api/** (server-side API routes)
 *
 * Output:
 *   <file>:<line>\t<url-or-expr>\t<line content>
 *
 * Exit 0 always.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_ROOT = path.join(REPO_ROOT, "frontend", "src");

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "__generated__",
  "__tests__",
]);

const EXT_OK = new Set([".ts", ".tsx"]);

const EXCLUDE_FILES = new Set([
  path.join("frontend", "src", "lib", "api-client.ts"),
]);

function isUnderApiRoute(rel) {
  return (
    rel.startsWith(path.join("frontend", "src", "app", "api") + path.sep) ||
    rel === path.join("frontend", "src", "app", "api")
  );
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

function bucketOfRel(rel) {
  // rel is like "frontend/src/..."
  const parts = rel.split(path.sep);
  // drop "frontend", "src"
  const inside = parts.slice(2);
  if (inside[0] === "app") {
    if (inside[1] && inside[1].startsWith("(")) return `page ${inside[1]}`;
    return "page app";
  }
  if (inside[0] === "hooks") return "hook";
  if (inside[0] === "components") return "component";
  if (inside[0] === "services") return "service";
  if (inside[0] === "lib") return "lib";
  return inside[0] || "other";
}

async function main() {
  const violations = [];
  // Match fetch with a string literal OR template literal starting with /api/
  // also catch fetch(`${base}/api/...`) where the literal begins with "/api/"
  // or any template literal that contains "/api/" as a path segment.
  const reString = /\bfetch\s*\(\s*"(\/api\/[^"]*)"/g;
  const reSingle = /\bfetch\s*\(\s*'(\/api\/[^']*)'/g;
  const reTemplate = /\bfetch\s*\(\s*`(\/api\/[^`]*)`/g;

  for await (const file of walk(SCAN_ROOT)) {
    const rel = path.relative(REPO_ROOT, file);
    if (EXCLUDE_FILES.has(rel)) continue;
    if (isUnderApiRoute(rel)) continue;

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

      for (const re of [reString, reSingle, reTemplate]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          violations.push({
            file: rel,
            line: i + 1,
            url: m[1],
            text: line.trim(),
            bucket: bucketOfRel(rel),
          });
        }
      }
    }
  }

  for (const v of violations) {
    const text = v.text.length > 240 ? v.text.slice(0, 240) + "…" : v.text;
    process.stdout.write(
      `${v.file}:${v.line}\t${v.url}\t${v.bucket}\t${text}\n`,
    );
  }

  const byBucket = new Map();
  for (const v of violations)
    byBucket.set(v.bucket, (byBucket.get(v.bucket) || 0) + 1);
  process.stderr.write(`\n--- SUMMARY ---\n`);
  process.stderr.write(`Total: ${violations.length}\n`);
  for (const [k, n] of [...byBucket.entries()].sort((a, b) => b[1] - a[1])) {
    process.stderr.write(`  ${k}: ${n}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${err?.stack || err}\n`);
  process.exit(0);
});
