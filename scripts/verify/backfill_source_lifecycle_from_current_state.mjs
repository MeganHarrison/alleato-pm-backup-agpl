#!/usr/bin/env node

/**
 * Backfill source_processing_jobs from existing app/RAG state.
 *
 * This does not call models or create embeddings. It creates the lifecycle
 * observability rows that let the source lifecycle verifier reason about data
 * already present before the source_processing_jobs ledger existed.
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
import { classifyProjectApplicability } from "./source_lifecycle_project_applicability.mjs";

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

const lookbackDays = numberArg("days", "SOURCE_LIFECYCLE_BACKFILL_DAYS", 14);
const sourceLimit = numberArg("source-limit", "SOURCE_LIFECYCLE_BACKFILL_SOURCE_LIMIT", 5_000);
const dryRun = args.get("dry-run") === "true";

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

function classifySource(row) {
  const source = String(row.source ?? "").toLowerCase();
  const category = String(row.category ?? "").toLowerCase();
  const type = String(row.type ?? "").toLowerCase();
  const id = String(row.id ?? "").toLowerCase();

  if (source === "fireflies") return "fireflies";
  if (source !== "microsoft_graph") return null;
  if (category === "teams_message" || type.includes("teams")) return "teams";
  if (category === "email" || type === "email" || id.startsWith("outlook_")) return "outlook_email";
  if (
    category === "document" ||
    type === "document" ||
    id.startsWith("sharepoint_") ||
    id.startsWith("onedrive_")
  ) {
    return "sharepoint_document";
  }
  if (type === "email_attachment") return "outlook_email";
  return null;
}

function sourceSystemForFamily(family) {
  return {
    fireflies: "fireflies",
    teams: "microsoft_graph_teams",
    outlook_email: "microsoft_graph_outlook",
    sharepoint_document: "microsoft_graph_sharepoint",
  }[family] ?? "unknown";
}

function contentHashFor(row) {
  return String(row.content_hash || row.source_etag || row.source_last_modified_at || row.created_at || "unknown");
}

function statusFor(row, state) {
  if (terminalEmbeddingFailureFor(row)) return "failed_permanent";
  if (!row.project_id) return "project_assignment_review";
  if (state.hasProjectIntelligenceEvidence) return "project_intelligence_updated";
  if (state.hasTask || taskExtractionOutcomeFor(row, state)) return "actions_routed";
  if (state.embeddedChunks > 0) return "indexed_for_rag";
  return "project_assigned";
}

function taskExtractionOutcomeFor(row, state) {
  if (state.existingTaskExtractionStatus) {
    return {
      task_extraction_status: state.existingTaskExtractionStatus,
      task_count: state.existingTaskCount ?? 0,
      task_extraction_source: state.existingTaskExtractionSource ?? "source_processing_jobs.metadata",
      task_extraction_reason: state.existingTaskExtractionReason ?? "Preserved from prior lifecycle extraction outcome.",
    };
  }

  if (state.hasTask) {
    return {
      task_extraction_status: "tasks_created",
      task_count: state.taskCount,
      task_extraction_source: "tasks.metadata_id",
    };
  }

  const title = String(row.title ?? "");
  const isSharePointApCheck =
    row.source_family === "sharepoint_document" &&
    row.project_id &&
    row.category === "document" &&
    /check\s*(?:#\s*)?\d+/i.test(title) &&
    /\$\s*[0-9,]+(?:\.\d{1,2})?/i.test(title);

  if (!isSharePointApCheck) return null;

  return {
    task_extraction_status: "no_actionable_tasks",
    task_count: 0,
    task_extraction_source: "sharepoint_ap_check_deterministic",
    task_extraction_reason: "AP check document records a payment artifact and contains no actionable follow-up task.",
  };
}

function terminalEmbeddingFailureFor(row) {
  const status = String(row.status ?? "").toLowerCase();
  if (status === "skipped_low_content") {
    return {
      error_code: "skipped_low_content",
      error_message: "Source item was skipped because it did not contain enough substantive text to embed.",
    };
  }
  if (status === "ocr_failed") {
    return {
      error_code: "ocr_failed",
      error_message: "OCR fallback failed before embeddable text could be extracted.",
    };
  }
  return null;
}

function compactMetadata(row, state) {
  const applicability = classifyProjectApplicability({
    ...row,
    text_sample: state.textSample,
  });
  const taskExtraction = taskExtractionOutcomeFor(row, state);

  return {
    source: row.source,
    category: row.category,
    type: row.type,
    backfilled_from_current_state: true,
    ...applicability,
    chunks: state.chunks,
    embedded_chunks: state.embeddedChunks,
    has_project_intelligence_evidence: state.hasProjectIntelligenceEvidence,
    has_task: state.hasTask,
    ...(taskExtraction ?? {}),
  };
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
  const sourceResult = await appClient.query(
    `
      select id, title, url, source, category, type, status, project_id, source_item_id,
        fireflies_id, content_hash, source_etag, source_web_url,
        source_last_modified_at, created_at, date
      from public.document_metadata
      where deleted_at is null
        and created_at >= now() - ($1::text || ' days')::interval
        and source in ('fireflies', 'microsoft_graph')
      order by created_at desc
      limit $2
    `,
    [lookbackDays, sourceLimit],
  );

  const appSources = sourceResult.rows
    .map((row) => ({ ...row, source_family: classifySource(row) }))
    .filter((row) => row.source_family);
  const appSourceIds = new Set(appSources.map((row) => String(row.id)));

  const ragEmailResult = await ragClient.query(
    `
      select id, title, source, type, source_system, source_item_id, source_web_url,
        created_at, updated_at, project_id, parsing_status
      from public.rag_document_metadata
      where source = 'microsoft_graph'
        and (type in ('email', 'email_attachment') or id like 'outlook_%')
        and coalesce(updated_at, created_at) >= now() - ($1::text || ' days')::interval
      order by coalesce(updated_at, created_at) desc
      limit $2
    `,
    [lookbackDays, sourceLimit],
  );

  const ragOnlyEmailSources = ragEmailResult.rows
    .filter((row) => !appSourceIds.has(String(row.id)))
    .map((row) => ({
      id: row.id,
      title: row.title,
      url: row.source_web_url,
      source: row.source,
      category: row.type === "email_attachment" ? "email_attachment" : "email",
      type: row.type,
      status: row.parsing_status || "raw_ingested",
      project_id: row.project_id,
      source_item_id: row.source_item_id,
      fireflies_id: null,
      content_hash: null,
      source_etag: null,
      source_web_url: row.source_web_url,
      source_last_modified_at: row.updated_at,
      created_at: row.created_at,
      date: row.created_at,
      source_family: "outlook_email",
    }));

  const sources = [...appSources, ...ragOnlyEmailSources];
  const sourceIds = sources.map((row) => String(row.id));

  const chunkRows = sourceIds.length
    ? (await ragClient.query(
        `
          select document_id, count(*)::int as chunks,
            count(*) filter (where embedding is not null)::int as embedded_chunks,
            left(string_agg(left(coalesce(text, ''), 1000), E'\n' order by chunk_index), 4000) as text_sample
          from public.document_chunks
          where document_id = any($1::text[])
          group by document_id
        `,
        [sourceIds],
      )).rows
    : [];
  const chunkByDocumentId = new Map(chunkRows.map((row) => [String(row.document_id), row]));

  const taskRows = sourceIds.length
    ? (await appClient.query(
        `
          select metadata_id, count(*)::int as tasks
          from public.tasks
          where metadata_id = any($1::text[])
          group by metadata_id
        `,
        [sourceIds],
      )).rows
    : [];
  const tasksByDocumentId = new Map(taskRows.map((row) => [String(row.metadata_id), Number(row.tasks ?? 0)]));

  const evidenceRows = sourceIds.length
    ? (await appClient.query(
        `
          select source_document_id, count(*)::int as evidence
          from public.insight_card_evidence
          where source_document_id = any($1::text[])
          group by source_document_id
        `,
        [sourceIds],
      )).rows
    : [];
  const evidenceByDocumentId = new Map(evidenceRows.map((row) => [String(row.source_document_id), Number(row.evidence ?? 0)]));

  const existingJobRows = sourceIds.length
    ? (await ragClient.query(
        `
          select distinct on (source_document_id)
            source_document_id,
            metadata,
            updated_at
          from (
            select
              source_document_id,
              metadata,
              updated_at
            from public.source_processing_jobs
            where source_document_id = any($1::text[])
            union all
            select
              source_document_id,
              output_summary as metadata,
              updated_at
            from public.source_intelligence_jobs
            where source_document_id = any($1::text[])
              and status = 'succeeded'
          ) jobs
          order by
            source_document_id,
            ((metadata ->> 'task_extraction_status') is not null) desc,
            updated_at desc
        `,
        [sourceIds],
      )).rows
    : [];
  const existingTaskExtractionByDocumentId = new Map(
    existingJobRows
      .map((row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        return [
          String(row.source_document_id),
          {
            status: metadata.task_extraction_status,
            count: metadata.task_count,
            source: metadata.task_extraction_source,
            reason: metadata.task_extraction_reason,
          },
        ];
      })
      .filter(([, outcome]) => outcome.status),
  );

  const rows = sources.map((row) => {
    const chunkState = chunkByDocumentId.get(String(row.id)) ?? { chunks: 0, embedded_chunks: 0 };
    const state = {
      chunks: Number(chunkState.chunks ?? 0),
      embeddedChunks: Number(chunkState.embedded_chunks ?? 0),
      textSample: String(chunkState.text_sample ?? ""),
      taskCount: Number(tasksByDocumentId.get(String(row.id)) ?? 0),
      hasTask: Number(tasksByDocumentId.get(String(row.id)) ?? 0) > 0,
      hasProjectIntelligenceEvidence: Number(evidenceByDocumentId.get(String(row.id)) ?? 0) > 0,
      existingTaskExtractionStatus: existingTaskExtractionByDocumentId.get(String(row.id))?.status,
      existingTaskCount: existingTaskExtractionByDocumentId.get(String(row.id))?.count,
      existingTaskExtractionSource: existingTaskExtractionByDocumentId.get(String(row.id))?.source,
      existingTaskExtractionReason: existingTaskExtractionByDocumentId.get(String(row.id))?.reason,
    };
    const status = statusFor(row, state);
    const terminalEmbeddingFailure = terminalEmbeddingFailureFor(row);
    return {
      source_system: sourceSystemForFamily(row.source_family),
      source_item_id: String(row.source_item_id || row.fireflies_id || row.id),
      content_hash: contentHashFor(row),
      source_document_id: String(row.id),
      project_id: row.project_id,
      status,
      source_title: row.title,
      source_url: row.source_web_url || row.url,
      occurred_at: row.date || row.source_last_modified_at || row.created_at,
      completed_at: ["project_intelligence_updated", "actions_routed", "indexed_for_rag", "failed_permanent"].includes(status)
        ? new Date().toISOString()
        : null,
      error_code: terminalEmbeddingFailure?.error_code ?? null,
      error_message: terminalEmbeddingFailure?.error_message ?? null,
      metadata: compactMetadata(row, state),
    };
  });

  if (!dryRun && rows.length > 0) {
    const batchSize = 500;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const params = [];
      const values = batch.map((row, rowIndex) => {
        const offset = rowIndex * 13;
        params.push(
          row.source_system,
          row.source_item_id,
          row.content_hash,
          row.source_document_id,
          row.project_id,
          row.status,
          row.source_title,
          row.source_url,
          row.occurred_at,
          row.completed_at,
          row.error_code,
          row.error_message,
          JSON.stringify(row.metadata),
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::bigint, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}::timestamptz, now(), now(), $${offset + 10}::timestamptz, 0, $${offset + 11}, $${offset + 12}, $${offset + 13}::jsonb)`;
      });

      await ragClient.query(
        `
          insert into public.source_processing_jobs (
            source_system, source_item_id, content_hash, source_document_id, project_id,
            status, source_title, source_url, occurred_at, first_seen_at, updated_at,
            completed_at, retry_count, error_code, error_message, metadata
          )
          values ${values.join(",")}
          on conflict (source_system, source_item_id, content_hash)
          do update set
            source_document_id = excluded.source_document_id,
            project_id = excluded.project_id,
            status = excluded.status,
            source_title = excluded.source_title,
            source_url = excluded.source_url,
            occurred_at = excluded.occurred_at,
            updated_at = now(),
            completed_at = excluded.completed_at,
            error_code = excluded.error_code,
            error_message = excluded.error_message,
            metadata = excluded.metadata
        `,
        params,
      );
    }
  }

  const byStatus = rows.reduce((groups, row) => {
    const key = `${row.source_system}:${row.status}`;
    groups[key] ??= {
      source_system: row.source_system,
      status: row.status,
      count: 0,
    };
    groups[key].count += 1;
    return groups;
  }, {});

  console.log(JSON.stringify({
    status: "pass",
    dryRun,
    lookbackDays,
    sourceLimit,
    rowsPrepared: rows.length,
    rowsWritten: dryRun ? 0 : rows.length,
    bySourceAndStatus: Object.values(byStatus),
  }, null, 2));
} finally {
  appClient.release();
  ragClient.release();
  await appPool.end();
  await ragPool.end();
}
