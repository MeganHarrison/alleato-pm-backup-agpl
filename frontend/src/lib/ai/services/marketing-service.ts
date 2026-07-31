import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json, TablesInsert, TablesUpdate } from "@/types/database.types";

type Tables = Database["public"]["Tables"];

export type MarketingIntelligenceItem = Tables["marketing_intelligence_items"]["Row"];
export type MarketingContentCalendarItem = Tables["marketing_content_calendar_items"]["Row"];
export type MarketingContentAsset = Tables["marketing_content_assets"]["Row"];

export type MarketingCalendarStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";

export type MarketingAssetStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "revision_requested"
  | "published"
  | "archived";

export type MarketingSourceCandidate = {
  sourceTable: string;
  sourceId: string;
  sourceTitle: string;
  sourceDate: string | null;
  sourceUrl: string | null;
  projectId: number | null;
  projectName: string | null;
  summary: string;
  confidence: "low" | "medium" | "high";
  citationText: string;
};

export type MarketingCalendarReviewItem = MarketingContentCalendarItem & {
  assets: MarketingContentAsset[];
  sources: MarketingIntelligenceItem[];
};

export type CmoWeeklyContentWorkflowResult = {
  weekStartDate: string;
  sourceCandidates: MarketingSourceCandidate[];
  intelligenceItems: MarketingIntelligenceItem[];
  calendarItems: MarketingContentCalendarItem[];
  assets: MarketingContentAsset[];
  reviewHref: string;
};

export class MarketingServiceError extends Error {
  readonly action: string;
  readonly causeMessage: string;
  readonly prevention: string;

  constructor(params: {
    action: string;
    cause: string;
    prevention: string;
  }) {
    super(`${params.action} failed: ${params.cause}`);
    this.name = "MarketingServiceError";
    this.action = params.action;
    this.causeMessage = params.cause;
    this.prevention = params.prevention;
  }
}

