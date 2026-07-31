import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  buildAppDatabaseConnectionString,
} from "../app-db-connection.mjs";
import { RAG_DATABASE_CONNECTION_OPTIONS } from "../../../project-intelligence/ingestion/rag-database-connection.mjs";

test("normalizes the RAG Supabase direct host to its regional pooler", async () => {
  const connectionString = await buildAppDatabaseConnectionString(
    "postgresql://postgres:secret@db.fqcvmfqldlewvbsuxdvz.supabase.co:5432/postgres?sslmode=require",
    RAG_DATABASE_CONNECTION_OPTIONS,
  );
  const url = new URL(connectionString);

  assert.equal(url.hostname, "aws-1-us-east-1.pooler.supabase.com");
  assert.equal(url.username, "postgres.fqcvmfqldlewvbsuxdvz");
  assert.equal(url.searchParams.has("sslmode"), false);
});

test("database inventory reuses the shared Supabase pooler contract", async () => {
  const source = await fs.readFile(
    new URL("../../dev-tools/generate-db-inventory.mjs", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /import \{ buildAppDatabaseConnectionString \} from "\.\.\/verify\/app-db-connection\.mjs"/,
  );
  assert.match(
    source,
    /buildAppDatabaseConnectionString\(\s*databaseUrl,\s*\{[\s\S]*includeSslMode:\s*false/,
  );
});

test("database inventory batches Management API reads and rejects incomplete snapshots", async () => {
  const source = await fs.readFile(
    new URL("../../dev-tools/generate-db-inventory.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /async function loadManagementSnapshot\(db, entries\)/);
  assert.match(source, /db\.query\(ALL_STATS_QUERY\)/);
  assert.match(source, /db\.query\(allCountsQuery\(tableNames\)\)/);
  assert.match(source, /db\.query\(ALL_COLUMNS_QUERY\)/);
  assert.match(source, /Management API snapshot is incomplete/);
});

test("all Daily Brief consumer RAG boundaries use the shared pooler contract", async () => {
  const source = await fs.readFile(
    new URL("../../../project-intelligence/projections/daily-deep-read-consumers.mjs", import.meta.url),
    "utf8",
  );
  const ragBoundaries = source.match(/getRagDatabaseUrl\(\),\s*([^,\n]+),/g) ?? [];

  assert.equal(ragBoundaries.length, 2);
  for (const boundary of ragBoundaries) {
    assert.match(boundary, /RAG_DATABASE_CONNECTION_OPTIONS/);
  }
  assert.doesNotMatch(
    source,
    /getRagDatabaseUrl\(\),\s*\{[^}]*rewriteSupabaseDirectHost:\s*false/s,
  );
});
