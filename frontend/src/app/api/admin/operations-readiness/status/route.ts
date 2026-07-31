import { NextResponse } from "next/server";
import { z } from "zod";

import {
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

import { requireAdmin } from "../../_shared";
import { fetchBackendSourceSync } from "../../source-sync/_shared";

const SourceSyncStatusSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  healthy: z.boolean(),
  generatedAt: z.string(),
  counts: z.object({
    alerts: z.number(),
    documents: z.number(),
    chunks: z.number(),
    unembedded: z.number(),
    uncompiled: z.number(),
    tasks: z.number(),
    stuckItems: z.number(),
  }),
  alerts: z.array(
    z.object({
      severity: z.enum(["info", "warning", "critical"]).or(z.string()),
      code: z.string(),
      source: z.string(),
      resourceId: z.string(),
      message: z.string(),
      detectedAt: z.string().nullable(),
    }),
  ),
  recentRuns: z.array(
    z.object({
      source: z.string(),
      stage: z.string(),
      status: z.string(),
      resourceName: z.string().nullable(),
      finishedAt: z.string().nullable(),
      errorCode: z.string().nullable(),
      errorMessage: z.string().nullable(),
    }),
  ),
});

const ProjectIntelligenceStatusSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]),
  healthy: z.boolean(),
  counts: z.object({
    insightCards: z.number(),
    currentPackets: z.number(),
    highConfidenceUnpromoted: z.number(),
  }),
  unhealthyChecks: z.record(z.string(), z.number()),
  generatedAt: z.string(),
});

type ReadinessLevel = "ready" | "attention" | "blocked" | "unknown";

type ReadinessItem = {
  id: "source-data" | "tasks" | "project-intelligence" | "daily-brief";
  question: string;
  answer: string;
  level: ReadinessLevel;
  checkedAt: string;
  metrics: Array<{ label: string; value: string }>;
  blocker: string | null;
  cause: string;
  prevention: string;
  primaryAction: { label: string; href: string };
  runActions: Array<{
    id: string;
    label: string;
    endpoint: string;
    method: "POST";
    body?: Record<string, unknown>;
    confirm?: string;
  }>;
};

type DailyBriefPacket = {
  generatedAt?: unknown;
  sections?: {
    needsBrandon?: unknown[];
    waitingOnOthers?: unknown[];
    importantUpdates?: unknown[];
  };
};

type DailyBriefCanonicalStatus = {
  runId: string | null;
  status: string | null;
  deliveryStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  sourceHealth: Array<{
    sourceFamily?: unknown;
    resourceName?: unknown;
    status?: unknown;
    warning?: unknown;
    failureMessage?: unknown;
  }>;
  teamsDeliveryAttemptStatus: string | null;
};

type SourceSyncStatus = z.infer<typeof SourceSyncStatusSchema>;
type ProjectIntelligenceStatus = z.infer<
  typeof ProjectIntelligenceStatusSchema
>;

const SOURCE_HEALTH_DOCUMENT_LIMIT = 2500;
const SOURCE_HEALTH_CHUNK_LIMIT = 5000;
const STALE_SYNC_MINUTES = 120;

