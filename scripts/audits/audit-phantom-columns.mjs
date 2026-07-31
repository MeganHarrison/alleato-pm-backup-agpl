#!/usr/bin/env node
// audit-phantom-columns.mjs
// Best-effort detection of phantom column references:
//   supabase.from("table").select("col1, col2").eq("col3", ...).update({col4: ...}).insert({col5: ...})
// against the Row shape from database.types.ts.
//
// Limitations:
//   - Only parses string-literal tables and column names (ignores dynamic/variable args)
//   - Skips `*` selects, JSON path selects (containing `->` or `->>`), joined selects (containing `(`)
//   - Uses a lightweight state machine that walks `.from()` occurrences and looks at subsequent
//     chained calls within a bounded window. It does NOT do full AST analysis — chains that
//     span complex formatting or non-fluent builder usage may be missed.
//   - .update({ ... }) / .insert({ ... }) object-literal key extraction is regex-based and
//     handles only the common flat-object case. Nested objects, spreads, and computed keys
//     are skipped.
//
// Usage: node scripts/audits/audit-phantom-columns.mjs

import { readFile } from "node:fs/promises";
import {
  FRONTEND_SRC,
  parseDatabaseTypes,
  walkFiles,
  posToLineCol,
  relFromRepo,
} from "./_lib.mjs";

