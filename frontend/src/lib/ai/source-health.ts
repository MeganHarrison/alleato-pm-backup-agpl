import type { SupabaseClient } from "@supabase/supabase-js";

import { createRagServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";

type SourceHealthRow =
  RagDatabase["public"]["Tables"]["source_sync_health_snapshots"]["Row"];
type SourceHealthSnapshotQueryRow = Pick<
  SourceHealthRow,
  | "source"
  | "resource_id"
  | "resource_name"
  | "status"
  | "last_sync_at"
  | "last_success_at"
  | "last_error_at"
  | "last_error_message"
  | "stale_minutes"
  | "unembedded_count"
  | "updated_at"
>;
type GraphSubscriptionHealthRow = Pick<
  RagDatabase["public"]["Tables"]["graph_subscriptions"]["Row"],
  "source" | "resource_id" | "resource_name" | "status" | "expiration_at" | "last_error_message"
>;

export type AssistantSourceHealthReason =
  | "source_status_request"
  | "empty_source_lookup"
  | "low_source_lookup"
  | "project_intelligence_context";

export type AssistantSourceHealthMetadata = {
  generatedAt: string;
  reason: AssistantSourceHealthReason;
  overallStatus: "healthy" | "degraded" | "unknown";
  missingStage: string | null;
  counts: {
    sources: number;
    criticalSources: number;
    warningSources: number;
    unembedded: number;
    uncompiled: number;
    failedSubscriptions: number;
    expiringSubscriptions: number;
  };
  sources: Array<{
    source: string;
    resourceId: string;
    resourceName: string;
    status: string;
    staleMinutes: number | null;
    lastSyncAt: string | null;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    hasError: boolean;
    unembeddedCount: number;
    uncompiledCount: number;
  }>;
  alerts: Array<{
    code: string;
    source: string;
    resourceId: string;
    severity: "critical" | "warning";
    message: string;
  }>;
};

export type AssistantSourceHealthContext = {
  metadata: AssistantSourceHealthMetadata;
  promptInjection: string;
  trace: Record<string, unknown>;
};

function sourceStatusRank(status: string | null): number {
  if (status === "critical") return 3;
  if (status === "warning") return 2;
  if (status === "healthy") return 0;
  return 1;
}

function subscriptionIsFailed(subscription: GraphSubscriptionHealthRow): boolean {
  return ["failed", "removed", "missed", "reauthorization_required"].includes(
    String(subscription.status ?? "").toLowerCase(),
  );
}

function subscriptionExpiresSoon(subscription: GraphSubscriptionHealthRow, now: Date): boolean {
  if (!subscription.expiration_at) return false;
  const expiration = new Date(subscription.expiration_at);
  if (Number.isNaN(expiration.getTime())) return false;
  return expiration.getTime() - now.getTime() <= 6 * 60 * 60 * 1000;
}

function inferMissingStage(params: {
  sourceRows: SourceHealthSnapshotQueryRow[];
  failedSubscriptions: number;
  totalUnembedded: number;
}): string | null {
  if (params.sourceRows.length === 0) return "no_source_health_rows";
  if (params.failedSubscriptions > 0) return "graph_subscription_issue";
  if (params.totalUnembedded > 0) return "embedding_backlog";
  return null;
}

function buildAlerts(
  sources: AssistantSourceHealthMetadata["sources"],
  subscriptions: GraphSubscriptionHealthRow[],
  now: Date,
): AssistantSourceHealthMetadata["alerts"] {
  const sourceAlerts = sources
    .filter((source) => source.status === "critical" || source.status === "warning")
    .slice(0, 8)
    .map((source) => ({
      code:
        source.status === "critical"
          ? "source_sync_critical"
          : source.unembeddedCount > 0
            ? "embedding_backlog"
            : "source_sync_warning",
      source: source.source,
      resourceId: source.resourceId,
      severity: source.status === "critical" ? "critical" as const : "warning" as const,
      message: source.hasError
        ? `${source.resourceName} has a sync error.`
        : `${source.resourceName} is ${source.status}.`,
    }));

  const subscriptionAlerts = subscriptions
    .filter((subscription) => subscriptionIsFailed(subscription) || subscriptionExpiresSoon(subscription, now))
    .slice(0, 6)
    .map((subscription) => ({
      code: subscriptionIsFailed(subscription)
        ? "graph_subscription_failed"
        : "graph_subscription_expiring",
      source: subscription.source,
      resourceId: subscription.resource_id,
      severity: subscriptionIsFailed(subscription) ? "critical" as const : "warning" as const,
      message: subscriptionIsFailed(subscription)
        ? `${subscription.resource_name ?? subscription.resource_id} subscription is ${subscription.status}.`
        : `${subscription.resource_name ?? subscription.resource_id} subscription expires soon.`,
    }));

  return [...sourceAlerts, ...subscriptionAlerts].slice(0, 12);
}

export function shouldAttachAssistantSourceHealth(message: string): boolean {
  const normalized = message.toLowerCase();
  return /\b(sync|synced|syncing|fresh|freshness|stale|current|latest|up to date|vectorized|vectorization|embedded|embedding|packet|source health|source status|teams|email|outlook|onedrive|sharepoint|transcript|meeting transcript)\b/.test(
    normalized,
  );
}

export async function loadAssistantSourceHealthContext(params: {
  supabase: SupabaseClient<Database>;
  reason: AssistantSourceHealthReason;
}): Promise<AssistantSourceHealthContext> {
  const now = new Date();
  const generatedAt = now.toISOString();
  const ragSupabase = createRagServiceClient();
  const [sourceResult, subscriptionResult] = await Promise.all([
    ragSupabase
      .from("source_sync_health_snapshots")
      .select(
        "source,resource_id,resource_name,status,last_sync_at,last_success_at,last_error_at,last_error_message,stale_minutes,unembedded_count,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(30),
    ragSupabase
      .from("graph_subscriptions")
      .select("source,resource_id,resource_name,status,expiration_at,last_error_message")
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  if (sourceResult.error) {
    throw new Error(`Failed to load source sync health snapshots: ${sourceResult.error.message}`);
  }
  if (subscriptionResult.error) {
    throw new Error(`Failed to load Graph subscription health: ${subscriptionResult.error.message}`);
  }

  const sourceRows: SourceHealthSnapshotQueryRow[] = sourceResult.data ?? [];
  const subscriptionRows: GraphSubscriptionHealthRow[] = subscriptionResult.data ?? [];
  const sources = sourceRows
    .sort((a, b) => sourceStatusRank(b.status) - sourceStatusRank(a.status))
    .slice(0, 12)
    .map((row) => ({
      source: row.source,
      resourceId: row.resource_id,
      resourceName: row.resource_name ?? `${row.source}/${row.resource_id}`,
      status: row.status,
      staleMinutes: row.stale_minutes,
      lastSyncAt: row.last_sync_at,
      lastSuccessAt: row.last_success_at,
      lastErrorAt: row.last_error_at,
      hasError: Boolean(row.last_error_message),
      unembeddedCount: row.unembedded_count,
      // Compatibility-only field. Packet freshness belongs to the canonical
      // Project Intelligence run/artifact ledger, never source-sync snapshots.
      uncompiledCount: 0,
    }));

  const totalUnembedded = sourceRows.reduce((total, row) => total + row.unembedded_count, 0);
  const failedSubscriptions = subscriptionRows.filter(subscriptionIsFailed).length;
  const expiringSubscriptions = subscriptionRows.filter((subscription) =>
    subscriptionExpiresSoon(subscription, now),
  ).length;
  const criticalSources = sourceRows.filter((row) => row.status === "critical").length;
  const warningSources = sourceRows.filter((row) => row.status === "warning").length;
  const missingStage = inferMissingStage({
    sourceRows,
    failedSubscriptions,
    totalUnembedded,
  });
  const overallStatus =
    sourceRows.length === 0
      ? "unknown"
      : criticalSources > 0 ||
          warningSources > 0 ||
          failedSubscriptions > 0 ||
          expiringSubscriptions > 0 ||
          totalUnembedded > 0
        ? "degraded"
        : "healthy";
  const metadata: AssistantSourceHealthMetadata = {
    generatedAt,
    reason: params.reason,
    overallStatus,
    missingStage,
    counts: {
      sources: sourceRows.length,
      criticalSources,
      warningSources,
      unembedded: totalUnembedded,
      // Retained in the response contract while callers migrate; it no longer
      // represents or reads a retired compiler queue.
      uncompiled: 0,
      failedSubscriptions,
      expiringSubscriptions,
    },
    sources,
    alerts: buildAlerts(sources, subscriptionRows, now),
  };

  const promptInjection = [
    "## Source Sync Health",
    `Generated at: ${metadata.generatedAt}`,
    `Overall status: ${metadata.overallStatus}`,
    `Likely missing stage when evidence is thin: ${metadata.missingStage ?? "none detected"}`,
    `Counts: ${metadata.counts.sources} source(s), ${metadata.counts.unembedded} unembedded, ${metadata.counts.failedSubscriptions} failed subscription(s), ${metadata.counts.expiringSubscriptions} expiring subscription(s).`,
    "Packet freshness must be verified from the canonical Project Intelligence run and artifact ledger; source-sync health does not prove packet freshness.",
    ...metadata.alerts
      .slice(0, 6)
      .map((alert) => `- ${alert.severity} ${alert.code} on ${alert.source}/${alert.resourceId}: ${alert.message}`),
    "If source retrieval is empty or thin, explain the likely pipeline stage instead of implying complete evidence coverage.",
  ].join("\n");

  return {
    metadata,
    promptInjection,
    trace: {
      tool: "assistantSourceHealth",
      input: {
        reason: params.reason,
      },
      output: metadata,
      timestamp: generatedAt,
    },
  };
}
