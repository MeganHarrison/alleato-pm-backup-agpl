/**
 * Owner Briefing Builder — Pipeline B data loader for the daily Teams card.
 *
 * Replaces the legacy `brandon-daily-update` extraction path which re-queried
 * raw document_metadata + document_chunks every morning. This loader reads the
 * curated intelligence layer (insight_cards + intelligence_packets) and
 * produces an action-oriented data structure for the Adaptive Card builder.
 *
 * Design principles:
 * - Owner-relevant cards only — filter to risks, blockers, financial
 *   exposures, schedule risks, open decisions, and pending change orders.
 *   Skip task/requirement/process_issue/product_need (PM-level).
 * - Rank projects by composite urgency, not alphabetically.
 * - Highlight packets that are stale (compiler not refreshing for that target).
 * - Cap items per project so the card stays under Teams' 28KB limit.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { PACKET_STALE_AFTER_HOURS } from "@/lib/ai/intelligence/types";
import type {
  ConfidenceLevel,
  InsightCardType,
} from "@/lib/ai/intelligence/types";

// -----------------------------------------------------------------------------
// Card type buckets — drives which cards land in which briefing section.
// -----------------------------------------------------------------------------

const DECISION_CARD_TYPES: InsightCardType[] = [
  "risk",
  "blocker",
  "financial_exposure",
  "schedule_risk",
  "decision",
  "change_management",
];

const ACTION_CARD_TYPES: InsightCardType[] = ["open_question", "task"];

// All card types the owner wants to see.
const OWNER_RELEVANT_CARD_TYPES: InsightCardType[] = [
  ...DECISION_CARD_TYPES,
  ...ACTION_CARD_TYPES,
];

// Cards in these states are considered "live" — open or needing attention.
// We skip resolved/closed cards entirely.
const ACTIVE_CARD_STATUS_VALUES = [
  "open",
  "blocked",
  "needs_review",
  "stale",
] as const;
const ACTIVE_CARD_STATUSES = new Set<string>(ACTIVE_CARD_STATUS_VALUES);

// Only fully-attributed or manually approved cards surface.
// needs_review and candidate are still in the review queue — their content is
// often placeholder boilerplate and should not appear in the owner brief.
const VALID_ATTRIBUTION_STATUS_VALUES = [
  "auto_assigned",
  "approved",
] as const;
const VALID_ATTRIBUTION_STATUSES = new Set<string>(VALID_ATTRIBUTION_STATUS_VALUES);

// -----------------------------------------------------------------------------
// Confidence ranking — Postgres alpha-sorts confidence wrong, so we sort
// client-side. high > medium > low.
// -----------------------------------------------------------------------------

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// -----------------------------------------------------------------------------
// Output types
// -----------------------------------------------------------------------------

export type OwnerBriefingCardItem = {
  cardId: string;
  cardType: InsightCardType;
  title: string;
  summary: string | null;
  whyItMatters: string | null;
  nextAction: string | null;
  confidence: ConfidenceLevel;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  ageHours: number | null;
  isNewSinceYesterday: boolean;
  suggestedOwnerLabel: string | null;
  /**
   * Number of distinct sources that corroborated this card (incremented each
   * time a new evidence document promotes the same normalized signal). >1 means
   * the issue has recurred across multiple meetings/messages — a strong urgency
   * and "this keeps coming up" signal for the brief.
   */
  sourceCount: number;
};

export type OwnerBriefingProject = {
  targetId: string;
  projectId: number | null;
  projectName: string;
  packetId: string | null;
  packetGeneratedAt: string | null;
  packetIsStale: boolean;
  packetAgeHours: number | null;
  urgencyScore: number;
  decisionsNeeded: OwnerBriefingCardItem[];
  actionsRequired: OwnerBriefingCardItem[];
};

export type OwnerBriefingData = {
  generatedAt: string;
  dateLabel: string;
  greeting: string;
  recipientName: string;
  portfolio: {
    activeProjectCount: number;
    totalDecisionsNeeded: number;
    totalActionsRequired: number;
    totalNewSinceYesterday: number;
    stalePacketCount: number;
  };
  topProjects: OwnerBriefingProject[];
};

