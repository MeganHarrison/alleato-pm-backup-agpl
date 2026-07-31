#!/usr/bin/env node
// audit-phantom-tables.mjs
// Find .from("tableName") calls in frontend/src that reference tables NOT in
// the generated Supabase types (Tables or Views).
//
// Usage: node scripts/audits/audit-phantom-tables.mjs
// Exits 0 even when violations exist (report tool).

import { readFile } from "node:fs/promises";
import {
  FRONTEND_SRC,
  parseDatabaseTypes,
  walkFiles,
  extractFromCalls,
  relFromRepo,
} from "./_lib.mjs";

async function main() {
  let typeInfo;
  try {
    typeInfo = await parseDatabaseTypes();
  } catch (err) {
    console.error(`[audit-phantom-tables] failed to parse database.types.ts: ${err.message}`);
    process.exit(0);
  }
  const { tables, views } = typeInfo;
  const knownRelations = new Set([...tables.keys(), ...views.keys()]);

  const violations = [];
  let totalFromCalls = 0;
  let filesScanned = 0;

  for await (const file of walkFiles(FRONTEND_SRC)) {
    filesScanned++;
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const calls = extractFromCalls(text);
    totalFromCalls += calls.length;
    for (const call of calls) {
      if (!knownRelations.has(call.name)) {
        violations.push({
          file: relFromRepo(file),
          line: call.line,
          table: call.name,
        });
      }
    }
  }

  // Stable sort: file, line
  violations.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  console.log(`# Phantom table audit`);
  console.log(`files_scanned=${filesScanned}`);
  console.log(`from_calls_total=${totalFromCalls}`);
  console.log(`tables_in_types=${tables.size}`);
  console.log(`views_in_types=${views.size}`);
  console.log(`violations=${violations.length}`);
  console.log(`---`);
  for (const v of violations) {
    console.log(`${v.file}:${v.line}\t${v.table}`);
  }

  // Summary by table name
  const byTable = new Map();
  for (const v of violations) {
    byTable.set(v.table, (byTable.get(v.table) ?? 0) + 1);
  }
  if (byTable.size > 0) {
    console.log(`---`);
    console.log(`# by_table`);
    const sorted = [...byTable.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      console.log(`${count}\t${name}`);
    }
  }
}

main().catch((err) => {
  console.error(`[audit-phantom-tables] fatal: ${err.message}`);
  process.exit(0);
});
