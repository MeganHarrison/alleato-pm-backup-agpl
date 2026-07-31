#!/usr/bin/env node

/**
 * Backfill missing document/task project assignments from compiler job output.
 *
 * The intelligence compiler already records high-confidence inferred project
 * IDs in RAG-side source_intelligence_jobs. This script copies that durable
 * evidence back into app-side document_metadata/tasks when project_id is still
 * null, then updates the source_processing_jobs ledger to match.
 */

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

const lookbackDays = numberArg("days", "PROJECT_ASSIGNMENT_BACKFILL_DAYS", 14);
const minConfidence = numberArg("min-confidence", "PROJECT_ASSIGNMENT_BACKFILL_MIN_CONFIDENCE", 0.85);
const limit = numberArg("limit", "PROJECT_ASSIGNMENT_BACKFILL_LIMIT", 5_000);
const dryRun = args.get("dry-run") === "true";
const sourceSystemFilter = textArg("source-system", "PROJECT_ASSIGNMENT_BACKFILL_SOURCE_SYSTEM", "");
const tasksOnly = args.get("tasks-only") === "true";

function numberArg(name, envName, fallback) {
  const raw = args.get(name) ?? process.env[envName];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`--${name} must be numeric.`);
    process.exit(1);
  }
  return value;
}

function textArg(name, envName, fallback) {
  const raw = args.get(name) ?? process.env[envName];
  if (raw === undefined) return fallback;
  return String(raw).trim();
}

const appDatabaseUrl = getAppDatabaseUrl();
const ragDatabaseUrl = getRagDatabaseUrl();