type OwnerBriefingTargetRow = {
  id: string;
  name: string | null;
  project_id: number | null;
};

type OwnerBriefingPacketRow = {
  id: string;
  target_id: string;
  generated_at: string | null;
  freshness_status: string | null;
};

type OwnerBriefingCardRow = {
  id: string;
  primary_target_id: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  current_status: string;
  card_type: InsightCardType;
  confidence: ConfidenceLevel | null;
  attribution_status: string | null;
  suggested_owner_label: string | null;
  next_action: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  stale_after: string | null;
  source_count: number | null;
};

type OwnerBriefingRows = {
  targets: OwnerBriefingTargetRow[];
  packetRows: OwnerBriefingPacketRow[];
  cardRows: OwnerBriefingCardRow[];
};

// -----------------------------------------------------------------------------
// Tuning constants
// -----------------------------------------------------------------------------

const MAX_PROJECTS_IN_CARD = 5;
const MAX_DECISIONS_PER_PROJECT = 3;
const MAX_ACTIONS_PER_PROJECT = 2;
const NEW_SINCE_HOURS = 24;
const SOFT_CARD_LIMIT_PER_TARGET = 25; // Query cap; we filter further below.

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export type BuildOwnerBriefingInput = {
  recipientName: string;
  now?: Date;
  /**
   * Limit to specific target IDs (e.g. for testing). If omitted, the builder
   * pulls every active client_project target.
   */
  targetIds?: string[];
};

