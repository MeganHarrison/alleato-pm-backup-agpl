#!/usr/bin/env node
/**
 * Audit: Hardcoded Status Colors (Rule 7)
 *
 * Finds ternary/conditional logic that maps a status value to color classes.
 * These should use <StatusBadge status="..." /> instead.
 *
 * Heuristic: for each line containing bg-(red|green|yellow|blue|orange)-<shade>
 * OR text-(same)-<shade>, look in a 5-line window (before + after) for identifiers
 * that suggest status mapping: `status`, `state`, `approved`, `pending`, `rejected`,
 * `complete`, `active`, `inactive`, `draft`, `void`, `closed`, `open`, `success`,
 * `failure`, `error`, `warning`, 'case ', `===`, ternary `?` nearby.
 *
 * Output: <file>:<line>\t<snippet>
 *
 * Always exits 0.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_ROOT = path.join(REPO_ROOT, "frontend", "src");

const SKIP_DIR = new Set(["node_modules", ".next", "dist", "build", "__tests__", "__generated__"]);
const SKIP_PATH_SUBSTRINGS = [
  path.join("frontend", "src", "components", "ui") + path.sep,
];
const EXT_OK = new Set([".ts", ".tsx"]);

// Status-ish words that, when near a color utility, strongly suggest a status map.
const STATUS_KEYWORDS = [
  "status", "state", "approved", "pending", "rejected", "complete", "completed",
  "active", "inactive", "draft", "void", "closed", "open", "success", "failure",
  "error", "warning", "overdue", "late", "on-hold", "onhold", "in_progress",
  "inprogress", "submitted", "awaiting",
];

// Colors commonly used for status semantics.
const STATUS_COLOR_RE = /\b(?:bg|text|border)-(?:red|green|yellow|blue|orange|emerald|amber|rose)-\d{2,3}(?:\/\d{1,3})?\b/;

const CONDITIONAL_RE = /\?\s*["'`]?\s*(?:bg|text|border)-|\?\s*\(|case\s+["']/;

async function* walkFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name) || e.name.startsWith(".")) continue;
      yield* walkFiles(full);
    } else if (e.isFile() && EXT_OK.has(path.extname(e.name))) {
      if (SKIP_PATH_SUBSTRINGS.some((s) => full.includes(s))) continue;
      yield full;
    }
  }
}

function rel(p) {
  return path.relative(REPO_ROOT, p);
}

function scan(text) {
  const lines = text.split("\n");
  const hits = [];
  const loweredKeywords = STATUS_KEYWORDS;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!STATUS_COLOR_RE.test(line)) continue;

    // Look at window of ±5 lines
    const start = Math.max(0, i - 5);
    const end = Math.min(lines.length, i + 6);
    const window = lines.slice(start, end).join("\n").toLowerCase();

    const keywordHit = loweredKeywords.some((k) => window.includes(k));
    const conditionalHit = CONDITIONAL_RE.test(window) || window.includes("switch (") || window.includes("? '") || window.includes("? \"");

    if (keywordHit && conditionalHit) {
      hits.push({ line: i + 1, snippet: line.trim().slice(0, 200) });
    }
  }
  return hits;
}

async function main() {
  let filesScanned = 0;
  let totalHits = 0;
  const rows = [];
  const byFile = new Map();

  for await (const file of walkFiles(SCAN_ROOT)) {
    filesScanned++;
    let text;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    const hits = scan(text);
    if (hits.length === 0) continue;
    byFile.set(rel(file), hits.length);
    for (const h of hits) {
      totalHits++;
      rows.push(`${rel(file)}:${h.line}\t${h.snippet}`);
    }
  }

  console.log("=== Hardcoded Status Colors Audit ===");
  console.log(`Files scanned: ${filesScanned}`);
  console.log(`Total suspicious lines: ${totalHits}`);
  console.log("");
  console.log("Top 20 files:");
  const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [file, n] of top) console.log(`  ${String(n).padStart(4)}  ${file}`);
  console.log("");
  console.log("file:line\tsnippet");
  for (const r of rows) console.log(r);
}

main().catch((err) => {
  console.error("audit-status-color-hardcoding failed:", err?.message || err);
  process.exit(0);
});
