import {
  summarizeProjectIntelligence,
  type ProjectIntelligenceSummary,
  type ProjectIntelligenceSummarySource,
} from "@/lib/ai/services/project-intelligence-summary";
import type { SourceSyncStatus } from "@/app/api/admin/source-sync/_contracts";
import {
  createRagServiceClient,
} from "@/lib/supabase/service";
import type { Database as RagDatabase, Json } from "@/types/rag-database.types";

const MAX_ALERT_SOURCES = 6;
const MAX_STUCK_ITEM_SOURCES = 4;
const MAX_RUN_SOURCES = 4;
const MAX_SOURCE_HEALTH_SOURCES = 5;

type SourceSyncRunInsert = RagDatabase["public"]["Tables"]["source_sync_runs"]["Insert"];
type SourceSyncRunSnapshotRow = Pick<
  RagDatabase["public"]["Tables"]["source_sync_runs"]["Row"],
  "id" | "finished_at" | "items_seen"
>;
type SourceSyncRunSnapshotListRow = Pick<
  RagDatabase["public"]["Tables"]["source_sync_runs"]["Row"],
  "id" | "finished_at" | "started_at" | "items_seen" | "metadata"
>;

export type SourceSyncRunSnapshotLedger = {
  insertAiBriefSnapshot(
    insert: SourceSyncRunInsert,
  ): Promise<{
    data: SourceSyncRunSnapshotRow | null;
    error: { message: string } | null;
  }>;
  listAiBriefSnapshots(limit: number): Promise<{
    data: SourceSyncRunSnapshotListRow[] | null;
    error: { message: string } | null;
  }>;
};

export type SourceSyncAiBriefSnapshot = {
  id: string;
  generatedAt: string;
  sourceCount: number;
};

export type SourceSyncAiBriefSnapshotListItem = SourceSyncAiBriefSnapshot & {
  headline: string | null;
  context: string | null;
  confidence: "low" | "medium" | "high" | null;
  healthStatus: string | null;
  model: string | null;
  risks: Array<{
    title: string;
    severity: string | null;
    recommendedAction: string | null;
  }>;
  actionItems: Array<{
    title: string;
    owner: string | null;
    dueDate: string | null;
    priority: string | null;
  }>;
  dataGaps: string[];
};

function createSourceSyncRunSnapshotLedger(): SourceSyncRunSnapshotLedger {
  const ragSupabase = createRagServiceClient();
  return {
    async insertAiBriefSnapshot(insert) {
      return ragSupabase
        .from("source_sync_runs")
        .insert(insert)
        .select("id, finished_at, items_seen")
        .single();
    },
    async listAiBriefSnapshots(limit) {
      return ragSupabase
        .from("source_sync_runs")
        .select("id, finished_at, started_at, items_seen, metadata")
        .eq("source", "source_sync_ai_brief")
        .eq("stage", "intelligence_compile")
        .order("finished_at", { ascending: false, nullsFirst: false })
        .limit(limit);
    },
  };
}

function compact(value: string | null | undefined): string {
  return value?.trim() || "unknown";
}

function statusCountsText(status: SourceSyncStatus): string {
  return [
    `Overall status is ${status.status}.`,
    `Generated at ${status.generatedAt}.`,
    `${status.counts.documents} documents, ${status.counts.chunks} chunks, ${status.counts.tasks} tasks.`,
    `${status.counts.unembedded} items are not searchable.`,
    `${status.counts.stuckItems} items are stuck.`,
    `${status.counts.alerts} alerts are active.`,
    `${status.counts.graphSubscriptions} Graph subscriptions are tracked.`,
  ].join(" ");
}

function severityRank(value: string): number {
  if (value === "critical") return 3;
  if (value === "warning") return 2;
  if (value === "info") return 1;
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readConfidence(value: unknown): "low" | "medium" | "high" | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function readRisks(value: unknown): SourceSyncAiBriefSnapshotListItem["risks"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const title = readString(item.title);
      if (!title) return null;
      return {
        title,
        severity: readString(item.severity),
        recommendedAction: readString(item.recommendedAction),
      };
    })
    .filter((item): item is SourceSyncAiBriefSnapshotListItem["risks"][number] =>
      Boolean(item),
    );
}