function formatCount(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function firstMeaningfulError(status: z.infer<typeof SourceSyncStatusSchema>) {
  const failedRun = status.recentRuns.find(
    (run) => run.status === "failed" && (run.errorMessage || run.errorCode),
  );
  if (failedRun) {
    return `${failedRun.resourceName ?? failedRun.source} ${failedRun.stage}: ${
      failedRun.errorMessage ?? failedRun.errorCode
    }`;
  }

  const alert =
    status.alerts.find((item) => item.severity === "critical") ??
    status.alerts[0];
  return alert?.message ?? null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageMinutes(
  value: string | null | undefined,
  now: Date,
): number | null {
  const date = parseDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
}

async function countTable(
  table: "tasks" | "insight_cards" | "intelligence_packets",
) {
  const { count, error } = await serviceDb
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
  return count ?? 0;
}

async function countCurrentPackets() {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("intelligence_packets")
    .select("id", { count: "exact", head: true })
    .eq("packet_type", "current");

  if (error)
    throw new Error(
      `Failed to count current intelligence packets: ${error.message}`,
    );
  return count ?? 0;
}

async function countSignalCandidates(status: string, confidence?: string) {
  const ragSupabase = createRagServiceClient();
  let query = ragSupabase
    .from("source_signal_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (confidence) query = query.eq("confidence", confidence);

  const { count, error } = await query;
  if (error)
    throw new Error(`Failed to count signal candidates: ${error.message}`);
  return count ?? 0;
}

async function loadSourceFallbackStatus(now: Date): Promise<SourceSyncStatus> {
  const supabase = createServiceClient();
  const ragSupabase = createRagServiceClient();
  const [
    documentsResult,
    chunksResult,
    graphStatesResult,
    recentRunsResult,
    totalTasks,
  ] = await Promise.all([
    supabase
      .from("document_metadata")
      .select(
        "id,source,source_system,category,type,status,captured_at,date,created_at,source_last_modified_at",
      )
      .limit(SOURCE_HEALTH_DOCUMENT_LIMIT),
    ragSupabase
      .from("document_chunks")
      .select("document_id")
      .limit(SOURCE_HEALTH_CHUNK_LIMIT),
    ragSupabase
      .from("graph_sync_state")
      .select(
        "source,resource_id,resource_name,last_sync_at,sync_status,error_message,items_synced,updated_at",
      )
      .order("last_sync_at", { ascending: true }),
    ragSupabase
      .from("source_sync_runs")
      .select(
        "source,stage,status,resource_name,finished_at,error_code,error_message",
      )
      .order("started_at", { ascending: false })
      .limit(20),
    countTable("tasks"),
  ]);

  if (documentsResult.error) {
    throw new Error(
      `Failed to load source documents: ${documentsResult.error.message}`,
    );
  }
  if (chunksResult.error) {
    throw new Error(
      `Failed to load source chunks: ${chunksResult.error.message}`,
    );
  }
  if (graphStatesResult.error) {
    throw new Error(
      `Failed to load graph sync state: ${graphStatesResult.error.message}`,
    );
  }
  if (recentRunsResult.error) {
    throw new Error(
      `Failed to load source sync runs: ${recentRunsResult.error.message}`,
    );
  }

  const chunkDocumentIds = new Set(
    (chunksResult.data ?? []).map((row) => row.document_id).filter(Boolean),
  );
  const documents = documentsResult.data ?? [];
  const unembedded = documents.filter(
    (row) => !chunkDocumentIds.has(row.id),
  ).length;
  const staleGraphStates = (graphStatesResult.data ?? [])
    .map((row) => ({
      ...row,
      staleMinutes: ageMinutes(row.last_sync_at, now),
    }))
    .filter(
      (row) =>
        row.error_message ||
        row.staleMinutes === null ||
        row.staleMinutes > STALE_SYNC_MINUTES,
    );
  const primaryGraphIssue = staleGraphStates[0];
  const alerts: SourceSyncStatus["alerts"] = [];

  if (primaryGraphIssue) {
    alerts.push({
      severity: primaryGraphIssue.error_message ? "critical" : "warning",
      code: primaryGraphIssue.error_message
        ? "source_sync_error"
        : "source_sync_stale",
      source: primaryGraphIssue.source ?? "microsoft_graph",
      resourceId: primaryGraphIssue.resource_id ?? "default",
      message: `${primaryGraphIssue.resource_name ?? primaryGraphIssue.source ?? "Microsoft Graph"}: ${
        primaryGraphIssue.error_message ??
        (primaryGraphIssue.staleMinutes === null
          ? "No successful sync timestamp is available."
          : `Last sync is ${primaryGraphIssue.staleMinutes} minutes old.`)
      }`,
      detectedAt: now.toISOString(),
    });
  }

  if (unembedded > 0) {
    alerts.push({
      severity: "warning",
      code: "embedding_backlog",
      source: "vectorization",
      resourceId: "document_metadata",
      message: `${unembedded} synced item(s) are missing searchable chunks.`,
      detectedAt: now.toISOString(),
    });
  }

  return {
    status: alerts.length > 0 ? "degraded" : "healthy",
    healthy: alerts.length === 0,
    generatedAt: now.toISOString(),
    counts: {
      alerts: alerts.length,
      documents: documents.length,
      chunks: chunksResult.data?.length ?? 0,
      unembedded,
      // Compatibility-only response field. Packet readiness is read from the
      // canonical Project Intelligence artifacts below, never a retired queue.
      uncompiled: 0,
      tasks: totalTasks,
      stuckItems: 0,
    },
    alerts,
    recentRuns: (recentRunsResult.data ?? []).map((run) => ({
      source: run.source ?? "unknown",
      stage: run.stage ?? "unknown",
      status: run.status ?? "unknown",
      resourceName: run.resource_name,
      finishedAt: run.finished_at,
      errorCode: run.error_code,
      errorMessage: run.error_message,
    })),
  };
}

async function loadProjectIntelligenceStatus(
  now: Date,
): Promise<ProjectIntelligenceStatus> {
  const [insightCards, currentPackets, highConfidenceUnpromoted] =
    await Promise.all([
      countTable("insight_cards"),
      countCurrentPackets(),
      countSignalCandidates("candidate", "high"),
    ]);
  const unhealthyChecks: Record<string, number> = {};

  if (currentPackets === 0) unhealthyChecks.missingCurrentPackets = 1;
  if (highConfidenceUnpromoted > 0) {
    unhealthyChecks.highConfidenceUnpromoted = highConfidenceUnpromoted;
  }

  return {
    status: Object.keys(unhealthyChecks).length > 0 ? "unhealthy" : "healthy",
    healthy: Object.keys(unhealthyChecks).length === 0,
    counts: {
      insightCards,
      currentPackets,
      highConfidenceUnpromoted,
    },
    unhealthyChecks,
    generatedAt: now.toISOString(),
  };
}

function packetItemCount(packet: DailyBriefPacket | null): number {
  if (!packet?.sections) return 0;
  return (
    (packet.sections.needsBrandon?.length ?? 0) +
    (packet.sections.waitingOnOthers?.length ?? 0) +
    (packet.sections.importantUpdates?.length ?? 0)
  );
}

function parseDailyPacket(value: unknown): DailyBriefPacket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as DailyBriefPacket;
}

function sourceHealthFromRunMetadata(
  metadata: unknown,
): DailyBriefCanonicalStatus["sourceHealth"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const sourceHealth = (metadata as { sourceHealth?: unknown }).sourceHealth;
  return Array.isArray(sourceHealth)
    ? sourceHealth.filter(
        (item): item is DailyBriefCanonicalStatus["sourceHealth"][number] =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function canonicalSourceWarning(
  sourceHealth: DailyBriefCanonicalStatus["sourceHealth"],
): string | null {
  const unhealthy = sourceHealth.find(
    (source) =>
      source.status !== "loaded" &&
      source.status !== "healthy" &&
      source.status !== "skipped",
  );
  if (!unhealthy) return null;
  const label =
    typeof unhealthy.resourceName === "string"
      ? unhealthy.resourceName
      : typeof unhealthy.sourceFamily === "string"
        ? unhealthy.sourceFamily
        : "source";
  const reason =
    typeof unhealthy.failureMessage === "string"
      ? unhealthy.failureMessage
      : typeof unhealthy.warning === "string"
        ? unhealthy.warning
        : `status ${String(unhealthy.status ?? "unknown")}`;
  return `${label}: ${reason}`;
}

async function fetchJson<TSchema extends z.ZodTypeAny>(
  requestId: string,
  where: string,
  label: string,
  fetcher: () => Promise<Response>,
  schema: TSchema,
): Promise<z.infer<TSchema> | { error: string }> {
  try {
    const response = await fetcher();
    const payload = await response.json();
    return validateResponseContract(
      schema,
      payload,
      `${where}.${label}`,
    ) as z.infer<TSchema>;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unknown readiness dependency failure.",
    };
  }
}

async function countTasksSince(
  iso: string,
  column: "created_at" | "updated_at",
) {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .gte(column, iso);

  if (error)
    throw new Error(`Failed to count ${column} tasks: ${error.message}`);
  return count ?? 0;
}

async function loadLatestDailyBrief() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("daily_recaps")
    .select(
      "id, recap_date, created_at, approved_at, workflow_status, briefing_packet, ai_work_run_id",
    )
    .eq("recap_kind", "executive_briefing")
    .order("recap_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error)
    throw new Error(`Failed to load daily brief status: ${error.message}`);
  return data;
}

async function loadLatestDailyBriefCanonicalStatus(
  dailyRecapId: string | null | undefined,
): Promise<DailyBriefCanonicalStatus | null> {
  const supabase = createServiceClient();
  let query = supabase
    .from("ai_work_runs")
    .select(
      "id, status, delivery_status, started_at, completed_at, failure_code, failure_message, metadata",
    )
    .eq("workflow_id", "executive_daily_brief")
    .order("started_at", { ascending: false })
    .limit(1);

  if (dailyRecapId) {
    query = query.eq("daily_recap_id", dailyRecapId);
  }

  const { data: run, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load canonical daily brief run status: ${error.message}`,
    );
  }
  if (!run) return null;

  const { data: latestTeamsAttempt, error: deliveryError } = await supabase
    .from("ai_work_run_delivery_attempts")
    .select("status")
    .eq("work_run_id", run.id)
    .eq("channel", "teams")
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deliveryError) {
    throw new Error(
      `Failed to load canonical daily brief delivery status: ${deliveryError.message}`,
    );
  }

  return {
    runId: run.id,
    status: run.status,
    deliveryStatus: run.delivery_status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    failureCode: run.failure_code,
    failureMessage: run.failure_message,
    sourceHealth: sourceHealthFromRunMetadata(run.metadata),
    teamsDeliveryAttemptStatus: latestTeamsAttempt?.status ?? null,
  };
}

export const GET = withApiGuardrails(
  "api.admin.operations-readiness.status.GET",
  async ({ requestId }) => {
    await requireAdmin("api.admin.operations-readiness.status.GET");

    const now = new Date();
    const generatedAt = now.toISOString();
    const since24h = new Date(now.getTime() - 86_400_000).toISOString();

    const [rawSourceResult, newTasks, updatedTasks, dailyBrief] =
      await Promise.all([
        fetchJson(
          requestId,
          "api.admin.operations-readiness.status.GET",
          "source-sync",
          () =>
            fetchBackendSourceSync(
              requestId,
              "api.admin.operations-readiness.status.GET",
              "status",
              { method: "GET" },
            ),
          SourceSyncStatusSchema,
        ),
        countTasksSince(since24h, "created_at"),
        countTasksSince(since24h, "updated_at"),
        loadLatestDailyBrief(),
      ]);
    const dailyBriefRun = await loadLatestDailyBriefCanonicalStatus(
      dailyBrief?.id,
    );

    const sourceResult =
      "error" in rawSourceResult
        ? await loadSourceFallbackStatus(now).catch((error) => ({
            error:
              error instanceof Error ? error.message : rawSourceResult.error,
          }))
        : rawSourceResult;
    const projectIntelligenceResult = await loadProjectIntelligenceStatus(
      now,
    ).catch((error) => ({
      error:
        error instanceof Error
          ? error.message
          : "Project intelligence health read-back failed.",
    }));

    const sourceUnavailable = "error" in sourceResult;
    const projectIntelligenceUnavailable = "error" in projectIntelligenceResult;
    const sourceBlocker = sourceUnavailable
      ? sourceResult.error
      : firstMeaningfulError(sourceResult);
    const sourceLevel: ReadinessLevel = sourceUnavailable
      ? "blocked"
      : sourceResult.counts.unembedded > 0
        ? "attention"
        : sourceResult.healthy
          ? "ready"
          : "blocked";
    const sourceHasBacklog =
      !sourceUnavailable &&
      (sourceResult.counts.unembedded > 0 ||
        sourceResult.counts.stuckItems > 0);
    const sourceBacklogAnswer = sourceUnavailable
      ? null
      : `No. ${formatCount(sourceResult.counts.unembedded)} synced items are not searchable.`;

    const projectIntelligenceBlocker = projectIntelligenceUnavailable
      ? projectIntelligenceResult.error
      : Object.entries(projectIntelligenceResult.unhealthyChecks)
          .filter(([, value]) => value > 0)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ") || null;

    const dailyPacket = parseDailyPacket(dailyBrief?.briefing_packet ?? null);
    const dailyItemCount = packetItemCount(dailyPacket);
    const dailyGeneratedAt =
      typeof dailyPacket?.generatedAt === "string"
        ? dailyPacket.generatedAt
        : (dailyBrief?.created_at ?? null);
    const dailySourceWarning = canonicalSourceWarning(
      dailyBriefRun?.sourceHealth ?? [],
    );
    const dailyTeamsSent =
      dailyBriefRun?.deliveryStatus === "sent" ||
      dailyBriefRun?.teamsDeliveryAttemptStatus === "sent";
    const dailyTeamsDisabled =
      dailyBriefRun?.deliveryStatus === "disabled" ||
      dailyBriefRun?.teamsDeliveryAttemptStatus === "disabled";
    const dailyRunFailed = dailyBriefRun?.status?.startsWith("failed") ?? false;

    const items: ReadinessItem[] = [
      {
        id: "source-data",
        question: "Has all source data been synced and embedded?",
        answer:
          sourceLevel === "ready"
            ? "Yes. Sources are synced and searchable."
            : sourceUnavailable
              ? "No. The source health service did not answer, so sync and embedding cannot be trusted."
              : (sourceBacklogAnswer ?? "No. Source data is not fully ready."),
        level: sourceLevel,
        checkedAt: sourceUnavailable ? generatedAt : sourceResult.generatedAt,
        metrics: sourceUnavailable
          ? [{ label: "Health service", value: "Unavailable" }]
          : [
              {
                label: "Documents",
                value: formatCount(sourceResult.counts.documents),
              },
              {
                label: "Chunks",
                value: formatCount(sourceResult.counts.chunks),
              },
              {
                label: "Not searchable",
                value: formatCount(sourceResult.counts.unembedded),
              },
            ],
        blocker: sourceBlocker,
        cause: sourceBlocker
          ? "A source or embedding stage is reporting backlog or a recent provider failure."
          : "No active source-sync blocker is currently reported.",
        prevention:
          "Keep source-sync health visible and alert when synced items remain unembedded after the normal job window.",
        primaryAction: { label: "Open RAG health", href: "/rag" },
        runActions: sourceUnavailable
          ? []
          : [
              {
                id: "embed-pending",
                label: "Embed pending",
                endpoint: "/api/admin/source-sync/graph-embed",
                method: "POST",
                body: { limit: 100 },
              },
              {
                id: "recompute-health",
                label: "Recompute health",
                endpoint: "/api/admin/source-sync/recompute",
                method: "POST",
              },
            ],
      },
      {
        id: "tasks",
        question: "Have all generated tasks been updated?",
        answer:
          sourceUnavailable ||
          (sourceResult.counts.tasks === 0 && newTasks === 0)
            ? "No. Task generation cannot be trusted until source health responds."
            : sourceHasBacklog
              ? `No. ${formatCount(newTasks)} tasks were created and ${formatCount(updatedTasks)} were updated in the last 24 hours, but source backlog can leave generated tasks incomplete.`
              : `Yes. ${formatCount(newTasks)} tasks were created and ${formatCount(updatedTasks)} were updated in the last 24 hours.`,
        level: sourceUnavailable
          ? "blocked"
          : sourceHasBacklog
            ? "attention"
            : "ready",
        checkedAt: generatedAt,
        metrics: [
          {
            label: "Total extracted tasks",
            value: sourceUnavailable
              ? "Unknown"
              : formatCount(sourceResult.counts.tasks),
          },
          { label: "Created in 24h", value: formatCount(newTasks) },
          { label: "Updated in 24h", value: formatCount(updatedTasks) },
        ],
        blocker: sourceUnavailable
          ? "Task extraction depends on source health, and source health is unavailable."
          : sourceHasBacklog
            ? "Task extraction depends on the same source pipeline; source backlog can leave tasks stale."
            : null,
        cause:
          "Generated tasks are derived from synced communication/document records, so task freshness follows source ingestion health.",
        prevention:
          "Track task created/updated counts beside source health so extraction drops are visible before a user notices missing follow-ups.",
        primaryAction: { label: "Open tasks", href: "/tasks" },
        runActions: [],
      },
      {
        id: "project-intelligence",
        question: "Have project intelligence and packets been updated?",
        answer: projectIntelligenceUnavailable
          ? "No. The Project Intelligence artifact read-back failed, so packet freshness cannot be trusted."
          : projectIntelligenceResult.counts.currentPackets === 0
            ? "No. No current Project Intelligence packet is available."
            : projectIntelligenceResult.counts.highConfidenceUnpromoted > 0
              ? "Attention required. Current packets exist, but high-confidence evidence awaits review."
              : "Yes. Current packets are available.",
        level: projectIntelligenceUnavailable
          ? "blocked"
          : !projectIntelligenceResult.healthy
            ? "attention"
            : "ready",
        checkedAt: projectIntelligenceUnavailable
          ? generatedAt
          : projectIntelligenceResult.generatedAt,
        metrics: projectIntelligenceUnavailable
          ? [{ label: "Artifact read-back", value: "Unavailable" }]
          : [
              {
                label: "Current packets",
                value: formatCount(
                  projectIntelligenceResult.counts.currentPackets,
                ),
              },
              {
                label: "Insight cards",
                value: formatCount(
                  projectIntelligenceResult.counts.insightCards,
                ),
              },
              {
                label: "High-confidence review",
                value: formatCount(
                  projectIntelligenceResult.counts.highConfidenceUnpromoted,
                ),
              },
            ],
        blocker: projectIntelligenceBlocker,
        cause: projectIntelligenceBlocker
          ? "Canonical Project Intelligence artifacts or evidence review checks need attention."
          : "No Project Intelligence artifact blocker is currently reported.",
        prevention:
          "Verify packet freshness from canonical artifacts and the AI Ops run ledger, never retired queue tables.",
        primaryAction: {
          label: "Open AI system health",
          href: "/ai-system-health",
        },
        runActions: [],
      },
      {
        id: "daily-brief",
        question: "Has the daily brief been updated?",
        answer: !dailyBrief
          ? "No. No executive brief exists yet."
          : !dailyBriefRun
            ? "No. The latest packet is not linked to a canonical AI work run."
            : dailyTeamsSent
              ? "Yes. The latest brief was generated and sent to Teams through the AI Ops ledger."
              : dailyTeamsDisabled
                ? "No. The latest brief run exists, but Teams delivery is disabled."
                : dailyBrief.workflow_status === "approved"
                  ? "No. The latest brief was generated and approved, but has not been sent to Teams."
                  : "No. The latest brief was generated as a draft, but has not been approved or sent.",
        level: !dailyBrief
          ? "blocked"
          : !dailyBriefRun || dailyRunFailed
            ? "blocked"
            : dailyTeamsSent
              ? "ready"
              : "attention",
        checkedAt: generatedAt,
        metrics: [
          { label: "Brief date", value: dailyBrief?.recap_date ?? "Missing" },
          { label: "Generated", value: formatDate(dailyGeneratedAt) },
          { label: "Run", value: dailyBriefRun?.status ?? "Missing" },
          {
            label: "Delivery",
            value:
              dailyBriefRun?.deliveryStatus ??
              dailyBriefRun?.teamsDeliveryAttemptStatus ??
              "Missing",
          },
          { label: "Approved", value: formatDate(dailyBrief?.approved_at) },
          { label: "Items", value: formatCount(dailyItemCount) },
        ],
        blocker: !dailyBrief
          ? "No executive briefing row was found."
          : !dailyBriefRun
            ? "No canonical AI Ops run is linked to the latest executive briefing packet."
            : dailyRunFailed
              ? (dailyBriefRun.failureMessage ??
                dailyBriefRun.failureCode ??
                "The latest canonical Daily Brief run failed.")
              : dailyTeamsSent
                ? (dailySourceWarning ?? null)
                : "The latest canonical Daily Brief run has not sent a Teams delivery attempt.",
        cause: !dailyBrief
          ? "The daily briefing job has not persisted a recap packet."
          : !dailyBriefRun
            ? "Daily Brief readiness now requires the packet artifact to have a canonical AI Ops run."
            : dailySourceWarning
              ? `The canonical AI Ops source-health snapshot reported: ${dailySourceWarning}`
              : "Daily brief status comes from the canonical AI Ops run, source-health snapshot, and delivery attempt ledger.",
        prevention:
          "Show generated packet, canonical run, source health, and delivery attempt states together so a brief cannot look complete when delivery is still pending.",
        primaryAction: { label: "Open Daily Briefs", href: "/daily-briefs" },
        runActions:
          dailyBrief &&
          !dailyTeamsSent &&
          dailyBrief.workflow_status === "approved"
            ? [
                {
                  id: "send-daily-brief-teams",
                  label: "Send to Teams",
                  endpoint: "/api/executive/daily-brief/send-teams",
                  method: "POST",
                  confirm:
                    "Send the approved daily brief to Teams now? This is externally visible.",
                },
              ]
            : [],
      },
    ];

    const blocked = items.filter((item) => item.level === "blocked").length;
    const attention = items.filter((item) => item.level === "attention").length;
    const unknown = items.filter((item) => item.level === "unknown").length;

    return NextResponse.json({
      generatedAt,
      status:
        blocked > 0 || unknown > 0
          ? "blocked"
          : attention > 0
            ? "attention"
            : "ready",
      summary:
        blocked > 0 || unknown > 0
          ? "One or more operating answers are blocked or cannot be trusted yet."
          : attention > 0
            ? "At least one operating answer is no and needs follow-up."
            : "All four operating answers are currently ready.",
      counts: {
        ready: items.filter((item) => item.level === "ready").length,
        attention,
        blocked,
        unknown,
      },
      items,
    });
  },
);
