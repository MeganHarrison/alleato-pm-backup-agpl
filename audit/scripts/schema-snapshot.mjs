#!/usr/bin/env node
/**
 * schema-snapshot.mjs — Tamper-evident structural snapshot of a Postgres database.
 *
 * Captures, for one database at a point in time:
 *   - every table in the public schema
 *   - every column (name, type, nullable) per table
 *   - an exact row count per table
 *
 * This is the "tripwire" baseline. Run it on a schedule; diff consecutive
 * snapshots with schema-diff.mjs to detect dropped tables, removed columns, and
 * row counts that crater — the class of destructive change that breaks features
 * with no warning.
 *
 * READ-ONLY. It never writes to the database it inspects.
 *
 * Usage:
 *   node scripts/audit/schema-snapshot.mjs --url "$DATABASE_URL" --label pm-app --out ./snapshots
 *   node scripts/audit/schema-snapshot.mjs --url "$RAG_DATABASE_URL" --label rag --out ./snapshots
 *
 * Env fallback: --url defaults to process.env.SNAPSHOT_DATABASE_URL.
 *
 * Output: one JSON file  <out>/<label>__<UTC-ISO>.json  and prints its path.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

function parseArgs(argv) {
  const args = { out: "./snapshots", label: "db", url: process.env.SNAPSHOT_DATABASE_URL };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--url") args.url = argv[++i];
    else if (key === "--label") args.label = argv[++i];
    else if (key === "--out") args.out = argv[++i];
    else if (key === "--stamp") args.stamp = argv[++i]; // injectable clock (Date.* is blocked in some harnesses)
  }
  return args;
}

async function listTables(client) {
  const { rows } = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`,
  );
  return rows.map((r) => r.table_name);
}

async function listColumns(client) {
  const { rows } = await client.query(
    `select table_name, column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position`,
  );
  const byTable = {};
  for (const r of rows) {
    (byTable[r.table_name] ||= []).push({
      column: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === "YES",
    });
  }
  return byTable;
}

async function rowCount(client, table) {
  // Exact count. Quoted identifier guards against reserved-word table names.
  const { rows } = await client.query(`select count(*)::bigint as n from "${table}"`);
  return Number(rows[0].n);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url) {
    console.error("ERROR: no database URL. Pass --url or set SNAPSHOT_DATABASE_URL.");
    process.exit(2);
  }
  const stamp = args.stamp ?? new Date().toISOString();

  // Strip any sslmode from the URL so our explicit ssl object wins (Supabase
  // presents a self-signed chain; verify-full would reject it).
  const sanitizedUrl = args.url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, "");
  const client = new pg.Client({
    connectionString: sanitizedUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });
  await client.connect();

  let snapshot;
  try {
    const tables = await listTables(client);
    const columns = await listColumns(client);

    const tableRecords = {};
    let totalRows = 0;
    for (const t of tables) {
      let count = null;
      try {
        count = await rowCount(client, t);
        totalRows += count;
      } catch (err) {
        count = `ERROR: ${err.message}`;
      }
      tableRecords[t] = { columns: columns[t] ?? [], row_count: count };
    }

    snapshot = {
      label: args.label,
      captured_at: stamp,
      table_count: tables.length,
      total_rows: totalRows,
      tables: tableRecords,
    };
  } finally {
    await client.end();
  }

  await mkdir(args.out, { recursive: true });
  const safeStamp = stamp.replace(/[:.]/g, "-");
  const file = join(args.out, `${args.label}__${safeStamp}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 2));

  console.log(
    `[snapshot] ${args.label}: ${snapshot.table_count} tables, ${snapshot.total_rows.toLocaleString()} rows`,
  );
  console.log(file);
}

main().catch((err) => {
  console.error("[snapshot] FAILED:", err.message);
  process.exit(1);
});
