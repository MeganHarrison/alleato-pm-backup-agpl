/**
 * Insight Cards Helper — single source of truth for Pipeline B queries.
 *
 * Every AI tool, briefing builder, and admin page that reads insight cards
 * imports from here. Keeps card-type buckets, status filters, severity
 * derivation, and project↔target resolution consistent across the codebase.
 *
 * Schema reminders (from `insight_cards` row type):
 *   - primary_target_id: UUID FK → intelligence_targets.id   (NOT project_id)
 *   - current_status:    'open' | 'blocked' | 'needs_review' | 'stale' | 'resolved' | ...
 *   - card_type:         one of 12 values (see InsightCardType in types.ts)
 *   - confidence:        'low' | 'medium' | 'high' (alpha-sort wrong → sort client-side)
 *   - attribution_status: 'auto_assigned' | 'needs_review' | 'candidate' | 'rejected' | 'confirmed' | ...
 *   - stale_after:        ISO timestamp; null = always live. > now() = snoozed.
 *
 * Source-document linkage goes through `insight_card_evidence`:
 *   insight_cards.id ←──── insight_card_evidence.insight_card_id
 *   insight_card_evidence.source_document_id → document_metadata.id
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

import type {
  ConfidenceLevel,
  InsightCardType,
} from "@/lib/ai/intelligence/types";

type AlleatoSupabase = SupabaseClient<Database>;

// =============================================================================
// Card type buckets
// =============================================================================

/** Card types that surface as RISK in legacy Pipeline A. */
export const RISK_CARD_TYPES: InsightCardType[] = [
  "risk",
  "blocker",
  "financial_exposure",
  "schedule_risk",
];

/** Card types that surface as DECISION in legacy Pipeline A. */
export const DECISION_CARD_TYPES: InsightCardType[] = ["decision", "change_management"];

/** Card types that represent open ACTIONS the owner/PM is responsible for. */
export const ACTION_CARD_TYPES: InsightCardType[] = ["task", "open_question", "requirement"];

/** Card types whose presence indicates a process or product issue. */
export const PROCESS_CARD_TYPES: InsightCardType[] = ["process_issue", "product_need"];

/**
 * Card types capturing team/owner emotional signal extracted from comms
 * (e.g. "Where are employees confused?", "Who's frustrated?").
 */
export const SENTIMENT_CARD_TYPES: InsightCardType[] = ["sentiment"];

/**
 * Card types capturing strategic direction signals from comms
 * (e.g. "Company is shifting focus", "New BD push").
 */
export const INITIATIVE_CARD_TYPES: InsightCardType[] = ["initiative_signal"];

/**
 * Pipeline A had an `opportunity` type that Pipeline B does NOT have a clean
 * equivalent for. Surface this in tool responses so the model doesn't pretend
 * to have opportunity data it does not.
 */
export const PIPELINE_B_HAS_NO_EQUIVALENT_FOR_PIPELINE_A_OPPORTUNITY = true;

// =============================================================================
// Status filters
// =============================================================================

/** Card current_status values that mean "still requires attention". */
export const ACTIVE_CARD_STATUSES = [
  "open",
  "blocked",
  "needs_review",
  "stale",
] as const;

/** Card attribution_status values whose rows we should hide. */
export const HIDDEN_ATTRIBUTION_STATUSES = ["rejected"] as const;

// =============================================================================
// Confidence ranking
// =============================================================================

/**
 * Sort key for confidence — Postgres alpha-sorts confidence wrong
 * (`high|low|medium`). Always sort client-side using this map.
 */
export const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// =============================================================================
// Severity derivation
// =============================================================================

export type DerivedSeverity = "critical" | "high" | "medium" | "low";