// Match `.from("name")` and capture the table name + position.
const FROM_RE = /\.from\(\s*(["'`])([A-Za-z_][A-Za-z0-9_]*)\1\s*\)/g;

// Match `.select("...")`, `.eq("col", ...)`, etc.
// For select, we capture the raw string arg.
const SELECT_RE = /\.select\(\s*(["'`])([^"'`]*)\1/g;
const EQ_LIKE_RE = /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|rangeGt|rangeGte|rangeLt|rangeLte|rangeAdjacent|overlaps|textSearch|match|filter|order|not)\(\s*(["'`])([A-Za-z_][A-Za-z0-9_]*)\2/g;
const UPDATE_RE = /\.update\(\s*\{([\s\S]*?)\}\s*\)/g;
const INSERT_RE = /\.insert\(\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*\)/g;
const UPSERT_RE = /\.upsert\(\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/g;

// Extract object-literal top-level keys from a brace/array body. Very lightweight:
// - Walks characters tracking bracket depth
// - Only grabs identifiers at depth 0 (inside outermost {}) followed by ':'
function extractObjectKeys(body) {
  const keys = new Set();
  // Strip leading/trailing brackets if array-of-one-object: [{...}]
  let text = body.trim();
  if (text.startsWith("[")) {
    // Try to grab first object inside
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return keys;
    text = text.slice(firstBrace, lastBrace + 1);
  }
  if (text.startsWith("{")) text = text.slice(1, text.length - 1);

  let depth = 0;
  let parenDepth = 0;
  let inStr = null; // track string quote char
  let inBacktickExpr = 0; // ${...} inside template strings
  let i = 0;
  // We walk, and when depth===0 and parenDepth===0 and not in a string, we look for identifier tokens followed by ':'
  let atLineStart = true;
  let buf = "";
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) { inStr = null; }
      if (inStr === "`" && c === "$" && text[i + 1] === "{") { inBacktickExpr++; i += 2; continue; }
      i++;
      continue;
    }
    if (inBacktickExpr > 0) {
      if (c === "{") inBacktickExpr++;
      else if (c === "}") inBacktickExpr--;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      i++;
      continue;
    }
    if (c === "{") { depth++; i++; continue; }
    if (c === "}") { depth--; i++; continue; }
    if (c === "(") { parenDepth++; i++; continue; }
    if (c === ")") { parenDepth--; i++; continue; }
    if (c === "[") { depth++; i++; continue; }
    if (c === "]") { depth--; i++; continue; }

    if (depth === 0 && parenDepth === 0) {
      // Look for identifier followed by ':' or a string key followed by ':'
      // identifier
      const idMatch = text.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (idMatch) {
        // skip if it's a computed accessor like "foo: bar ? baz : qux" — idMatch still matches; safe enough
        keys.add(idMatch[1]);
        i += idMatch[0].length;
        continue;
      }
      const strKeyMatch = text.slice(i).match(/^(["'])([A-Za-z_][A-Za-z0-9_]*)\1\s*:/);
      if (strKeyMatch) {
        keys.add(strKeyMatch[2]);
        i += strKeyMatch[0].length;
        continue;
      }
    }
    i++;
  }
  return keys;
}

// Parse a select string and return the list of plain column names.
// Returns null if we should skip (JSON path, joins, aggregates, '*').
function parseSelectString(s) {
  const trimmed = s.trim();
  if (trimmed === "*" || trimmed === "") return null;
  if (trimmed.includes("(")) return null; // joined or aggregate
  if (trimmed.includes("->")) return null; // JSON path
  // Split on commas
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  const cols = [];
  for (const p of parts) {
    // Handle aliases: "alias:col" or "col::type"
    let col = p;
    if (col.includes(":")) col = col.split(":").pop().trim();
    if (col.includes("::")) col = col.split("::")[0].trim();
    // Strip leading/trailing quotes or modifiers
    col = col.replace(/^!/, "");
    // After these cleanups if not a simple identifier, skip
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(col)) return null;
    cols.push(col);
  }
  return cols;
}

// For each .from() occurrence, find chained calls that appear after it but before the NEXT
// .from() (which starts a new chain) OR a statement boundary. We conservatively cap at 4 KB.
// This prevents columns from one chain being attributed to a prior .from() table.
const MAX_WINDOW = 4096;

async function analyzeFile(file, knownTables) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return { violations: [], fromCount: 0 };
  }

  const violations = [];
  let fromCount = 0;

  // Find all .from() positions
  const fromMatches = [];
  let fm;
  FROM_RE.lastIndex = 0;
  while ((fm = FROM_RE.exec(text)) !== null) {
    fromMatches.push({ table: fm[2], start: fm.index, end: FROM_RE.lastIndex });
  }
  fromCount = fromMatches.length;

  for (let fi = 0; fi < fromMatches.length; fi++) {
    const fromMatch = fromMatches[fi];
    const tbl = fromMatch.table;
    const cols = knownTables.get(tbl);
    if (!cols) continue; // unknown table — reported by audit-phantom-tables
    // Window ends at next .from() start, or MAX_WINDOW chars ahead, or EOF
    const nextFromStart = fi + 1 < fromMatches.length ? fromMatches[fi + 1].start : text.length;
    const windowEnd = Math.min(text.length, fromMatch.end + MAX_WINDOW, nextFromStart);
    const window = text.slice(fromMatch.end, windowEnd);

    const check = (colName, absLocalIdx) => {
      if (cols.has(colName)) return;
      const absIdx = fromMatch.end + absLocalIdx;
      const { line } = posToLineCol(text, absIdx);
      violations.push({
        file: relFromRepo(file),
        line,
        table: tbl,
        column: colName,
      });
    };

    // .select("...")
    let sm;
    SELECT_RE.lastIndex = 0;
    while ((sm = SELECT_RE.exec(window)) !== null) {
      const arg = sm[2];
      const colList = parseSelectString(arg);
      if (colList) {
        for (const c of colList) check(c, sm.index);
      }
    }

    // .eq("col", ...) and friends
    let em;
    EQ_LIKE_RE.lastIndex = 0;
    while ((em = EQ_LIKE_RE.exec(window)) !== null) {
      const col = em[3];
      // `order` can be applied to selected aliased columns or joined syntax — still worth checking;
      // false positives here are acceptable as best-effort.
      check(col, em.index);
    }

    // .update({ ... })
    let um;
    UPDATE_RE.lastIndex = 0;
    while ((um = UPDATE_RE.exec(window)) !== null) {
      const keys = extractObjectKeys(um[1]);
      for (const k of keys) check(k, um.index);
    }

    // .insert({ ... }) / .insert([{ ... }])
    let im;
    INSERT_RE.lastIndex = 0;
    while ((im = INSERT_RE.exec(window)) !== null) {
      const keys = extractObjectKeys(im[1]);
      for (const k of keys) check(k, im.index);
    }

    // .upsert({ ... })
    let upm;
    UPSERT_RE.lastIndex = 0;
    while ((upm = UPSERT_RE.exec(window)) !== null) {
      const keys = extractObjectKeys(upm[1]);
      for (const k of keys) check(k, upm.index);
    }
  }

  return { violations, fromCount };
}

async function main() {
  let typeInfo;
  try {
    typeInfo = await parseDatabaseTypes();
  } catch (err) {
    console.error(`[audit-phantom-columns] failed to parse database.types.ts: ${err.message}`);
    process.exit(0);
  }
  const { tables, views } = typeInfo;
  // Treat views as valid read targets (they have a Row shape too)
  const knownTables = new Map([...tables, ...views]);

  const allViolations = [];
  let totalFrom = 0;
  let filesScanned = 0;

  for await (const file of walkFiles(FRONTEND_SRC)) {
    filesScanned++;
    const { violations, fromCount } = await analyzeFile(file, knownTables);
    totalFrom += fromCount;
    allViolations.push(...violations);
  }

  // De-duplicate: (file,line,table,column)
  const seen = new Set();
  const dedup = [];
  for (const v of allViolations) {
    const key = `${v.file}|${v.line}|${v.table}|${v.column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(v);
  }
  dedup.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.column.localeCompare(b.column);
  });

  console.log(`# Phantom column audit (best-effort)`);
  console.log(`files_scanned=${filesScanned}`);
  console.log(`from_calls_total=${totalFrom}`);
  console.log(`tables_in_types=${tables.size}`);
  console.log(`views_in_types=${views.size}`);
  console.log(`violations=${dedup.length}`);
  console.log(`---`);
  for (const v of dedup) {
    console.log(`${v.file}:${v.line}\t${v.table}.${v.column}`);
  }

  // Top offenders
  const byColumn = new Map();
  for (const v of dedup) {
    const k = `${v.table}.${v.column}`;
    byColumn.set(k, (byColumn.get(k) ?? 0) + 1);
  }
  if (byColumn.size > 0) {
    console.log(`---`);
    console.log(`# by_column (top 30)`);
    const sorted = [...byColumn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    for (const [name, count] of sorted) {
      console.log(`${count}\t${name}`);
    }
  }
}

main().catch((err) => {
  console.error(`[audit-phantom-columns] fatal: ${err.message}`);
  process.exit(0);
});
