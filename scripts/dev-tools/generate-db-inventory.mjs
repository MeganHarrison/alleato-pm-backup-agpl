#!/usr/bin/env node

/**
 * Database Inventory Generator
 *
 * Combines:
 *   1. docs/architecture/tables.yaml  — human-authored metadata
 *   2. Live SQL (both Supabase projects) — row counts, size, columns, last stats
 *   3. Codebase grep                  — writers, readers, migrations per table
 *
 * Output: frontend/src/components/dev-tools/db-inventory.generated.ts
 *
 * Usage:
 *   npm run db:inventory           — full regenerate
 *   npm run db:inventory -- --check-only  — schema-drift check only (CI gate)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const pg = require("pg");
const dotenv = require("dotenv");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..");

const CHECK_ONLY = process.argv.includes("--check-only");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`\n[db-inventory] ❌ ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[db-inventory] ${msg}`);
}

function warn(msg) {
  console.warn(`[db-inventory] ⚠️  ${msg}`);
}

// ─── Load env ────────────────────────────────────────────────────────────────

const envPath = path.join(repoRoot, ".env");
if (!fs.existsSync(envPath)) fail(`.env not found at ${envPath}`);
dotenv.config({ path: envPath });

const MAIN_DB_URL = process.env.DATABASE_URL;
const RAG_DB_URL = process.env.RAG_DATABASE_URL;
const MAIN_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const RAG_SUPABASE_URL = process.env.RAG_SUPABASE_URL;
const SUPABASE_ACCESS_TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_API_TOKEN;

if (!MAIN_DB_URL && !MAIN_SUPABASE_URL) {
  fail("Neither DATABASE_URL nor NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL is set in .env");
}
if (!RAG_DB_URL && !RAG_SUPABASE_URL) {
  fail("Neither RAG_DATABASE_URL nor RAG_SUPABASE_URL is set in .env");
}

// ─── Load YAML ───────────────────────────────────────────────────────────────

const yamlPath = path.join(repoRoot, "docs", "architecture", "tables.yaml");
if (!fs.existsSync(yamlPath)) {
  fail(`tables.yaml not found at ${yamlPath}. Run Phase 1 first.`);
}

let parsedYaml;
try {
  const raw = fs.readFileSync(yamlPath, "utf8");
  parsedYaml = yaml.load(raw);
} catch (err) {
  fail(`YAML parse error in tables.yaml: ${err.message}`);
}

if (!parsedYaml?.tables || !Array.isArray(parsedYaml.tables)) {
  fail("tables.yaml must have a top-level `tables:` array");
}

/** @type {Map<string, any>} */
const yamlByName = new Map();
for (const entry of parsedYaml.tables) {
  if (!entry.name) fail(`YAML entry missing required field 'name': ${JSON.stringify(entry)}`);
  if (!entry.db) fail(`YAML entry '${entry.name}' missing required field 'db'`);
  if (!["MAIN", "RAG"].includes(entry.db)) fail(`YAML entry '${entry.name}' has invalid db '${entry.db}'. Must be MAIN or RAG`);
  if (!entry.domain) fail(`YAML entry '${entry.name}' missing required field 'domain'`);
  if (!entry.status) fail(`YAML entry '${entry.name}' missing required field 'status'`);
  if (!entry.purpose) fail(`YAML entry '${entry.name}' missing required field 'purpose'`);
  yamlByName.set(`${entry.name}:${entry.db}`, entry);
}

log(`Loaded ${yamlByName.size} entries from tables.yaml`);

// ─── DB connections ───────────────────────────────────────────────────────────

function projectRefFromUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const match = url.hostname.match(/^([^.]+)\.supabase\.co$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function statsQuery(tableName) {
  return `
    SELECT
      c.relname AS name,
      GREATEST(c.reltuples::bigint, 0) AS approx_rows,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
      pg_total_relation_size(c.oid) AS total_size_bytes,
      ps.last_autoanalyze,
      ps.last_autovacuum,
      COALESCE(ps.n_live_tup, 0) AS n_live_tup,
      COALESCE(ps.n_dead_tup, 0) AS n_dead_tup
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables ps ON ps.relid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ${quoteLiteral(tableName)}
  `;
}

function columnsQuery(tableName) {
  return `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${quoteLiteral(tableName)}
    ORDER BY ordinal_position
  `;
}

function countQuery(tableName) {
  return `SELECT COUNT(*)::bigint AS n FROM public.${quoteIdentifier(tableName)}`;
}

async function createDatabaseClient({ databaseUrl, supabaseUrl, label }) {
  const managementProjectRef = projectRefFromUrl(supabaseUrl);

  const managementQuery = async (sql) => {
    if (!SUPABASE_ACCESS_TOKEN || !managementProjectRef) {
      fail(`Cannot query ${label} database: direct Postgres auth failed and Management API fallback is unavailable.`);
    }

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${managementProjectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: sql,
          read_only: true,
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Management API query failed (${response.status}): ${text}`);
    }
    return { rows: text ? JSON.parse(text) : [] };
  };

  if (!databaseUrl) {
    log(`Connected to ${label} database via Supabase Management API`);
    return {
      label,
      mode: "management",
      query: managementQuery,
      connect: async () => ({
        query: managementQuery,
        release() {},
      }),
      async end() {},
    };
  }

  // Strip sslmode from the URL so the programmatic ssl config takes effect.
  // pg treats sslmode=require as verify-full which fails against Supabase pooler certs.
  const cleanUrl = databaseUrl.replace(/[?&]sslmode=[^&]+/, (m) => (m.startsWith("?") ? "?" : "")).replace(/\?$/, "");
  const useSSL = databaseUrl.includes("sslmode=require") || databaseUrl.includes("sslmode=verify");
  const pool = new pg.Pool({ connectionString: cleanUrl, max: 5, ssl: useSSL ? { rejectUnauthorized: false } : undefined });
  try {
    const client = await pool.connect();
    client.release();
    log(`Connected to ${label} database`);
    return {
      label,
      mode: "pg",
      query: (sql) => pool.query(sql),
      connect: () => pool.connect(),
      end: () => pool.end(),
    };
  } catch (err) {
    await pool.end().catch(() => {});
    if (!SUPABASE_ACCESS_TOKEN || !managementProjectRef) {
      fail(`Cannot connect to ${label} database: ${err.message}`);
    }
    warn(`Direct ${label} Postgres auth failed (${err.message}); falling back to Supabase Management API query endpoint.`);
    log(`Connected to ${label} database via Supabase Management API`);
    return {
      label,
      mode: "management",
      query: managementQuery,
      connect: async () => ({
        query: managementQuery,
        release() {},
      }),
      async end() {},
    };
  }
}

// ─── SQL queries ──────────────────────────────────────────────────────────────

const ALL_TABLES_QUERY = `
  SELECT relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY relname
`;

// ─── Code grep ───────────────────────────────────────────────────────────────

const SEARCH_ROOTS = [
  path.join(repoRoot, "frontend", "src"),
  path.join(repoRoot, "backend", "src"),
];
const MIGRATION_ROOT = path.join(repoRoot, "supabase", "migrations");

const EXCLUDE_PATTERNS = [
  "__tests__",
  "node_modules",
  ".next",
  ".claude/worktrees",
  "dist",
  ".archive",
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((p) => filePath.includes(p));
}

/** Walk a directory recursively, yielding file paths */
function* walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldExclude(full)) continue;
    if (entry.isDirectory()) yield* walkDir(full);
    else if (entry.isFile()) yield full;
  }
}

/** Classify a reference as read/write/unknown based on surrounding lines */
function classifyRef(lines, lineIdx) {
  const context = lines
    .slice(Math.max(0, lineIdx - 1), Math.min(lines.length, lineIdx + 4))
    .join(" ");
  if (/\.(insert|update|upsert|delete)\b/.test(context)) return "write";
  if (/\.(select|maybeSingle|single|csv|explain|count)\b/.test(context)) return "read";
  return "unknown";
}

function escapeSnippet(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 120);
}

/** Find all code references for a given table name */
function grepTable(tableName) {
  /** @type {{ filePath: string; lineNumber: number; kind: string; snippet: string }[]} */
  const writes = [];
  const reads = [];
  const migrations = [];
  const unknown = [];

  // Source code patterns
  const quotedTable = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const codePattern = new RegExp(
    `\\.from\\(['"](?:${quotedTable})['"]\\)|\\.table\\(['"](?:${quotedTable})['"]\\)`,
    "g"
  );

  for (const root of SEARCH_ROOTS) {
    for (const filePath of walkDir(root)) {
      if (!filePath.match(/\.(ts|tsx|js|jsx|py|mjs|cjs)$/)) continue;
      let content;
      try {
        content = fs.readFileSync(filePath, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        codePattern.lastIndex = 0;
        if (codePattern.test(line)) {
          const kind = classifyRef(lines, idx);
          const ref = {
            filePath: path.relative(repoRoot, filePath),
            lineNumber: idx + 1,
            kind,
            snippet: escapeSnippet(line),
          };
          if (kind === "write") writes.push(ref);
          else if (kind === "read") reads.push(ref);
          else unknown.push(ref);
        }
        codePattern.lastIndex = 0;
      });
    }
  }

  // Migration files
  const migrationPattern = new RegExp(
    `(?:FROM|INTO|UPDATE|ON)\\s+(?:public\\.)?${quotedTable}(?:\\s|\\(|;)`,
    "gi"
  );

  if (fs.existsSync(MIGRATION_ROOT)) {
    for (const filePath of walkDir(MIGRATION_ROOT)) {
      if (!filePath.endsWith(".sql")) continue;
      let content;
      try {
        content = fs.readFileSync(filePath, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        migrationPattern.lastIndex = 0;
        if (migrationPattern.test(line)) {
          migrations.push({
            filePath: path.relative(repoRoot, filePath),
            lineNumber: idx + 1,
            kind: "migration",
            snippet: escapeSnippet(line),
          });
        }
        migrationPattern.lastIndex = 0;
      });
    }
  }

  return { writes, reads, migrations, unknown };
}

// ─── Schema drift check ───────────────────────────────────────────────────────

async function checkSchemaDrift(mainDb, ragDb) {
  const mainResult = await mainDb.query(ALL_TABLES_QUERY);
  const ragResult = await ragDb.query(ALL_TABLES_QUERY);

  const mainTables = new Set(mainResult.rows.map((r) => r.relname));
  const ragTables = new Set(ragResult.rows.map((r) => r.relname));

  const missing = [];
  const stale = [];

  // Check DB tables not in YAML
  for (const t of mainTables) {
    if (!yamlByName.has(`${t}:MAIN`)) {
      missing.push({ table: t, db: "MAIN" });
    }
  }
  for (const t of ragTables) {
    if (!yamlByName.has(`${t}:RAG`)) {
      missing.push({ table: t, db: "RAG" });
    }
  }

  // Check YAML entries where the DB table no longer exists
  for (const [, entry] of yamlByName) {
    const name = entry.name;
    const dbSet = entry.db === "MAIN" ? mainTables : ragTables;
    if (!dbSet.has(name)) {
      stale.push({ table: name, db: entry.db });
    }
  }

  if (missing.length > 0) {
    console.error("\n[db-inventory] ❌ Schema drift detected — tables in DB but missing from tables.yaml:");
    for (const { table, db } of missing) {
      console.error(`  Missing: ${table} (${db})`);
      console.error(`  Add this stub to tables.yaml:`);
      console.error(`    - name: ${table}`);
      console.error(`      db: ${db}`);
      console.error(`      domain: unknown`);
      console.error(`      status: dormant`);
      console.error(`      purpose: |`);
      console.error(`        TODO: Document this table.`);
      console.error(`      gotchas: null`);
      console.error(`      cleanup_priority: null`);
      console.error(`      owner: unknown`);
      console.error(`      related_tables: []`);
      console.error(`      notes_for_ai: null`);
      console.error();
    }
  }

  if (stale.length > 0) {
    console.error("\n[db-inventory] ❌ Stale YAML entries — tables in tables.yaml but no longer in DB:");
    for (const { table, db } of stale) {
      console.error(`  Stale: ${table} (${db}) — remove from tables.yaml`);
    }
  }

  if (missing.length > 0 || stale.length > 0) {
    process.exit(1);
  }

  log("Schema drift check passed ✓");
  return { mainTables, ragTables };
}

// ─── Markdown table list (agent-facing) ───────────────────────────────────────

function renderTableListMarkdown(tableEntries, generatedAt) {
  const escape = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

  const fmtRows = (n) => {
    if (!n) return "0";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return String(n);
  };

  // Strip trailing/embedded "N code references" sentences from purpose —
  // that count belongs in its own column now and rotted in the YAML.
  const stripCodeRefs = (s) =>
    String(s ?? "")
      .replace(/\s*\d+\s+code\s+references?\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

  function renderSection(dbLabel, entries) {
    if (entries.length === 0) return `_(no ${dbLabel} tables)_\n`;
    const sorted = [...entries].sort((a, b) => {
      const da = a.entry.domain || "";
      const db = b.entry.domain || "";
      if (da !== db) return da.localeCompare(db);
      return a.entry.name.localeCompare(b.entry.name);
    });

    let out = "| Table | Domain | Status | Rows | Code refs | Purpose | Notes |\n";
    out += "|---|---|---|---:|---:|---|---|\n";
    for (const { entry, liveStats, refs } of sorted) {
      const codeRefs = refs.writes.length + refs.reads.length + refs.unknown.length;
      const notes = entry.notes_for_ai || entry.gotchas || "";
      out += `| \`${entry.name}\` | ${escape(entry.domain)} | ${escape(entry.status)} | ${fmtRows(liveStats.approxRows)} | ${codeRefs} | ${escape(truncate(stripCodeRefs(entry.purpose), 160))} | ${escape(truncate(notes, 160))} |\n`;
    }
    return out;
  }

  const main = tableEntries.filter((t) => t.entry.db === "MAIN");
  const rag = tableEntries.filter((t) => t.entry.db === "RAG");

  const statusCounts = (entries) => {
    const counts = {};
    for (const { entry } of entries) counts[entry.status] = (counts[entry.status] || 0) + 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${v} ${k}`)
      .join(" · ");
  };

  return `# Database Tables — Live List

> **AUTO-GENERATED — DO NOT EDIT BY HAND.**
> Regenerate with \`npm run db:inventory\`. Source: \`docs/architecture/tables.yaml\` + live Supabase stats.
> Last generated: ${generatedAt}

This file lists every table in both Supabase projects with its current status, row count, code-reference count, one-line purpose, and any gotchas/notes. It is the fastest way to answer "does table X exist, what does it do, is it live, does anything use it?"

Column meanings:
- **Rows** — approximate row count from \`pg_class.reltuples\` (refreshed each regenerate).
- **Code refs** — count of \`.from("table")\` / \`.table("table")\` references in \`frontend/src\`, \`backend/src\`, and \`alleato-ai\`. Does NOT include migration files or one-off scripts. **0 code refs + 0 rows = strong drop candidate.** **0 code refs + N rows = stale data, no readers.**
- **Notes** — uses notesForAi when set, otherwise gotchas, from tables.yaml.

For richer information (full writer/reader file lists, columns, line numbers), open the admin UI at \`/database-inventory\` or read the source: \`docs/architecture/tables.yaml\`. For architectural narrative + dated corrections, read \`docs/architecture/TABLE-INVENTORY.md\`.

**How to update:** edit \`docs/architecture/tables.yaml\` and run \`npm run db:inventory\`. This file is regenerated from that source.

---

## MAIN — PM App database (\`lgveqfnpkxvzbnnwuled\`)

${main.length} tables · ${statusCounts(main)}

${renderSection("MAIN", main)}

---

## RAG — AI Database (\`fqcvmfqldlewvbsuxdvz\`)

${rag.length} tables · ${statusCounts(rag)}

${renderSection("RAG", rag)}
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`Mode: ${CHECK_ONLY ? "check-only" : "full regenerate"}`);

  const mainDb = await createDatabaseClient({
    databaseUrl: MAIN_DB_URL,
    supabaseUrl: MAIN_SUPABASE_URL,
    label: "MAIN",
  });
  const ragDb = await createDatabaseClient({
    databaseUrl: RAG_DB_URL,
    supabaseUrl: RAG_SUPABASE_URL,
    label: "RAG",
  });

  try {
    // Phase 1: Schema drift check
    await checkSchemaDrift(mainDb, ragDb);

    if (CHECK_ONLY) {
      log("Check-only mode: no output file written.");
      return;
    }

    const generatedAt = new Date().toISOString();
    const tableEntries = [];

    const allEntries = [...yamlByName.values()];
    log(`Processing ${allEntries.length} tables...`);

    for (let i = 0; i < allEntries.length; i++) {
      const entry = allEntries[i];
      if (i > 0 && i % 50 === 0) log(`  ${i}/${allEntries.length} processed...`);

      const db = entry.db === "MAIN" ? mainDb : ragDb;
      const refreshedAt = new Date().toISOString();

      // Stats
      let liveStats = {
        approxRows: 0,
        totalSize: "0 bytes",
        lastAutoanalyze: null,
        nLiveTup: 0,
        nDeadTup: 0,
        refreshedAt,
      };
      try {
        const statsResult = await db.query(statsQuery(entry.name));
        if (statsResult.rows.length > 0) {
          const row = statsResult.rows[0];
          liveStats = {
            approxRows: Number(row.approx_rows) || 0,
            totalSize: row.total_size || "0 bytes",
            lastAutoanalyze: normalizeTimestamp(row.last_autoanalyze),
            nLiveTup: Number(row.n_live_tup) || 0,
            nDeadTup: Number(row.n_dead_tup) || 0,
            refreshedAt,
          };
        }
      } catch (err) {
        warn(`Could not get stats for ${entry.name}: ${err.message}`);
      }

      // pg_class.reltuples and pg_stat_user_tables.n_live_tup are estimates that
      // only update during VACUUM/ANALYZE — so any table that grew since its last
      // analyze (or has never been analyzed) reports a wrong count. Always run a
      // real COUNT(*) and trust it over the estimate. Cap at 5s so a multi-million-
      // row table can't hang the run; on timeout we keep the estimate.
      {
        let client;
        try {
          client = await db.connect();
          if (db.mode === "pg") {
            await client.query("SET LOCAL statement_timeout = '5s'");
          }
          const cnt = await client.query(countQuery(entry.name));
          const real = Number(cnt.rows[0].n) || 0;
          liveStats.approxRows = real;
          liveStats.nLiveTup = real;
        } catch (err) {
          // Timeout or permission error — leave the estimate in place and warn so
          // the operator knows that specific table's row count is approximate.
          if (String(err.message).includes("statement timeout")) {
            warn(`COUNT(*) timed out for ${entry.name} — using stale estimate (${liveStats.approxRows})`);
          } else {
            warn(`COUNT(*) failed for ${entry.name}: ${err.message}`);
          }
        } finally {
          if (client) client.release();
        }
      }

      // Columns
      let columns = [];
      try {
        const colResult = await db.query(columnsQuery(entry.name));
        columns = colResult.rows.map((r) => ({
          name: r.column_name,
          dataType: r.data_type,
          isNullable: r.is_nullable === "YES",
        }));
      } catch (err) {
        warn(`Could not get columns for ${entry.name}: ${err.message}`);
      }

      // Code grep
      const refs = grepTable(entry.name);

      tableEntries.push({ entry, liveStats, columns, refs });
    }

    log("Generating output file...");

    // ─── Emit .generated.ts ─────────────────────────────────────────────────

    const outputPath = path.join(
      repoRoot,
      "frontend",
      "src",
      "components",
      "dev-tools"
    );
    const outputTsPath = path.join(outputPath, "db-inventory.generated.ts");
    const outputJsonPath = path.join(outputPath, "db-inventory.generated.json");

    const inventoryPayload = {
      generatedAt,
      generatorVersion: "1",
      tables: tableEntries.map(({ entry, liveStats, columns, refs }) => ({
        name: entry.name,
        db: entry.db,
        domain: entry.domain,
        status: entry.status,
        purpose: entry.purpose ? String(entry.purpose).trim() : "",
        gotchas: entry.gotchas ? String(entry.gotchas).trim() : null,
        cleanupPriority: entry.cleanup_priority ?? null,
        owner: entry.owner || "unknown",
        relatedTables: Array.isArray(entry.related_tables) ? entry.related_tables : [],
        notesForAi: entry.notes_for_ai ? String(entry.notes_for_ai).trim() : null,
        liveStats,
        columns,
        references: refs,
      })),
    };
    const serializedInventoryJson = JSON.stringify(inventoryPayload, null, 2);

    const output = `// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Regenerate with: npm run db:inventory
// Source: docs/architecture/tables.yaml + live Supabase (MAIN + RAG) + codebase grep.
// Generated: ${generatedAt}

import inventoryJson from "./db-inventory.generated.json";

export type DbInventoryStatus =
${[...new Set([...yamlByName.values()].map((e) => e.status))].sort().map((status) => `  | ${JSON.stringify(status)}`).join("\n")};

export type DbInventoryDomain =
${[...new Set([...yamlByName.values()].map((e) => e.domain))].sort().map((d) => `  | ${JSON.stringify(d)}`).join("\n")};

export type DbInventoryReference = {
  filePath: string;
  lineNumber: number;
  kind: "read" | "write" | "migration" | "unknown";
  snippet: string;
};

export type DbInventoryTable = {
  name: string;
  db: "MAIN" | "RAG";
  domain: DbInventoryDomain;
  status: DbInventoryStatus;
  purpose: string;
  gotchas: string | null;
  cleanupPriority: "low" | "medium" | "high" | null;
  owner: string;
  relatedTables: string[];
  notesForAi: string | null;
  liveStats: {
    approxRows: number;
    totalSize: string;
    lastAutoanalyze: string | null;
    nLiveTup: number;
    nDeadTup: number;
    refreshedAt: string;
  };
  columns: Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
  }>;
  references: {
    writes: DbInventoryReference[];
    reads: DbInventoryReference[];
    migrations: DbInventoryReference[];
    unknown: DbInventoryReference[];
  };
};

export type DbInventory = {
  generatedAt: string;
  generatorVersion: "1";
  tables: DbInventoryTable[];
};

export const DB_INVENTORY: DbInventory = inventoryJson as DbInventory;
`;

    fs.writeFileSync(outputTsPath, output, "utf8");
    fs.writeFileSync(outputJsonPath, `${serializedInventoryJson}\n`, "utf8");
    const sizeKB = Math.round(Buffer.byteLength(output, "utf8") / 1024);
    const jsonSizeKB = Math.round(Buffer.byteLength(serializedInventoryJson, "utf8") / 1024);
    log(`✅ Written: ${outputTsPath} (${sizeKB} KB, ${tableEntries.length} tables)`);
    log(`✅ Written: ${outputJsonPath} (${jsonSizeKB} KB JSON payload)`);

    if (jsonSizeKB > 500) {
      warn(`JSON payload is ${jsonSizeKB} KB — consider reducing snippet length if this causes issues.`);
    }

    // ─── Emit TABLE-LIST.md (agent-facing, two tables per DB) ──────────────
    const tableListPath = path.join(repoRoot, "docs", "architecture", "TABLE-LIST.md");
    fs.writeFileSync(tableListPath, renderTableListMarkdown(tableEntries, generatedAt), "utf8");
    log(`✅ Written: ${tableListPath}`);
  } finally {
    await mainDb.end();
    await ragDb.end();
  }
}

main().catch((err) => {
  console.error(`[db-inventory] Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
