#!/usr/bin/env node
/**
 * Audit: Type Escape Hatches
 *
 * Finds every:
 *   - `as any`
 *   - `as unknown as X`
 *   - `// @ts-ignore`
 *   - `// @ts-expect-error`
 *   - `// @ts-nocheck`
 *   - `: any` (explicit annotation)
 *
 * in frontend/src/**\/*.{ts,tsx}
 *
 * Output (stdout, one violation per line):
 *   <file>:<line>\t<pattern>\t<surrounding line>
 *
 * Exit code is always 0 even when violations exist.
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

/** Regex patterns. Apply in order; each match contributes one violation. */
const PATTERNS = [
  { name: "as any", re: /\bas\s+any\b/g },
  { name: "as unknown as", re: /\bas\s+unknown\s+as\b/g },
  { name: "@ts-ignore", re: /\/\/\s*@ts-ignore\b/g },
  { name: "@ts-expect-error", re: /\/\/\s*@ts-expect-error\b/g },
  { name: "@ts-nocheck", re: /\/\/\s*@ts-nocheck\b/g },
  // `: any` annotation, but skip `: any[]` is still a violation; also skip string literals / comments (best effort)
  // Require preceding identifier char or paren/comma/space so we don't match substrings like `many`.
  { name: ": any", re: /([:\s\(,])any\b(?!\w)/g, whenPrefixedByColon: true },
];

/** Walk a directory recursively, yielding file paths. */
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
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXT_OK.has(ext)) yield full;
    }
  }
}

/** Returns true if the line looks like a comment (// or /* or *). */
function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  );
}

/** Return bucket directory label given a file path relative to frontend/src. */
function bucketOf(relPath) {
  const parts = relPath.split(path.sep);
  // parts[0] should be 'app', 'components', etc.
  if (parts[0] === "app") {
    if (parts[1] === "api") return "app/api";
    if (parts[1] && parts[1].startsWith("(")) return `app/${parts[1]}`;
    return "app/other";
  }
  return parts[0] || "root";
}

async function main() {
  const violations = [];
  const byBucket = new Map();
  const byPattern = new Map();

  for await (const file of walk(SCAN_ROOT)) {
    let src;
    try {
      src = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip pure comment lines for `as any` / `: any` matches (still allow @ts-* directives)
      for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(line)) !== null) {
          // For `: any`, require prefix char we captured to be `:` (strict annotation) — drop loose matches like `(any` or `,any` which are rare, but allow them too.
          if (p.name === ": any") {
            const prefix = m[1];
            if (prefix !== ":" && prefix !== " " && prefix !== "\t") {
              // Treat only `: any` shaped matches (after a `:` possibly preceded by whitespace). We re-check here by looking at char before the `any`.
              // Actually we want only the `:any` / `: any` annotation shape. Skip other forms.
              continue;
            }
            // if prefix is whitespace, ensure previous non-space char is `:` so this really is a type annotation.
            if (prefix !== ":") {
              const before = line.slice(0, m.index).trimEnd();
              if (!before.endsWith(":")) continue;
            }
          }
          if (
            (p.name === "as any" ||
              p.name === "as unknown as" ||
              p.name === ": any") &&
            isCommentLine(line)
          ) {
            continue;
          }
          const rel = path.relative(REPO_ROOT, file);
          const bucket = bucketOf(path.relative(SCAN_ROOT, file));
          violations.push({
            file: rel,
            line: i + 1,
            pattern: p.name,
            text: line.trim(),
            bucket,
          });
          byBucket.set(bucket, (byBucket.get(bucket) || 0) + 1);
          byPattern.set(p.name, (byPattern.get(p.name) || 0) + 1);
        }
      }
    }
  }

  // Print one violation per line, tab-separated.
  for (const v of violations) {
    // keep line content short
    const text = v.text.length > 240 ? v.text.slice(0, 240) + "…" : v.text;
    process.stdout.write(
      `${v.file}:${v.line}\t${v.pattern}\t${text}\n`,
    );
  }

  // Summary on stderr for humans
  process.stderr.write(`\n--- SUMMARY ---\n`);
  process.stderr.write(`Total violations: ${violations.length}\n`);
  process.stderr.write(`By pattern:\n`);
  for (const [k, v] of [...byPattern.entries()].sort((a, b) => b[1] - a[1])) {
    process.stderr.write(`  ${k}: ${v}\n`);
  }
  process.stderr.write(`By bucket:\n`);
  for (const [k, v] of [...byBucket.entries()].sort((a, b) => b[1] - a[1])) {
    process.stderr.write(`  ${k}: ${v}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${err?.stack || err}\n`);
  process.exit(0);
});
