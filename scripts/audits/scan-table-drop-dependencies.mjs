#!/usr/bin/env node

/**
 * Table-drop dependency scanner
 *
 * The db-inventory "code refs" count is an app-code `.from("literal")` grep. It is
 * NOT a safe-to-rename/drop signal on its own, because a table can be reached through
 * mechanisms that grep never sees:
 *
 *   - a view / materialized view (`FROM public.<t>` in a view body),
 *   - a foreign key from another table (`REFERENCES public.<t>`),
 *   - a PostgREST relation embed (`alias:<t>(cols)`) resolved by relation name,
 *   - a dynamic table-name map (e.g. entity-links `table-map.ts`) driving `.from(variable)`,
 *   - raw SQL in a `scripts/` job (`insert into public.<t>`).
 *
 * This scanner takes a set of tables (from a soft-drop migration, or passed as args)
 * and reports any that still have one of those dependencies. Run it BEFORE renaming or
 * dropping any table. Exit code 1 if any dependency is found.
 *
 * Usage:
 *   node scripts/audits/scan-table-drop-dependencies.mjs --migration supabase/migrations/<file>.sql
 *   node scripts/audits/scan-table-drop-dependencies.mjs table_a table_b ...
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);

let tables = [];
const migIdx = args.indexOf("--migration");
if (migIdx !== -1 && args[migIdx + 1]) {
  const mig = fs.readFileSync(path.join(repoRoot, args[migIdx + 1]), "utf8");
  tables = [...mig.matchAll(/RENAME TO zz_deprecated_([a-z_]+)/g)].map((m) => m[1]);
} else {
  tables = args.filter((a) => !a.startsWith("--"));
}
tables = [...new Set(tables)];
if (tables.length === 0) {
  console.error("No tables to scan. Pass --migration <file> or a list of table names.");
  process.exit(2);
}

function liveSchemaDependencies(table) {
  const sql = `select con.conname, con.conrelid::regclass::text as owner from pg_constraint con join pg_class target on target.oid=con.confrelid join pg_namespace ns on ns.oid=target.relnamespace where con.contype='f' and ns.nspname='public' and target.relname='${table}'`;
  try {
    const out = execSync(`npx supabase db query --linked --output json ${JSON.stringify(sql)}`, {
      cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 8,
    });
    const start = out.indexOf("{");
    const payload = start >= 0 ? JSON.parse(out.slice(start)) : { rows: [] };
    return payload.rows ?? [];
  } catch (error) {
    throw new Error(`Live schema dependency query failed for ${table}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function grepLines(pattern, paths) {
  try {
    const out = execSync(`grep -rInE ${JSON.stringify(pattern)} ${paths} 2>/dev/null || true`, {
      cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 64,
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const problems = {};
for (const t of tables) {
  const hits = [];
  const foreignKeys = liveSchemaDependencies(t);
  if (foreignKeys.length) hits.push(`live FK references x${foreignKeys.length}`);
  const embed = grepLines(`:${t}\\(`, "frontend/src");
  if (embed.length) hits.push(`PostgREST embed x${embed.length}`);
  const map = grepLines(`["']${t}["']`, "frontend/src/lib/entity-links frontend/src/app/api/entity-links");
  if (map.length) hits.push(`entity-link map x${map.length}`);
  const scripts = grepLines(
    `(insert into|update|delete from|from)\\s+(public\\.)?${t}\\b|\\.from\\(['\"]${t}['\"]`,
    "scripts",
  );
  if (scripts.length) hits.push(`script SQL x${scripts.length}`);
  if (hits.length) problems[t] = hits;
}

console.log(`Scanned ${tables.length} table(s) for view/FK/embed/map/script dependencies.\n`);
if (Object.keys(problems).length === 0) {
  console.log("CLEAN — no dependencies found. Safe to soft-drop (rename).");
  process.exit(0);
}
console.log("DEPENDENCIES FOUND — hold these back:");
for (const [t, h] of Object.entries(problems)) console.log(`  ${t} → ${h.join(", ")}`);
process.exit(1);