/**
 * Pipeline B does not have a severity column. Tools that previously surfaced
 * `severity` (`getProjectRiskAnalysis`, `getProjectsWithRisks`, etc.) derive it
 * from card_type + confidence using these rules:
 *
 *   critical: blocker / financial_exposure / schedule_risk + high confidence
 *   high:     any RISK_CARD_TYPES at any confidence, OR change_management+high
 *   medium:   anything else at medium/high confidence
 *   low:      anything else at low confidence
 */
export function deriveSeverity(card: {
  card_type: string;
  confidence: string;
}): DerivedSeverity {
  const type = card.card_type as InsightCardType;
  const conf = card.confidence as ConfidenceLevel;

  const isCriticalType =
    type === "blocker" || type === "financial_exposure" || type === "schedule_risk";
  if (isCriticalType && conf === "high") return "critical";

  if (RISK_CARD_TYPES.includes(type)) return "high";
  if (type === "change_management" && conf === "high") return "high";

  // Sentiment and initiative_signal default to medium severity regardless
  // of confidence band, except low-confidence which stays low.
  if (type === "sentiment" || type === "initiative_signal") {
    if (conf === "low") return "low";
    return "medium";
  }

  if (conf === "high" || conf === "medium") return "medium";
  return "low";
}

/** Rank derived severities so we can sort cards by priority. */
export const SEVERITY_RANK: Record<DerivedSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// =============================================================================
// Insight-type → card-type mapping (for write tools like flagProjectRisk)
// =============================================================================

/** Legacy Pipeline A `insight_type` strings → Pipeline B `card_type`. */
export function mapLegacyInsightTypeToCardType(legacyType: string): InsightCardType {
  switch (legacyType) {
    case "financial_risk":
    case "financial_exposure":
      return "financial_exposure";
    case "schedule_risk":
    case "schedule":
      return "schedule_risk";
    case "scope_risk":
    case "change":
    case "change_order":
      return "change_management";
    case "decision":
      return "decision";
    case "blocker":
      return "blocker";
    case "task":
    case "action":
    case "action_item":
      return "task";
    case "open_question":
    case "question":
      return "open_question";
    default:
      return "risk";
  }
}

/** Map user-typed severity → confidence band (used by manual write tools). */
export function severityToConfidence(severity: string): ConfidenceLevel {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "high") return "high";
  if (normalized === "medium" || normalized === "med") return "medium";
  return "low";
}

// =============================================================================
// Project ↔ Target resolution
// =============================================================================

/** Resolve numeric project_id values to intelligence_targets.id (UUID). */
export async function resolveTargetIdsForProjects(
  supabase: AlleatoSupabase,
  projectIds: readonly number[],
): Promise<Map<number, string>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("intelligence_targets")
    .select("id, project_id, status")
    .eq("target_type", "client_project")
    .eq("status", "active")
    .in("project_id", projectIds as number[]);
  if (error) {
    throw new Error(`Failed to resolve intelligence_targets: ${error.message}`);
  }
  const out = new Map<number, string>();
  for (const row of data ?? []) {
    if (row.project_id != null) out.set(row.project_id, row.id);
  }
  return out;
}

