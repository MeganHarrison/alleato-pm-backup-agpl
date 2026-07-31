#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(repoRoot, ".env"));

const sourceUrl = process.env.APP_METADATA_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const ragUrl = process.env.RAG_DATABASE_URL;

if (!sourceUrl) throw new Error("APP_METADATA_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is required.");
if (!ragUrl) throw new Error("RAG_DATABASE_URL is required.");

const tables = [
  "document_attribution_candidates",
  "fireflies_ingestion_jobs",
  "ingestion_dead_letter",
  "ingestion_jobs",
  "packet_refresh_jobs",
  "rag_pipeline_state",
  "source_intelligence_jobs",
  "source_signal_candidates",
  "source_sync_health_snapshots",
  "source_sync_runs",
];

const sourceSql = postgres(sourceUrl, { max: 1, ssl: "require", idle_timeout: 5 });
const ragSql = postgres(ragUrl, { max: 1, ssl: "require", idle_timeout: 5, prepare: false });
const insertBatchSize = Number(process.env.RAG_TABLE_COPY_BATCH_SIZE || "500");

function tableIdentifier(sql, table) {
  return sql.unsafe(`public.${table}`);
}

async function tableColumns(sql, table) {
  const rows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
    order by ordinal_position
  `;
  return rows.map((row) => row.column_name);
}

async function primaryKeyColumns(sql, table) {
  const rows = await sql`
    select a.attname as column_name
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = any(i.indkey)
    where i.indrelid = ${`public.${table}`}::regclass
      and i.indisprimary
    order by array_position(i.indkey, a.attnum)
  `;
  return rows.map((row) => row.column_name);
}

async function copyTable(table) {
  const [sourceColumns, ragColumns, primaryKeys] = await Promise.all([
    tableColumns(sourceSql, table),
    tableColumns(ragSql, table),
    primaryKeyColumns(ragSql, table),
  ]);
  const columns = sourceColumns.filter((column) => ragColumns.includes(column));
  if (!columns.length) throw new Error(`${table}: no shared columns`);

  const rows = await sourceSql`select ${sourceSql(columns)} from ${tableIdentifier(sourceSql, table)}`;
  if (!rows.length) {
    return { table, sourceRows: 0, copiedRows: 0 };
  }

  for (let index = 0; index < rows.length; index += insertBatchSize) {
    const batch = rows.slice(index, index + insertBatchSize);
    await ragSql`
      insert into ${tableIdentifier(ragSql, table)} ${ragSql(batch, columns)}
      ${primaryKeys.length ? ragSql`on conflict do nothing` : ragSql``}
    `;
  }
  return { table, sourceRows: rows.length, copiedRows: rows.length };
}

try {
  for (const table of tables) {
    const result = await copyTable(table);
    console.log(`${result.table}\tsource=${result.sourceRows}\tcopied=${result.copiedRows}`);
  }
} finally {
  await Promise.allSettled([sourceSql.end(), ragSql.end()]);
}
