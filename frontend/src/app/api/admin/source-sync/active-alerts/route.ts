import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { createRagServiceClient } from "@/lib/supabase/service";

import { requireAdmin } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * Active pipeline alerts for the /rag dashboard banner.
 *
 * Reads persisted `system_alerts` (RAG DB) — the same rows the Teams notifier
 * writes — so a source going dark is loud on the dashboard, not just in a DM.
 * Covers the pipeline outcome alerts (pipeline_alert_notifier), the source-sync
 * health alerts, and AI-provider health alerts.
 */

export type ActiveAlert = {
  alertKey: string;
  category: string;
  code: string;
  severity: "info" | "warning" | "critical";
  source: string;
  title: string;
  message: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  notifiedAt: string | null;
};

export type ActiveAlertsResponse = {
  alerts: ActiveAlert[];
  counts: { critical: number; warning: number; total: number };
  generatedAt: string;
};

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

// `system_alerts` lives in the RAG DB but is not in the generated RagDatabase
// types yet, so read it through a narrowly-typed view of the client (no `any`).
type SystemAlertRow = {
  alert_key: string | null;
  category: string | null;
  code: string | null;
  severity: string | null;
  source: string | null;
  title: string | null;
  message: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  notified_at: string | null;
};

type SystemAlertReader = {
  from: (table: "system_alerts") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => {
          limit: (
            count: number,
          ) => PromiseLike<{ data: SystemAlertRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

export const GET = withApiGuardrails(
  "admin/source-sync/active-alerts#GET",
  async (): Promise<NextResponse> => {
    await requireAdmin("admin/source-sync/active-alerts#GET");

    const rag = createRagServiceClient() as unknown as SystemAlertReader;
    const { data, error } = await rag
      .from("system_alerts")
      .select(
        "alert_key,category,code,severity,source,title,message,first_seen_at,last_seen_at,notified_at",
      )
      .eq("status", "active")
      .order("last_seen_at", { ascending: false })
      .limit(100);

    if (error) {
      // Surface loudly rather than swallow — a broken alert feed is itself an alert.
      return NextResponse.json(
        { error: `Could not read system_alerts: ${error.message}` },
        { status: 502 },
      );
    }

    const alerts: ActiveAlert[] = (data ?? []).map((row) => ({
      alertKey: String(row.alert_key ?? ""),
      category: String(row.category ?? "unknown"),
      code: String(row.code ?? "unknown"),
      severity: ((s) => (s === "critical" || s === "warning" ? s : "info"))(
        String(row.severity ?? "warning"),
      ),
      source: String(row.source ?? "unknown"),
      title: String(row.title ?? "Alert"),
      message: String(row.message ?? ""),
      firstSeenAt: row.first_seen_at ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      notifiedAt: row.notified_at ?? null,
    }));

    alerts.sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
        (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""),
    );

    const counts = {
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      total: alerts.length,
    };

    return NextResponse.json({
      alerts,
      counts,
      generatedAt: new Date().toISOString(),
    } satisfies ActiveAlertsResponse);
  },
);