function readActionItems(
  value: unknown,
): SourceSyncAiBriefSnapshotListItem["actionItems"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const title = readString(item.title);
      if (!title) return null;
      return {
        title,
        owner: readString(item.owner),
        dueDate: readString(item.dueDate),
        priority: readString(item.priority),
      };
    })
    .filter(
      (item): item is SourceSyncAiBriefSnapshotListItem["actionItems"][number] =>
        Boolean(item),
    );
}

export function buildSourceSyncSummarySources(
  status: SourceSyncStatus,
): ProjectIntelligenceSummarySource[] {
  const sources: ProjectIntelligenceSummarySource[] = [
    {
      id: "source-sync:counts",
      type: "source_sync",
      title: "Source sync aggregate counts",
      text: statusCountsText(status),
      capturedAt: status.generatedAt,
    },
  ];

  const alertSources = [...status.alerts]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, MAX_ALERT_SOURCES)
    .map<ProjectIntelligenceSummarySource>((alert, index) => ({
      id: `source-sync:alert:${alert.code}:${alert.source}:${alert.resourceId}:${index}`,
      type: "source_sync",
      title: `${alert.severity} ${alert.code}`,
      text: [
        `Alert severity ${alert.severity}.`,
        `Code ${alert.code}.`,
        `Source ${alert.source}.`,
        `Resource ${alert.resourceId}.`,
        `Detected at ${compact(alert.detectedAt)}.`,
        `Message: ${alert.message}`,
      ].join(" "),
      capturedAt: alert.detectedAt ?? status.generatedAt,
    }));

  const stuckItemSources = [...status.stuckItems]
    .sort((a, b) => (b.ageMinutes ?? 0) - (a.ageMinutes ?? 0))
    .slice(0, MAX_STUCK_ITEM_SOURCES)
    .map<ProjectIntelligenceSummarySource>((item, index) => ({
      id: `source-sync:stuck:${item.source}:${item.resourceId}:${item.stage}:${index}`,
      type: "source_sync",
      title: `Stuck ${item.stage} item`,
      text: [
        `Source ${item.source}.`,
        `Resource ${item.resourceName} (${item.resourceId}).`,
        `Stage ${item.stage}.`,
        `Status ${item.status}.`,
        `Age minutes ${item.ageMinutes ?? "unknown"}.`,
        `Last attempt ${compact(item.lastAttemptAt)}.`,
        item.errorMessage ? `Error: ${item.errorMessage}` : "No error message recorded.",
      ].join(" "),
      capturedAt: item.lastAttemptAt ?? status.generatedAt,
    }));

  const runSources = [...status.recentRuns]
    .filter((run) => run.status !== "succeeded" || run.itemsFailed > 0 || run.errorMessage)
    .sort((a, b) => (b.itemsFailed ?? 0) - (a.itemsFailed ?? 0))
    .slice(0, MAX_RUN_SOURCES)
    .map<ProjectIntelligenceSummarySource>((run) => ({
      id: `source-sync:run:${run.id}`,
      type: "source_sync",
      title: `${run.source} ${run.stage} ${run.status}`,
      text: [
        `Run ${run.id}.`,
        `Source ${run.source}.`,
        `Stage ${run.stage}.`,
        `Status ${run.status}.`,
        `Resource ${compact(run.resourceName)} (${run.resourceId}).`,
        `${run.itemsSeen} seen, ${run.itemsSynced} synced, ${run.itemsFailed} failed.`,
        `Started ${compact(run.startedAt)}. Finished ${compact(run.finishedAt)}.`,
        run.errorMessage ? `Error: ${run.errorMessage}` : "No run error message recorded.",
      ].join(" "),
      capturedAt: run.finishedAt ?? run.startedAt ?? status.generatedAt,
    }));

  const sourceHealthSources = [...status.sources]
    .filter(
      (source) =>
        source.status !== "healthy" ||
        source.unembeddedCount > 0 ||
        source.unprocessedCount > 0,
    )
    .sort((a, b) => severityRank(b.status) - severityRank(a.status))
    .slice(0, MAX_SOURCE_HEALTH_SOURCES)
    .map<ProjectIntelligenceSummarySource>((source, index) => ({
      id: `source-sync:source:${source.source}:${source.resourceId}:${index}`,
      type: "source_sync",
      title: `${source.source} ${source.status}`,
      text: [
        `Source ${source.source}.`,
        `Resource ${source.resourceName} (${source.resourceId}).`,
        `Status ${source.status}.`,
        `${source.itemsSynced} synced.`,
        `${source.unprocessedCount} unprocessed, ${source.unembeddedCount} unembedded.`,
        `Last sync ${compact(source.lastSyncAt)}. Last success ${compact(source.lastSuccessAt)}.`,
        source.lastErrorMessage ? `Last error: ${source.lastErrorMessage}` : "No last error recorded.",
      ].join(" "),
      capturedAt: source.lastErrorAt ?? source.lastSyncAt ?? status.generatedAt,
    }));

  return [
    ...sources,
    ...alertSources,
    ...stuckItemSources,
    ...runSources,
    ...sourceHealthSources,
  ];
}

