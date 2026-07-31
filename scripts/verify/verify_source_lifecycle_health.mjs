#!/usr/bin/env node

/**
 * End-to-end source lifecycle health gate.
 *
 * This is intentionally read-only and model-free. It verifies that recent
 * Fireflies, Teams, Outlook, and SharePoint sources are visible across
 * the app DB and the split RAG DB, then fails loudly when the pipeline cannot
 * prove project assignment, vectorization, task assignment, and packet updates.
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

const lookbackDays = numberArg("days", "SOURCE_LIFECYCLE_VERIFY_DAYS", 2);
const sourceLimit = numberArg("source-limit", "SOURCE_LIFECYCLE_VERIFY_SOURCE_LIMIT", 1_500);
const maxPacketAgeHours = numberArg("max-packet-age-hours", "SOURCE_LIFECYCLE_VERIFY_MAX_PACKET_AGE_HOURS", 36);
const minProjectAssignedRatio = numberArg("min-project-assigned-ratio", "SOURCE_LIFECYCLE_VERIFY_MIN_PROJECT_ASSIGNED_RATIO", 0.9);
const minEmbeddedRatio = numberArg("min-embedded-ratio", "SOURCE_LIFECYCLE_VERIFY_MIN_EMBEDDED_RATIO", 0.9);
const minTaskAssignedRatio = numberArg("min-task-assigned-ratio", "SOURCE_LIFECYCLE_VERIFY_MIN_TASK_ASSIGNED_RATIO", 0.9);
const requireLifecycleRows = args.get("require-lifecycle-rows") !== "false";

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

function compactRow(row) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  );
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 1;
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

function matchesLifecycle(row, job) {
  const sourceIds = [
    row.id,
    row.source_item_id,
    row.fireflies_id,
  ].filter(Boolean).map(String);

  return (
    (job.source_document_id && String(job.source_document_id) === String(row.id)) ||
    (job.source_item_id && sourceIds.includes(String(job.source_item_id)))
  );
}

function latestLifecycleFor(row, lifecycleByDocumentId) {
  const jobs = lifecycleByDocumentId.get(String(row.id)) ?? [];
  return jobs[0] ?? null;
}

const terminalEmbeddingCodes = new Set([
  "graph_content_missing",
  "graph_content_empty",
  "skipped_low_content",
  "no_chunks",
  "interview_title_excluded",
  "ocr_failed",
]);

const terminalDocumentStatuses = new Set([
  "intentionally_excluded",
  "deleted_no_transcript",
  "metadata_only",
  "not_vectorizable",
  "skipped",
  "skipped_low_content",
  "graph_content_missing",
  "graph_content_empty",
  "no_chunks",
  "ocr_failed",
]);

function applicabilityFor(row, lifecycleByDocumentId) {
  const metadata = latestLifecycleFor(row, lifecycleByDocumentId)?.metadata ?? {};
  const storedApplicability = metadata?.project_applicability;
  if (storedApplicability) {
    return {
      project_applicability: storedApplicability,
      project_required: metadata.project_required === true || isProjectRequired(storedApplicability),
      project_applicability_reason: metadata.project_applicability_reason ?? "source_processing_jobs.metadata",
    };
  }

  return classifyProjectApplicability(row);
}

function terminalEmbeddingReason(row, lifecycleByDocumentId, ragMetadataByDocumentId) {
  if (terminalDocumentStatuses.has(String(row.status ?? ""))) {
    return {
      source: "document_metadata.status",
      code: String(row.status),
      message: null,
    };
  }

  const ragMetadata = ragMetadataByDocumentId.get(String(row.id));
  for (const field of ["embedding_status", "parsing_status"]) {
    const status = String(ragMetadata?.[field] ?? "");
    if (terminalDocumentStatuses.has(status)) {
      return {
        source: `rag_document_metadata.${field}`,
        code: status,
        message: null,
      };
    }
  }

  const terminalJob = (lifecycleByDocumentId.get(String(row.id)) ?? []).find((job) =>
    job.status === "failed_permanent" && terminalEmbeddingCodes.has(String(job.error_code ?? "")),
  );
  if (terminalJob) {
    return {
      source: "source_processing_jobs.error_code",
      code: terminalJob.error_code,
      message: terminalJob.error_message,
    };
  }

  return null;
}

function pushFailure(failures, message, details) {
  failures.push({ message, details });
}

const appDatabaseUrl = getAppDatabaseUrl();
const ragDatabaseUrl = getRagDatabaseUrl();

if (!appDatabaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required for app DB lifecycle verification.");
  process.exit(1);
}
if (!ragDatabaseUrl) {
  console.error("RAG_DATABASE_URL is required for RAG lifecycle verification.");
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

async function connectOrFail(pool, label) {
  try {
    return await pool.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error?.code ? ` code=${error.code}` : "";
    console.error(`${label} connection failed:${code} ${message}`);
    console.error(
      label === "RAG database"
        ? "RAG source-lifecycle verification cannot prove ingestion, embeddings, task assignment, or Project Intelligence freshness while the AI/RAG database is unreachable."
        : "App database verification cannot prove source metadata, generated tasks, or Project Intelligence packet state while the PM app database is unreachable.",
    );
    process.exit(1);
  }
}

const appClient = await connectOrFail(appPool, "App database");
const ragClient = await connectOrFail(ragPool, "RAG database");

try {
  const recentSourcesResult = await appClient.query(
    `
      select id, title, source, category, type, project_id, source_item_id, fireflies_id,
        content_hash, status, created_at, date, source_last_modified_at
      from public.document_metadata
      where deleted_at is null
        and created_at >= now() - ($1::text || ' days')::interval
        and source in ('fireflies', 'microsoft_graph')
      order by created_at desc
      limit $2
    `,
    [lookbackDays, sourceLimit],
  );

  const appSourceRows = recentSourcesResult.rows
    .map((row) => ({ ...row, source_family: classifySource(row) }))
    .filter((row) => row.source_family);
  const appSourceIds = new Set(appSourceRows.map((row) => String(row.id)));
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
  const ragOnlyEmailRows = ragEmailResult.rows
    .filter((row) => !appSourceIds.has(String(row.id)))
    .map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      category: row.type === "email_attachment" ? "email_attachment" : "email",
      type: row.type,
      project_id: row.project_id,
      source_item_id: row.source_item_id,
      fireflies_id: null,
      content_hash: null,
      status: row.parsing_status || "raw_ingested",
      created_at: row.updated_at || row.created_at,
      date: row.created_at,
      source_last_modified_at: row.updated_at,
      source_family: "outlook_email",
    }));
  const sourceRows = [...appSourceRows, ...ragOnlyEmailRows];
  const sourceIds = sourceRows.map((row) => String(row.id));
  const sourceItemIds = [
    ...new Set(
      sourceRows.flatMap((row) => [row.id, row.source_item_id, row.fireflies_id].filter(Boolean).map(String)),
    ),
  ];

  const chunkRows = sourceIds.length
    ? (await ragClient.query(
        `
          select document_id, count(*)::int as chunks,
            count(*) filter (where embedding is not null)::int as embedded_chunks,
            max(updated_at) as newest_chunk_at
          from public.document_chunks
          where document_id = any($1::text[])
          group by document_id
        `,
        [sourceIds],
      )).rows
    : [];
  const chunkByDocumentId = new Map(chunkRows.map((row) => [String(row.document_id), row]));

  const ragMetadataRows = sourceIds.length
    ? (await ragClient.query(
        `
          select id, embedding_status, parsing_status
          from public.rag_document_metadata
          where id = any($1::text[])
        `,
        [sourceIds],
      )).rows
    : [];
  const ragMetadataByDocumentId = new Map(ragMetadataRows.map((row) => [String(row.id), row]));

  const lifecycleRows = (await ragClient.query(
    `
      select source_system, source_item_id, source_document_id, content_hash, project_id,
        status, updated_at, completed_at, retry_count, error_code, error_message, metadata
      from public.source_processing_jobs
      where source_system <> 'verification'
        and (
          updated_at >= now() - ($1::text || ' days')::interval
          or source_document_id = any($2::text[])
          or source_item_id = any($3::text[])
        )
      order by updated_at desc
      limit 5000
    `,
    [Math.max(lookbackDays, 14), sourceIds, sourceItemIds],
  )).rows;

  const lifecycleByDocumentId = new Map();
  for (const row of sourceRows) {
    lifecycleByDocumentId.set(String(row.id), lifecycleRows.filter((job) => matchesLifecycle(row, job)));
  }

  const taskDetailRows = (await appClient.query(
    `
      select id::text, title, source_system, status, project_id, metadata_id::text, created_at
      from public.tasks
      where created_at >= now() - ($1::text || ' days')::interval
        and source_system in ('fireflies', 'meeting', 'email', 'teams_dm_conversation', 'microsoft_graph')
      order by created_at desc
    `,
    [Math.max(lookbackDays, 14)],
  )).rows;
  const taskMetadataIds = [...new Set(taskDetailRows.map((row) => row.metadata_id).filter(Boolean).map(String))];
  const lifecycleByTaskMetadataId = new Map(
    taskMetadataIds.map((id) => [
      id,
      lifecycleRows.filter((job) =>
        (job.source_document_id && String(job.source_document_id) === id) ||
        (job.source_item_id && String(job.source_item_id) === id),
      ),
    ]),
  );
  const taskHasProjectDisposition = (task) => {
    if (task.project_id !== null && task.project_id !== undefined) return true;
    const jobs = lifecycleByTaskMetadataId.get(String(task.metadata_id ?? "")) ?? [];
    return jobs.some((job) => {
      const applicability = job.metadata?.project_applicability;
      return (
        job.status === "project_assignment_review" ||
        applicability === "project_assignment_review" ||
        applicability === "multi_project_review" ||
        applicability === "not_project_applicable" ||
        applicability === "internal_project" ||
        applicability === "company_level"
      );
    });
  };
  const taskRowsByKey = new Map();
  for (const task of taskDetailRows) {
    const key = `${task.source_system}::${task.status}`;
    const current = taskRowsByKey.get(key) ?? {
      source_system: task.source_system,
      status: task.status,
      count: 0,
      with_project: 0,
      with_project_disposition: 0,
      newest: task.created_at,
    };
    current.count += 1;
    if (task.project_id !== null && task.project_id !== undefined) current.with_project += 1;
    if (taskHasProjectDisposition(task)) current.with_project_disposition += 1;
    if (String(task.created_at ?? "") > String(current.newest ?? "")) current.newest = task.created_at;
    taskRowsByKey.set(key, current);
  }
  const taskRows = [...taskRowsByKey.values()].sort((a, b) =>
    String(b.newest ?? "").localeCompare(String(a.newest ?? "")),
  );

  const packetResult = await appClient.query(
    `
      select count(*)::int as current_packets,
        count(*) filter (where generated_at >= now() - ($1::text || ' hours')::interval)::int as fresh_packets,
        max(generated_at) as newest_current_packet
      from public.intelligence_packets
      where packet_type = 'current'
    `,
    [maxPacketAgeHours],
  );

  const recentEvidenceResult = await appClient.query(
    `
      select count(*)::int as recent_evidence,
        count(distinct insight_card_id)::int as cards_with_recent_evidence,
        max(created_at) as newest_evidence
      from public.insight_card_evidence
      where created_at >= now() - ($1::text || ' days')::interval
    `,
    [Math.max(lookbackDays, 14)],
  );

  const families = ["fireflies", "teams", "outlook_email", "sharepoint_document"];
  const sourceFamilySummary = families.map((family) => {
    const rows = sourceRows.filter((row) => row.source_family === family);
    const rowsWithApplicability = rows.map((row) => ({
      ...row,
      project_applicability: applicabilityFor(row, lifecycleByDocumentId),
    }));
    const projectRequiredRows = rowsWithApplicability.filter((row) =>
      row.project_applicability.project_required === true,
    );
    const withProject = projectRequiredRows.filter((row) => row.project_id !== null && row.project_id !== undefined).length;
    const terminalEmbeddingFailures = rows
      .map((row) => ({ row, reason: terminalEmbeddingReason(row, lifecycleByDocumentId, ragMetadataByDocumentId) }))
      .filter((item) => item.reason);
    const terminalEmbeddingFailureIds = new Set(terminalEmbeddingFailures.map((item) => String(item.row.id)));
    const embeddingRequiredRows = rows.filter((row) => !terminalEmbeddingFailureIds.has(String(row.id)));
    const withChunks = rows.filter((row) => Number(chunkByDocumentId.get(String(row.id))?.chunks ?? 0) > 0).length;
    const withEmbeddings = embeddingRequiredRows.filter((row) =>
      Number(chunkByDocumentId.get(String(row.id))?.embedded_chunks ?? 0) > 0,
    ).length;
    const withLifecycle = rows.filter((row) => (lifecycleByDocumentId.get(String(row.id)) ?? []).length > 0).length;
    const hasProjectAssignmentLifecycle = (row) =>
      (lifecycleByDocumentId.get(String(row.id)) ?? []).some((job) =>
        ["project_assigned", "project_assignment_review", "indexed_for_rag", "signals_extracted", "project_intelligence_updated", "complete"].includes(job.status),
      );
    const withProjectAssignmentLifecycle = rows.filter(hasProjectAssignmentLifecycle).length;
    const withProjectIntelligenceLifecycle = rows.filter((row) =>
      (lifecycleByDocumentId.get(String(row.id)) ?? []).some((job) =>
        ["project_intelligence_updated", "complete"].includes(job.status),
      ),
    ).length;
    const applicabilityCounts = rowsWithApplicability.reduce((counts, row) => {
      const key = row.project_applicability.project_applicability;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    const withProjectDisposition = projectRequiredRows.filter((row) =>
      (row.project_id !== null && row.project_id !== undefined) ||
      (
        row.project_applicability.project_applicability === "project_assignment_review" &&
        hasProjectAssignmentLifecycle(row)
      ),
    ).length;

    return {
      family,
      recent_sources: rows.length,
      project_required_sources: projectRequiredRows.length,
      project_not_required_sources: rows.length - projectRequiredRows.length,
      project_applicability: applicabilityCounts,
      with_project: withProject,
      project_assigned_ratio: ratio(withProject, projectRequiredRows.length),
      with_project_disposition: withProjectDisposition,
      project_disposition_ratio: ratio(withProjectDisposition, projectRequiredRows.length),
      embedding_required_sources: embeddingRequiredRows.length,
      terminal_embedding_failures: terminalEmbeddingFailures.length,
      with_chunks: withChunks,
      with_embeddings: withEmbeddings,
      embedded_ratio: ratio(withEmbeddings, embeddingRequiredRows.length),
      with_lifecycle: withLifecycle,
      lifecycle_ratio: ratio(withLifecycle, rows.length),
      with_project_assignment_lifecycle: withProjectAssignmentLifecycle,
      with_project_intelligence_lifecycle: withProjectIntelligenceLifecycle,
      newest_source: rows[0]?.created_at ?? null,
      unassigned_samples: rows
        .filter((row) => row.project_id === null || row.project_id === undefined)
        .slice(0, 5)
        .map((row) => compactRow({
          id: row.id,
          title: row.title,
          category: row.category,
          type: row.type,
          created_at: row.created_at,
        })),
      project_assignment_review_samples: rowsWithApplicability
        .filter((row) =>
          row.project_applicability.project_required === true &&
          (row.project_id === null || row.project_id === undefined)
        )
        .slice(0, 5)
        .map((row) => compactRow({
          id: row.id,
          title: row.title,
          category: row.category,
          type: row.type,
          project_applicability: row.project_applicability.project_applicability,
          project_applicability_reason: row.project_applicability.project_applicability_reason,
          created_at: row.created_at,
        })),
      not_project_required_samples: rowsWithApplicability
        .filter((row) => row.project_applicability.project_required !== true)
        .slice(0, 5)
        .map((row) => compactRow({
          id: row.id,
          title: row.title,
          category: row.category,
          type: row.type,
          project_applicability: row.project_applicability.project_applicability,
          project_applicability_reason: row.project_applicability.project_applicability_reason,
          created_at: row.created_at,
        })),
      unembedded_samples: rows
        .filter((row) =>
          Number(chunkByDocumentId.get(String(row.id))?.embedded_chunks ?? 0) === 0 &&
          !terminalEmbeddingFailureIds.has(String(row.id))
        )
        .slice(0, 5)
        .map((row) => compactRow({
          id: row.id,
          title: row.title,
          category: row.category,
          type: row.type,
          created_at: row.created_at,
        })),
      terminal_unembeddable_samples: terminalEmbeddingFailures
        .slice(0, 5)
        .map(({ row, reason }) => {
          return compactRow({
            id: row.id,
            title: row.title,
            category: row.category,
            type: row.type,
            terminal_source: reason.source,
            terminal_code: reason.code,
            terminal_message: reason.message,
            created_at: row.created_at,
          });
        }),
    };
  });

  const lifecycleStatusSummary = Object.values(
    lifecycleRows.reduce((groups, row) => {
      const key = `${row.source_system}:${row.status}`;
      groups[key] ??= {
        source_system: row.source_system,
        status: row.status,
        count: 0,
        newest: null,
      };
      groups[key].count += 1;
      groups[key].newest = groups[key].newest && groups[key].newest > row.updated_at
        ? groups[key].newest
        : row.updated_at;
      return groups;
    }, {}),
  ).sort((a, b) => String(b.newest ?? "").localeCompare(String(a.newest ?? "")));

  const taskTotals = taskRows.reduce((totals, row) => {
    totals.count += Number(row.count ?? 0);
    totals.with_project += Number(row.with_project ?? 0);
    totals.with_project_disposition += Number(row.with_project_disposition ?? 0);
    return totals;
  }, { count: 0, with_project: 0, with_project_disposition: 0 });

  const packetSummary = packetResult.rows[0] ?? {
    current_packets: 0,
    fresh_packets: 0,
    newest_current_packet: null,
  };
  const evidenceSummary = recentEvidenceResult.rows[0] ?? {
    recent_evidence: 0,
    cards_with_recent_evidence: 0,
    newest_evidence: null,
  };

  const failures = [];
  if (sourceRows.length === 0) {
    pushFailure(failures, "No recent Fireflies or Microsoft Graph source documents were found.", {
      lookbackDays,
      sourceLimit,
    });
  }

  if (requireLifecycleRows && lifecycleRows.length === 0) {
    pushFailure(failures, "No real source_processing_jobs lifecycle rows exist for recent sources.", {
      explanation: "The pipeline cannot prove ingestion-to-intelligence lifecycle status per source item.",
    });
  }

  for (const summary of sourceFamilySummary) {
    if (summary.recent_sources === 0) continue;
    if (summary.project_disposition_ratio < minProjectAssignedRatio) {
      pushFailure(failures, `${summary.family} project-disposition coverage is below threshold.`, {
        threshold: minProjectAssignedRatio,
        ...summary,
      });
    }
    if (summary.embedded_ratio < minEmbeddedRatio) {
      pushFailure(failures, `${summary.family} embedded chunk coverage is below threshold.`, {
        threshold: minEmbeddedRatio,
        ...summary,
      });
    }
  }

  if (taskTotals.count > 0 && ratio(taskTotals.with_project_disposition, taskTotals.count) < minTaskAssignedRatio) {
    pushFailure(failures, "Generated task project-disposition coverage is below threshold.", {
      threshold: minTaskAssignedRatio,
      tasks: taskTotals.count,
      withProject: taskTotals.with_project,
      withProjectDisposition: taskTotals.with_project_disposition,
      ratio: ratio(taskTotals.with_project_disposition, taskTotals.count),
      bySource: taskRows,
    });
  }

  if (Number(packetSummary.current_packets ?? 0) === 0) {
    pushFailure(failures, "No current Project Intelligence packets exist.", packetSummary);
  } else if (Number(packetSummary.fresh_packets ?? 0) === 0) {
    pushFailure(failures, "No current Project Intelligence packets are fresh enough.", {
      maxPacketAgeHours,
      ...packetSummary,
    });
  }

  if (Number(evidenceSummary.recent_evidence ?? 0) === 0) {
    pushFailure(failures, "No recent source-linked Project Intelligence evidence exists.", evidenceSummary);
  }

  const summary = {
    status: failures.length > 0 ? "fail" : "pass",
    generatedAt: new Date().toISOString(),
    thresholds: {
      lookbackDays,
      sourceLimit,
      maxPacketAgeHours,
      minProjectAssignedRatio,
      minEmbeddedRatio,
      minTaskAssignedRatio,
      requireLifecycleRows,
    },
    sources: {
      total_recent_sources: sourceRows.length,
      by_family: sourceFamilySummary,
    },
    lifecycle: {
      total_rows: lifecycleRows.length,
      by_source_and_status: lifecycleStatusSummary,
      recent_failures: lifecycleRows
        .filter((row) => String(row.status).startsWith("failed"))
        .slice(0, 10)
        .map(compactRow),
    },
    tasks: {
      total: taskTotals.count,
      with_project: taskTotals.with_project,
      with_project_disposition: taskTotals.with_project_disposition,
      project_assigned_ratio: ratio(taskTotals.with_project, taskTotals.count),
      project_disposition_ratio: ratio(taskTotals.with_project_disposition, taskTotals.count),
      by_source_and_status: taskRows,
    },
    project_intelligence: {
      packets: packetSummary,
      evidence: evidenceSummary,
    },
    failures,
  };

  const output = JSON.stringify(summary, null, 2);
  if (failures.length > 0) {
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log(output);
  }
} finally {
  appClient.release();
  ragClient.release();
  await appPool.end();
  await ragPool.end();
}
