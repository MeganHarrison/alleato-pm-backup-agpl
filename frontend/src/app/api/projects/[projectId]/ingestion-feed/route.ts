export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

/**
 * Per-project source-ingestion feed for the Project Intelligence dashboard.
 *
 * Default mode = "recent": the most recent items PER CATEGORY (meetings,
 * SharePoint/OneDrive documents, emails, Teams messages) for the project,
 * regardless of day. This is what users actually want — to SEE the project's
 * content. (A single-day filter showed 0 on most days because ingestion is
 * sporadic, and a fixed time window still zeroes out categories whose newest
 * item is older than the window, e.g. documents synced months ago.)
 *
 * Optional `?date=YYYY-MM-DD` switches to "day" mode — only items ingested that
 * calendar day (UTC, by created_at) — for drill-down.
 *
 * `document_metadata` (PM APP) holds all four categories with project_id + a
 * date, so this is one table, four small reads. Also returns active pipeline
 * alerts (`system_alerts`, RAG DB) so a source going dark is loud on the page.
 */

const PER_CATEGORY_LIMIT = 25;
const SELECT_COLS =
  "id, title, file_name, type, source_system, date, created_at, source_web_url, url, fireflies_link, meeting_link";

export type IngestionItem = {
  id: string;
  title: string;
  fileName: string | null;
  date: string | null; // the item's own date (meeting/received date), falls back to ingestedAt
  ingestedAt: string | null; // created_at — when the pipeline brought it in
  link: string | null;
  sourceSystem: string | null;
};

export type IngestionFeedError = {
  severity: "info" | "warning" | "critical";
  source: string;
  title: string;
  message: string;
  lastSeenAt: string | null;
};

export type IngestionCategory = "meetings" | "documents" | "emails" | "teams";

