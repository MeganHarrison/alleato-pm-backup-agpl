import { NextResponse } from "next/server";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logEvent } from "@/lib/guardrails/observability";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

import { SourceSyncStatusSchema, type SourceSyncStatus } from "../_contracts";
import {
  SOURCE_FAMILIES,
  STAGE_GRACE_MINUTES,
  ageMinutes,
  batches,
  computeDocumentStages,
  hasFullTranscriptReadProof,
  hasTaskExtractionOutcome,
  isIntentionalSkipJob,
  latestJobMetadataByDocumentId,
  maturityCoverageStatus,
  newest,
  readSupabaseRows,
  type LifecycleJobRow,
  type LifecycleStageKey,
  type LifecycleStatus,
  type LifecycleSupport,
  type RagEmailSourceRow,
  type SourceFamilyKey,
  type SourceRow,
} from "../_lifecycle";
import { fetchBackendSourceSync, requireAdmin } from "../_shared";

const RAG_LIFECYCLE_LOOKBACK_HOURS = 24;
const RAG_LIFECYCLE_MAX_PACKET_AGE_HOURS = 36;
const RAG_LIFECYCLE_MAX_WINDOW_DAYS = 180;

/**
 * The cohort window the lifecycle funnel is scoped to. `sinceISO` is the lower
 * bound on source-document creation; `untilISO` is an optional upper bound
 * (set only for explicit custom ranges). Downstream stage checks (vectorized,
 * tasks, evidence) always reflect current state — only the source cohort is
 * date-bounded.
 */
