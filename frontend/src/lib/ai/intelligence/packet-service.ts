import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type {
  ClientProjectIntelligencePacket,
  ConfidenceLevel,
  ConfidenceSummary,
  InsightCard,
  InsightCardEvidence,
  InsightCardEvidenceRow,
  InsightCardReviewFeedback,
  InsightCardRow,
  IntelligencePacketCardRow,
  IntelligencePacketRow,
  IntelligenceTargetRow,
  IntelligenceTargetType,
  PacketFreshnessStatus,
  ResolvedIntelligenceTarget,
  SourceCoverageSummary,
} from "./types";
import { PACKET_STALE_AFTER_HOURS } from "./types";
import { chunkArray, normalizeDbRow, normalizeDbRows, withAppDbClient } from "./db-fallback";
import { cleanSourcePreview, isMetadataOnlyPreview, sourceCoverageCategory, toRecord } from "./utils";

type AlleatoSupabaseClient = SupabaseClient<Database>;
type ProjectOperatingRecordContext = ClientProjectIntelligencePacket["operatingRecord"];

type SourceDocumentPreview = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  "id" | "type" | "category" | "summary" | "overview" | "description" | "notes"
> & {
  content?: string | null;
  raw_text?: string | null;
};

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeQuery(value).replace(/\s+/g, "-");
}

function targetMatchesQuery(target: IntelligenceTargetRow, query: string): boolean {
  const normalized = normalizeQuery(query);
  const targetName = normalizeQuery(target.name);
  const targetSlug = slugify(target.slug);

  return (
    normalized === targetName ||
    normalized === targetSlug ||
    normalized.includes(targetName) ||
    normalized.includes(targetSlug.replace(/-/g, " "))
  );
}

function mapTarget(
  row: IntelligenceTargetRow,
  source: ResolvedIntelligenceTarget["source"],
  resolutionReason: string,
): ResolvedIntelligenceTarget {
  return {
    id: row.id,
    targetType: row.target_type as IntelligenceTargetType,
    name: row.name,
    slug: row.slug,
    projectId: row.project_id,
    status: row.status,
    resolutionReason,
    source,
  };
}

function getSourcePreview(source: SourceDocumentPreview | undefined): string | null {
  if (!source) return null;
  const sourceKind = `${source.type ?? ""} ${source.category ?? ""}`.toLowerCase();
  const isEmailSource = sourceKind.includes("email");
  const primaryContent = [source.content, source.raw_text]
    .map((value) => cleanSourcePreview(value))
    .find(Boolean);

  if (isEmailSource) {
    return primaryContent ?? null;
  }

  const nonMetadataPrimaryContent = [source.content, source.raw_text]
    .map((value) => cleanSourcePreview(value))
    .find((value) => value && !isMetadataOnlyPreview(value));

  if (nonMetadataPrimaryContent) return nonMetadataPrimaryContent;

  return [source.summary, source.overview, source.description, source.notes, source.content, source.raw_text]
    .map((value) => cleanSourcePreview(value))
    .find((value) => Boolean(value)) ?? null;
}

function mapEvidence(
  row: InsightCardEvidenceRow,
  sourceDocument: SourceDocumentPreview | undefined,
): InsightCardEvidence {
  return {
    id: row.id,
    sourceDocumentId: row.source_document_id,
    sourceChunkId: row.source_chunk_id,
    sourceMessageId: row.source_message_id,
    sourceType: row.source_type,
    sourceCategory: sourceDocument?.category ?? sourceDocument?.type ?? null,
    sourceTitle: row.source_title,
    sourceOccurredAt: row.source_occurred_at,
    participants: row.participants,
    sourceContentPreview: getSourcePreview(sourceDocument),
    excerpt: row.excerpt,
    summary: row.summary,
    relevanceReason: row.relevance_reason,
    evidenceRole: row.evidence_role,
    confidence: row.confidence as ConfidenceLevel,
  };
}

