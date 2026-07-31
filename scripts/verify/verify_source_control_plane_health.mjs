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
import {
  SOURCE_FAMILY_CONFIG,
  STAGE_GRACE_MINUTES,
  ageHours,
  coverageStatus,
  newest,
  normalizeRunSource,
} from "./source_control_plane_health_lib.mjs";
import {
  classifyProjectApplicability,
  isProjectRequired,
} from "./source_lifecycle_project_applicability.mjs";

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

const lookbackDays = numberArg("days", "SOURCE_CONTROL_PLANE_DAYS", 7);
const sourceLimit = numberArg("source-limit", "SOURCE_CONTROL_PLANE_SOURCE_LIMIT", 2500);
const minChunkedRatio = numberArg("min-chunked-ratio", "SOURCE_CONTROL_PLANE_MIN_CHUNKED_RATIO", 0.9);
const minEmbeddedRatio = numberArg("min-embedded-ratio", "SOURCE_CONTROL_PLANE_MIN_EMBEDDED_RATIO", 0.9);
const minTaskOutcomeRatio = numberArg("min-task-outcome-ratio", "SOURCE_CONTROL_PLANE_MIN_TASK_OUTCOME_RATIO", 0.9);
const minProjectDispositionRatio = numberArg(
  "min-project-disposition-ratio",
  "SOURCE_CONTROL_PLANE_MIN_PROJECT_DISPOSITION_RATIO",
  0.9,
);

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

function latestLifecycleFor(row, lifecycleByDocumentId) {
  const jobs = lifecycleByDocumentId.get(String(row.id)) ?? [];
  return jobs[0] ?? null;
}

function latestLifecycleMetadataFor(row, lifecycleByDocumentId) {
  return latestLifecycleFor(row, lifecycleByDocumentId)?.metadata ?? {};
}

function taskOutcomeFor(documentId, taskCountByMetadataId, lifecycleByDocumentId) {
  if ((taskCountByMetadataId.get(documentId) ?? 0) > 0) return "tasks_created";
  const status = String(
    (lifecycleByDocumentId.get(documentId) ?? [])[0]?.metadata?.task_extraction_status ?? "",
  ).toLowerCase();
  if (status === "no_actionable_tasks") return "no_actionable_tasks";
  if (status === "task_signal_staged") return "task_signal_staged";
  return "not_extracted";
}

function isSuccessfulRunStatus(status) {
  const normalized = String(status ?? "").toLowerCase();
  return normalized === "success" || normalized === "succeeded" || normalized === "complete" || normalized === "completed";
}

function projectDispositionFor(row, lifecycleByDocumentId) {
  if (row.project_id !== null && row.project_id !== undefined) {
    return { ok: true, disposition: "assigned", required: true };
  }

  const metadata = latestLifecycleMetadataFor(row, lifecycleByDocumentId);
  const storedApplicability = metadata?.project_applicability;
  const classification = storedApplicability
    ? {
        project_applicability: storedApplicability,
        project_required: metadata.project_required === true || isProjectRequired(storedApplicability),
      }
    : classifyProjectApplicability(row);

  const applicability = String(classification.project_applicability ?? "");
  if (applicability === "project_assignment_review") {
    return {
      ok: true,
      disposition: "review",
      required: Boolean(classification.project_required),
    };
  }
  if (
    applicability === "not_project_applicable" ||
    applicability === "internal_project" ||
    applicability === "multi_project_review"
  ) {
    return {
      ok: true,
      disposition: applicability,
      required: false,
    };
  }
  return {
    ok: false,
    disposition: applicability || "unknown",
    required: Boolean(classification.project_required),
  };
}

function matureRows(rows, graceMinutes) {
  const cutoffMs = Date.now() - graceMinutes * 60 * 1000;
  return rows.filter((row) => {
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
    if (Number.isNaN(createdAt)) return true;
    return createdAt <= cutoffMs;
  });
}

