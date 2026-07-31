#!/usr/bin/env node
// audit-migration-vs-types.mjs
// Compare tables defined in supabase/migrations/*.sql vs tables in database.types.ts.
// Flags:
//   - Tables in migrations but NOT in types (types stale, OR migration was reverted)
//   - Tables in types but NOT in migrations (dashboard edits / untracked schema drift)
//
// Parsing notes:
//   - Handles `CREATE TABLE [IF NOT EXISTS] [schema.]"?name"? (`
//   - Only picks up tables in the `public` schema (no schema prefix == public, or `public.`)
//   - Skips `auth.`, `storage.`, `extensions.`, `pgsodium.`, etc.
//   - Ignores CREATE TEMP TABLE, CREATE UNLOGGED TABLE, etc. (we accept `CREATE TABLE` and `CREATE UNLOGGED TABLE`; rare)
//   - Does NOT attempt to resolve ALTER TABLE ... RENAME, DROP TABLE, etc. So:
//       * A table created then dropped still shows as "in migrations"
//       * A renamed table shows under its old name
//     → These are known limitations; use as signals, not hard truth.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { MIGRATIONS_DIR, parseDatabaseTypes, relFromRepo } from "./_lib.mjs";

const CREATE_RE = /\bCREATE\s+(?:UNLOGGED\s+|TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?)([A-Za-z_][A-Za-z0-9_]*)\1(?:\.("?)([A-Za-z_][A-Za-z0-9_]*)\3)?/gi;

// Capture DROP TABLE to optionally exclude dropped ones
const DROP_RE = /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?)([A-Za-z_][A-Za-z0-9_]*)\1(?:\.("?)([A-Za-z_][A-Za-z0-9_]*)\3)?/gi;

// ALTER TABLE ... RENAME TO new_name
const RENAME_RE = /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?)([A-Za-z_][A-Za-z0-9_]*)\1(?:\.("?)([A-Za-z_][A-Za-z0-9_]*)\3)?\s+RENAME\s+TO\s+("?)([A-Za-z_][A-Za-z0-9_]*)\5/gi;

async function collectMigrationTables() {
  // Map table -> { created: Set<file>, dropped: Set<file>, renamedTo?: newName }
  const created = new Map();
  const dropped = new Map();
  const renamedTo = new Map(); // oldName -> newName

  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (err) {
    console.error(`[audit-migration-vs-types] cannot read ${MIGRATIONS_DIR}: ${err.message}`);
    return { created, dropped, renamedTo, migrationFiles: [] };
  }
  const sqlFiles = entries.filter((f) => f.endsWith(".sql")).sort();

  for (const f of sqlFiles) {
    const full = path.join(MIGRATIONS_DIR, f);
    let text;
    try {
      text = await readFile(full, "utf8");
    } catch {
      continue;
    }
    // Strip line comments and block comments to reduce false positives
    const stripped = text
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // CREATE TABLE
    CREATE_RE.lastIndex = 0;
    let m;
    while ((m = CREATE_RE.exec(stripped)) !== null) {
      // groups: 1=quote1 2=first 3=quote2 4=second (after dot)
      const schema = m[4] ? m[2] : null;
      const name = m[4] ? m[4] : m[2];
      if (schema && schema.toLowerCase() !== "public") continue;
      if (!created.has(name)) created.set(name, new Set());
      created.get(name).add(f);
    }

    // DROP TABLE
    DROP_RE.lastIndex = 0;
    while ((m = DROP_RE.exec(stripped)) !== null) {
      const schema = m[4] ? m[2] : null;
      const name = m[4] ? m[4] : m[2];
      if (schema && schema.toLowerCase() !== "public") continue;
      if (!dropped.has(name)) dropped.set(name, new Set());
      dropped.get(name).add(f);
    }

    // RENAME
    RENAME_RE.lastIndex = 0;
    while ((m = RENAME_RE.exec(stripped)) !== null) {
      const schema = m[4] ? m[2] : null;
      const oldName = m[4] ? m[4] : m[2];
      const newName = m[6];
      if (schema && schema.toLowerCase() !== "public") continue;
      renamedTo.set(oldName, newName);
    }
  }

  return { created, dropped, renamedTo, migrationFiles: sqlFiles };
}

async function main() {
  let typeInfo;
  try {
    typeInfo = await parseDatabaseTypes();
  } catch (err) {
    console.error(`[audit-migration-vs-types] failed to parse database.types.ts: ${err.message}`);
    process.exit(0);
  }
  const typeTables = new Set(typeInfo.tables.keys());

  const { created, dropped, renamedTo, migrationFiles } = await collectMigrationTables();

  // Resolve rename chains: for each created name, follow renames until no next rename.
  // An originally-created table may end up under a different final name.
  function resolveFinalName(name) {
    const seen = new Set();
    let cur = name;
    while (renamedTo.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = renamedTo.get(cur);
    }
    return cur;
  }

  // Set of table names that should currently exist per migrations:
  // (created - dropped), with rename applied.
  const migrationFinalTables = new Set();
  for (const name of created.keys()) {
    const final = resolveFinalName(name);
    migrationFinalTables.add(final);
  }
  for (const name of dropped.keys()) {
    // If the final-resolved name was dropped, remove it
    const final = resolveFinalName(name);
    migrationFinalTables.delete(final);
    migrationFinalTables.delete(name);
  }

  // Ignore known infrastructure tables
  const IGNORE = new Set([
    "__drizzle_migrations",
    "schema_migrations",
    "supabase_migrations",
  ]);

  const inMigrationsNotTypes = [...migrationFinalTables]
    .filter((t) => !typeTables.has(t))
    .filter((t) => !IGNORE.has(t))
    .sort();

  const inTypesNotMigrations = [...typeTables]
    .filter((t) => !migrationFinalTables.has(t))
    .filter((t) => !IGNORE.has(t))
    .sort();

  console.log(`# Migration vs types audit`);
  console.log(`migration_files=${migrationFiles.length}`);
  console.log(`migration_create_statements_distinct=${created.size}`);
  console.log(`migration_drop_statements_distinct=${dropped.size}`);
  console.log(`migration_rename_statements=${renamedTo.size}`);
  console.log(`migration_final_tables=${migrationFinalTables.size}`);
  console.log(`types_tables=${typeTables.size}`);
  console.log(`in_migrations_not_in_types=${inMigrationsNotTypes.length}`);
  console.log(`in_types_not_in_migrations=${inTypesNotMigrations.length}`);
  console.log(`---`);
  console.log(`# tables in migrations but NOT in types`);
  console.log(`# (possible: types stale, migration reverted, or table dropped via dashboard)`);
  for (const t of inMigrationsNotTypes) {
    const firstFile = created.has(t) ? [...created.get(t)][0] : "(unknown file)";
    console.log(`${t}\t${firstFile}`);
  }
  console.log(`---`);
  console.log(`# tables in types but NOT in migrations`);
  console.log(`# (possible: table created via Supabase dashboard, or created before current migration history)`);
  for (const t of inTypesNotMigrations) {
    console.log(`${t}`);
  }
}

main().catch((err) => {
  console.error(`[audit-migration-vs-types] fatal: ${err.message}`);
  process.exit(0);
});