export type IngestionFeedResponse = {
  mode: "recent" | "day";
  date: string | null; // set in "day" mode
  perCategoryLimit: number;
  counts: Record<IngestionCategory, number>;
  /** Daily ingested-item counts per category over the last TREND_DAYS (oldest→newest), for sparklines. */
  trends: Record<IngestionCategory, number[]>;
  meetings: IngestionItem[];
  documents: IngestionItem[];
  emails: IngestionItem[];
  teams: IngestionItem[];
  errors: IngestionFeedError[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TREND_DAYS = 14;

function categoryOf(type: string | null, sourceSystem: string | null): IngestionCategory | null {
  const t = (type || "").toLowerCase();
  const s = (sourceSystem || "").toLowerCase();
  if (t === "meeting") return "meetings";
  if (t === "email" || t === "email_attachment") return "emails";
  if (t.startsWith("teams")) return "teams";
  if (s.includes("sharepoint") || s.includes("onedrive") || t === "document") return "documents";
  return null;
}

function emptyTrends(): Record<IngestionCategory, number[]> {
  return {
    meetings: Array<number>(TREND_DAYS).fill(0),
    documents: Array<number>(TREND_DAYS).fill(0),
    emails: Array<number>(TREND_DAYS).fill(0),
    teams: Array<number>(TREND_DAYS).fill(0),
  };
}

type DocRow = {
  id: string;
  title: string | null;
  file_name: string | null;
  type: string | null;
  source_system: string | null;
  date: string | null;
  created_at: string | null;
  source_web_url: string | null;
  url: string | null;
  fireflies_link: string | null;
  meeting_link: string | null;
};

function dayBounds(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function toItem(row: DocRow): IngestionItem {
  return {
    id: row.id,
    title: (row.title || row.file_name || "Untitled").trim(),
    fileName: row.file_name,
    date: row.date ?? row.created_at,
    ingestedAt: row.created_at,
    link: row.source_web_url || row.url || row.meeting_link || row.fireflies_link || null,
    sourceSystem: row.source_system,
  };
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/ingestion-feed#GET",
  async ({ request, params }): Promise<NextResponse> => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/ingestion-feed#GET",
        message: "Authentication required.",
      });
    }

    const { projectId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(numericProjectId)) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    const requested = new URL(request.url).searchParams.get("date");
    const day = requested && DATE_RE.test(requested) ? requested : null;
    const bounds = day ? dayBounds(day) : null;

    const supabase = createServiceClient();

    async function loadCategory(category: IngestionCategory): Promise<IngestionItem[]> {
      const base = serviceDb.from("document_metadata")
        .select(SELECT_COLS)
        .eq("project_id", numericProjectId)
        .is("deleted_at", null);
      let query =
        category === "meetings"
          ? base.eq("type", "meeting")
          : category === "emails"
            ? base.in("type", ["email", "email_attachment"])
            : category === "teams"
              ? base.ilike("type", "teams%")
              : base.or("source_system.ilike.%sharepoint%,source_system.ilike.%onedrive%,type.eq.document");
      if (bounds) {
        query = query.gte("created_at", bounds.start).lt("created_at", bounds.end);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(bounds ? 500 : PER_CATEGORY_LIMIT);
      if (error) throw new Error(`${category}: ${error.message}`);
      // Fetched newest-ingested first; present newest by the item's own date so the
      // Date column reads cleanly (a meeting's date, not when we synced it).
      return ((data ?? []) as DocRow[])
        .map(toItem)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    }

    let meetings: IngestionItem[];
    let documents: IngestionItem[];
    let emails: IngestionItem[];
    let teams: IngestionItem[];
    try {
      [meetings, documents, emails, teams] = await Promise.all([
        loadCategory("meetings"),
        loadCategory("documents"),
        loadCategory("emails"),
        loadCategory("teams"),
      ]);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not read document_metadata" },
        { status: 502 },
      );
    }

    // Per-category daily activity over the last TREND_DAYS, for the sparklines.
    // Best-effort: a trend read failure must not break the feed.
    const trends = emptyTrends();
    try {
      const now = new Date();
      const todayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const windowStartMs = todayStartMs - (TREND_DAYS - 1) * 86_400_000;
      const { data: trendRows } = await serviceDb.from("document_metadata")
        .select("type, source_system, created_at")
        .eq("project_id", numericProjectId)
        .is("deleted_at", null)
        .gte("created_at", new Date(windowStartMs).toISOString())
        .limit(5000);
      for (const row of (trendRows ?? []) as Pick<DocRow, "type" | "source_system" | "created_at">[]) {
        const cat = categoryOf(row.type, row.source_system);
        if (!cat || !row.created_at) continue;
        const idx = Math.floor((Date.parse(row.created_at) - windowStartMs) / 86_400_000);
        if (idx >= 0 && idx < TREND_DAYS) trends[cat][idx] += 1;
      }
    } catch (error) {
      console.warn("[ingestion-feed] Unable to load activity trends; returning zeroed trends.", error);
    }

    // Active pipeline alerts (operational health). Best-effort: a broken alert
    // feed must not break the page.
    let errors: IngestionFeedError[] = [];
    try {
      const rag = createRagServiceClient() as unknown as SystemAlertReader;
      const { data: alertRows } = await rag
        .from("system_alerts")
        .select("severity, source, title, message, last_seen_at")
        .eq("status", "active")
        .order("last_seen_at", { ascending: false })
        .limit(20);
      errors = (alertRows ?? []).map((a) => ({
        severity: ((s) => (s === "critical" || s === "warning" ? s : "info"))(String(a.severity ?? "warning")),
        source: String(a.source ?? "unknown"),
        title: String(a.title ?? "Pipeline alert"),
        message: String(a.message ?? ""),
        lastSeenAt: a.last_seen_at ?? null,
      }));
    } catch {
      errors = [];
    }

    return NextResponse.json({
      mode: day ? "day" : "recent",
      date: day,
      perCategoryLimit: PER_CATEGORY_LIMIT,
      counts: {
        meetings: meetings.length,
        documents: documents.length,
        emails: emails.length,
        teams: teams.length,
      },
      trends,
      meetings,
      documents,
      emails,
      teams,
      errors,
    } satisfies IngestionFeedResponse);
  },
);

// `system_alerts` lives in the RAG DB but is not in the generated RagDatabase
// types yet, so read it through a narrowly-typed view of the client (no `any`).
type SystemAlertRow = {
  severity: string | null;
  source: string | null;
  title: string | null;
  message: string | null;
  last_seen_at: string | null;
};

type SystemAlertReader = {
  from: (table: "system_alerts") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => {
          limit: (count: number) => PromiseLike<{ data: SystemAlertRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
};