function isFeedbackSignal(value: unknown): value is InsightCardReviewFeedback["signal"] {
  return value === "useful" || value === "wrong" || value === "stale";
}

function mapReviewFeedback(
  row: Database["public"]["Tables"]["intelligence_reviews"]["Row"],
): InsightCardReviewFeedback | null {
  const proposedValue = toRecord(row.proposed_value);
  const signal = proposedValue.signal;
  if (!isFeedbackSignal(signal)) return null;

  return {
    id: row.id,
    status: row.status,
    signal,
    reason: typeof proposedValue.reason === "string" ? proposedValue.reason : null,
    correction: typeof proposedValue.correction === "string" ? proposedValue.correction : null,
    createdAt: row.created_at,
  };
}

function mapCard(
  row: InsightCardRow,
  packetCard: IntelligencePacketCardRow | undefined,
  evidence: InsightCardEvidence[],
  latestFeedback: InsightCardReviewFeedback | null,
): InsightCard {
  return {
    id: row.id,
    title: row.title,
    cardType: row.card_type as InsightCard["cardType"],
    section: packetCard?.section ?? null,
    rank: packetCard?.rank ?? null,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    currentStatus: row.current_status,
    confidence: row.confidence as ConfidenceLevel,
    attributionStatus: row.attribution_status,
    nextAction: row.next_action,
    sourceCount: row.source_count,
    metadata: toRecord(row.metadata),
    evidence,
    latestFeedback,
  };
}

function enrichSourceCoverage(
  sourceCoverage: SourceCoverageSummary,
  cards: InsightCard[],
): SourceCoverageSummary {
  if (Array.isArray(sourceCoverage.categoryCoverage)) {
    return sourceCoverage;
  }

  const counts = new Map<string, { count: number; latestAt: string | null }>();
  for (const card of cards) {
    for (const evidence of card.evidence) {
      const category = sourceCoverageCategory(`${evidence.sourceCategory ?? ""} ${evidence.sourceType ?? ""}`);
      const current = counts.get(category) ?? { count: 0, latestAt: null };
      const latestAt =
        evidence.sourceOccurredAt && (!current.latestAt || evidence.sourceOccurredAt > current.latestAt)
          ? evidence.sourceOccurredAt
          : current.latestAt;
      counts.set(category, { count: current.count + 1, latestAt });
    }
  }

  return {
    ...sourceCoverage,
    categoryCoverage: Array.from(counts.entries()).map(([category, value]) => ({
      category,
      label: category.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      availableCount: value.count,
      sourceCount: value.count,
      inPacketCount: value.count,
      latestAt: value.latestAt,
      tableNames: ["insight_card_evidence"],
    })),
  };
}

function mapPacket(row: IntelligencePacketRow, cards: InsightCard[]): ClientProjectIntelligencePacket {
  const sourceCoverage = enrichSourceCoverage(
    toRecord(row.source_coverage) as SourceCoverageSummary,
    cards,
  );

  const generatedAtMs = row.generated_at ? new Date(row.generated_at).getTime() : NaN;
  const ageHours = Number.isFinite(generatedAtMs)
    ? Math.max(0, (Date.now() - generatedAtMs) / 3_600_000)
    : Number.POSITIVE_INFINITY;
  const isStale = ageHours > PACKET_STALE_AFTER_HOURS;

  return {
    id: row.id,
    targetId: row.target_id,
    packetType: row.packet_type,
    packetVersion: row.packet_version,
    generatedAt: row.generated_at,
    coveredStartAt: row.covered_start_at,
    coveredEndAt: row.covered_end_at,
    freshnessStatus: row.freshness_status as PacketFreshnessStatus,
    executiveSummary: row.executive_summary,
    currentStatus: row.current_status,
    strategicRead: row.strategic_read,
    whyItMatters: row.why_it_matters,
    recommendedNextMoves: row.recommended_next_moves,
    confidenceSummary: toRecord(row.confidence_summary) as ConfidenceSummary,
    sourceCoverage,
    reviewQueueCount: row.review_queue_count,
    staleItemCount: row.stale_item_count,
    packetJson: toRecord(row.packet_json),
    compilerVersion: row.compiler_version,
    cards,
    ageHours,
    isStale,
  };
}