function summarizeStage(rows, predicate, threshold, graceMinutes, exampleBuilder) {
  const mature = matureRows(rows, graceMinutes);
  const clearedRows = mature.filter(predicate);
  const failedRows = mature.filter((row) => !predicate(row));
  return {
    totalRecent: rows.length,
    totalMature: mature.length,
    cleared: clearedRows.length,
    ratio: mature.length > 0 ? Number((clearedRows.length / mature.length).toFixed(3)) : 1,
    status: coverageStatus(clearedRows.length, mature.length, threshold),
    examples: failedRows.slice(0, 5).map(exampleBuilder),
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
  const [docResult, runResult] = await Promise.all([
    appClient.query(
      `
        select id, title, source, category, type, project_id, status, created_at,
          date, source_last_modified_at, source_item_id, fireflies_id, source_system
        from public.document_metadata
        where deleted_at is null
          and created_at >= now() - ($1::text || ' days')::interval
          and source in ('fireflies', 'microsoft_graph')
        order by created_at desc
        limit $2
      `,
      [lookbackDays, sourceLimit],
    ),
    ragClient.query(
      `
        select id, source, status, started_at, finished_at, items_seen, items_synced,
          items_failed, error_message
        from public.source_sync_runs
        where started_at >= now() - ($1::text || ' days')::interval
        order by started_at desc
        limit 5000
      `,
      [lookbackDays],
    ),
  ]);

  const documents = docResult.rows;
  const documentIds = documents.map((row) => String(row.id));

  const [chunkResult, taskResult, lifecycleResult] = await Promise.all([
    ragClient.query(
      `
        select document_id,
          count(*)::int as chunk_count,
          count(embedding)::int as embedded_count,
          max(updated_at) as latest_chunk_at
        from public.document_chunks
        where document_id = any($1::text[])
        group by document_id
      `,
      [documentIds],
    ),
    appClient.query(
      `
        select metadata_id,
          count(*)::int as task_count,
          max(created_at) as latest_task_at
        from public.tasks
        where metadata_id = any($1::text[])
        group by metadata_id
      `,
      [documentIds],
    ),
    ragClient.query(
      `
        select source_document_id, source_item_id, source_system, status, updated_at,
          error_code, error_message, metadata
        from public.source_processing_jobs
        where source_document_id = any($1::text[])
        order by updated_at desc
      `,
      [documentIds],
    ),
  ]);

  const chunkByDocumentId = new Map(
    chunkResult.rows.map((row) => [String(row.document_id), row]),
  );
  const taskByMetadataId = new Map(
    taskResult.rows.map((row) => [String(row.metadata_id), Number(row.task_count ?? 0)]),
  );
  const lifecycleByDocumentId = new Map();
  for (const row of lifecycleResult.rows) {
    const key = String(row.source_document_id ?? "");
    if (!key) continue;
    const existing = lifecycleByDocumentId.get(key) ?? [];
    existing.push(row);
    lifecycleByDocumentId.set(key, existing);
  }

  const families = SOURCE_FAMILY_CONFIG.map((family) => {
    const familyDocs = documents.filter((row) => family.matchesDocument(row));
    const familyRuns = runResult.rows.filter((row) => family.runSources.has(normalizeRunSource(row.source)));
    const latestSuccessAt = newest(
      familyRuns
        .filter((row) => isSuccessfulRunStatus(row.status))
        .map((row) => row.finished_at ?? row.started_at),
    );
    const latestRunAt = newest(familyRuns.map((row) => row.finished_at ?? row.started_at));
    const syncAgeHours = ageHours(latestSuccessAt);
    const syncStatus =
      familyRuns.length === 0
        ? "unknown"
        : latestSuccessAt === null
          ? "critical"
          : syncAgeHours !== null && syncAgeHours > family.maxSyncAgeHours
            ? "warning"
            : "healthy";

    const stageRows = familyDocs.map((row) => {
      const chunk = chunkByDocumentId.get(String(row.id));
      const taskOutcome = taskOutcomeFor(String(row.id), taskByMetadataId, lifecycleByDocumentId);
      const projectDisposition = projectDispositionFor(row, lifecycleByDocumentId);
      return {
        ...row,
        chunk_count: Number(chunk?.chunk_count ?? 0),
        embedded_count: Number(chunk?.embedded_count ?? 0),
        latest_chunk_at: chunk?.latest_chunk_at ?? null,
        task_outcome: taskOutcome,
        project_disposition: projectDisposition.disposition,
        project_disposition_ok: projectDisposition.ok,
      };
    });

    const chunking = summarizeStage(
      stageRows,
      (row) => row.chunk_count > 0,
      minChunkedRatio,
      STAGE_GRACE_MINUTES.chunking,
      (row) => ({ id: row.id, title: row.title, status: row.status, chunk_count: row.chunk_count }),
    );
    const embeddings = summarizeStage(
      stageRows,
      (row) => row.embedded_count > 0,
      minEmbeddedRatio,
      STAGE_GRACE_MINUTES.embeddings,
      (row) => ({ id: row.id, title: row.title, status: row.status, embedded_count: row.embedded_count }),
    );
    const taskExtraction = summarizeStage(
      stageRows,
      (row) =>
        row.task_outcome !== "not_extracted" ||
        String(row.status ?? "") === "skipped_low_content" ||
        String(row.status ?? "") === "intentionally_excluded",
      minTaskOutcomeRatio,
      STAGE_GRACE_MINUTES.taskExtraction,
      (row) => ({ id: row.id, title: row.title, task_outcome: row.task_outcome }),
    );
    const projectDisposition = summarizeStage(
      stageRows,
      (row) => row.project_disposition_ok,
      minProjectDispositionRatio,
      STAGE_GRACE_MINUTES.projectDisposition,
      (row) => ({
        id: row.id,
        title: row.title,
        project_id: row.project_id,
        project_disposition: row.project_disposition,
      }),
    );

    const projectDispositionBreakdown = stageRows.reduce(
      (acc, row) => {
        acc[row.project_disposition] = (acc[row.project_disposition] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      key: family.key,
      label: family.label,
      sync: {
        status: syncStatus,
        latestRunAt,
        latestSuccessAt,
        successRunCount: familyRuns.filter((row) => isSuccessfulRunStatus(row.status)).length,
        failedRunCount: familyRuns.filter((row) => !isSuccessfulRunStatus(row.status)).length,
        itemsSynced: familyRuns.reduce((sum, row) => sum + Number(row.items_synced ?? 0), 0),
        maxHealthyAgeHours: family.maxSyncAgeHours,
      },
      intake: {
        status: familyDocs.length > 0 ? "healthy" : familyRuns.length > 0 ? "warning" : "unknown",
        count: familyDocs.length,
        latestDocumentAt: newest(
          familyDocs.map((row) => row.source_last_modified_at ?? row.date ?? row.created_at),
        ),
      },
      chunking,
      embeddings,
      taskExtraction,
      projectAssignment: {
        ...projectDisposition,
        breakdown: projectDispositionBreakdown,
        assignedCount: stageRows.filter((row) => row.project_disposition === "assigned").length,
      },
      recentFailures: familyRuns
        .filter((row) => !isSuccessfulRunStatus(row.status))
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          status: row.status,
          started_at: row.started_at,
          error_message: row.error_message,
        })),
    };
  });

  const failures = [];
  for (const family of families) {
    for (const [stageKey, stage] of Object.entries({
      sync: family.sync,
      intake: family.intake,
      chunking: family.chunking,
      embeddings: family.embeddings,
      taskExtraction: family.taskExtraction,
      projectAssignment: family.projectAssignment,
    })) {
      if (stage.status === "healthy" || stage.status === "unknown") continue;
      failures.push({
        family: family.key,
        stage: stageKey,
        status: stage.status,
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    thresholds: {
      minChunkedRatio,
      minEmbeddedRatio,
      minTaskOutcomeRatio,
      minProjectDispositionRatio,
    },
    families,
    failures,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
} finally {
  appClient.release();
  ragClient.release();
  await appPool.end();
  await ragPool.end();
}