export async function summarizeSourceSyncHealth(
  status: SourceSyncStatus,
): Promise<ProjectIntelligenceSummary> {
  const sources = buildSourceSyncSummarySources(status);
  return summarizeProjectIntelligence({
    focus: "source_sync",
    sources,
  });
}

function buildSourceSyncAiBriefMetadata({
  status,
  summary,
  generatedByUserId,
}: {
  status: SourceSyncStatus;
  summary: ProjectIntelligenceSummary;
  generatedByUserId: string;
}): Json {
  return {
    kind: "source_sync_ai_brief",
    generatedByUserId,
    statusGeneratedAt: status.generatedAt,
    healthStatus: status.status,
    counts: status.counts,
    summary,
  };
}

export async function saveSourceSyncAiBriefSnapshot({
  status,
  summary,
  generatedByUserId,
  ledger = createSourceSyncRunSnapshotLedger(),
}: {
  status: SourceSyncStatus;
  summary: ProjectIntelligenceSummary;
  generatedByUserId: string;
  ledger?: SourceSyncRunSnapshotLedger;
}): Promise<SourceSyncAiBriefSnapshot> {
  const generatedAt = new Date().toISOString();
  const insert: SourceSyncRunInsert = {
    source: "source_sync_ai_brief",
    resource_id: "source-sync",
    resource_name: "Source Sync AI Brief",
    stage: "intelligence_compile",
    status: "succeeded",
    started_at: generatedAt,
    finished_at: generatedAt,
    items_seen: summary.sourceCount,
    items_synced: 1,
    items_failed: 0,
    metadata: buildSourceSyncAiBriefMetadata({
      status,
      summary,
      generatedByUserId,
    }),
  };

  const { data, error } = await ledger.insertAiBriefSnapshot(insert);

  if (error || !data) {
    throw new Error(
      `Failed to save source sync AI brief snapshot: ${error?.message ?? "No snapshot row returned."}`,
    );
  }

  return {
    id: data.id,
    generatedAt: data.finished_at ?? generatedAt,
    sourceCount: data.items_seen,
  };
}

export async function listSourceSyncAiBriefSnapshots({
  limit = 5,
  ledger = createSourceSyncRunSnapshotLedger(),
}: {
  limit?: number;
  ledger?: SourceSyncRunSnapshotLedger;
} = {}): Promise<SourceSyncAiBriefSnapshotListItem[]> {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 10);
  const { data, error } = await ledger.listAiBriefSnapshots(normalizedLimit);

  if (error) {
    throw new Error(`Failed to list source sync AI brief snapshots: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const summary = isRecord(metadata.summary) ? metadata.summary : {};

    return {
      id: row.id,
      generatedAt: row.finished_at ?? row.started_at,
      sourceCount: row.items_seen,
      headline: readString(summary.headline),
      context: readString(summary.context),
      confidence: readConfidence(summary.confidence),
      healthStatus: readString(metadata.healthStatus),
      model: readString(summary.model),
      risks: readRisks(summary.risks),
      actionItems: readActionItems(summary.actionItems),
      dataGaps: readStringArray(summary.dataGaps),
    };
  });
}