async function loadProjectOperatingRecordContext(input: {
  projectId: number;
  supabase: AlleatoSupabaseClient;
}): Promise<ProjectOperatingRecordContext> {
  const supabase = input.supabase;
  const [
    { data: currentState },
    { data: latestSnapshot },
    { data: timelineEvents },
    { data: changeEventCandidates },
  ] = await Promise.all([
    supabase
      .from("project_current_state")
      .select(
        "project_id,current_summary,health_status,what_changed_since_last_update,needs_attention,open_decisions,active_risks,financial_read,schedule_read,field_read,source_confidence,updated_at",
      )
      .eq("project_id", input.projectId)
      .maybeSingle(),
    supabase
      .from("project_operating_snapshots")
      .select(
        "id,project_id,snapshot_at,source_coverage,financial_snapshot,schedule_snapshot,database_counts,project_info,acumatica_sync_at,freshness,warnings,confidence",
      )
      .eq("project_id", input.projectId)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("project_intelligence_timeline_events")
      .select(
        "id,event_at,event_type,title,summary,why_it_matters,current_status,owner_label,priority,source_document_id,confidence",
      )
      .eq("project_id", input.projectId)
      .in("current_status", ["open", "monitoring", "needs_decision"])
      .order("event_at", { ascending: false })
      .limit(12),
    supabase
      .from("change_event_candidates")
      .select(
        "id,title,description,reason,potential_cost_impact,potential_schedule_impact,confidence,missing_information,status,created_at",
      )
      .eq("project_id", input.projectId)
      .in("status", ["candidate", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    currentState: currentState
      ? normalizeDbRow(currentState as Record<string, unknown>)
      : null,
    latestSnapshot: latestSnapshot
      ? normalizeDbRow(latestSnapshot as Record<string, unknown>)
      : null,
    timelineEvents: ((timelineEvents ?? []) as Record<string, unknown>[]).map((row) =>
      normalizeDbRow(row),
    ),
    changeEventCandidates: ((changeEventCandidates ?? []) as Record<string, unknown>[]).map((row) =>
      normalizeDbRow(row),
    ),
  };
}

export async function resolveIntelligenceTarget(input: {
  query: string;
  selectedProjectId?: number;
  supabase: AlleatoSupabaseClient;
}): Promise<ResolvedIntelligenceTarget | null> {
  if (typeof input.selectedProjectId === "number") {
    const { data, error } = await input.supabase
      .from("intelligence_targets")
      .select("*")
      .eq("target_type", "client_project")
      .eq("project_id", input.selectedProjectId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve selected intelligence project: ${error.message}`);
    }
    if (data) {
      return mapTarget(
        data,
        "selected_project",
        `Selected project ${input.selectedProjectId} resolved to intelligence target ${data.slug}.`,
      );
    }
  }

  const { data: targets, error: targetError } = await input.supabase
    .from("intelligence_targets")
    .select("*")
    .eq("status", "active")
    .limit(100);

  if (targetError) {
    throw new Error(`Failed to load intelligence targets: ${targetError.message}`);
  }

  const target = (targets ?? [])
    .filter((candidate) => candidate.target_type === "client_project")
    .find((candidate) => targetMatchesQuery(candidate, input.query));
  if (target) {
    return mapTarget(target, "target_match", `Query matched intelligence target ${target.slug}.`);
  }

  const normalized = normalizeQuery(input.query);
  if (!normalized) return null;

  const { data: projects, error: projectError } = await input.supabase
    .from("projects")
    .select("id, name, aliases")
    .limit(100);

  if (projectError) {
    throw new Error(`Failed to load projects for intelligence target resolution: ${projectError.message}`);
  }

  const project = (projects ?? []).find((candidate) => {
    const name = normalizeQuery(candidate.name ?? "");
    const aliases = candidate.aliases ?? [];
    return (
      (name && normalized.includes(name)) ||
      aliases.some((alias) => normalized.includes(normalizeQuery(alias)))
    );
  });

  if (!project) return null;

  const { data: projectTarget, error: projectTargetError } = await input.supabase
    .from("intelligence_targets")
    .select("*")
    .eq("target_type", "client_project")
    .eq("project_id", project.id)
    .maybeSingle();

  if (projectTargetError) {
    throw new Error(`Failed to resolve project intelligence target: ${projectTargetError.message}`);
  }

  return projectTarget
    ? mapTarget(
        projectTarget,
        "project_match",
        `Project name ${project.name ?? project.id} resolved to intelligence target ${projectTarget.slug}.`,
      )
    : null;
}

export async function loadCurrentIntelligencePacket(input: {
  targetId: string;
  supabase: AlleatoSupabaseClient;
  includeSourcePreview?: boolean;
  projectId?: number | null;
}): Promise<ClientProjectIntelligencePacket | null> {
  try {
    const { data, error } = await input.supabase
      .from("intelligence_packets")
      .select("*")
      .eq("target_id", input.targetId)
      .eq("packet_type", "current")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load current intelligence packet: ${error.message}`);
    }
    if (!data) return loadCurrentIntelligencePacketFromAppDb(input);

    const cards = await loadPacketCards({
      targetId: input.targetId,
      supabase: input.supabase,
      includeSourcePreview: input.includeSourcePreview,
    });

    const packet = mapPacket(data, cards);
    const operatingRecord = typeof input.projectId === "number"
      ? await loadProjectOperatingRecordContext({
          projectId: input.projectId,
          supabase: input.supabase,
        }).catch(() => null)
      : null;

    return {
      ...packet,
      operatingRecord,
    };
  } catch (error) {
    try {
      return await loadCurrentIntelligencePacketFromAppDb(input);
    } catch (fallbackError) {
      const primaryMessage = error instanceof Error ? error.message : String(error);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Failed to load current intelligence packet: ${primaryMessage}; direct database fallback also failed: ${fallbackMessage}`,
      );
    }
  }
}

export async function loadCurrentIntelligencePacketBySlug(input: {
  slug: string;
  supabase: AlleatoSupabaseClient;
  includeSourcePreview?: boolean;
}): Promise<ClientProjectIntelligencePacket | null> {
  const { data: target, error } = await input.supabase
    .from("intelligence_targets")
    .select("*")
    .eq("slug", input.slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve intelligence target ${input.slug}: ${error.message}`);
  }
  if (!target) return null;

  return loadCurrentIntelligencePacket({
    targetId: target.id,
    supabase: input.supabase,
    includeSourcePreview: input.includeSourcePreview,
    projectId: target.project_id,
  });
}

export async function loadPacketCards(input: {
  targetId: string;
  supabase: AlleatoSupabaseClient;
  includeCandidate?: boolean;
  includeSourcePreview?: boolean;
}): Promise<InsightCard[]> {
  try {
    const { data: packet, error: packetError } = await input.supabase
      .from("intelligence_packets")
      .select("id")
      .eq("target_id", input.targetId)
      .eq("packet_type", "current")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (packetError) {
      throw new Error(`Failed to load packet card index: ${packetError.message}`);
    }
    if (!packet) return [];

    const { data: packetCards, error: packetCardsError } = await input.supabase
      .from("intelligence_packet_cards")
      .select("*")
      .eq("packet_id", packet.id)
      .order("rank", { ascending: true });

    if (packetCardsError) {
      throw new Error(`Failed to load packet cards: ${packetCardsError.message}`);
    }

    const packetCardRows = packetCards ?? [];
    const cardIds = Array.from(new Set(packetCardRows.map((row) => row.insight_card_id)));
    if (cardIds.length === 0) return [];

    const cardResults = await Promise.all(
      chunkArray(cardIds).map((ids) =>
        input.includeCandidate
          ? input.supabase
              .from("insight_cards")
              .select("*")
              .in("id", ids)
          : input.supabase
              .from("insight_cards")
              .select("*")
              .in("id", ids)
              .neq("attribution_status", "rejected"),
      ),
    );
    const cardsError = cardResults.find((result) => result.error)?.error;
    if (cardsError) {
      throw new Error(`Failed to load insight cards: ${cardsError.message}`);
    }
    const cardRows = cardResults.flatMap((result) => result.data ?? []);

    const evidenceResults = await Promise.all(
      chunkArray(cardIds).map((ids) =>
        input.supabase
          .from("insight_card_evidence")
          .select("*")
          .in("insight_card_id", ids)
          .order("source_occurred_at", { ascending: false, nullsFirst: false }),
      ),
    );
    const evidenceError = evidenceResults.find((result) => result.error)?.error;
    if (evidenceError) {
      throw new Error(`Failed to load insight card evidence: ${evidenceError.message}`);
    }
    const evidenceRows = evidenceResults.flatMap((result) => result.data ?? []);

    const sourceDocumentIds = input.includeSourcePreview === false
      ? []
      : Array.from(
          new Set(
            evidenceRows
              .map((row) => row.source_document_id)
              .filter((value): value is string => Boolean(value)),
          ),
        );
    const sourceDocumentResults = sourceDocumentIds.length > 0
      ? await Promise.all(
          chunkArray(sourceDocumentIds).map((ids) =>
            input.supabase
              .from("document_metadata")
              .select("id,type,category,summary,overview,description,notes")
              .in("id", ids),
          ),
        )
      : [];
    const sourceDocumentError = sourceDocumentResults.find((result) => result.error)?.error;
    if (sourceDocumentError) {
      throw new Error(`Failed to load insight card source content: ${sourceDocumentError.message}`);
    }
    const sourceDocumentRows = sourceDocumentResults.flatMap((result) => result.data ?? []);

    const reviewResults = await Promise.all(
      chunkArray(cardIds).map((ids) =>
        input.supabase
          .from("intelligence_reviews")
          .select("*")
          .eq("review_type", "packet_card_feedback")
          .in("insight_card_id", ids)
          .order("created_at", { ascending: false }),
      ),
    );
    const reviewError = reviewResults.find((result) => result.error)?.error;
    if (reviewError) {
      throw new Error(`Failed to load insight card feedback: ${reviewError.message}`);
    }
    const reviewRows = reviewResults.flatMap((result) => result.data ?? []);

    return mapPacketCards({
      packetCardRows,
      cardRows,
      evidenceRows,
      sourceDocumentRows,
      reviewRows,
    });
  } catch (error) {
    try {
      return await loadPacketCardsFromAppDb(input);
    } catch (fallbackError) {
      const primaryMessage = error instanceof Error ? error.message : String(error);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Failed to load packet cards: ${primaryMessage}; direct database fallback also failed: ${fallbackMessage}`,
      );
    }
  }
}

function mapPacketCards(input: {
  packetCardRows: IntelligencePacketCardRow[];
  cardRows: InsightCardRow[];
  evidenceRows: InsightCardEvidenceRow[];
  sourceDocumentRows: SourceDocumentPreview[];
  reviewRows: Database["public"]["Tables"]["intelligence_reviews"]["Row"][];
}): InsightCard[] {
  const sourceDocumentById = new Map(
    input.sourceDocumentRows.map((row) => [row.id, row]),
  );
  const evidenceByCard = new Map<string, InsightCardEvidence[]>();
  for (const row of input.evidenceRows) {
    const existing = evidenceByCard.get(row.insight_card_id) ?? [];
    existing.push(mapEvidence(row, row.source_document_id ? sourceDocumentById.get(row.source_document_id) : undefined));
    evidenceByCard.set(row.insight_card_id, existing);
  }

  const feedbackByCard = new Map<string, InsightCardReviewFeedback>();
  for (const row of input.reviewRows) {
    if (!row.insight_card_id || feedbackByCard.has(row.insight_card_id)) continue;
    const feedback = mapReviewFeedback(row);
    if (feedback) feedbackByCard.set(row.insight_card_id, feedback);
  }

  const cardsById = new Map(input.cardRows.map((row) => [row.id, row]));
  return input.packetCardRows
    .map((packetCard) => {
      const card = cardsById.get(packetCard.insight_card_id);
      return card
        ? mapCard(
            card,
            packetCard,
            evidenceByCard.get(card.id) ?? [],
            feedbackByCard.get(card.id) ?? null,
          )
        : null;
    })
    .filter((card): card is InsightCard => Boolean(card));
}

async function loadCurrentIntelligencePacketFromAppDb(input: {
  targetId: string;
  includeSourcePreview?: boolean;
}): Promise<ClientProjectIntelligencePacket | null> {
  return withAppDbClient(async (client) => {
    const packetResult = await client.query(
      `
        select *
        from public.intelligence_packets
        where target_id = $1
          and packet_type = 'current'
        order by generated_at desc nulls last
        limit 1
      `,
      [input.targetId],
    );
    const packet = packetResult.rows[0]
      ? (normalizeDbRow(packetResult.rows[0]) as IntelligencePacketRow)
      : null;
    if (!packet) return null;

    const cards = await loadPacketCardsFromAppDb(input);
    return mapPacket(packet, cards);
  });
}

async function loadPacketCardsFromAppDb(input: {
  targetId: string;
  includeCandidate?: boolean;
  includeSourcePreview?: boolean;
}): Promise<InsightCard[]> {
  return withAppDbClient(async (client) => {
    const packetResult = await client.query(
      `
        select id
        from public.intelligence_packets
        where target_id = $1
          and packet_type = 'current'
        order by generated_at desc nulls last
        limit 1
      `,
      [input.targetId],
    );
    const packetId = packetResult.rows[0]?.id;
    if (!packetId) return [];

    const packetCardsResult = await client.query(
      `
        select *
        from public.intelligence_packet_cards
        where packet_id = $1
        order by rank asc nulls last
      `,
      [packetId],
    );
    const packetCardRows = normalizeDbRows(packetCardsResult.rows) as IntelligencePacketCardRow[];
    const cardIds = Array.from(new Set(packetCardRows.map((row) => row.insight_card_id)));
    if (cardIds.length === 0) return [];

    const cardsResult = await client.query(
      `
        select *
        from public.insight_cards
        where id = any($1::uuid[])
          and ($2::boolean or attribution_status <> 'rejected')
      `,
      [cardIds, input.includeCandidate === true],
    );
    const evidenceResult = await client.query(
      `
        select *
        from public.insight_card_evidence
        where insight_card_id = any($1::uuid[])
        order by source_occurred_at desc nulls last
      `,
      [cardIds],
    );
    const evidenceRows = normalizeDbRows(evidenceResult.rows) as InsightCardEvidenceRow[];
    const sourceDocumentIds = input.includeSourcePreview === false
      ? []
      : Array.from(
          new Set(
            evidenceRows
              .map((row) => row.source_document_id)
              .filter((value): value is string => Boolean(value)),
          ),
        );
    const sourceDocumentRows = sourceDocumentIds.length > 0
      ? normalizeDbRows(
          (
            await client.query(
              `
                select id, type, category, summary, overview, description, notes, content, raw_text
                from public.document_metadata
                where id = any($1::text[])
              `,
              [sourceDocumentIds],
            )
          ).rows,
        ) as SourceDocumentPreview[]
      : [];
    const reviewRows = normalizeDbRows(
      (
        await client.query(
          `
            select *
            from public.intelligence_reviews
            where review_type = 'packet_card_feedback'
              and insight_card_id = any($1::uuid[])
            order by created_at desc nulls last
          `,
          [cardIds],
        )
      ).rows,
    ) as Database["public"]["Tables"]["intelligence_reviews"]["Row"][];

    return mapPacketCards({
      packetCardRows,
      cardRows: normalizeDbRows(cardsResult.rows) as InsightCardRow[],
      evidenceRows,
      sourceDocumentRows,
      reviewRows,
    });
  });
}

/**
 * Card types that belong on the Progress Log — the curated "decisions, risks,
 * issues, and AI flags" the timeline subtitle promises. Excludes high-volume,
 * low-signal types (project_update, task, sentiment, requirement, product_need,
 * process_issue, initiative_signal) that otherwise flood the log: a single
 * deeply-extracted meeting can emit 40-70 cards, and without this filter one
 * busy meeting day consumes the entire row limit and hides weeks of history.
 */
export const TIMELINE_EVENT_CARD_TYPES = [
  "decision",
  "risk",
  "schedule_risk",
  "financial_exposure",
  "blocker",
  "change_management",
  "open_question",
  "flag",
  "solution",
  "milestone",
] as const;

/**
 * Project intelligence "Progress Log" — curated event cards for a target,
 * most-recent-first by occurred_at, INDEPENDENT of any packet. This is the
 * running log of decisions/issues/risks/solutions/flags surfaced by the
 * synthesizer from meetings, emails, and Teams.
 */
export type ProjectTimelineEntry = {
  id: string;
  cardType: string;
  title: string;
  summary: string;
  whyItMatters: string | null;
  occurredAt: string | null;
  severity: number | null;
  currentStatus: string;
  suggestedOwnerLabel: string | null;
};

export async function loadProjectTimeline(input: {
  targetId: string;
  supabase: AlleatoSupabaseClient;
  limit?: number;
}): Promise<ProjectTimelineEntry[]> {
  try {
    const { data, error } = await input.supabase
      .from("insight_cards")
      .select(
        "id, card_type, title, summary, why_it_matters, occurred_at, severity, current_status, suggested_owner_label",
      )
      .eq("primary_target_id", input.targetId)
      .neq("attribution_status", "rejected")
      .in("card_type", [...TIMELINE_EVENT_CARD_TYPES])
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .limit(input.limit ?? 200);

    if (error) {
      throw new Error(`Failed to load project timeline: ${error.message}`);
    }

    return mapProjectTimelineRows(data ?? []);
  } catch (error) {
    try {
      return await loadProjectTimelineFromAppDb(input);
    } catch (fallbackError) {
      const primaryMessage = error instanceof Error ? error.message : String(error);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Failed to load project timeline: ${primaryMessage}; direct database fallback also failed: ${fallbackMessage}`,
      );
    }
  }
}

type ProjectTimelineRow = {
  id: string;
  card_type: string | null;
  title: string | null;
  summary: string | null;
  why_it_matters: string | null;
  occurred_at: string | null;
  severity: number | null;
  current_status: string | null;
  suggested_owner_label: string | null;
};

function mapProjectTimelineRows(rows: ProjectTimelineRow[]): ProjectTimelineEntry[] {
  return rows.map((row) => ({
    id: row.id,
    cardType: row.card_type ?? "",
    title: row.title ?? "",
    summary: row.summary ?? "",
    whyItMatters: row.why_it_matters,
    occurredAt: row.occurred_at,
    severity: row.severity,
    currentStatus: row.current_status ?? "",
    suggestedOwnerLabel: row.suggested_owner_label,
  }));
}

async function loadProjectTimelineFromAppDb(input: {
  targetId: string;
  limit?: number;
}): Promise<ProjectTimelineEntry[]> {
  return withAppDbClient(async (client) => {
    const result = await client.query(
      `
        select id, card_type, title, summary, why_it_matters, occurred_at, severity, current_status, suggested_owner_label
        from public.insight_cards
        where primary_target_id = $1
          and attribution_status <> 'rejected'
          and card_type = any($2::text[])
        order by occurred_at desc nulls last
        limit $3
      `,
      [input.targetId, [...TIMELINE_EVENT_CARD_TYPES], input.limit ?? 200],
    );

    return mapProjectTimelineRows(normalizeDbRows(result.rows) as ProjectTimelineRow[]);
  });
}