/** Reverse map: intelligence_targets.id → project_id (number). */
export async function resolveProjectIdsForTargets(
  supabase: AlleatoSupabase,
  targetIds: readonly string[],
): Promise<Map<string, { projectId: number | null; name: string }>> {
  if (targetIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("intelligence_targets")
    .select("id, project_id, name")
    .in("id", targetIds as string[]);
  if (error) {
    throw new Error(`Failed to load intelligence_targets: ${error.message}`);
  }
  const out = new Map<string, { projectId: number | null; name: string }>();
  for (const row of data ?? []) {
    out.set(row.id, { projectId: row.project_id, name: row.name });
  }
  return out;
}

// =============================================================================
// Query builders
// =============================================================================

/**
 * Build a base select on insight_cards that:
 *   - Joins to intelligence_targets so the caller gets project_id + name
 *   - Filters out rejected attribution
 *   - Filters out snoozed cards (stale_after > now)
 *   - Limits to ACTIVE_CARD_STATUSES by default
 *
 * Callers add their own `.in("card_type", ...)`, `.in("primary_target_id", ...)`,
 * `.eq(...)`, `.order(...)`, `.limit(...)`, etc.
 */
export function insightCardBaseQuery(
  supabase: AlleatoSupabase,
  options: { now?: Date; includeAnyStatus?: boolean } = {},
) {
  const now = (options.now ?? new Date()).toISOString();
  let q = supabase
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
       next_action,
       suggested_owner_label,
       suggested_owner_person_id,
       first_seen_at,
       last_seen_at,
       stale_after,
       source_count,
       metadata,
       created_at,
       updated_at,
       intelligence_targets:primary_target_id (id, project_id, name)`,
    )
    .neq("attribution_status", "rejected")
    .or(`stale_after.is.null,stale_after.lte.${now}`);
  if (!options.includeAnyStatus) {
    q = q.in("current_status", ACTIVE_CARD_STATUSES as unknown as string[]);
  }
  return q;
}

/**
 * Fetch insight_card_ids that have evidence linking them to one or more
 * source documents (meeting transcripts, emails, etc.).
 *
 * Use this for tools that previously filtered Pipeline A `insights` by
 * `metadata_id IN (meeting_ids)` — Pipeline B routes that join through the
 * insight_card_evidence table.
 */
export async function findInsightCardIdsBySourceDocuments(
  supabase: AlleatoSupabase,
  sourceDocumentIds: readonly string[],
): Promise<{
  cardIdsByDocId: Map<string, string[]>;
  allCardIds: string[];
}> {
  if (sourceDocumentIds.length === 0) {
    return { cardIdsByDocId: new Map(), allCardIds: [] };
  }
  const { data, error } = await supabase
    .from("insight_card_evidence")
    .select("insight_card_id, source_document_id")
    .in("source_document_id", sourceDocumentIds as string[]);
  if (error) {
    throw new Error(`Failed to query insight_card_evidence: ${error.message}`);
  }
  const cardIdsByDocId = new Map<string, string[]>();
  const allCardIds = new Set<string>();
  for (const row of data ?? []) {
    if (!row.source_document_id || !row.insight_card_id) continue;
    const bucket = cardIdsByDocId.get(row.source_document_id) ?? [];
    bucket.push(row.insight_card_id);
    cardIdsByDocId.set(row.source_document_id, bucket);
    allCardIds.add(row.insight_card_id);
  }
  return { cardIdsByDocId, allCardIds: Array.from(allCardIds) };
}

// =============================================================================
// Row type helpers
// =============================================================================

/** Card row shape returned by insightCardBaseQuery (with embedded target). */
export type InsightCardWithTarget = {
  id: string;
  primary_target_id: string;
  title: string;
  summary: string;
  why_it_matters: string | null;
  current_status: string;
  card_type: string;
  confidence: string;
  attribution_status: string;
  next_action: string | null;
  suggested_owner_label: string | null;
  suggested_owner_person_id: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  stale_after: string | null;
  source_count: number;
  metadata: Database["public"]["Tables"]["insight_cards"]["Row"]["metadata"];
  created_at: string;
  updated_at: string;
  intelligence_targets: { id: string; project_id: number | null; name: string } | null;
};

/**
 * Sort cards by urgency, descending. Composite: derived severity → confidence
 * → recency (last_seen_at desc).
 */
export function sortByUrgencyDesc<T extends { card_type: string; confidence: string; last_seen_at?: string | null }>(
  cards: T[],
): T[] {
  return [...cards].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[deriveSeverity(b)] - SEVERITY_RANK[deriveSeverity(a)];
    if (sevDiff !== 0) return sevDiff;
    const confDiff =
      CONFIDENCE_RANK[b.confidence as ConfidenceLevel] -
      CONFIDENCE_RANK[a.confidence as ConfidenceLevel];
    if (confDiff !== 0) return confDiff;
    return (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "");
  });
}
