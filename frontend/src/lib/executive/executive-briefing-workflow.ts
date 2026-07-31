import { createHash } from "node:crypto";
import type { Database, Json } from "@/types/database.types";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  DEFAULT_EXECUTIVE_WINDOW_DAYS,
  type DailyBriefItem as BrandonBriefItem,
  type DailyBriefPacket as BrandonDailyUpdatePacket,
} from "@/lib/executive/daily-brief";
import { buildCanonicalOperatingPacket } from "@/lib/executive/canonical-operating-packet";

type FollowUpRow =
  Database["public"]["Tables"]["executive_briefing_follow_ups"]["Row"];
type FollowUpInsert =
  Database["public"]["Tables"]["executive_briefing_follow_ups"]["Insert"];
type FollowUpSection =
  Database["public"]["Tables"]["executive_briefing_follow_ups"]["Row"]["section"];

export type ExecutiveBriefingDraft = {
  id: string;
  recapDate: string;
  workflowStatus: "draft" | "approved";
  approvedAt: string | null;
  approvedBy: string | null;
  packet: BrandonDailyUpdatePacket;
  createdAt: string | null;
  updatedSummary: string;
};

export type ExecutiveBriefingFollowUp = FollowUpRow & {
  daysOpen: number;
};

export type ExecutiveBriefingDashboard = {
  draft: ExecutiveBriefingDraft;
  followUps: ExecutiveBriefingFollowUp[];
  openFollowUps: ExecutiveBriefingFollowUp[];
  staleFollowUps: ExecutiveBriefingFollowUp[];
  liveFingerprints: Set<string>;
  fingerprintMap: Map<string, ExecutiveBriefingFollowUp>;
};

export const CEO_EXECUTIVE_BRIEFING_RECAP_KIND = "executive_briefing";
export const LEGACY_MEETING_DIGEST_RECAP_KIND = "meeting_digest";

function getNow() {
  return new Date();
}

function getEasternDateParts(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(value);
}

function getDateRange(windowDays: number) {
  const end = getNow();
  const start = new Date(end);
  start.setDate(end.getDate() - Math.max(windowDays - 1, 0));

  return {
    recapDate: getEasternDateParts(end),
    dateRangeStart: getEasternDateParts(start),
    dateRangeEnd: getEasternDateParts(end),
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSectionEntries(packet: BrandonDailyUpdatePacket): Array<{
  section: FollowUpSection;
  item: BrandonBriefItem;
}> {
  return [
    ...packet.sections.needsBrandon.map((item) => ({
      section: "needsBrandon" as const,
      item,
    })),
    ...packet.sections.waitingOnOthers.map((item) => ({
      section: "waitingOnOthers" as const,
      item,
    })),
    ...packet.sections.importantUpdates.map((item) => ({
      section: "importantUpdates" as const,
      item,
    })),
  ];
}

function createFingerprint(item: BrandonBriefItem, section: FollowUpSection) {
  const raw = JSON.stringify({
    section,
    title: item.title.trim().toLowerCase(),
    project: item.project.trim().toLowerCase(),
    source: item.source.trim().toLowerCase(),
    sourceId: item.sourceId?.trim().toLowerCase() ?? "",
    recommendedAction: item.recommendedAction?.trim().toLowerCase() ?? "",
  });

  return createHash("sha256").update(raw).digest("hex");
}

function sanitizeSupabaseText(value: string): string {
  let sanitized = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0) continue;

    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += value[index] + value[index + 1];
        index += 1;
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) continue;

    sanitized += value[index];
  }

  return sanitized;
}

function normalizeSupabaseJson(value: unknown): Json {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return sanitizeSupabaseText(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") return value;

  if (typeof value === "bigint") return value.toString();

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSupabaseJson(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, normalizeSupabaseJson(item)]),
    );
  }

  return null;
}

function toSupabaseJson(value: unknown): Json {
  return normalizeSupabaseJson(value);
}

function toSupabaseText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return sanitizeSupabaseText(value);
}

function daysOpen(firstSeenAt: string) {
  const first = new Date(firstSeenAt);
  if (Number.isNaN(first.getTime())) return 0;
  const diff = getNow().getTime() - first.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function isFollowUpInsideSourceWindow(
  followUp: ExecutiveBriefingFollowUp,
  cutoffDateKey: string,
) {
  const anchor =
    parseDate(followUp.source_date) ?? parseDate(followUp.last_seen_at);
  return anchor !== null && getEasternDateParts(anchor) >= cutoffDateKey;
}

function toDashboardFollowUp(row: FollowUpRow): ExecutiveBriefingFollowUp {
  return {
    ...row,
    daysOpen: daysOpen(row.first_seen_at),
  };
}

async function withAppDbClient<T>(
  callback: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const databaseUrl =
    process.env.APP_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error(
      "App database URL is not configured for executive briefing fallback.",
    );
  }
  const pg = await import("pg");
  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 1_000,
    });
    try {
      const client = await pool.connect();
      try {
        await client.query("set statement_timeout = '15000ms'");
        return await callback(client);
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750));
    } finally {
      await pool.end();
    }
  }
  throw lastError;
}

function toDbValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}

function normalizeDbRow<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as T;
}

async function upsertFollowUps(packet: BrandonDailyUpdatePacket) {
    const entries = getSectionEntries(packet);
  if (entries.length === 0) {
    return new Map<string, ExecutiveBriefingFollowUp>();
  }

  const existingResponse = await serviceDb.from("executive_briefing_follow_ups")
    .select("*")
    .in(
      "fingerprint",
      entries.map(({ item, section }) => createFingerprint(item, section)),
    );

  if (existingResponse.error) {
    return upsertFollowUpsToAppDb(packet);
  }

  const existingByFingerprint = new Map(
    (existingResponse.data ?? []).map((row) => [row.fingerprint, row]),
  );

  const rows: FollowUpInsert[] = entries.map(({ item, section }) => {
    const fingerprint = createFingerprint(item, section);
    const existing = existingByFingerprint.get(fingerprint);

    return {
      fingerprint,
      section,
      title: toSupabaseText(item.title) ?? "",
      summary: toSupabaseText(item.summary) ?? "",
      recommended_action: toSupabaseText(item.recommendedAction),
      why_it_matters: toSupabaseText(item.whyItMatters),
      owner: toSupabaseText(item.owner),
      status: toSupabaseText(item.status),
      tone: item.tone ?? null,
      state: existing?.state ?? "open",
      source_type: toSupabaseText(item.source) ?? "Document",
      source_detail: toSupabaseText(item.sourceDetail) ?? "",
      source_id: toSupabaseText(item.sourceId),
      source_url: toSupabaseText(item.sourceUrl),
      project_label: toSupabaseText(item.project) ?? "No project linked",
      source_date: toSupabaseText(item.date) ?? "",
      // recap_id columns are uuid FKs to the retired daily_recaps draft. The
      // canonical packet is keyed by business date, not a daily_recaps uuid, so
      // there is no valid uuid to store here — leave them null (they are unused
      // on read; staleness tracks first_seen_at/last_seen_at/source_date).
      first_seen_recap_id: existing?.first_seen_recap_id ?? null,
      last_seen_recap_id: null,
      first_seen_at: existing?.first_seen_at ?? new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      resolved_at: existing?.resolved_at ?? null,
      resolved_by: existing?.resolved_by ?? null,
      resolution_note: existing?.resolution_note ?? null,
      payload: toSupabaseJson(item),
    };
  });

  const { data, error } = await serviceDb.from("executive_briefing_follow_ups")
    .upsert(rows, { onConflict: "fingerprint" })
    .select("*");

  if (error) {
    return upsertFollowUpsToAppDb(packet);
  }

  return new Map(
    (data ?? []).map((row) => [row.fingerprint, toDashboardFollowUp(row)]),
  );
}

async function upsertFollowUpsToAppDb(
  packet: BrandonDailyUpdatePacket,
): Promise<Map<string, ExecutiveBriefingFollowUp>> {
  const entries = getSectionEntries(packet);
  if (entries.length === 0) {
    return new Map<string, ExecutiveBriefingFollowUp>();
  }

  return withAppDbClient(async (client) => {
    const fingerprints = entries.map(({ item, section }) =>
      createFingerprint(item, section),
    );
    const existingResult = await client.query<FollowUpRow>(
      `
        select *
        from public.executive_briefing_follow_ups
        where fingerprint = any($1::text[])
      `,
      [fingerprints],
    );
    const existingByFingerprint = new Map(
      existingResult.rows.map((row) => [row.fingerprint, normalizeDbRow(row)]),
    );
    const now = new Date().toISOString();
    const savedRows: FollowUpRow[] = [];

    for (const { item, section } of entries) {
      const fingerprint = createFingerprint(item, section);
      const existing = existingByFingerprint.get(fingerprint);
      const row: FollowUpInsert = {
        fingerprint,
        section,
        title: toSupabaseText(item.title) ?? "",
        summary: toSupabaseText(item.summary) ?? "",
        recommended_action: toSupabaseText(item.recommendedAction),
        why_it_matters: toSupabaseText(item.whyItMatters),
        owner: toSupabaseText(item.owner),
        status: toSupabaseText(item.status),
        tone: item.tone ?? null,
        state: existing?.state ?? "open",
        source_type: toSupabaseText(item.source) ?? "Document",
        source_detail: toSupabaseText(item.sourceDetail) ?? "",
        source_id: toSupabaseText(item.sourceId),
        source_url: toSupabaseText(item.sourceUrl),
        project_label: toSupabaseText(item.project) ?? "No project linked",
        source_date: toSupabaseText(item.date) ?? "",
        // See upsertFollowUps: recap_id uuid FKs left null now the daily_recaps
        // draft is retired and the packet is keyed by business date.
        first_seen_recap_id: existing?.first_seen_recap_id ?? null,
        last_seen_recap_id: null,
        first_seen_at: existing?.first_seen_at ?? now,
        last_seen_at: now,
        resolved_at: existing?.resolved_at ?? null,
        resolved_by: existing?.resolved_by ?? null,
        resolution_note: existing?.resolution_note ?? null,
        payload: toSupabaseJson(item),
      };
      const columns = Object.keys(row) as Array<keyof FollowUpInsert>;
      const values = columns.map((column) => toDbValue(row[column]));
      const placeholders = columns.map((_, index) => `$${index + 1}`);
      const updates = columns
        .filter((column) => column !== "fingerprint")
        .map((column) => `${column} = excluded.${column}`);
      const result = await client.query<FollowUpRow>(
        `
          insert into public.executive_briefing_follow_ups (${columns.join(", ")})
          values (${placeholders.join(", ")})
          on conflict (fingerprint)
          do update set ${updates.join(", ")}
          returning *
        `,
        values,
      );
      savedRows.push(normalizeDbRow(result.rows[0]) as FollowUpRow);
    }

    return new Map(
      savedRows.map((row) => [row.fingerprint, toDashboardFollowUp(row)]),
    );
  });
}

