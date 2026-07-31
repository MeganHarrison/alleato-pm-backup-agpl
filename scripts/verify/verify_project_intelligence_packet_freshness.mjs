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

const projectIds = parseProjectIds(args.get("project-ids") ?? args.get("projects"));
const maxAgeHours = numberArg("max-age-hours", 8);
const requiredCompilerVersion = args.get("compiler-version") ?? "project_intelligence_synthesis_v1";

if (!projectIds.length) {
  console.error("Provide --project-ids as a comma-separated list, for example --project-ids 67,876,1009.");
  process.exit(1);
}

function parseProjectIds(raw) {
  return String(raw ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

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

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

try {
  appClient = await appPool.connect();
  ragClient = await ragPool.connect();
  await appClient.query("set statement_timeout = '20000ms'");
  await ragClient.query("set statement_timeout = '20000ms'");

  const { rows: packetRows } = await appClient.query(
    `
      with current_packet as (
        select distinct on (t.project_id)
          t.project_id,
          ip.id,
          ip.generated_at,
          ip.covered_end_at,
          ip.freshness_status,
          ip.compiler_version,
          ip.packet_json,
          ip.source_coverage
        from public.intelligence_targets t
        join public.intelligence_packets ip
          on ip.target_id = t.id
         and ip.packet_type = 'current'
        where t.project_id = any($1::int[])
        order by t.project_id, ip.generated_at desc nulls last, ip.created_at desc nulls last
      ),
      latest_app as (
        select distinct on (dm.project_id)
          dm.project_id::int as project_id,
          dm.id,
          dm.title,
          dm.type,
          coalesce(dm.date, dm.source_last_modified_at, dm.captured_at, dm.created_at::timestamptz) as source_at
        from public.document_metadata dm
        where dm.project_id = any($1::bigint[])
          and dm.deleted_at is null
        order by dm.project_id, coalesce(dm.date, dm.source_last_modified_at, dm.captured_at, dm.created_at::timestamptz) desc nulls last
      ),
      packet_sources as (
        select
          cp.project_id,
          jsonb_array_length(coalesce(cp.packet_json #> '{sourceSet,sources}', '[]'::jsonb)) as source_count,
          array_agg(source_row ->> 'id') as source_ids
        from current_packet cp
        left join lateral jsonb_array_elements(coalesce(cp.packet_json #> '{sourceSet,sources}', '[]'::jsonb)) source_row on true
        group by cp.project_id, cp.packet_json
      )
      select
        p.id as project_id,
        p.name as project_name,
        cp.id as packet_id,
        cp.generated_at,
        cp.covered_end_at,
        cp.freshness_status,
        cp.compiler_version,
        cp.source_coverage ->> 'latestSourceAt' as packet_latest_source_at,
        extract(epoch from (now() - cp.generated_at)) / 3600 as age_hours,
        coalesce(ps.source_count, 0) as source_count,
        la.id as latest_app_source_id,
        la.title as latest_app_title,
        la.type as latest_app_type,
        la.source_at as latest_app_source_at,
        coalesce(la.id = any(ps.source_ids), false) as latest_app_in_packet_sources
      from public.projects p
      left join current_packet cp on cp.project_id = p.id
      left join latest_app la on la.project_id = p.id
      left join packet_sources ps on ps.project_id = p.id
      where p.id = any($1::int[])
      order by p.id
    `,
    [projectIds],
  );

  const { rows: ragRows } = await ragClient.query(
    `
      with latest_rag as (
        select distinct on (project_id)
          project_id,
          id,
          app_document_id,
          title,
          type,
          coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at, created_at) as loaded_at,
          parsing_status,
          embedding_status
        from public.rag_document_metadata
        where project_id = any($1::int[])
        order by project_id, coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at, created_at) desc nulls last
      ),
      agg as (
        select
          project_id,
          count(*)::int as total_rag_docs,
          count(*) filter (where embedding_status is distinct from 'embedded')::int as not_embedded_count,
          max(coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at, created_at)) as latest_rag_loaded_at
        from public.rag_document_metadata
        where project_id = any($1::int[])
        group by project_id
      )
      select
        agg.*,
        latest_rag.id as latest_rag_id,
        latest_rag.app_document_id as latest_rag_app_document_id,
        latest_rag.title as latest_rag_title,
        latest_rag.type as latest_rag_type,
        latest_rag.loaded_at as latest_rag_loaded_at_row,
        latest_rag.parsing_status as latest_rag_parsing_status,
        latest_rag.embedding_status as latest_rag_embedding_status
      from agg
      join latest_rag using (project_id)
      order by project_id
    `,
    [projectIds],
  );

  const ragByProject = new Map(ragRows.map((row) => [Number(row.project_id), row]));
  const checked = packetRows.map((row) => {
    const rag = ragByProject.get(Number(row.project_id));
    const failures = [];
    const warnings = [];
    const generatedAtMs = row.generated_at ? new Date(row.generated_at).getTime() : NaN;
    const latestRagMs = rag?.latest_rag_loaded_at ? new Date(rag.latest_rag_loaded_at).getTime() : NaN;

    if (!row.packet_id) failures.push("missing current packet");
    if (row.compiler_version !== requiredCompilerVersion) {
      failures.push(`compiler_version=${row.compiler_version ?? "null"} expected ${requiredCompilerVersion}`);
    }
    if (!Number.isFinite(generatedAtMs)) failures.push("packet generated_at is missing or invalid");
    if (Number(row.age_hours) > maxAgeHours) {
      failures.push(`packet age ${Number(row.age_hours).toFixed(2)}h exceeds ${maxAgeHours}h`);
    }
    if (Number(row.source_count) <= 0) failures.push("packet sourceSet is empty");
    if (row.latest_app_source_id && !row.latest_app_in_packet_sources) {
      failures.push("latest app document_metadata source is not present in packet sourceSet");
    }
    if (Number.isFinite(generatedAtMs) && Number.isFinite(latestRagMs) && latestRagMs > generatedAtMs) {
      failures.push("RAG has source material loaded after packet generated_at");
    }
    if (rag && Number(rag.not_embedded_count) > 0) {
      warnings.push(`${rag.not_embedded_count} RAG source rows are not embedded`);
    }
    if (rag?.latest_rag_embedding_status !== "embedded") {
      warnings.push(`latest RAG source embedding_status=${rag?.latest_rag_embedding_status ?? "null"}`);
    }

    return {
      projectId: Number(row.project_id),
      projectName: row.project_name,
      packetId: row.packet_id,
      generatedAt: iso(row.generated_at),
      coveredEndAt: iso(row.covered_end_at),
      freshnessStatus: row.freshness_status,
      compilerVersion: row.compiler_version,
      ageHours: Number(row.age_hours ?? 0),
      sourceCount: Number(row.source_count ?? 0),
      latestApp: {
        id: row.latest_app_source_id,
        title: row.latest_app_title,
        type: row.latest_app_type,
        sourceAt: iso(row.latest_app_source_at),
        inPacketSources: Boolean(row.latest_app_in_packet_sources),
      },
      latestRag: rag
        ? {
            id: rag.latest_rag_id,
            appDocumentId: rag.latest_rag_app_document_id,
            title: rag.latest_rag_title,
            type: rag.latest_rag_type,
            loadedAt: iso(rag.latest_rag_loaded_at),
            parsingStatus: rag.latest_rag_parsing_status,
            embeddingStatus: rag.latest_rag_embedding_status,
            totalRagDocs: Number(rag.total_rag_docs ?? 0),
            notEmbeddedCount: Number(rag.not_embedded_count ?? 0),
          }
        : null,
      failures,
      warnings,
    };
  });

  const summary = {
    ok: checked.every((row) => row.failures.length === 0),
    projectIds,
    maxAgeHours,
    checked,
  };

  const output = JSON.stringify(summary, null, 2);
  if (!summary.ok) {
    console.error(output);
    process.exit(1);
  }
  console.log(output);
} finally {
  appClient?.release();
  ragClient?.release();
  await Promise.all([appPool.end(), ragPool.end()]);
}
