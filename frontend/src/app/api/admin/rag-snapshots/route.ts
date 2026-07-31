import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";
const WHERE = "/api/admin/rag-snapshots#GET";

/**
 * Daily sync health for the /rag dashboard.
 *
 * Returns one row per day for the last N days, with per-source totals for
 * items successfully synced and items that failed. Source rows in
 * `source_sync_runs` are bucketed into the user-visible sources
 * (SharePoint, Outlook, Meetings, Teams, Acumatica). Days with no sync activity at all
 * still appear so a multi-day stall is obvious at a glance.
 */

export type SourceKey = "sharepoint" | "outlook" | "meetings" | "teams" | "acumatica";

export type DailySyncRow = {
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  sharepoint_synced: number;
  sharepoint_failed: number;
  outlook_synced: number;
  outlook_failed: number;
  outlook_added: number;
  outlook_vectorized: number;
  outlook_project_assigned: number;
  outlook_tasks_extracted: number;
  outlook_project_intelligence_updated: number;
  outlook_complete: number;
  meetings_synced: number;
  meetings_failed: number;
  meetings_added: number;
  meetings_vectorized: number;
  meetings_project_assigned: number;
  meetings_tasks_extracted: number;
  meetings_project_intelligence_updated: number;
  meetings_complete: number;
  teams_synced: number;
  teams_failed: number;
  teams_runs: number;
  acumatica_synced: number;
  acumatica_failed: number;
  acumatica_runs: number;
  sharepoint_runs: number;
  outlook_runs: number;
  meetings_runs: number;
  /** Total runs that landed in any non-success status (error/failed/warning) for that date. */
  failed_runs: number;
};

const SOURCE_BUCKETS: Record<string, SourceKey> = {
  sharepoint_file: "sharepoint",
  outlook_email: "outlook",
  fireflies: "meetings",
  teams_message: "teams",
  teams_chat_export: "teams",
  acumatica_financial_sync: "acumatica",
};

const FAILURE_STATUSES = new Set(["error", "failed", "warning"]);
const GRAPH_CATEGORY_BUCKETS: Record<string, SourceKey> = {
  email: "outlook",
  email_attachment: "outlook",
  outlook: "outlook",
  outlook_email: "outlook",
  sharepoint: "sharepoint",
  sharepoint_file: "sharepoint",
  file: "sharepoint",
  document: "sharepoint",
  teams: "teams",
  teams_message: "teams",
  teams_chat_export: "teams",
};

type SyncRunMetadata = {
  by_category?: Record<string, number>;
};

type MeetingDocumentRow = {
  id: string;
  created_at: string | null;
  project_id: number | null;
};