type LifecycleWindow = {
  sinceISO: string;
  untilISO: string | null;
  lookbackHours: number;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function defaultLifecycleWindow(): LifecycleWindow {
  return {
    sinceISO: new Date(Date.now() - RAG_LIFECYCLE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString(),
    untilISO: null,
    lookbackHours: RAG_LIFECYCLE_LOOKBACK_HOURS,
  };
}

/**
 * Resolve the lifecycle cohort window from query params. Supported, in order:
 * - `start` + `end` (YYYY-MM-DD): explicit inclusive UTC date range.
 * - `days` (1-180): trailing window of N days ending now.
 * - neither: the default 24h window (preserves cron + legacy behavior).
 */
function parseLifecycleWindow(request: Request): LifecycleWindow {
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (start && end && DATE_ONLY.test(start) && DATE_ONLY.test(end)) {
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    const sinceISO = new Date(`${lo}T00:00:00.000Z`).toISOString();
    const untilISO = new Date(`${hi}T23:59:59.999Z`).toISOString();
    const lookbackHours = Math.max(
      1,
      Math.round((new Date(untilISO).getTime() - new Date(sinceISO).getTime()) / (60 * 60 * 1000)),
    );
    return { sinceISO, untilISO, lookbackHours };
  }

  const daysParam = url.searchParams.get("days");
  if (daysParam) {
    const days = Math.min(
      Math.max(parseInt(daysParam, 10) || 1, 1),
      RAG_LIFECYCLE_MAX_WINDOW_DAYS,
    );
    return {
      sinceISO: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      untilISO: null,
      lookbackHours: days * 24,
    };
  }

  return defaultLifecycleWindow();
}

function emptyRagLifecycleStatus(
  status: "unavailable" | "degraded",
  message: string,
): NonNullable<SourceSyncStatus["ragLifecycle"]> {
  return {
    generatedAt: new Date().toISOString(),
    lookbackHours: RAG_LIFECYCLE_LOOKBACK_HOURS,
    maxPacketAgeHours: RAG_LIFECYCLE_MAX_PACKET_AGE_HOURS,
    status,
    sources: SOURCE_FAMILIES.map((family) => ({
      key: family.key,
      label: family.label,
      sourceSystems: family.sourceSystems,
      totalSources: 0,
      latestSourceAt: null,
      status: "unknown",
      stages: [
        lifecycleStage("synced", "Synced", "unknown", 0, 0, null, message, "source adapter"),
        lifecycleStage("vectorized", "Vectorized", "unknown", 0, 0, null, message, "RAG embedder"),
        lifecycleStage("projectAssigned", "Project assigned", "unknown", 0, 0, null, message, "project attribution"),
        lifecycleStage("tasksExtracted", "Tasks extracted", "unknown", 0, 0, null, message, "task extractor"),
        lifecycleStage(
          "projectIntelligenceUpdated",
          "Project Intelligence updated",
          "unknown",
          0,
          0,
          null,
          message,
          "Project Intelligence runner",
        ),
      ],
      alerts: [],
    })),
    notifications: [
      {
        status: "blocked",
        channel: "source-sync-health",
        message,
        checkedAt: new Date().toISOString(),
      },
    ],
  };
}

function lifecycleStage(
  key: LifecycleStageKey,
  label: string,
  status: LifecycleStatus,
  count: number,
  total: number,
  latestAt: string | null,
  message: string,
  ownerHint: string,
) {
  return { key, label, status, count, total, latestAt, message, ownerHint };
}

function sourceStatus(stages: Array<{ status: LifecycleStatus }>): LifecycleStatus {
  if (stages.some((stage) => stage.status === "critical")) return "critical";
  if (stages.some((stage) => stage.status === "warning")) return "warning";
  if (stages.every((stage) => stage.status === "healthy")) return "healthy";
  return "unknown";
}

function sourceAlert(params: {
  severity: "warning" | "critical";
  code: string;
  source: SourceFamilyKey;
  message: string;
}): SourceSyncStatus["alerts"][number] {
  return {
    severity: params.severity,
    code: params.code,
    source: params.source,
    resourceId: `rag-lifecycle:${params.source}`,
    message: params.message,
    detectedAt: new Date().toISOString(),
  };
}

async function buildRagLifecycleStatus(
  window: LifecycleWindow,
): Promise<NonNullable<SourceSyncStatus["ragLifecycle"]>> {
  const generatedAt = new Date().toISOString();
  const cutoff = window.sinceISO;
  const until = window.untilISO;
  const lookbackHours = window.lookbackHours;
  const maxFreshPacketCutoff = new Date(
    Date.now() - RAG_LIFECYCLE_MAX_PACKET_AGE_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const appClient = createServiceClient();
  const ragClient = createRagServiceClient();

  const sourceRows = await readSupabaseRows<SourceRow>("daily source metadata", () =>
    serviceDb.from("document_metadata")
      .select(
        "id,title,source,category,type,project_id,source_system,source_item_id,fireflies_id,created_at,date,source_last_modified_at",
      )
      .is("deleted_at", null)
      .gte("created_at", cutoff)
      .lte("created_at", until ?? new Date().toISOString())
      .in("source", ["fireflies", "microsoft_graph"])
      .order("created_at", { ascending: false })
      .limit(2000),
  );

  const appRows = sourceRows;
  const appRowIds = new Set(appRows.map((row) => row.id));
  const ragEmailRows = await readSupabaseRows<RagEmailSourceRow>("RAG email metadata", () =>
    ragClient
      .from("rag_document_metadata")
      .select("id,title,source,type,source_system,source_item_id,source_web_url,created_at,updated_at,project_id")
      .eq("source", "microsoft_graph")
      .or("type.in.(email,email_attachment),id.like.outlook_%")
      .gte("updated_at", cutoff)
      .lte("updated_at", until ?? new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(2000),
  );

  const ragOnlyEmailRows = ragEmailRows
    .filter((row) => !appRowIds.has(row.id))
    .map<SourceRow>((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      category: row.type === "email_attachment" ? "email_attachment" : "email",
      type: row.type,
      project_id: row.project_id,
      source_system: row.source_system,
      source_item_id: row.source_item_id,
      fireflies_id: null,
      created_at: row.created_at,
      date: row.created_at,
      source_last_modified_at: row.updated_at,
    }));

  const rows = [...appRows, ...ragOnlyEmailRows];
  const sourceIds = rows.map((row) => row.id);

  const chunkRows: Array<{ document_id: string; source_type: string | null; updated_at: string | null }> = [];
  const taskRows: Array<{
    metadata_id: string;
    project_id: number | null;
    created_at: string;
  }> = [];
  const evidenceRows: Array<{
    source_document_id: string | null;
    created_at: string;
  }> = [];
  const jobRows: LifecycleJobRow[] = [];

  for (const batch of batches(sourceIds)) {
    const [chunkResult, taskResult, evidenceResult, jobResult] = await Promise.all([
      readSupabaseRows<{ document_id: string; source_type: string | null; updated_at: string | null }>("RAG chunks", () =>
        ragClient
          .from("document_chunks")
          .select("document_id,source_type,updated_at")
          .in("document_id", batch)
          .not("embedding", "is", null)
          .limit(1000),
      ),
      readSupabaseRows<{ metadata_id: string; project_id: number | null; created_at: string }>("extracted tasks", () =>
        serviceDb.from("tasks")
          .select("metadata_id,source_system,project_id,created_at")
          .in("metadata_id", batch)
          .gte("created_at", cutoff)
          .limit(1000),
      ),
      readSupabaseRows<{ source_document_id: string | null; created_at: string }>("Project Intelligence evidence", () =>
        serviceDb.from("insight_card_evidence")
          .select("source_document_id,created_at")
          .in("source_document_id", batch)
          .gte("created_at", cutoff)
          .limit(1000),
      ),
      readSupabaseRows<LifecycleJobRow>("source processing jobs", () =>
        ragClient
          .from("source_processing_jobs")
          .select("source_document_id,source_item_id,source_system,status,updated_at,error_code,error_message,metadata")
          .in("source_document_id", batch)
          .order("updated_at", { ascending: false })
          .limit(1000)
          .returns<LifecycleJobRow[]>(),
      ),
    ]);

    chunkRows.push(...chunkResult);
    taskRows.push(...taskResult);
    evidenceRows.push(...evidenceResult);
    jobRows.push(...jobResult);
  }

  const [packetResult, recentJobResult] =
    await Promise.all([
      readSupabaseRows<{ id: string; generated_at: string }>("Project Intelligence packets", () =>
        serviceDb.from("intelligence_packets")
          .select("id,generated_at")
          .eq("packet_type", "current")
          .gte("generated_at", maxFreshPacketCutoff)
          .order("generated_at", { ascending: false })
          .limit(100),
      ),
      readSupabaseRows<LifecycleJobRow>("source processing jobs", () =>
        ragClient
          .from("source_processing_jobs")
          .select("source_document_id,source_item_id,source_system,status,updated_at,error_code,error_message,metadata")
          .gte("updated_at", cutoff)
          .limit(5000)
          .returns<LifecycleJobRow[]>(),
      ),
    ]);

  jobRows.push(...recentJobResult);

  const embeddedIds = new Set(chunkRows.map((row) => row.document_id));
  const embeddedMeetingTranscriptIds = new Set(
    chunkRows
      .filter((row) => row.source_type === "meeting_transcript")
      .map((row) => row.document_id),
  );
  const taskIds = new Set(taskRows.map((row) => row.metadata_id));
  const jobMetadataByDocumentId = latestJobMetadataByDocumentId(jobRows);
  const evidenceIds = new Set(
    evidenceRows
      .map((row) => row.source_document_id)
      .filter((id): id is string => Boolean(id)),
  );
  const latestPacketAt = newest(packetResult.map((row) => row.generated_at));
  const hasFreshPackets = Boolean(latestPacketAt);

  // Single source of truth for per-document stage evaluation. Shared with the
  // /rag drill-down (lifecycle-documents/route.ts) so the matrix counts and the
  // document list can never disagree about which stages a document has cleared.
  const support: LifecycleSupport = {
    embeddedIds,
    embeddedMeetingTranscriptIds,
    taskIds,
    evidenceIds,
    jobMetadataByDocumentId,
  };

  const sources = SOURCE_FAMILIES.map((family) => {
    const familyRows = rows.filter(family.matches);
    const ids = new Set(familyRows.map((row) => row.id));
    const total = familyRows.length;
    const stageFlags = familyRows.map((row) => computeDocumentStages(row, family, support));
    const vectorized = stageFlags.filter((flags) => flags.vectorized).length;
    const projectAssigned = stageFlags.filter((flags) => flags.projectAssigned).length;
    const tasksExtracted = stageFlags.filter((flags) => flags.tasksExtracted).length;

    // Health color is judged over the *mature* cohort only (docs past the
    // stage's grace window). Docs still within the window are in flight — the
    // feeding cron simply has not run yet — so normal lag reads as "flowing",
    // not stalled. Displayed count/total stay the full cohort for transparency.
    const nowMs = Date.now();
    const rowAgeMinutes = familyRows.map((row) => ageMinutes(row.created_at, nowMs));
    const maturity = (stageKey: LifecycleStageKey) => {
      const grace = STAGE_GRACE_MINUTES[stageKey];
      let clearedMature = 0;
      let totalMature = 0;
      let inFlight = 0;
      stageFlags.forEach((flags, index) => {
        const age = rowAgeMinutes[index];
        const isMature = age === null || age >= grace;
        if (isMature) {
          totalMature += 1;
          if (flags[stageKey]) clearedMature += 1;
        } else if (!flags[stageKey]) {
          inFlight += 1;
        }
      });
      return { clearedMature, totalMature, inFlight };
    };
    const inFlightSuffix = (inFlight: number, stageKey: LifecycleStageKey) =>
      inFlight > 0
        ? ` ${inFlight} still in flight (synced <${Math.round(STAGE_GRACE_MINUTES[stageKey] / 60)}h ago).`
        : "";
    const vectorizedMaturity = maturity("vectorized");
    const projectAssignedMaturity = maturity("projectAssigned");
    const tasksMaturity = maturity("tasksExtracted");
    const intelligenceMaturity = maturity("projectIntelligenceUpdated");
    const evidenceOnlyProjectIntelligence = familyRows.filter(
      (row) => family.key === "meetings" && evidenceIds.has(row.id) && !hasFullTranscriptReadProof(row.id, jobMetadataByDocumentId),
    ).length;
    const intelligenceUpdated = stageFlags.filter(
      (flags) => flags.projectIntelligenceUpdated,
    ).length;
    const latestSourceAt = newest(
      familyRows.map((row) => row.source_last_modified_at ?? row.date ?? row.created_at),
    );
    const latestChunkAt = newest(
      chunkRows
        .filter((row) => ids.has(row.document_id) && (family.key !== "meetings" || row.source_type === "meeting_transcript"))
        .map((row) => row.updated_at),
    );
    const latestTaskAt = newest(
      [
        ...taskRows.filter((row) => ids.has(row.metadata_id)).map((row) => row.created_at),
        ...familyRows
          .filter((row) => hasTaskExtractionOutcome(row.id, taskIds, jobMetadataByDocumentId))
          .map((row) => jobMetadataByDocumentId.get(row.id)?._updated_at as string | undefined),
      ],
    );
    const latestEvidenceAt = newest(
      evidenceRows
        .filter((row) => row.source_document_id && ids.has(row.source_document_id))
        .map((row) => row.created_at),
    );
    const familySourceIds = new Set(
      familyRows.flatMap((row) =>
        [row.id, row.source_item_id, row.fireflies_id].filter(Boolean).map(String),
      ),
    );
    const latestJobBySourceId = new Map<string, LifecycleJobRow>();
    for (const job of [...jobRows].sort((a, b) =>
      String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
    )) {
      const jobSourceIds = [job.source_document_id, job.source_item_id]
        .filter(Boolean)
        .map(String)
        .filter((sourceId) => familySourceIds.has(sourceId));
      for (const sourceId of jobSourceIds) {
        if (!latestJobBySourceId.has(sourceId)) latestJobBySourceId.set(sourceId, job);
      }
    }
    const recentFailures = [...new Set(latestJobBySourceId.values())].filter(
      (job) =>
        (String(job.status).startsWith("failed") || job.status === "error") &&
        // Intentional skips (interview-title / low-content exclusions) are
        // recorded as failed_permanent upstream but are not real failures —
        // never surface them as critical pipeline alerts.
        !isIntentionalSkipJob(job),
    );

    const stages = [
      lifecycleStage(
        "synced",
        "Synced",
        total > 0 ? "healthy" : "unknown",
        total,
        total,
        latestSourceAt,
        total > 0
          ? `${total} ${family.label.toLowerCase()} synced in the selected window.`
          : `No ${family.label.toLowerCase()} synced in the selected window.`,
        "source adapter",
      ),
      lifecycleStage(
        "vectorized",
        "Vectorized",
        maturityCoverageStatus(vectorizedMaturity.clearedMature, vectorizedMaturity.totalMature),
        vectorized,
        total,
        latestChunkAt,
        (family.key === "meetings"
          ? `${vectorized}/${total} Fireflies metadata rows have embedded meeting_transcript chunks and are searchable by the AI assistant.`
          : `${vectorized}/${total} have embedded chunks and are searchable by the AI assistant.`) +
          inFlightSuffix(vectorizedMaturity.inFlight, "vectorized"),
        "RAG embedder",
      ),
      lifecycleStage(
        "projectAssigned",
        "Project assigned",
        maturityCoverageStatus(
          projectAssignedMaturity.clearedMature,
          projectAssignedMaturity.totalMature,
        ),
        projectAssigned,
        total,
        latestSourceAt,
        `${projectAssigned}/${total} have project_id assigned.` +
          inFlightSuffix(projectAssignedMaturity.inFlight, "projectAssigned"),
        "project attribution",
      ),
      lifecycleStage(
        "tasksExtracted",
        "Tasks extracted",
        maturityCoverageStatus(tasksMaturity.clearedMature, tasksMaturity.totalMature),
        tasksExtracted,
        total,
        latestTaskAt,
        `${tasksExtracted}/${total} have task extraction outcomes from this source set.` +
          inFlightSuffix(tasksMaturity.inFlight, "tasksExtracted"),
        "task extractor",
      ),
      lifecycleStage(
        "projectIntelligenceUpdated",
        "Project Intelligence updated",
        // Absent a fresh packet the canonical daily runner is genuinely down → critical
        // regardless of cohort age. Otherwise judge over the mature cohort.
        hasFreshPackets
          ? maturityCoverageStatus(
              intelligenceMaturity.clearedMature,
              intelligenceMaturity.totalMature,
            )
          : "critical",
        intelligenceUpdated,
        total,
        latestEvidenceAt ?? latestPacketAt,
        hasFreshPackets
          ? (family.key === "meetings"
              ? `${intelligenceUpdated}/${total} have Project Intelligence evidence with full transcript-read proof; ${evidenceOnlyProjectIntelligence} have evidence without read proof; newest current packet ${latestPacketAt ?? "not found"}.`
              : `${intelligenceUpdated}/${total} have recent Project Intelligence evidence; newest current packet ${latestPacketAt ?? "not found"}.`) +
            inFlightSuffix(intelligenceMaturity.inFlight, "projectIntelligenceUpdated")
          : `No fresh current Project Intelligence packet within ${RAG_LIFECYCLE_MAX_PACKET_AGE_HOURS} hours.`,
        "Project Intelligence runner",
      ),
    ];

    const alerts = [
      ...stages
        .filter((stage) => stage.status === "critical" || stage.status === "warning")
        .map((stage) =>
          sourceAlert({
            severity: stage.status === "critical" ? "critical" : "warning",
            code: `rag_lifecycle_${stage.key}`,
            source: family.key,
            message: `${family.label}: ${stage.message} Owner: ${stage.ownerHint}.`,
          }),
        ),
      ...recentFailures.slice(0, 3).map((failure) =>
        sourceAlert({
          severity: "critical",
          code: failure.error_code ?? "source_processing_failed",
          source: family.key,
          message: `${family.label}: ${failure.error_message ?? failure.status}. Owner: source processing job.`,
        }),
      ),
    ];

    return {
      key: family.key,
      label: family.label,
      sourceSystems: family.sourceSystems,
      totalSources: total,
      latestSourceAt,
      status: sourceStatus(stages),
      stages,
      alerts,
    };
  });

  const degraded = sources.some((source) =>
    source.status === "critical" || source.status === "warning",
  );

  return {
    generatedAt,
    lookbackHours,
    maxPacketAgeHours: RAG_LIFECYCLE_MAX_PACKET_AGE_HOURS,
    status: degraded ? "degraded" : "healthy",
    sources,
    notifications: [
      {
        status: degraded ? "ready" : "skipped",
        channel: "source-sync-health",
        message: degraded
          ? "RAG lifecycle is degraded; source-sync alerts are ready for immediate notification handling."
          : "No immediate RAG lifecycle notification needed.",
        checkedAt: generatedAt,
      },
    ],
  };
}

async function withRagLifecycle(
  status: SourceSyncStatus,
  window: LifecycleWindow,
): Promise<SourceSyncStatus> {
  try {
    const ragLifecycle = await buildRagLifecycleStatus(window);
    const lifecycleAlerts = ragLifecycle.sources.flatMap((source) => source.alerts);
    return {
      ...status,
      healthy: status.healthy && ragLifecycle.status === "healthy",
      status:
        status.status === "unavailable"
          ? "unavailable"
          : status.status === "degraded" || ragLifecycle.status === "degraded"
            ? "degraded"
            : "healthy",
      alerts: [...lifecycleAlerts, ...status.alerts].slice(0, 120),
      counts: {
        ...status.counts,
        alerts: status.counts.alerts + lifecycleAlerts.length,
      },
      ragLifecycle,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const ragLifecycle = emptyRagLifecycleStatus(
      "degraded",
      `RAG lifecycle read-back failed: ${message}`,
    );
    return {
      ...status,
      healthy: false,
      status: status.status === "unavailable" ? "unavailable" : "degraded",
      alerts: [
        sourceAlert({
          severity: "critical",
          code: "rag_lifecycle_readback_failed",
          source: "meetings",
          message: `RAG lifecycle read-back failed: ${message}`,
        }),
        ...status.alerts,
      ],
      counts: {
        ...status.counts,
        alerts: status.counts.alerts + 1,
      },
      ragLifecycle,
    };
  }
}

/**
 * Graceful-degradation payload returned when the backend times out or is
 * unreachable. Using HTTP 200 here intentionally — the UI should render a
 * "checking…" state rather than surfacing a red error page, and the error
 * tracker should not fire a high-severity alert for routine backend cold-starts.
 */
function unavailableStatus(reason: string, requestId: string): SourceSyncStatus {
  return {
    status: "unavailable",
    healthy: false,
    generatedAt: new Date().toISOString(),
    thresholds: {
      staleSyncMinutes: 120,
      staleFirefliesMinutes: 240,
      staleExtractionMinutes: 1440,
      embeddingBacklogWarning: 25,
      failedJobWarning: 1,
      documentHealthSampleLimit: 2500,
      chunkHealthSampleLimit: 5000,
      jobHealthSampleLimit: 5000,
      maxReturnedSources: 80,
      maxReturnedAlerts: 80,
      maxReturnedStuckItems: 25,
    },
    sources: [],
    pipeline: {},
    alerts: [
      {
        severity: "warning",
        code: "backend_unavailable",
        source: "backend",
        resourceId: "source-sync-status",
        message: `Status check could not reach the backend: ${reason}`,
        detectedAt: new Date().toISOString(),
      },
    ],
    recentRuns: [],
    stuckItems: [],
    counts: {
      sources: 0,
      alerts: 1,
      documents: 0,
      chunks: 0,
      unembedded: 0,
      uncompiled: 0,
      tasks: 0,
      graphSubscriptions: 0,
      stuckItems: 0,
    },
    ragLifecycle: emptyRagLifecycleStatus(
      "unavailable",
      "Backend source-sync status is unavailable, so daily RAG lifecycle trust cannot be proved.",
    ),
  };
}

export const GET = withApiGuardrails(
  "api.admin.source-sync.status.GET",
  async ({ requestId, request }) => {
    await requireAdmin("api.admin.source-sync.status.GET");

    const lifecycleWindow = parseLifecycleWindow(request);

    let backendResponse: Response;
    try {
      backendResponse = await fetchBackendSourceSync(
        requestId,
        "api.admin.source-sync.status.GET",
        "status",
        { method: "GET" },
      );
    } catch (err) {
      // UPSTREAM_TIMEOUT / UPSTREAM_FAILURE: the backend is slow or down.
      // Return a structured "unavailable" payload (HTTP 200) so the UI renders
      // gracefully and the error tracker is not spammed with high-severity 504s.
      const isTimeout =
        err instanceof GuardrailError &&
        (err.code === "UPSTREAM_TIMEOUT" || err.code === "UPSTREAM_FAILURE");

      if (isTimeout) {
        logEvent({
          event: "dependency_degraded",
          level: "warn",
          requestId,
          where: "api.admin.source-sync.status.GET",
          dependency: "backend.source-sync.status",
          details: {
            code: (err as GuardrailError).code,
            reason: (err as GuardrailError).message,
          },
        });
        const statusWithLifecycle = await withRagLifecycle(
          unavailableStatus((err as GuardrailError).message, requestId),
          lifecycleWindow,
        );
        return NextResponse.json(statusWithLifecycle);
      }
      throw err;
    }

    const payload = await backendResponse.json();
    const status = validateResponseContract(
      SourceSyncStatusSchema,
      payload,
      "api.admin.source-sync.status.GET",
    );

    const enrichedStatus = validateResponseContract(
      SourceSyncStatusSchema,
      await withRagLifecycle(status, lifecycleWindow),
      "api.admin.source-sync.status.GET.rag-lifecycle",
    );

    return NextResponse.json(enrichedStatus);
  },
);
