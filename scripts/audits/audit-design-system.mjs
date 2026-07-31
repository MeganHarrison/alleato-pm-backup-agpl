#!/usr/bin/env node
/**
 * Audit: Design System Violations (Rule 7)
 *
 * Scans frontend/src/**\/*.{ts,tsx} (excluding components/ui shadcn primitives,
 * __tests__, node_modules, .next, etc.) for:
 *
 *   - bg-white / bg-white/<n>
 *   - text-white (where it looks like a plain text class, not on dark surface)
 *   - Hardcoded Tailwind color scales: bg-{palette}-{shade}, text-{palette}-{shade},
 *     border-{palette}-{shade}, ring-{palette}-{shade}, from-/via-/to-{palette}-{shade}
 *     where palette ∈ common Tailwind palette list below.
 *   - Hex codes (#abc, #aabbcc, #aabbccdd) inside className strings or style attrs.
 *   - Arbitrary spacing: p-[, m-[, gap-[, w-[, h-[, pt-[, etc.
 *   - Lowercase <button element (should be <Button).
 *   - shadow-md, shadow-lg, shadow-xl, shadow-2xl.
 *
 * Output: per-file-per-line violations + summary by category and top-20 offenders.
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

// Paths to skip entirely (pure shadcn primitives we can't modify meaningfully,
// test files, and type definitions)
const SKIP_DIR = new Set(["node_modules", ".next", "dist", "build", "__tests__", "__generated__"]);
const SKIP_PATH_SUBSTRINGS = [
  path.join("frontend", "src", "components", "ui") + path.sep,
];

const EXT_OK = new Set([".ts", ".tsx"]);

const PALETTES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green",
  "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose",
];

// Tailwind class-utility prefixes that commonly carry color scale values.
// For each, we'll allow an optional variant prefix like `hover:`, `dark:`, `md:`, `group-hover:`.
const COLOR_UTILS = [
  "bg", "text", "border", "ring", "fill", "stroke", "outline", "divide",
  "placeholder", "caret", "accent", "decoration", "from", "via", "to",
  "shadow",
];

function buildColorRegex() {
  const palette = PALETTES.join("|");
  const utils = COLOR_UTILS.join("|");
  // Match things like: bg-gray-100, hover:text-blue-500, dark:border-slate-800/50
  // Require a word boundary before (won't accidentally grab middle of a word)
  return new RegExp(
    `(?<![A-Za-z0-9_-])((?:[a-z0-9_-]+:)*)(?:${utils})-(?:${palette})-\\d{2,3}(?:\\/\\d{1,3})?`,
    "g"
  );
}

const COLOR_RE = buildColorRegex();

const BG_WHITE_RE = /(?<![A-Za-z0-9_-])((?:[a-z0-9_-]+:)*)bg-white(?:\/\d{1,3})?\b/g;
const TEXT_WHITE_RE = /(?<![A-Za-z0-9_-])((?:[a-z0-9_-]+:)*)text-white(?:\/\d{1,3})?\b/g;
const HEX_IN_CLASS_RE = /className[^>]*["'`][^"'`]*?(#[0-9a-fA-F]{3,8})\b[^"'`]*?["'`]/g;
const HEX_IN_STYLE_RE = /style=\{\{[^}]*?(#[0-9a-fA-F]{3,8})[^}]*?\}\}/g;
const ARBITRARY_SPACING_RE = /(?<![A-Za-z0-9_-])((?:[a-z0-9_-]+:)*)(?:p|m|w|h|gap|top|left|right|bottom|inset|space-x|space-y|pt|pb|pl|pr|px|py|mt|mb|ml|mr|mx|my)-\[[^\]]+\]/g;
const LOWERCASE_BUTTON_RE = /<button(?:\s|>)/g;
const OVERSIZED_SHADOW_RE = /(?<![A-Za-z0-9_-])((?:[a-z0-9_-]+:)*)shadow-(?:md|lg|xl|2xl)\b/g;

const CATEGORIES = {
  BG_WHITE: "bg-white",
  TEXT_WHITE: "text-white",
  HARDCODED_COLOR: "hardcoded Tailwind color scale",
  HEX_CODE: "hex code in className/style",
  ARBITRARY_SPACING: "arbitrary spacing value",
  LOWERCASE_BUTTON: "<button> lowercase element",
  OVERSIZED_SHADOW: "shadow-md or larger",
};

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

function scanFile(text) {
  const lines = text.split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // bg-white (must come before generic color regex since "white" isn't a palette)
    let m;
    BG_WHITE_RE.lastIndex = 0;
    while ((m = BG_WHITE_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "BG_WHITE", snippet: m[0] });
    }
    TEXT_WHITE_RE.lastIndex = 0;
    while ((m = TEXT_WHITE_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "TEXT_WHITE", snippet: m[0] });
    }

    // Tailwind palette color classes
    COLOR_RE.lastIndex = 0;
    while ((m = COLOR_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "HARDCODED_COLOR", snippet: m[0] });
    }

    // Hex in className / style
    HEX_IN_CLASS_RE.lastIndex = 0;
    while ((m = HEX_IN_CLASS_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "HEX_CODE", snippet: m[1] });
    }
    HEX_IN_STYLE_RE.lastIndex = 0;
    while ((m = HEX_IN_STYLE_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "HEX_CODE", snippet: m[1] });
    }

    // Arbitrary spacing
    ARBITRARY_SPACING_RE.lastIndex = 0;
    while ((m = ARBITRARY_SPACING_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "ARBITRARY_SPACING", snippet: m[0] });
    }

    // Lowercase <button>
    LOWERCASE_BUTTON_RE.lastIndex = 0;
    while ((m = LOWERCASE_BUTTON_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "LOWERCASE_BUTTON", snippet: "<button" });
    }

    // Oversized shadows
    OVERSIZED_SHADOW_RE.lastIndex = 0;
    while ((m = OVERSIZED_SHADOW_RE.exec(line)) !== null) {
      findings.push({ line: i + 1, category: "OVERSIZED_SHADOW", snippet: m[0] });
    }
  }

  return findings;
}

async function main() {
  const counts = {};
  for (const k of Object.keys(CATEGORIES)) counts[k] = 0;

  const byFile = new Map(); // rel path -> total findings
  const sampleRows = []; // first ~500 to print

  let filesScanned = 0;

  for await (const file of walkFiles(SCAN_ROOT)) {
    filesScanned++;
    let text;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    const findings = scanFile(text);
    if (findings.length === 0) continue;
    byFile.set(rel(file), (byFile.get(rel(file)) || 0) + findings.length);
    for (const f of findings) {
      counts[f.category]++;
      if (sampleRows.length < 500) {
        sampleRows.push(`${rel(file)}:${f.line}\t${f.category}\t${f.snippet}`);
      }
    }
  }

  console.log("=== Design System Violations Audit ===");
  console.log(`Files scanned: ${filesScanned}`);
  console.log("");
  console.log("Counts by category:");
  for (const [k, label] of Object.entries(CATEGORIES)) {
    console.log(`  ${k.padEnd(20)} ${String(counts[k]).padStart(6)}  ${label}`);
  }
  console.log("");
  console.log("Top 20 files by violation count:");
  const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [file, n] of top) {
    console.log(`  ${String(n).padStart(5)}  ${file}`);
  }
  console.log("");
  console.log(`Sample findings (first ${sampleRows.length}):`);
  console.log("file:line\tcategory\tsnippet");
  for (const row of sampleRows) console.log(row);
}

main().catch((err) => {
  console.error("audit-design-system failed:", err?.message || err);
  process.exit(0);
});