function dbError(action: string, message: string): MarketingServiceError {
  return new MarketingServiceError({
    action,
    cause: message,
    prevention:
      "Check the marketing table migration, Supabase schema cache, RLS policies, and service-role configuration.",
  });
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function truncate(value: string, max = 420): string {
  return value.length > max ? `${value.slice(0, max - 1).trim()}...` : value;
}

function matchesTopics(candidate: MarketingSourceCandidate, topics: string[] | undefined): boolean {
  const terms = (topics ?? []).map((topic) => topic.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${candidate.sourceTitle} ${candidate.summary} ${candidate.projectName ?? ""}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function sourceEnabled(sourceTypes: string[] | undefined, sourceType: string): boolean {
  const normalized = (sourceTypes ?? []).map((type) => type.trim()).filter(Boolean);
  return normalized.length === 0 || normalized.includes(sourceType);
}

function asJson(value: unknown): Json {
  return value as Json;
}

export async function findMarketingSourceCandidates(params: {
  dateRange?: { start?: string; end?: string };
  projectId?: number | null;
  topics?: string[];
  sourceTypes?: string[];
  limit?: number;
} = {}): Promise<MarketingSourceCandidate[]> {
  const supabase = createServiceClient();
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 40);
  const candidates: MarketingSourceCandidate[] = [];

  if (sourceEnabled(params.sourceTypes, "document_metadata")) {
    let query = serviceDb.from("document_metadata")
      .select("id,title,summary,overview,notes,date,captured_at,project_id,project,source_web_url,url,type,source_system")
      .order("date", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (params.projectId != null) query = query.eq("project_id", params.projectId);
    if (params.dateRange?.start) query = query.gte("date", params.dateRange.start);
    if (params.dateRange?.end) query = query.lte("date", params.dateRange.end);
    const { data, error } = await query;
    if (error) throw dbError("findMarketingSourceCandidates.document_metadata", error.message);

    for (const row of data ?? []) {
      const sourceTitle = nonEmpty(row.title) ?? nonEmpty(row.type) ?? "Document source";
      const summary = nonEmpty(row.summary) ?? nonEmpty(row.overview) ?? nonEmpty(row.notes);
      if (!summary) continue;
      candidates.push({
        sourceTable: "document_metadata",
        sourceId: row.id,
        sourceTitle,
        sourceDate: row.date ?? row.captured_at ?? null,
        sourceUrl: row.source_web_url ?? row.url ?? null,
        projectId: row.project_id ?? null,
        projectName: row.project ?? null,
        summary: truncate(summary),
        confidence: row.project_id ? "high" : "medium",
        citationText: `${sourceTitle}${row.date ? ` (${row.date})` : ""}`,
      });
    }
  }

  // Pipeline B: pull marketing-relevant source candidates from insight_cards.
  // We accept both the legacy "ai_insights" source-type key (kept for backwards
  // compatibility with callers) and the new "insight_cards" key.
  if (
    sourceEnabled(params.sourceTypes, "ai_insights") ||
    sourceEnabled(params.sourceTypes, "insight_cards")
  ) {
    const marketingCardTypes = [
      "project_update",
      "decision",
      "change_management",
    ];

    let query = serviceDb.from("insight_cards")
      .select(
        "id,title,summary,why_it_matters,created_at,last_seen_at,card_type,confidence,attribution_status,primary_target_id,intelligence_targets:primary_target_id(id,project_id,name)",
      )
      .neq("attribution_status", "rejected")
      .in("card_type", marketingCardTypes)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (params.dateRange?.start) query = query.gte("created_at", params.dateRange.start);
    if (params.dateRange?.end) query = query.lte("created_at", params.dateRange.end);

    const { data, error } = await query;
    if (error) throw dbError("findMarketingSourceCandidates.insight_cards", error.message);

    type InsightCardRow = {
      id: string;
      title: string;
      summary: string | null;
      why_it_matters: string | null;
      created_at: string | null;
      last_seen_at: string | null;
      card_type: string;
      confidence: string;
      intelligence_targets: { id: string; project_id: number | null; name: string | null } | null;
    };

    for (const rawRow of data ?? []) {
      const row = rawRow as unknown as InsightCardRow;
      const target = row.intelligence_targets ?? null;
      const rowProjectId = target?.project_id ?? null;

      if (params.projectId != null && rowProjectId !== params.projectId) continue;

      const summary = nonEmpty(row.summary) ?? nonEmpty(row.why_it_matters);
      if (!summary) continue;

      const projectName = target?.name ?? null;
      const conf: "low" | "medium" | "high" =
        row.confidence === "high" || row.confidence === "medium"
          ? (row.confidence as "high" | "medium")
          : "low";

      candidates.push({
        sourceTable: "insight_cards",
        sourceId: row.id,
        sourceTitle: nonEmpty(row.title) ?? "AI insight",
        sourceDate: row.last_seen_at ?? row.created_at ?? null,
        sourceUrl: null,
        projectId: rowProjectId,
        projectName,
        summary: truncate(summary),
        confidence: conf,
        citationText: `${row.title}${projectName ? ` - ${projectName}` : ""}`,
      });
    }
  }

  if (sourceEnabled(params.sourceTypes, "projects")) {
    let query = serviceDb.from("projects")
      .select("id,name,company_id,phase,stage,health_status,summary,summary_updated_at,project_sector")
      .order("summary_updated_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (params.projectId != null) query = query.eq("id", params.projectId);
    const { data, error } = await query;
    if (error) throw dbError("findMarketingSourceCandidates.projects", error.message);

    for (const row of data ?? []) {
      const summary = nonEmpty(row.summary);
      if (!summary) continue;
      const sourceTitle = nonEmpty(row.name) ?? `Project ${row.id}`;
      candidates.push({
        sourceTable: "projects",
        sourceId: String(row.id),
        sourceTitle,
        sourceDate: row.summary_updated_at ?? null,
        sourceUrl: `/${row.id}/home`,
        projectId: row.id,
        projectName: row.name ?? null,
        summary: truncate(summary),
        confidence: "medium",
        citationText: sourceTitle,
      });
    }
  }

  return candidates
    .filter((candidate) => matchesTopics(candidate, params.topics))
    .slice(0, limit);
}

export async function createMarketingIntelligenceItem(
  input: TablesInsert<"marketing_intelligence_items">,
): Promise<MarketingIntelligenceItem> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("marketing_intelligence_items")
    .insert(input)
    .select("*")
    .single();
  if (error || !data) {
    throw dbError("createMarketingIntelligenceItem", error?.message ?? "insert returned no row");
  }
  return data;
}

export async function createContentCalendarDraft(params: {
  weekStartDate: string;
  createdBy?: string | null;
  items: Array<Omit<TablesInsert<"marketing_content_calendar_items">, "created_by" | "planned_date"> & {
    plannedDate?: string;
  }>;
}): Promise<MarketingContentCalendarItem[]> {
  if (params.items.length === 0) {
    throw new MarketingServiceError({
      action: "createContentCalendarDraft",
      cause: "No content calendar items were provided.",
      prevention: "Have the CMO generate at least one sourced calendar item before persisting the draft.",
    });
  }

  const rows: TablesInsert<"marketing_content_calendar_items">[] = params.items.map((item) => {
    const { plannedDate, ...dbItem } = item;
    return {
      ...dbItem,
      planned_date: plannedDate ?? params.weekStartDate,
      created_by: params.createdBy ?? null,
      metadata: dbItem.metadata ?? {},
      source_item_ids: dbItem.source_item_ids ?? [],
      status: dbItem.status ?? "needs_review",
    };
  });

  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("marketing_content_calendar_items")
    .insert(rows)
    .select("*");
  if (error || !data) {
    throw dbError("createContentCalendarDraft", error?.message ?? "insert returned no rows");
  }
  return data;
}

export async function createMarketingContentAsset(
  input: TablesInsert<"marketing_content_assets">,
): Promise<MarketingContentAsset> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("marketing_content_assets")
    .insert({
      ...input,
      source_citations: input.source_citations ?? [],
      status: input.status ?? "needs_review",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw dbError("createMarketingContentAsset", error?.message ?? "insert returned no row");
  }
  return data;
}

export async function getMarketingCalendar(params: {
  dateRange?: { start?: string; end?: string };
  status?: string | null;
  projectId?: number | null;
  limit?: number;
} = {}): Promise<MarketingCalendarReviewItem[]> {
  const supabase = createServiceClient();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

  let query = serviceDb.from("marketing_content_calendar_items")
    .select("*")
    .order("planned_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (params.status) query = query.eq("status", params.status);
  if (params.projectId != null) query = query.eq("project_id", params.projectId);
  if (params.dateRange?.start) query = query.gte("planned_date", params.dateRange.start);
  if (params.dateRange?.end) query = query.lte("planned_date", params.dateRange.end);

  const { data: calendarItems, error } = await query;
  if (error) throw dbError("getMarketingCalendar.calendar", error.message);
  if (!calendarItems || calendarItems.length === 0) return [];

  const calendarIds = calendarItems.map((item) => item.id);
  const sourceIds = [...new Set(calendarItems.flatMap((item) => item.source_item_ids ?? []))];

  const [{ data: assets, error: assetsError }, { data: sources, error: sourcesError }] = await Promise.all([
    serviceDb.from("marketing_content_assets")
      .select("*")
      .in("calendar_item_id", calendarIds)
      .order("created_at", { ascending: true }),
    sourceIds.length > 0
      ? serviceDb.from("marketing_intelligence_items")
          .select("*")
          .in("id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (assetsError) throw dbError("getMarketingCalendar.assets", assetsError.message);
  if (sourcesError) throw dbError("getMarketingCalendar.sources", sourcesError.message);

  const assetsByCalendar = new Map<string, MarketingContentAsset[]>();
  for (const asset of assets ?? []) {
    const list = assetsByCalendar.get(asset.calendar_item_id) ?? [];
    list.push(asset);
    assetsByCalendar.set(asset.calendar_item_id, list);
  }

  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));
  return calendarItems.map((item) => ({
    ...item,
    assets: assetsByCalendar.get(item.id) ?? [],
    sources: (item.source_item_ids ?? [])
      .map((sourceId) => sourceById.get(sourceId))
      .filter((source): source is MarketingIntelligenceItem => Boolean(source)),
  }));
}

export async function updateMarketingCalendarItem(
  calendarItemId: string,
  updates: TablesUpdate<"marketing_content_calendar_items">,
): Promise<MarketingContentCalendarItem> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("marketing_content_calendar_items")
    .update(updates)
    .eq("id", calendarItemId)
    .select("*")
    .single();
  if (error || !data) {
    throw dbError("updateMarketingCalendarItem", error?.message ?? "update returned no row");
  }
  return data;
}

export async function updateMarketingContentAsset(
  assetId: string,
  updates: TablesUpdate<"marketing_content_assets">,
): Promise<MarketingContentAsset> {
  const supabase = createServiceClient();
  const { data, error } = await serviceDb.from("marketing_content_assets")
    .update(updates)
    .eq("id", assetId)
    .select("*")
    .single();
  if (error || !data) {
    throw dbError("updateMarketingContentAsset", error?.message ?? "update returned no row");
  }
  return data;
}

export function candidateToIntelligenceInsert(params: {
  candidate: MarketingSourceCandidate;
  itemType?: string;
  createdBy?: string | null;
}): TablesInsert<"marketing_intelligence_items"> {
  return {
    source_table: params.candidate.sourceTable,
    source_id: params.candidate.sourceId,
    source_url: params.candidate.sourceUrl,
    source_title: params.candidate.sourceTitle,
    source_date: params.candidate.sourceDate,
    project_id: params.candidate.projectId,
    item_type: params.itemType ?? "campaign_idea",
    title: params.candidate.sourceTitle,
    summary: params.candidate.summary,
    strategic_rationale: "Candidate surfaced for CMO weekly content planning.",
    recommended_use: asJson(["content calendar", "draft asset"]),
    confidence: params.candidate.confidence,
    status: "new",
    metadata: asJson({
      projectName: params.candidate.projectName,
      citationText: params.candidate.citationText,
    }),
    created_by: params.createdBy ?? null,
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function utcDateOnly(fromDate: Date): Date {
  return new Date(Date.UTC(
    fromDate.getUTCFullYear(),
    fromDate.getUTCMonth(),
    fromDate.getUTCDate(),
  ));
}

function nextMonday(fromDate = new Date()): string {
  const date = utcDateOnly(fromDate);
  const day = date.getUTCDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  return isoDate(addDays(date, daysUntilMonday));
}

function recentWindowStart(fromDate = new Date()): string {
  return isoDate(addDays(utcDateOnly(fromDate), -14));
}

function classifyCandidate(
  candidate: MarketingSourceCandidate,
): TablesInsert<"marketing_intelligence_items">["item_type"] {
  const haystack = `${candidate.sourceTitle} ${candidate.summary}`.toLowerCase();
  if (/\bowner|client|weekly report|update\b/.test(haystack)) return "owner_update";
  if (/\bwin|milestone|complete|turnover|award|praised|praise\b/.test(haystack)) return "project_win";
  if (/\bleadership|brandon|positioning|strategy|thought\b/.test(haystack)) return "leadership_thought";
  return "campaign_idea";
}

function plannedDateForIndex(weekStartDate: string, index: number): string {
  const start = new Date(`${weekStartDate}T00:00:00.000Z`);
  return isoDate(addDays(start, index));
}

function draftTitle(candidate: MarketingSourceCandidate, index: number): string {
  const prefixes = [
    "Project progress spotlight",
    "Owner update takeaway",
    "Field execution note",
    "Leadership perspective",
    "Weekly credibility proof",
  ];
  return `${prefixes[index % prefixes.length]}: ${candidate.sourceTitle}`;
}

function draftAngle(candidate: MarketingSourceCandidate): string {
  const project = candidate.projectName ? `${candidate.projectName}: ` : "";
  return `${project}${candidate.summary}`;
}

function draftAssetBody(params: {
  candidate: MarketingSourceCandidate;
}): string {
  const projectLead = params.candidate.projectName
    ? `On ${params.candidate.projectName}, `
    : "This week, ";
  return [
    `${projectLead}${params.candidate.summary}`,
    "",
    "Why it matters: steady execution is easiest to trust when progress is specific, sourced, and easy for owners to review.",
    "",
    `Source for review: ${params.candidate.citationText}.`,
    "",
    "Status: draft for internal CMO review. Do not publish until approved.",
  ].join("\n");
}

function assetTypeForChannel(
  channel: MarketingContentCalendarItem["channel"],
): TablesInsert<"marketing_content_assets">["asset_type"] {
  if (channel === "email") return "email_draft";
  if (channel === "blog" || channel === "website") return "blog_outline";
  if (channel === "case_study") return "case_study_outline";
  if (channel === "video") return "video_script";
  return "linkedin_post";
}

function marketingRelevanceScore(candidate: MarketingSourceCandidate): number {
  const haystack = `${candidate.sourceTitle} ${candidate.summary} ${candidate.projectName ?? ""}`.toLowerCase();
  const strongTerms = [
    "owner",
    "weekly report",
    "project win",
    "milestone",
    "progress",
    "completion",
    "turnover",
    "testing",
    "riser",
    "walkthrough",
    "site video",
    "field update",
    "client",
  ];
  const supportTerms = [
    "project",
    "huddle",
    "meeting prep",
    "procurement",
    "schedule",
    "manpower",
    "install",
    "installation",
    "fire protection",
  ];
  let score = candidate.projectName ? 2 : 0;
  for (const term of strongTerms) {
    if (haystack.includes(term)) score += 3;
  }
  for (const term of supportTerms) {
    if (haystack.includes(term)) score += 1;
  }
  return score;
}

function selectMarketingWorkflowCandidates(
  candidates: MarketingSourceCandidate[],
  limit: number,
): MarketingSourceCandidate[] {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({
      candidate,
      score: marketingRelevanceScore(candidate),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter(({ candidate }) => {
      const key = `${candidate.sourceTable}:${candidate.projectId ?? "none"}:${candidate.sourceTitle.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export async function createWeeklyMarketingContentWorkflow(params: {
  createdBy: string;
  projectId?: number | null;
  weekStartDate?: string;
  now?: Date;
  limit?: number;
}): Promise<CmoWeeklyContentWorkflowResult> {
  const now = params.now ?? new Date();
  const weekStartDate = params.weekStartDate ?? nextMonday(now);
  const sourceCandidates = await findMarketingSourceCandidates({
    dateRange: {
      start: recentWindowStart(now),
      end: isoDate(now),
    },
    projectId: params.projectId ?? null,
    limit: params.limit ?? 5,
  });
  const selectedCandidates = selectMarketingWorkflowCandidates(
    sourceCandidates,
    params.limit ?? 5,
  );

  if (selectedCandidates.length === 0) {
    throw new MarketingServiceError({
      action: "createWeeklyMarketingContentWorkflow",
      cause: "No recent project, owner, progress, or milestone-backed marketing candidates were found.",
      prevention:
        "Confirm recent source ingestion is healthy or broaden the date/project scope before asking the CMO to create a weekly content calendar.",
    });
  }

  const intelligenceItems: MarketingIntelligenceItem[] = [];
  for (const candidate of selectedCandidates) {
    const item = await createMarketingIntelligenceItem(
      candidateToIntelligenceInsert({
        candidate,
        itemType: classifyCandidate(candidate),
        createdBy: params.createdBy,
      }),
    );
    intelligenceItems.push(item);
  }

  const channels: MarketingContentCalendarItem["channel"][] = [
    "linkedin",
    "email",
    "website",
    "linkedin",
    "internal",
  ];
  const funnelStages: MarketingContentCalendarItem["funnel_stage"][] = [
    "awareness",
    "retention",
    "reputation",
    "consideration",
    "reputation",
  ];

  const calendarItems = await createContentCalendarDraft({
    weekStartDate,
    createdBy: params.createdBy,
    items: intelligenceItems.map((item, index) => {
      const candidate = selectedCandidates[index];
      return {
        plannedDate: plannedDateForIndex(weekStartDate, index),
        channel: channels[index % channels.length],
        funnel_stage: funnelStages[index % funnelStages.length],
        title: draftTitle(candidate, index),
        angle: draftAngle(candidate),
        target_audience:
          index % 2 === 0
            ? "Owners, developers, and prospective clients"
            : "Existing clients and referral partners",
        project_id: candidate.projectId ?? params.projectId ?? null,
        source_item_ids: [item.id],
        rationale:
          "CMO Phase 1 selected this source because it contains recent operational proof that can become reviewable marketing content.",
        status: "needs_review",
        metadata: asJson({
          generatedBy: "cmo_phase1_weekly_workflow",
          sourceTable: candidate.sourceTable,
          sourceId: candidate.sourceId,
          citationText: candidate.citationText,
        }),
      };
    }),
  });

  const assets: MarketingContentAsset[] = [];
  for (const [index, calendarItem] of calendarItems.entries()) {
    const candidate = selectedCandidates[index];
    const asset = await createMarketingContentAsset({
      calendar_item_id: calendarItem.id,
      asset_type: assetTypeForChannel(calendarItem.channel),
      title: `Draft asset: ${calendarItem.title}`,
      body: draftAssetBody({ candidate }),
      source_citations: asJson([
        {
          sourceTable: candidate.sourceTable,
          sourceId: candidate.sourceId,
          title: candidate.sourceTitle,
          url: candidate.sourceUrl,
        },
      ]),
      status: "needs_review",
      created_by: params.createdBy,
    });
    assets.push(asset);
  }

  return {
    weekStartDate,
    sourceCandidates: selectedCandidates,
    intelligenceItems,
    calendarItems,
    assets,
    reviewHref: "/ai-assistant/marketing",
  };
}
