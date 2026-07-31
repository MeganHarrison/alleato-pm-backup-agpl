#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), override: false, quiet: true });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  args.set(arg.slice(2), next && !next.startsWith("--") ? next : "true");
}

const lookbackDays = numberArg("days", 1);
const family = args.get("family") ?? "fireflies";

function numberArg(name, fallback) {
  const raw = args.get(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--${name} must be a positive number.`);
    process.exit(1);
  }
  return value;
}

if (family !== "fireflies") {
  console.error("Only --family fireflies is supported by this verifier slice.");
  process.exit(1);
}

const appDatabaseUrl = getAppDatabaseUrl();
const ragDatabaseUrl = getRagDatabaseUrl();
if (!appDatabaseUrl || !ragDatabaseUrl) {
  console.error("App and RAG database URLs are required.");
  process.exit(1);
}

const appPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(appDatabaseUrl, { includeSslMode: false }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});
const ragPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(ragDatabaseUrl, {
    includeSslMode: false,
    rewriteSupabaseDirectHost: false,
  }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

let appClient;
let ragClient;

async function connectOrFail(pool, label) {
  try {
    return await pool.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error?.code ? ` code=${error.code}` : "";
    console.error(`${label} connection failed:${code} ${message}`);
    console.error(
      label === "RAG database"
        ? "RAG read-proof verification cannot prove source intelligence jobs or full-source read proof while the AI/RAG database is unreachable."
        : "App database read-proof verification cannot prove document metadata or packet evidence while the PM app database is unreachable.",
    );
    process.exit(1);
  }
}

try {
  appClient = await connectOrFail(appPool, "App database");
  ragClient = await connectOrFail(ragPool, "RAG database");

  const { rows: sourceRows } = await appClient.query(
    `
      select
        dm.id,
        dm.title,
        dm.project_id,
        max(e.created_at) as latest_evidence_at
      from public.document_metadata dm
      join public.insight_card_evidence e
        on e.source_document_id = dm.id
      where dm.source = 'fireflies'
        and dm.project_id is not null
        and coalesce(dm.date, dm.created_at) >= now() - ($1::text || ' days')::interval
        and coalesce(dm.status, '') not in ('deleted', 'deleted_no_transcript', 'archived')
      group by dm.id, dm.title, dm.project_id
      order by max(e.created_at) desc nulls last
    `,
    [lookbackDays],
  );

  const ids = sourceRows.map((row) => row.id);
  let proofRows = [];
  if (ids.length) {
    const result = await ragClient.query(
      `
        select distinct on (source_document_id)
          source_document_id,
          status,
          updated_at,
          metadata
        from (
          select
            source_document_id,
            status,
            updated_at,
            metadata
          from public.source_processing_jobs
          where source_document_id = any($1::text[])

          union all

          select
            source_document_id,
            status,
            updated_at,
            output_summary as metadata
          from public.source_intelligence_jobs
          where source_document_id = any($1::text[])
            and status = 'succeeded'
        ) jobs
        order by
          source_document_id,
          coalesce(
            (metadata -> 'read_proof' ->> 'status') = 'full_source_read'
            and (metadata -> 'read_proof' ->> 'scope') = 'full_transcript',
            false
          ) desc,
          updated_at desc
      `,
      [ids],
    );
    proofRows = result.rows;
  }

  const proofById = new Map(proofRows.map((row) => [row.source_document_id, row]));
  const failures = sourceRows
    .map((row) => {
      const proofRow = proofById.get(row.id);
      const readProof = proofRow?.metadata?.read_proof;
      const valid =
        readProof?.status === "full_source_read" &&
        readProof?.scope === "full_transcript";
      if (valid) return null;
      return {
        source_document_id: row.id,
        title: row.title,
        latest_evidence_at: row.latest_evidence_at,
        latest_ledger_status: proofRow?.status ?? null,
        latest_ledger_updated_at: proofRow?.updated_at ?? null,
        missing: "metadata.read_proof.status=full_source_read scope=full_transcript",
      };
    })
    .filter(Boolean);

  const summary = {
    ok: failures.length === 0,
    family,
    lookbackDays,
    checked: sourceRows.length,
    failures,
  };

  if (failures.length) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  appClient?.release();
  ragClient?.release();
  await Promise.all([appPool.end(), ragPool.end()]);
}