async function loadFollowUps() {
    const { data, error } = await serviceDb.from("executive_briefing_follow_ups")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (error) {
    return loadFollowUpsFromAppDb();
  }

  return (data ?? []).map(toDashboardFollowUp);
}

async function loadFollowUpsFromAppDb(): Promise<ExecutiveBriefingFollowUp[]> {
  return withAppDbClient(async (client) => {
    const result = await client.query<FollowUpRow>(
      `
        select *
        from public.executive_briefing_follow_ups
        order by last_seen_at desc
      `,
    );
    return result.rows.map((row) =>
      toDashboardFollowUp(normalizeDbRow(row) as FollowUpRow),
    );
  });
}

export async function getExecutiveBriefingDashboard(options?: {
  windowDays?: number;
}) {
  const windowDays = options?.windowDays ?? DEFAULT_EXECUTIVE_WINDOW_DAYS;
  const { recapDate, dateRangeStart } = getDateRange(windowDays);
  // The Daily Executive Brief has a single source of truth: the canonical
  // intelligence deep-read (intelligence_packets + structured signal
  // candidates). The dashboard reads that adapter — there is no separate
  // daily_recaps draft to load, regenerate, or approve.
  const packet = await buildCanonicalOperatingPacket();
  const draft: ExecutiveBriefingDraft = {
    id: recapDate,
    recapDate,
    workflowStatus: "draft",
    approvedAt: null,
    approvedBy: null,
    packet,
    createdAt: packet.generatedAt,
    updatedSummary: "",
  };

  // Persist the live packet's items as follow-ups so the staleness tracker keeps
  // working after the daily_recaps draft was retired. Failures here must not take
  // down the dashboard read.
  try {
    await upsertFollowUps(draft.packet);
  } catch (error) {
    console.error("[executive-briefing] follow-up persistence failed", error);
  }

  const followUps = await loadFollowUps();
  const openFollowUps = followUps.filter(
    (followUp) => followUp.state === "open",
  );
  const liveFingerprints = new Set(
    getSectionEntries(draft.packet).map(({ item, section }) =>
      createFingerprint(item, section),
    ),
  );
  const fingerprintMap = new Map(
    followUps.map((followUp) => [followUp.fingerprint, followUp]),
  );
  const staleFollowUps = openFollowUps.filter(
    (followUp) =>
      !liveFingerprints.has(followUp.fingerprint) &&
      isFollowUpInsideSourceWindow(followUp, dateRangeStart),
  );

  return {
    draft,
    followUps,
    openFollowUps,
    staleFollowUps,
    liveFingerprints,
    fingerprintMap,
  } satisfies ExecutiveBriefingDashboard;
}

export async function setExecutiveFollowUpState(params: {
  followUpId: string;
  nextState: "open" | "resolved";
  userId: string | null;
}) {
    const update =
    params.nextState === "resolved"
      ? {
          state: "resolved" as const,
          resolved_at: new Date().toISOString(),
          resolved_by: params.userId,
          resolution_note: "Marked resolved from the executive briefing.",
        }
      : {
          state: "open" as const,
          resolved_at: null,
          resolved_by: null,
          resolution_note: null,
        };

  const { error } = await serviceDb.from("executive_briefing_follow_ups")
    .update(update)
    .eq("id", params.followUpId);

  if (error) {
    throw new Error(
      `Failed to update executive follow-up state: ${error.message}`,
    );
  }
}

export function getFollowUpFingerprint(
  item: BrandonBriefItem,
  section: FollowUpSection,
) {
  return createFingerprint(item, section);
}