export async function buildOwnerBriefingData(
  input: BuildOwnerBriefingInput,
): Promise<OwnerBriefingData> {
  const now = input.now ?? new Date();
  const supabase = createServiceClient();

  const { targets, packetRows, cardRows } = await loadOwnerBriefingRows({
    supabase,
    input,
    now,
  });

  if (targets.length === 0) {
    return emptyBriefing({ now, recipientName: input.recipientName });
  }

  const packetByTarget = new Map<
    string,
    { id: string; generatedAt: string | null; freshnessStatus: string | null }
  >();
  for (const row of packetRows) {
    // If multiple rows somehow exist for a target, keep the freshest.
    const prev = packetByTarget.get(row.target_id);
    if (
      !prev ||
      (row.generated_at && (!prev.generatedAt || row.generated_at > prev.generatedAt))
    ) {
      packetByTarget.set(row.target_id, {
        id: row.id,
        generatedAt: row.generated_at,
        freshnessStatus: row.freshness_status,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Group cards by target, apply filters, rank, and trim.
  // ---------------------------------------------------------------------------
  const newSinceThresholdMs = now.getTime() - NEW_SINCE_HOURS * 3_600_000;
  const cardsByTarget = new Map<string, OwnerBriefingCardItem[]>();

  // Cards created by the source-attribution pipeline before full intelligence
  // extraction have this placeholder text stamped in why_it_matters. They are
  // not real actionable intelligence — skip them.
  const ATTRIBUTION_PLACEHOLDER = "This source contains project-relevant language";

  for (const row of cardRows) {
    // These mirror the database filters above and keep the function safe if a
    // future caller supplies preloaded rows or the query changes.
    if (!ACTIVE_CARD_STATUSES.has(row.current_status)) continue;
    if (!row.attribution_status || !VALID_ATTRIBUTION_STATUSES.has(row.attribution_status)) continue;
    if (row.why_it_matters?.startsWith(ATTRIBUTION_PLACEHOLDER)) continue;

    const firstSeenAt = row.first_seen_at;
    const lastSeenAt = row.last_seen_at;
    const ageHours = lastSeenAt
      ? Math.max(0, (now.getTime() - new Date(lastSeenAt).getTime()) / 3_600_000)
      : null;
    const isNew = firstSeenAt
      ? new Date(firstSeenAt).getTime() >= newSinceThresholdMs
      : false;

    const item: OwnerBriefingCardItem = {
      cardId: row.id,
      cardType: row.card_type as InsightCardType,
      title: row.title,
      summary: row.summary,
      whyItMatters: row.why_it_matters,
      nextAction: row.next_action,
      confidence: (row.confidence as ConfidenceLevel) ?? "medium",
      firstSeenAt,
      lastSeenAt,
      ageHours,
      isNewSinceYesterday: isNew,
      suggestedOwnerLabel: row.suggested_owner_label,
      sourceCount: typeof row.source_count === "number" ? row.source_count : 1,
    };

    const bucket = cardsByTarget.get(row.primary_target_id) ?? [];
    bucket.push(item);
    cardsByTarget.set(row.primary_target_id, bucket);
  }

  // ---------------------------------------------------------------------------
  // 5. Build per-project briefing objects with urgency scoring.
  // ---------------------------------------------------------------------------
  const projectBriefings: OwnerBriefingProject[] = targets.map((target) => {
    const allCards = cardsByTarget.get(target.id) ?? [];
    const decisions = allCards
      .filter((c) => DECISION_CARD_TYPES.includes(c.cardType))
      .sort(byUrgencyDesc)
      .slice(0, MAX_DECISIONS_PER_PROJECT);
    const actions = allCards
      .filter(
        (c) =>
          ACTION_CARD_TYPES.includes(c.cardType) && (c.nextAction?.trim().length ?? 0) > 0,
      )
      .sort(byUrgencyDesc)
      .slice(0, MAX_ACTIONS_PER_PROJECT);

    const packet = packetByTarget.get(target.id);
    const generatedAt = packet?.generatedAt ?? null;
    const packetAgeHours = generatedAt
      ? Math.max(0, (now.getTime() - new Date(generatedAt).getTime()) / 3_600_000)
      : null;
    const isStale =
      packetAgeHours === null || packetAgeHours > PACKET_STALE_AFTER_HOURS;

    const urgencyScore = computeUrgency({ decisions, actions, isStale, packetAgeHours });

    return {
      targetId: target.id,
      projectId: target.project_id,
      projectName: target.name ?? "Untitled project",
      packetId: packet?.id ?? null,
      packetGeneratedAt: generatedAt,
      packetIsStale: isStale,
      packetAgeHours,
      urgencyScore,
      decisionsNeeded: decisions,
      actionsRequired: actions,
    };
  });

  // ---------------------------------------------------------------------------
  // 6. Pick the top N most urgent projects with at least one card to show.
  // ---------------------------------------------------------------------------
  const topProjects = projectBriefings
    .filter((p) => p.decisionsNeeded.length + p.actionsRequired.length > 0)
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, MAX_PROJECTS_IN_CARD);

  // ---------------------------------------------------------------------------
  // 7. Portfolio aggregates across ALL active targets (not just top N shown).
  // ---------------------------------------------------------------------------
  const totalDecisions = projectBriefings.reduce(
    (sum, p) => sum + p.decisionsNeeded.length,
    0,
  );
  const totalActions = projectBriefings.reduce(
    (sum, p) => sum + p.actionsRequired.length,
    0,
  );
  const totalNew = projectBriefings.reduce(
    (sum, p) =>
      sum +
      p.decisionsNeeded.filter((c) => c.isNewSinceYesterday).length +
      p.actionsRequired.filter((c) => c.isNewSinceYesterday).length,
    0,
  );
  const staleCount = projectBriefings.filter((p) => p.packetIsStale).length;

  return {
    generatedAt: now.toISOString(),
    dateLabel: formatDateLabel(now),
    greeting: greetingFor(now, input.recipientName),
    recipientName: input.recipientName,
    portfolio: {
      activeProjectCount: targets.length,
      totalDecisionsNeeded: totalDecisions,
      totalActionsRequired: totalActions,
      totalNewSinceYesterday: totalNew,
      stalePacketCount: staleCount,
    },
    topProjects,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function byUrgencyDesc(a: OwnerBriefingCardItem, b: OwnerBriefingCardItem): number {
  // First: newer items first (last 24h).
  if (a.isNewSinceYesterday !== b.isNewSinceYesterday) {
    return a.isNewSinceYesterday ? -1 : 1;
  }
  // Then: higher confidence first.
  const confDiff = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
  if (confDiff !== 0) return confDiff;
  // Then: recurring issues (corroborated by more sources) outrank one-offs.
  const recurrenceDiff = b.sourceCount - a.sourceCount;
  if (recurrenceDiff !== 0) return recurrenceDiff;
  // Then: more recently seen.
  return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
}

function computeUrgency(params: {
  decisions: OwnerBriefingCardItem[];
  actions: OwnerBriefingCardItem[];
  isStale: boolean;
  packetAgeHours: number | null;
}): number {
  let score = 0;
  for (const c of params.decisions) {
    // High-confidence risk/blocker > medium > low.
    score += CONFIDENCE_RANK[c.confidence] * 4;
    if (c.isNewSinceYesterday) score += 5;
    // Recurring issues compound urgency, capped so a noisy signal can't dominate.
    score += Math.min(Math.max(c.sourceCount - 1, 0), 3) * 3;
  }
  for (const c of params.actions) {
    score += CONFIDENCE_RANK[c.confidence] * 1;
    if (c.isNewSinceYesterday) score += 2;
    score += Math.min(Math.max(c.sourceCount - 1, 0), 3) * 1;
  }
  // Stale packets penalty — a project whose compiler hasn't fired in days
  // shouldn't outrank a project with live signal.
  if (params.isStale) score -= 3;
  return score;
}

async function loadOwnerBriefingRows(params: {
  supabase: ReturnType<typeof createServiceClient>;
  input: BuildOwnerBriefingInput;
  now: Date;
}): Promise<OwnerBriefingRows> {
  try {
    return await loadOwnerBriefingRowsFromSupabase(params);
  } catch (error) {
    const fallback = await loadOwnerBriefingRowsFromAppDb(params);
    if (fallback.targets.length > 0) return fallback;
    throw error;
  }
}

async function loadOwnerBriefingRowsFromSupabase(params: {
  supabase: ReturnType<typeof createServiceClient>;
  input: BuildOwnerBriefingInput;
  now: Date;
}): Promise<OwnerBriefingRows> {
  let targetQuery = params.supabase
    .from("intelligence_targets")
    .select("id,name,project_id,target_type,status")
    .eq("status", "active")
    .eq("target_type", "client_project");

  if (params.input.targetIds && params.input.targetIds.length > 0) {
    targetQuery = targetQuery.in("id", params.input.targetIds);
  }

  const { data: targetRows, error: targetError } = await targetQuery;
  if (targetError) {
    throw new Error(`Failed to load intelligence targets: ${targetError.message}`);
  }
  const targets = (targetRows ?? []) as OwnerBriefingTargetRow[];
  if (targets.length === 0) return { targets: [], packetRows: [], cardRows: [] };

  const targetIds = targets.map((target) => target.id);
  const { data: packetRows, error: packetError } = await params.supabase
    .from("intelligence_packets")
    .select("id,target_id,generated_at,freshness_status")
    .in("target_id", targetIds)
    .eq("packet_type", "current");
  if (packetError) {
    throw new Error(`Failed to load intelligence packets: ${packetError.message}`);
  }

  const { data: cardRows, error: cardError } = await params.supabase
    .from("insight_cards")
    .select(
      `id,
       primary_target_id,
       title,
       summary,
       why_it_matters,
       current_status,
       card_type,
       confidence,
       attribution_status,
       suggested_owner_label,
       next_action,
       first_seen_at,
       last_seen_at,
       stale_after,
       source_count`,
    )
    .in("primary_target_id", targetIds)
    .in("card_type", OWNER_RELEVANT_CARD_TYPES)
    .in("current_status", ACTIVE_CARD_STATUS_VALUES)
    .in("attribution_status", VALID_ATTRIBUTION_STATUS_VALUES)
    .or(`stale_after.is.null,stale_after.lte.${params.now.toISOString()}`)
    .order("last_seen_at", { ascending: false })
    .limit(SOFT_CARD_LIMIT_PER_TARGET * targets.length);
  if (cardError) {
    throw new Error(`Failed to load insight cards: ${cardError.message}`);
  }

  return {
    targets,
    packetRows: (packetRows ?? []) as OwnerBriefingPacketRow[],
    cardRows: (cardRows ?? []) as OwnerBriefingCardRow[],
  };
}

async function loadOwnerBriefingRowsFromAppDb(params: {
  input: BuildOwnerBriefingInput;
  now: Date;
}): Promise<OwnerBriefingRows> {
  const databaseUrl =
    process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error("Failed to load owner briefing rows: app database URL is not configured.");
  }

  const pg = await import("pg");
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const pool = new pg.Pool({
      connectionString: buildAppDatabaseConnectionString(databaseUrl),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 1_000,
    });
    try {
      const client = await pool.connect();
      try {
        await client.query("set statement_timeout = '15000ms'");
        const targetParams: unknown[] = [];
        let targetFilter = "";
        if (params.input.targetIds && params.input.targetIds.length > 0) {
          targetParams.push(params.input.targetIds);
          targetFilter = "and id = any($1::uuid[])";
        }

        const targetResult = await client.query<OwnerBriefingTargetRow>(
          `
            select id, name, project_id
            from public.intelligence_targets
            where status = 'active'
              and target_type = 'client_project'
              ${targetFilter}
          `,
          targetParams,
        );
        const targets = targetResult.rows;
        if (targets.length === 0) return { targets: [], packetRows: [], cardRows: [] };

        const targetIds = targets.map((target) => target.id);
        const packetResult = await client.query<OwnerBriefingPacketRow>(
          `
            select id, target_id, generated_at, freshness_status
            from public.intelligence_packets
            where target_id = any($1::uuid[])
              and packet_type = 'current'
          `,
          [targetIds],
        );
        const cardResult = await client.query<OwnerBriefingCardRow>(
          `
            select id,
              primary_target_id,
              title,
              summary,
              why_it_matters,
              current_status,
              card_type,
              confidence,
              attribution_status,
              suggested_owner_label,
              next_action,
              first_seen_at,
              last_seen_at,
              stale_after,
              source_count
            from public.insight_cards
            where primary_target_id = any($1::uuid[])
              and card_type = any($2::text[])
              and current_status = any($3::text[])
              and attribution_status = any($4::text[])
              and (stale_after is null or stale_after <= $5::timestamptz)
            order by last_seen_at desc nulls last
            limit $6
          `,
          [
            targetIds,
            OWNER_RELEVANT_CARD_TYPES,
            ACTIVE_CARD_STATUS_VALUES,
            VALID_ATTRIBUTION_STATUS_VALUES,
            params.now.toISOString(),
            SOFT_CARD_LIMIT_PER_TARGET * targets.length,
          ],
        );

        return {
          targets,
          packetRows: packetResult.rows.map((row) => ({
            ...row,
            generated_at: normalizeBriefingTimestamp(row.generated_at),
          })),
          cardRows: cardResult.rows.map((row) => ({
            ...row,
            first_seen_at: normalizeBriefingTimestamp(row.first_seen_at),
            last_seen_at: normalizeBriefingTimestamp(row.last_seen_at),
            stale_after: normalizeBriefingTimestamp(row.stale_after),
          })),
        };
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

function normalizeBriefingTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function buildAppDatabaseConnectionString(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

function emptyBriefing(params: {
  now: Date;
  recipientName: string;
}): OwnerBriefingData {
  return {
    generatedAt: params.now.toISOString(),
    dateLabel: formatDateLabel(params.now),
    greeting: greetingFor(params.now, params.recipientName),
    recipientName: params.recipientName,
    portfolio: {
      activeProjectCount: 0,
      totalDecisionsNeeded: 0,
      totalActionsRequired: 0,
      totalNewSinceYesterday: 0,
      stalePacketCount: 0,
    },
    topProjects: [],
  };
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function greetingFor(date: Date, name: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 17) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}