if (!appDatabaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}
if (!ragDatabaseUrl) {
  console.error("RAG_DATABASE_URL is required.");
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

const appClient = await appPool.connect();
const ragClient = await ragPool.connect();

try {
  const jobRows = (await ragClient.query(
    `
      select distinct on (source_document_id)
        source_document_id,
        (output_summary->>'project_id')::bigint as project_id,
        coalesce((output_summary->>'confidence_score')::numeric, 0) as confidence_score,
        output_summary,
        updated_at
      from public.source_intelligence_jobs
      where source_document_id is not null
        and (output_summary->>'project_id') is not null
        and coalesce((output_summary->>'confidence_score')::numeric, 0) >= $1
        and updated_at >= now() - ($2::text || ' days')::interval
      order by source_document_id, updated_at desc
      limit $3
    `,
    [minConfidence, lookbackDays, limit],
  )).rows;

  const sourceIds = tasksOnly ? [] : jobRows.map((row) => String(row.source_document_id));
  const docs = sourceIds.length
    ? (await appClient.query(
        `
          select d.id, d.title, d.source, d.category, d.type, d.project_id,
            j.project_id as inferred_project_id, j.confidence_score, p.name as inferred_project_name
          from public.document_metadata d
          join jsonb_to_recordset($1::jsonb) as j(source_document_id text, project_id bigint, confidence_score numeric)
            on j.source_document_id = d.id
          join public.projects p on p.id = j.project_id
          where d.project_id is null
            and d.deleted_at is null
        `,
        [JSON.stringify(jobRows.map((row) => ({
          source_document_id: String(row.source_document_id),
          project_id: Number(row.project_id),
          confidence_score: Number(row.confidence_score),
        })))],
      )).rows
    : [];

  const taskLinkRows = (await appClient.query(
    `
      select t.id, t.title, t.source_system, t.metadata_id,
        t.project_id as task_project_id,
        coalesce(t.project_ids, '{}'::bigint[]) as task_project_ids,
        d.project_id as document_project_id,
        d.title as document_title
      from public.tasks t
      join public.document_metadata d on d.id::text = t.metadata_id::text
      where t.created_at >= now() - ($1::text || ' days')::interval
        and t.source_system in ('fireflies', 'meeting', 'email', 'teams_dm_conversation', 'microsoft_graph')
        and ($3::text = '' or t.source_system = $3::text)
        and d.project_id is not null
        and (
          t.project_id is distinct from d.project_id
          or t.project_ids is null
          or not (d.project_id = any(t.project_ids))
        )
      order by t.created_at desc
      limit $2
    `,
    [lookbackDays, limit, sourceSystemFilter],
  )).rows;

  if (!dryRun && (docs.length > 0 || taskLinkRows.length > 0)) {
    await appClient.query("begin");
    try {
      if (docs.length > 0) {
        await appClient.query(
          `
            update public.document_metadata d
            set project_id = v.project_id,
              project = v.project_name,
              source_metadata = jsonb_set(
                coalesce(d.source_metadata, '{}'::jsonb),
                '{project_assignment_backfill}',
                jsonb_build_object(
                  'status', 'assigned',
                  'source', 'source_intelligence_jobs.output_summary',
                  'confidence_score', v.confidence_score,
                  'assigned_at', now()
                ),
                true
              )
            from (
              select *
              from jsonb_to_recordset($1::jsonb) as x(
                source_document_id text,
                project_id bigint,
                project_name text,
                confidence_score numeric
              )
            ) v
            where d.id = v.source_document_id
              and d.project_id is null
              and d.deleted_at is null
          `,
          [JSON.stringify(docs.map((row) => ({
            source_document_id: String(row.id),
            project_id: Number(row.inferred_project_id),
            project_name: row.inferred_project_name,
            confidence_score: Number(row.confidence_score),
          })))],
        );

        await appClient.query(
          `
            update public.tasks t
            set project_id = v.project_id,
              project_ids = array[v.project_id]::bigint[],
              updated_at = now()
            from (
              select *
              from jsonb_to_recordset($1::jsonb) as x(source_document_id text, project_id bigint)
            ) v
            where t.metadata_id = v.source_document_id
              and t.project_id is null
          `,
          [JSON.stringify(docs.map((row) => ({
            source_document_id: String(row.id),
            project_id: Number(row.inferred_project_id),
          })))],
        );
      }

      if (taskLinkRows.length > 0) {
        await appClient.query(
          `
            update public.tasks t
            set project_id = v.project_id,
              project_ids = case
                when t.project_ids is null then array[v.project_id]::bigint[]
                when v.project_id = any(t.project_ids) then t.project_ids
                else array_append(t.project_ids, v.project_id)
              end,
              extraction_metadata = coalesce(t.extraction_metadata, '{}'::jsonb) || jsonb_build_object(
                'project_assignment_backfill',
                jsonb_build_object(
                  'status', 'assigned_from_source_document',
                  'source', 'document_metadata.project_id',
                  'assigned_at', now()
                )
              ),
              updated_at = now()
            from (
              select *
              from jsonb_to_recordset($1::jsonb) as x(task_id uuid, project_id bigint)
            ) v
            where t.id = v.task_id
          `,
          [JSON.stringify(taskLinkRows.map((row) => ({
            task_id: String(row.id),
            project_id: Number(row.document_project_id),
          })))],
        );
      }

      await appClient.query("commit");

      if (docs.length > 0) {
        await ragClient.query(
          `
            update public.source_processing_jobs j
            set project_id = v.project_id,
              status = case
                when j.status = 'project_assignment_review' then 'project_assigned'
                else j.status
              end,
              updated_at = now(),
              metadata = coalesce(j.metadata, '{}'::jsonb) || jsonb_build_object(
                'project_assignment_backfill',
                jsonb_build_object(
                  'status', 'assigned',
                  'source', 'source_intelligence_jobs.output_summary',
                  'assigned_at', now()
                )
              )
            from (
              select *
              from jsonb_to_recordset($1::jsonb) as x(source_document_id text, project_id bigint)
            ) v
            where j.source_document_id = v.source_document_id
              and j.project_id is null
          `,
          [JSON.stringify(docs.map((row) => ({
            source_document_id: String(row.id),
            project_id: Number(row.inferred_project_id),
          })))],
        );
      }
    } catch (error) {
      await appClient.query("rollback");
      throw error;
    }
  }

  const bySource = docs.reduce((groups, row) => {
    const key = `${row.source}:${row.category}:${row.type}`;
    groups[key] ??= {
      source: row.source,
      category: row.category,
      type: row.type,
      count: 0,
    };
    groups[key].count += 1;
    return groups;
  }, {});

  console.log(JSON.stringify({
    status: "pass",
    dryRun,
    lookbackDays,
    minConfidence,
    sourceSystemFilter: sourceSystemFilter || null,
    tasksOnly,
    compilerJobsConsidered: jobRows.length,
    documentsEligible: docs.length,
    documentsUpdated: dryRun ? 0 : docs.length,
    taskLinksEligible: taskLinkRows.length,
    taskLinksUpdated: dryRun ? 0 : taskLinkRows.length,
    bySource: Object.values(bySource),
    samples: docs.slice(0, 10).map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      category: row.category,
      type: row.type,
      project_id: Number(row.inferred_project_id),
      project: row.inferred_project_name,
      confidence_score: Number(row.confidence_score),
    })),
    taskLinkSamples: taskLinkRows.slice(0, 10).map((row) => ({
      id: row.id,
      title: row.title,
      source_system: row.source_system,
      metadata_id: row.metadata_id,
      document_title: row.document_title,
      project_id: Number(row.document_project_id),
      previous_project_id: row.task_project_id === null ? null : Number(row.task_project_id),
      previous_project_ids: row.task_project_ids,
    })),
  }, null, 2));
} finally {
  appClient.release();
  ragClient.release();
  await appPool.end();
  await ragPool.end();
}