type LifecycleJobRow = {
  source_document_id: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(value: unknown): SyncRunMetadata {
  if (!isRecord(value)) return {};
  const byCategory = value.by_category;
  if (!isRecord(byCategory)) return {};

  return {
    by_category: Object.fromEntries(
      Object.entries(byCategory)
        .map(([key, count]) => [key, typeof count === "number" ? count : Number(count)])
        .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
    ),
  };
}

function addSourceTotals(
  day: DailySyncRow,
  bucket: SourceKey,
  synced: number,
  failed: number,
  runs = 1,
) {
  if (bucket === "sharepoint") {
    day.sharepoint_synced += synced;
    day.sharepoint_failed += failed;
    day.sharepoint_runs += runs;
    return;
  }
  if (bucket === "outlook") {
    day.outlook_synced += synced;
    day.outlook_failed += failed;
    day.outlook_runs += runs;
    return;
  }
  if (bucket === "meetings") {
    day.meetings_synced += synced;
    day.meetings_failed += failed;
    day.meetings_runs += runs;
    return;
  }
  if (bucket === "teams") {
    day.teams_synced += synced;
    day.teams_failed += failed;
    day.teams_runs += runs;
    return;
  }
  day.acumatica_synced += synced;
  day.acumatica_failed += failed;
  day.acumatica_runs += runs;
}

function batches<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function latestJobMetadataByDocumentId(jobRows: LifecycleJobRow[]) {
  const metadataByDocumentId = new Map<string, Record<string, unknown>>();
  const sorted = [...jobRows].sort((a, b) => {
    const aReadProof = a.metadata?.read_proof;
    const bReadProof = b.metadata?.read_proof;
    const aHasFullReadProof =
      typeof aReadProof === "object" &&
      aReadProof !== null &&
      (aReadProof as Record<string, unknown>).status === "full_source_read" &&
      (aReadProof as Record<string, unknown>).scope === "full_transcript";
    const bHasFullReadProof =
      typeof bReadProof === "object" &&
      bReadProof !== null &&
      (bReadProof as Record<string, unknown>).status === "full_source_read" &&
      (bReadProof as Record<string, unknown>).scope === "full_transcript";
    if (aHasFullReadProof !== bHasFullReadProof) return aHasFullReadProof ? -1 : 1;
    const aHasTaskStatus = Boolean(a.metadata?.task_extraction_status);
    const bHasTaskStatus = Boolean(b.metadata?.task_extraction_status);
    if (aHasTaskStatus !== bHasTaskStatus) return aHasTaskStatus ? -1 : 1;
    return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
  });

  for (const row of sorted) {
    const documentId = row.source_document_id ? String(row.source_document_id) : "";
    if (!documentId || metadataByDocumentId.has(documentId)) continue;
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    metadataByDocumentId.set(documentId, { ...metadata, _updated_at: row.updated_at });
  }

  return metadataByDocumentId;
}

function hasTaskExtractionOutcome(
  documentId: string,
  taskIds: Set<string>,
  jobMetadataByDocumentId: Map<string, Record<string, unknown>>,
) {
  if (taskIds.has(documentId)) return true;
  const status = String(jobMetadataByDocumentId.get(documentId)?.task_extraction_status ?? "").toLowerCase();
  return status === "tasks_created" || status === "no_actionable_tasks" || status === "task_signal_staged";
}

function hasFullTranscriptReadProof(
  documentId: string,
  jobMetadataByDocumentId: Map<string, Record<string, unknown>>,
) {
  const readProof = jobMetadataByDocumentId.get(documentId)?.read_proof;
  if (!readProof || typeof readProof !== "object") return false;
  const proof = readProof as Record<string, unknown>;
  return proof.status === "full_source_read" && proof.scope === "full_transcript";
}

function emptyDay(date: string): DailySyncRow {
  return {
    date,
    sharepoint_synced: 0,
    sharepoint_failed: 0,
    outlook_synced: 0,
    outlook_failed: 0,
    outlook_added: 0,
    outlook_vectorized: 0,
    outlook_project_assigned: 0,
    outlook_tasks_extracted: 0,
    outlook_project_intelligence_updated: 0,
    outlook_complete: 0,
    meetings_synced: 0,
    meetings_failed: 0,
    meetings_added: 0,
    meetings_vectorized: 0,
    meetings_project_assigned: 0,
    meetings_tasks_extracted: 0,
    meetings_project_intelligence_updated: 0,
    meetings_complete: 0,
    teams_synced: 0,
    teams_failed: 0,
    teams_runs: 0,
    acumatica_synced: 0,
    acumatica_failed: 0,
    acumatica_runs: 0,
    sharepoint_runs: 0,
    outlook_runs: 0,
    meetings_runs: 0,
    failed_runs: 0,
  };
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const appSupabase = createServiceClient();
  const ragSupabase = createRagServiceClient();

  const user = await getApiRouteUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 1),
    180,
  );

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await ragSupabase
    .from("source_sync_runs")
    .select("source,started_at,items_synced,items_failed,status,metadata")
    .gte("started_at", since.toISOString())
    .in("source", [...Object.keys(SOURCE_BUCKETS), "microsoft_graph"])
    .order("started_at", { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 },
    );
  }

  const { data: acumaticaData, error: acumaticaError } = await serviceDb.from("acumatica_sync_runs")
    .select("started_at,upserted,projected,errors,status")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })
    .limit(10000);

  if (acumaticaError) {
    return NextResponse.json(
      { error: acumaticaError.message, code: acumaticaError.code },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Array<{
    source: string;
    started_at: string;
    items_synced: number | null;
    items_failed: number | null;
    status: string | null;
    metadata: unknown;
  }>;

  const byDay = new Map<string, DailySyncRow>();
  for (const row of rows) {
    const date = row.started_at.slice(0, 10);
    let day = byDay.get(date);
    if (!day) {
      day = emptyDay(date);
      byDay.set(date, day);
    }

    if (row.source === "microsoft_graph") {
      const byCategory = parseMetadata(row.metadata).by_category ?? {};
      for (const [category, count] of Object.entries(byCategory)) {
        const bucket = GRAPH_CATEGORY_BUCKETS[category];
        if (!bucket || count <= 0) continue;
        addSourceTotals(day, bucket, count, 0, 1);
      }
      if (row.status && FAILURE_STATUSES.has(row.status)) {
        day.failed_runs += 1;
      }
      continue;
    }

    const bucket = SOURCE_BUCKETS[row.source];
    if (!bucket) continue;

    const synced = row.items_synced ?? 0;
    const failed = row.items_failed ?? 0;
    addSourceTotals(day, bucket, synced, failed, 1);
    if (row.status && FAILURE_STATUSES.has(row.status)) {
      day.failed_runs += 1;
    }
  }

  for (const row of acumaticaData ?? []) {
    if (!row.started_at) continue;
    const date = row.started_at.slice(0, 10);
    let day = byDay.get(date);
    if (!day) {
      day = emptyDay(date);
      byDay.set(date, day);
    }

    const synced = (row.upserted ?? 0) + (row.projected ?? 0);
    const failed = row.errors ?? 0;
    addSourceTotals(day, "acumatica", synced, failed, 1);
    if (row.status && FAILURE_STATUSES.has(row.status)) {
      day.failed_runs += 1;
    }
  }

  const { data: meetingDocuments, error: meetingDocumentsError } = await serviceDb.from("document_metadata")
    .select("id,created_at,project_id")
    .eq("type", "meeting")
    .or("source.eq.fireflies,source_system.eq.fireflies")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);

  if (meetingDocumentsError) {
    return NextResponse.json(
      { error: meetingDocumentsError.message, code: meetingDocumentsError.code },
      { status: 500 },
    );
  }

  const meetingRows = ((meetingDocuments ?? []) as MeetingDocumentRow[]).filter(
    (row) => row.id && row.created_at,
  );
  const meetingIds = meetingRows.map((row) => row.id);
  const chunkRows: Array<{ document_id: string; updated_at: string | null }> = [];
  const taskRows: Array<{ metadata_id: string | null; created_at: string }> = [];
  const evidenceRows: Array<{ source_document_id: string | null; created_at: string | null }> = [];
  const jobRows: LifecycleJobRow[] = [];

  for (const batch of batches(meetingIds, 25)) {
    const [chunkResult, taskResult, evidenceResult, processingJobResult] =
      await Promise.all([
        ragSupabase
          .from("document_chunks")
          .select("document_id,updated_at")
          .in("document_id", batch)
          .not("embedding", "is", null)
          .limit(10000),
        serviceDb.from("tasks")
          .select("metadata_id,created_at")
          .in("metadata_id", batch)
          .gte("created_at", since.toISOString())
          .limit(10000),
        serviceDb.from("insight_card_evidence")
          .select("source_document_id,created_at")
          .in("source_document_id", batch)
          .gte("created_at", since.toISOString())
          .limit(10000),
        ragSupabase
          .from("source_processing_jobs")
          .select("source_document_id,updated_at,metadata")
          .in("source_document_id", batch)
          .order("updated_at", { ascending: false })
          .limit(10000)
          .returns<LifecycleJobRow[]>(),
      ]);

    if (chunkResult.error) {
      return NextResponse.json(
        { error: chunkResult.error.message, code: chunkResult.error.code },
        { status: 500 },
      );
    }
    if (taskResult.error) {
      return NextResponse.json(
        { error: taskResult.error.message, code: taskResult.error.code },
        { status: 500 },
      );
    }
    if (evidenceResult.error) {
      return NextResponse.json(
        { error: evidenceResult.error.message, code: evidenceResult.error.code },
        { status: 500 },
      );
    }
    if (processingJobResult.error) {
      return NextResponse.json(
        { error: processingJobResult.error.message, code: processingJobResult.error.code },
        { status: 500 },
      );
    }
    chunkRows.push(...(chunkResult.data ?? []));
    taskRows.push(...(taskResult.data ?? []));
    evidenceRows.push(...(evidenceResult.data ?? []));
    jobRows.push(...(processingJobResult.data ?? []));
  }

  const embeddedIds = new Set(chunkRows.map((row) => row.document_id));
  const taskIds = new Set(
    taskRows
      .map((row) => row.metadata_id)
      .filter((id): id is string => id !== null),
  );
  const evidenceIds = new Set(
    evidenceRows
      .map((row) => row.source_document_id)
      .filter((id): id is string => Boolean(id)),
  );
  const jobMetadataByDocumentId = latestJobMetadataByDocumentId(jobRows);

  for (const meeting of meetingRows) {
    if (!meeting.created_at) continue;
    const date = meeting.created_at.slice(0, 10);
    let day = byDay.get(date);
    if (!day) {
      day = emptyDay(date);
      byDay.set(date, day);
    }

    const vectorized = embeddedIds.has(meeting.id);
    const projectAssigned = meeting.project_id !== null;
    const tasksExtracted = hasTaskExtractionOutcome(meeting.id, taskIds, jobMetadataByDocumentId);
    const projectIntelligenceUpdated =
      evidenceIds.has(meeting.id) && hasFullTranscriptReadProof(meeting.id, jobMetadataByDocumentId);
    const complete = vectorized && projectAssigned && tasksExtracted && projectIntelligenceUpdated;

    day.meetings_added += 1;
    day.meetings_vectorized += vectorized ? 1 : 0;
    day.meetings_project_assigned += projectAssigned ? 1 : 0;
    day.meetings_tasks_extracted += tasksExtracted ? 1 : 0;
    day.meetings_project_intelligence_updated += projectIntelligenceUpdated ? 1 : 0;
    day.meetings_complete += complete ? 1 : 0;
  }

  const { data: outlookDocuments, error: outlookDocumentsError } = await ragSupabase
    .from("rag_document_metadata")
    .select("id,created_at,project_id")
    .eq("source", "microsoft_graph")
    .eq("type", "email")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);

  if (outlookDocumentsError) {
    return NextResponse.json(
      { error: outlookDocumentsError.message, code: outlookDocumentsError.code },
      { status: 500 },
    );
  }

  const outlookRows = ((outlookDocuments ?? []) as MeetingDocumentRow[]).filter(
    (row) => row.id && row.created_at,
  );
  const outlookIds = outlookRows.map((row) => row.id);
  const outlookChunkRows: Array<{ document_id: string; updated_at: string | null }> = [];
  const outlookTaskRows: Array<{ metadata_id: string | null; created_at: string }> = [];
  const outlookEvidenceRows: Array<{ source_document_id: string | null; created_at: string | null }> = [];
  const outlookJobRows: LifecycleJobRow[] = [];

  for (const batch of batches(outlookIds, 25)) {
    const [chunkResult, taskResult, evidenceResult, processingJobResult] =
      await Promise.all([
        ragSupabase
          .from("document_chunks")
          .select("document_id,updated_at")
          .in("document_id", batch)
          .not("embedding", "is", null)
          .limit(10000),
        serviceDb.from("tasks")
          .select("metadata_id,created_at")
          .in("metadata_id", batch)
          .gte("created_at", since.toISOString())
          .limit(10000),
        serviceDb.from("insight_card_evidence")
          .select("source_document_id,created_at")
          .in("source_document_id", batch)
          .gte("created_at", since.toISOString())
          .limit(10000),
        ragSupabase
          .from("source_processing_jobs")
          .select("source_document_id,updated_at,metadata")
          .in("source_document_id", batch)
          .order("updated_at", { ascending: false })
          .limit(10000)
          .returns<LifecycleJobRow[]>(),
      ]);

    if (chunkResult.error) {
      return NextResponse.json(
        { error: chunkResult.error.message, code: chunkResult.error.code },
        { status: 500 },
      );
    }
    if (taskResult.error) {
      return NextResponse.json(
        { error: taskResult.error.message, code: taskResult.error.code },
        { status: 500 },
      );
    }
    if (evidenceResult.error) {
      return NextResponse.json(
        { error: evidenceResult.error.message, code: evidenceResult.error.code },
        { status: 500 },
      );
    }
    if (processingJobResult.error) {
      return NextResponse.json(
        { error: processingJobResult.error.message, code: processingJobResult.error.code },
        { status: 500 },
      );
    }
    outlookChunkRows.push(...(chunkResult.data ?? []));
    outlookTaskRows.push(...(taskResult.data ?? []));
    outlookEvidenceRows.push(...(evidenceResult.data ?? []));
    outlookJobRows.push(...(processingJobResult.data ?? []));
  }

  const outlookEmbeddedIds = new Set(outlookChunkRows.map((row) => row.document_id));
  const outlookTaskIds = new Set(
    outlookTaskRows
      .map((row) => row.metadata_id)
      .filter((id): id is string => id !== null),
  );
  const outlookEvidenceIds = new Set(
    outlookEvidenceRows
      .map((row) => row.source_document_id)
      .filter((id): id is string => Boolean(id)),
  );
  const outlookJobMetadataByDocumentId = latestJobMetadataByDocumentId(outlookJobRows);

  for (const outlook of outlookRows) {
    if (!outlook.created_at) continue;
    const date = outlook.created_at.slice(0, 10);
    let day = byDay.get(date);
    if (!day) {
      day = emptyDay(date);
      byDay.set(date, day);
    }

    const vectorized = outlookEmbeddedIds.has(outlook.id);
    const projectAssigned = outlook.project_id !== null;
    const tasksExtracted = hasTaskExtractionOutcome(outlook.id, outlookTaskIds, outlookJobMetadataByDocumentId);
    const projectIntelligenceUpdated = outlookEvidenceIds.has(outlook.id);
    const complete = vectorized && projectAssigned && tasksExtracted && projectIntelligenceUpdated;

    day.outlook_added += 1;
    day.outlook_vectorized += vectorized ? 1 : 0;
    day.outlook_project_assigned += projectAssigned ? 1 : 0;
    day.outlook_tasks_extracted += tasksExtracted ? 1 : 0;
    day.outlook_project_intelligence_updated += projectIntelligenceUpdated ? 1 : 0;
    day.outlook_complete += complete ? 1 : 0;
  }

  // Fill in empty days so a multi-day stall is visible as a row of zeros
  // rather than an absent row.
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  for (const date of dates) {
    if (!byDay.has(date)) {
      byDay.set(date, emptyDay(date));
    }
  }

  const days_sorted = Array.from(byDay.values()).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

  return NextResponse.json({
    days: days_sorted,
    count: days_sorted.length,
  });
});
