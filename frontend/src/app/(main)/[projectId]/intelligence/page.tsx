export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, GitCommitHorizontal, HelpCircle } from "lucide-react";

import { Button, EmptyState, ErrorState, SectionHeader } from "@/components/ds";
import { InsightCardShowcase } from "@/components/ai-intelligence/insight-card-showcase";
import {
  SourceReferenceButton,
  type SourceReferenceRecord,
} from "@/components/ai-intelligence/source-reference-button";
import { DetailLayout, LabelValueRow, PageShell, SectionRuleHeading } from "@/components/layout";
import { DailyIngestionFeed } from "@/features/intelligence/daily-ingestion-feed";
import { ProjectIntelligenceWorkflow } from "@/features/intelligence/project-intelligence-workflow";
import {
  DailyDeepReadCandidateReview,
  type DailyDeepReadReviewCandidate,
} from "@/features/intelligence/daily-deep-read-candidate-review";
import { buildIntelligencePageState } from "@/lib/ai/intelligence/page-state";
import {
  loadCurrentIntelligencePacket,
  loadCurrentIntelligencePacketBySlug,
  resolveIntelligenceTarget,
} from "@/lib/ai/intelligence/packet-service";
import { loadCurrentDailyExecutiveBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import type {
  ClientProjectIntelligencePacket,
  InsightCard,
  InsightCardEvidence,
} from "@/lib/ai/intelligence/types";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import {
  createOutlookIntakeServiceClient,
  createRagServiceClient,
  createServiceClient,
  isRagDatabaseReadsEnabled,
} from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "project_number" | "budget" | "budget_used" | "phase" | "stage" | "summary" | "work_scope" | "type"
>;

type InternalTaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "description" | "status" | "due_date" | "priority" | "assignee_name" | "created_at"
>;

type SourceDocumentRow = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  | "id"
  | "title"
  | "type"
  | "category"
  | "source"
  | "source_system"
  | "date"
  | "created_at"
  | "summary"
  | "overview"
  | "description"
  | "notes"
  | "content"
  | "raw_text"
  | "source_web_url"
  | "fireflies_link"
  | "meeting_link"
  | "url"
  | "participants"
  | "participants_array"
  | "source_metadata"
>;

type RagSourceDocumentRow = Pick<
  import("@/types/rag-database.types").Database["public"]["Tables"]["rag_document_metadata"]["Row"],
  "id" | "title" | "type" | "category" | "source" | "source_system" | "summary" | "overview" | "content" | "raw_text" | "source_web_url" | "url"
>;

type OutlookAttachmentLinkRow = Pick<
  Database["public"]["Tables"]["outlook_email_intake_attachments"]["Row"],
  "document_metadata_id" | "email_attachment_id" | "content_type" | "file_name"
>;

type StrategicItem = {
  title: string;
  detail?: string;
  sourceIds: string[];
  occurredAt?: string;
  fields: Record<string, string>;
};

type StatusTone = "healthy" | "watch" | "risk";

type OperatingSnapshotRow = {
  id: string;
  project_id: number;
  snapshot_at: string;
  source_delta_id: string | null;
  source_coverage: Record<string, unknown>;
  financial_snapshot: Record<string, unknown>;
  schedule_snapshot: Record<string, unknown>;
  database_counts: Record<string, unknown>;
  project_info: Record<string, unknown>;
  acumatica_sync_at: string | null;
  freshness: Record<string, unknown>;
  warnings: unknown[];
  confidence: "high" | "medium" | "low" | "unknown";
};

type ProjectCurrentStateRow = {
  project_id: number;
  current_summary: string | null;
  health_status: "on_track" | "watch" | "at_risk" | "critical" | "unknown";
  what_changed_since_last_update: unknown[];
  needs_attention: unknown[];
  open_decisions: unknown[];
  active_risks: unknown[];
  financial_read: string | null;
  schedule_read: string | null;
  field_read: string | null;
  source_confidence: Record<string, unknown>;
  last_delta_id: string | null;
  last_snapshot_id: string | null;
  updated_at: string;
};

type OperatingTimelineEventRow = {
  id: string;
  project_id: number;
  event_at: string;
  event_type: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  current_status: string;
  owner_label: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  source_synthesis_id: string | null;
  source_document_id: string | null;
  related_record_type: string | null;
  related_record_id: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
};

type ChangeEventCandidateRow = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  potential_cost_impact: string | null;
  potential_schedule_impact: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
  missing_information: unknown[];
  status: string;
};

type DailyDeepReadCandidateRow = Pick<
  import("@/types/rag-database.types").Database["public"]["Tables"]["source_signal_candidates"]["Row"],
  | "id"
  | "signal_type"
  | "title"
  | "summary"
  | "why_it_matters"
  | "status"
  | "confidence"
  | "next_action"
  | "excerpt"
  | "extraction_json"
  | "created_at"
>;

type ProjectReportSuggestionRow = {
  id: string;
  report_type: string;
  business_date: string | null;
  week_start_date: string | null;
  title: string;
  suggestion_payload: Record<string, unknown>;
  status: string;
  confidence: "high" | "medium" | "low" | "unknown";
};

type OperatingRecordState = {
  currentState: ProjectCurrentStateRow | null;
  latestSnapshot: OperatingSnapshotRow | null;
  timelineEvents: OperatingTimelineEventRow[];
  changeEventCandidates: ChangeEventCandidateRow[];
  dailyDeepReadCandidates: DailyDeepReadCandidateRow[];
  dailyDeepReadCandidateError: string | null;
  reportSuggestions: ProjectReportSuggestionRow[];
};

type DashboardActionItem = {
  key: string;
  title: string;
  detail?: string;
  meta: string;
  href: string;
  ctaLabel: string;
  tone: StatusTone;
};

function formatLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\[message:[^\]]+\]/gi, "")
    .replace(/\[\d{4}-\d{2}-\d{2}[^\]]+\]/g, "")
    .replace(/(?:^|\s)#{1,6}\s+/gm, " ")
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeText(value: string | null | undefined, maxLength = 260): string {
  const text = cleanText(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSentence = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
  if (lastSentence > 120) return truncated.slice(0, lastSentence + 1);
  return `${truncated.trim()}...`;
}

/**
 * A synthesized "read" is never a raw email/source dump. When the intelligence
 * pipeline copies a source document verbatim (header, From:/To:, &nbsp; junk,
 * signature) instead of summarizing it, we must NOT render that as if it were an
 * executive summary. Detect the telltale structure so the dashboard refuses to
 * surface garbage. (Root cause is a backend synthesis bug affecting ~20 projects
 * plus ~22% of insight_cards and ~44% of timeline_events; this is the
 * display-side guardrail until that is fixed.)
 */
function looksLikeRawSource(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return false;
  if (/^\s*subject:\s/i.test(text)) return true;
  if (/\bfrom:\s*[^\s@]+@/i.test(text) && /\bto:\s*[^\s@]+@/i.test(text)) return true;
  // Multiple raw &nbsp; entities = un-processed source HTML, never a clean summary.
  if ((text.match(/&nbsp;/gi) ?? []).length >= 2) return true;
  return false;
}

/** Synthesized narrative, or empty string — never a raw source dump. */
function safeNarrative(value: string | null | undefined, maxLength = 260): string {
  if (looksLikeRawSource(value)) return "";
  return summarizeText(value, maxLength);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function moneyField(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanUnknown(value: unknown): string {
  return cleanText(typeof value === "string" || typeof value === "number" ? String(value) : "");
}

function summaryRecord(packet: ClientProjectIntelligencePacket): Record<string, unknown> {
  return asRecord(asRecord(packet.packetJson).summary);
}

function sourceAliases(index: number): string[] {
  return [`S${String(index).padStart(3, "0")}`, `S${String(index).padStart(2, "0")}`, `S${index}`];
}

function packetSourceAliasMap(packet: ClientProjectIntelligencePacket): Map<string, string> {
  const sourceSet = asRecord(asRecord(packet.packetJson).sourceSet);
  const sources = Array.isArray(sourceSet.sources) ? sourceSet.sources : [];
  const map = new Map<string, string>();
  sources.forEach((source, index) => {
    const record = asRecord(source);
    const sourceId = cleanUnknown(record.id);
    if (!sourceId) return;
    for (const alias of sourceAliases(index + 1)) { map.set(alias, sourceId); }
    map.set(sourceId, sourceId);
  });
  return map;
}

function citedSourceIds(record: Record<string, unknown>): string[] {
  return (Array.isArray(record.sourceIds) ? record.sourceIds : []).map((value) => cleanUnknown(value)).filter(Boolean);
}

function candidateSourceIds(candidate: DailyDeepReadCandidateRow): string[] {
  const metadata = asRecord(candidate.extraction_json);
  const sourceIds = metadata.source_ids ?? metadata.sourceIds;
  return (Array.isArray(sourceIds) ? sourceIds : []).map((value) => cleanUnknown(value)).filter(Boolean);
}

function stripCandidateCitationNoise(value: string | null | undefined): string {
  return cleanText(value)
    .replace(/\[[^\]]*(?:outlook|teams?|fireflies|email|transcript|AAAA|MTA)[^\]]*\]/gi, "")
    .replace(/\b(?:outlook|teams?|fireflies|email|transcript)[A-Za-z0-9._:-]{16,}\b/gi, "")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "")
    .replace(/[\[\]]+/g, "")
    .replace(/\s+[,:;.-]*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateDisplayText(value: string | null | undefined, maxLength = 260): string {
  const stripped = stripCandidateCitationNoise(value);
  if (!stripped) return "";
  if (/^candidate:?\s*[\W_]*$/i.test(stripped)) return "";
  if (looksLikeRawSource(stripped)) return "";
  return summarizeText(stripped, maxLength);
}

function narrativeItemsFromUnknown(
  value: unknown,
  detailKeys: string[],
  fieldKeys: string[] = [],
): StrategicItem[] {
  return (Array.isArray(value) ? value : [])
    .map((item): StrategicItem | null => {
      const record = asRecord(item);
      const title = cleanUnknown(record.title);
      if (!title) return null;
      const detail = detailKeys.map((detailKey) => cleanUnknown(record[detailKey])).filter(Boolean).join(" ");
      const fields = Object.fromEntries(
        fieldKeys
          .map((fieldKey) => [fieldKey, cleanUnknown(record[fieldKey])])
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      );
      return {
        title,
        detail: detail || undefined,
        sourceIds: citedSourceIds(record),
        occurredAt: cleanUnknown(record.occurredAt || record.date) || undefined,
        fields,
      };
    })
    .filter((item): item is StrategicItem => Boolean(item));
}

function summaryItems(
  packet: ClientProjectIntelligencePacket,
  key: string,
  detailKeys: string[],
  fieldKeys: string[] = [],
): StrategicItem[] {
  return narrativeItemsFromUnknown(summaryRecord(packet)[key], detailKeys, fieldKeys);
}

function packetEvidence(packet: ClientProjectIntelligencePacket): InsightCardEvidence[] {
  return packet.cards.flatMap((card) => card.evidence);
}

function sourceReferenceRecord(source: SourceDocumentRow, projectId: number): SourceReferenceRecord {
  const sourceMetadata = asRecord(source.source_metadata);
  const attachmentId =
    typeof sourceMetadata.email_attachment_id === "number"
      ? sourceMetadata.email_attachment_id
      : typeof sourceMetadata.email_attachment_id === "string"
        ? Number.parseInt(sourceMetadata.email_attachment_id, 10)
        : null;

  return {
    id: source.id,
    title: source.title,
    type: source.type,
    category: source.category,
    source: source.source,
    sourceSystem: source.source_system,
    date: source.date,
    createdAt: source.created_at,
    summary: source.summary,
    overview: source.overview,
    description: source.description,
    notes: source.notes,
    content: source.content,
    rawText: source.raw_text,
    sourceWebUrl: source.source_web_url,
    firefliesLink: source.fireflies_link,
    meetingLink: source.meeting_link,
    url: source.url,
    participants: source.participants_array?.length
      ? source.participants_array
      : source.participants
        ? source.participants
            .replace(/[{}"]/g, "")
            .split(/[,;|\n]+/)
            .map((participant) => participant.trim())
            .filter(Boolean)
        : [],
    attachmentDownloadUrl:
      typeof attachmentId === "number" && Number.isInteger(attachmentId)
        ? `/api/projects/${projectId}/email-attachments/${attachmentId}/download?disposition=inline`
        : null,
    attachmentContentType:
      typeof sourceMetadata.attachment_content_type === "string" ? sourceMetadata.attachment_content_type : null,
    attachmentFileName:
      typeof sourceMetadata.attachment_file_name === "string" ? sourceMetadata.attachment_file_name : source.title,
  };
}

function sourceButtonLabel(source: SourceDocumentRow): string {
  const primary = cleanText(source.title);
  if (primary) return primary.length > 44 ? `${primary.slice(0, 41).trim()}...` : primary;
  return [formatLabel(source.category || source.type || "Source"), formatDate(source.date || source.created_at)]
    .filter(Boolean)
    .join(" ");
}

function mergeSourceDocumentRows(source: SourceDocumentRow, ragSource?: RagSourceDocumentRow): SourceDocumentRow {
  if (!ragSource) return source;
  return {
    ...source,
    title: ragSource.title || source.title,
    type: ragSource.type || source.type,
    category: ragSource.category || source.category,
    source: ragSource.source || source.source,
    source_system: ragSource.source_system || source.source_system,
    summary: ragSource.summary || source.summary,
    overview: ragSource.overview || source.overview,
    content: ragSource.content || source.content,
    raw_text: ragSource.raw_text || source.raw_text,
    source_web_url: ragSource.source_web_url || source.source_web_url,
    url: ragSource.url || source.url,
  };
}

type UntypedSupabaseQuery = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}> & {
  select: (columns?: string) => UntypedSupabaseQuery;
  eq: (column: string, value: unknown) => UntypedSupabaseQuery;
  in: (column: string, values: unknown[]) => UntypedSupabaseQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedSupabaseQuery;
  limit: (count: number) => UntypedSupabaseQuery;
};

type UntypedSupabaseReader = {
  from: (table: string) => UntypedSupabaseQuery;
};

async function loadDailyDeepReadCandidates(projectId: number): Promise<{
  candidates: DailyDeepReadCandidateRow[];
  error: string | null;
}> {
  if (!isRagDatabaseReadsEnabled()) return { candidates: [], error: null };

  let currentPacketId: string;
  try {
    currentPacketId = (await loadCurrentDailyExecutiveBriefPacket()).id;
  } catch (error) {
    return {
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const ragSupabase = createRagServiceClient();
  const result = await ragSupabase
    .from("source_signal_candidates")
    .select(
      "id, signal_type, title, summary, why_it_matters, status, confidence, next_action, excerpt, extraction_json, created_at",
    )
    .eq("project_id", projectId)
    .eq("compiler_version", "daily_deep_read_consumers_v1")
    .eq("extraction_json->>daily_packet_id", currentPacketId)
    .in("status", ["needs_review", "candidate"])
    .order("created_at", { ascending: false })
    .limit(12);

  if (result.error) {
    return { candidates: [], error: result.error.message };
  }

  return {
    candidates: ((result.data ?? []) as DailyDeepReadCandidateRow[]) ?? [],
    error: null,
  };
}

async function loadOperatingRecordState(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: number,
): Promise<OperatingRecordState> {
  const db = supabase as unknown as UntypedSupabaseReader;

  const currentStateResult = await db
    .from("project_current_state")
    .select("*")
    .eq("project_id", projectId)
    .limit(1);
  const currentState = ((currentStateResult.data ?? [])[0] ?? null) as ProjectCurrentStateRow | null;

  const snapshotQuery = db
    .from("project_operating_snapshots")
    .select("*")
    .eq("project_id", projectId);
  const snapshotResult = currentState?.last_snapshot_id
    ? await snapshotQuery.eq("id", currentState.last_snapshot_id).limit(1)
    : await snapshotQuery.order("snapshot_at", { ascending: false }).limit(1);
  const latestSnapshot = ((snapshotResult.data ?? [])[0] ?? null) as OperatingSnapshotRow | null;

  const timelineResult = await db
    .from("project_intelligence_timeline_events")
    .select(
      "id, project_id, event_at, event_type, title, summary, why_it_matters, current_status, owner_label, priority, source_synthesis_id, source_document_id, related_record_type, related_record_id, confidence",
    )
    .eq("project_id", projectId)
    .order("event_at", { ascending: false })
    .limit(40);

  const changeCandidatesResult = await db
    .from("change_event_candidates")
    .select(
      "id, title, description, reason, potential_cost_impact, potential_schedule_impact, confidence, missing_information, status",
    )
    .eq("project_id", projectId)
    .in("status", ["candidate", "reviewing", "draft_created"])
    .order("created_at", { ascending: false })
    .limit(8);

  const reportSuggestionsResult = await db
    .from("project_report_suggestions")
    .select("id, report_type, business_date, week_start_date, title, suggestion_payload, status, confidence")
    .eq("project_id", projectId)
    .in("status", ["suggested", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(8);
  const dailyDeepReadCandidatesResult = await loadDailyDeepReadCandidates(projectId);

  return {
    currentState,
    latestSnapshot,
    timelineEvents: ((timelineResult.data ?? []) as OperatingTimelineEventRow[]) ?? [],
    changeEventCandidates: ((changeCandidatesResult.data ?? []) as ChangeEventCandidateRow[]) ?? [],
    dailyDeepReadCandidates: dailyDeepReadCandidatesResult.candidates,
    dailyDeepReadCandidateError: dailyDeepReadCandidatesResult.error,
    reportSuggestions: ((reportSuggestionsResult.data ?? []) as ProjectReportSuggestionRow[]) ?? [],
  };
}

async function loadSourceDocumentMap(
  supabase: ReturnType<typeof createServiceClient>,
  evidenceSourceIds: string[],
): Promise<Map<string, SourceDocumentRow>> {
  if (evidenceSourceIds.length === 0) return new Map();

  const ragSupabase = isRagDatabaseReadsEnabled() ? createRagServiceClient() : null;
  const intakeSupabase = createOutlookIntakeServiceClient();
  const sourceDocumentsResult = await supabase
    .from("document_metadata")
    .select(
      "id, title, type, category, source, source_system, date, created_at, summary, overview, description, notes, content, raw_text, source_web_url, fireflies_link, meeting_link, url, participants, participants_array",
    )
    .in("id", evidenceSourceIds);
  const ragSourceDocumentsResult = ragSupabase
    ? await ragSupabase
        .from("rag_document_metadata")
        .select("id, title, type, category, source, source_system, summary, overview, content, raw_text, source_web_url, url")
        .in("id", evidenceSourceIds)
    : { data: [], error: null };
  const attachmentLinksResult = await intakeSupabase
    .from("outlook_email_intake_attachments")
    .select("document_metadata_id, email_attachment_id, content_type, file_name")
    .in("document_metadata_id", evidenceSourceIds);

  const ragSourceMap = new Map(
    (((ragSourceDocumentsResult.data ?? []) as RagSourceDocumentRow[]) ?? []).map((source) => [source.id, source]),
  );
  const attachmentLinkMap = new Map(
    (((attachmentLinksResult.data ?? []) as OutlookAttachmentLinkRow[]) ?? [])
      .filter((row): row is OutlookAttachmentLinkRow & { document_metadata_id: string } => Boolean(row.document_metadata_id))
      .map((row) => [row.document_metadata_id, row]),
  );
  const sourceDocuments = ((sourceDocumentsResult.data ?? []) as SourceDocumentRow[]).map((source) => {
    const merged = mergeSourceDocumentRows(source, ragSourceMap.get(source.id));
    const attachmentLink = attachmentLinkMap.get(source.id);
    if (!attachmentLink) return merged;
    return {
      ...merged,
      source_metadata: {
        ...asRecord(merged.source_metadata),
        email_attachment_id: attachmentLink.email_attachment_id,
        attachment_content_type: attachmentLink.content_type,
        attachment_file_name: attachmentLink.file_name,
      },
    };
  });
  return new Map(sourceDocuments.map((source) => [source.id, source]));
}

function supportingSourcesForIds(
  packet: ClientProjectIntelligencePacket,
  sourceIds: string[],
  sourceDocumentMap: Map<string, SourceDocumentRow>,
): SourceDocumentRow[] {
  const aliasMap = packetSourceAliasMap(packet);
  const seen = new Set<string>();
  const rows: SourceDocumentRow[] = [];
  sourceIds.forEach((sourceId) => {
    const resolvedId = aliasMap.get(sourceId) ?? sourceId;
    if (!resolvedId || seen.has(resolvedId)) return;
    const row = sourceDocumentMap.get(resolvedId);
    if (!row) return;
    seen.add(resolvedId);
    rows.push(row);
  });
  return rows.slice(0, 3);
}

function SourceLinkRow({ projectId, sources }: { projectId: number; sources: SourceDocumentRow[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
      {sources.map((source) => (
        <SourceReferenceButton
          key={source.id}
          projectId={projectId}
          source={sourceReferenceRecord(source, projectId)}
          buttonLabel={sourceButtonLabel(source)}
        />
      ))}
    </div>
  );
}

function toneClasses(tone: StatusTone): string {
  if (tone === "healthy") return "text-status-success";
  if (tone === "risk") return "text-destructive";
  return "text-status-warning";
}

function stageLabel(project: ProjectRow): string {
  return cleanText(project.stage || project.phase || project.summary || "Stage not available");
}

function operatingHealthTone(status: string | null | undefined): StatusTone {
  if (status === "critical" || status === "at_risk") return "risk";
  if (status === "watch") return "watch";
  return "healthy";
}

function isPacketNewerThanCurrentState(
  packet: ClientProjectIntelligencePacket | null,
  currentState: ProjectCurrentStateRow | null,
): boolean {
  const packetMs = parseDateMs(packet?.generatedAt);
  const currentStateMs = parseDateMs(currentState?.updated_at);
  return packetMs != null && (currentStateMs == null || packetMs > currentStateMs);
}

function intelligenceLastUpdatedAt(
  packet: ClientProjectIntelligencePacket | null,
  currentState: ProjectCurrentStateRow | null,
): string | null {
  if (isPacketNewerThanCurrentState(packet, currentState)) return packet?.generatedAt ?? null;
  return currentState?.updated_at ?? packet?.generatedAt ?? null;
}

function formatTimelineDate(occurredAt: string | null): string {
  if (!occurredAt) return "";
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ===========================================================================
// Clean insight-card spine
// ---------------------------------------------------------------------------
// insight_cards is the only synthesized, evidence-linked source that is clean
// enough to surface (current_state risk/decision arrays and the timeline_events
// table are largely raw-email dumps from a backend synthesis bug). Everything
// in the "thinking" and "evidence" sections below reads from filtered cards.
// ===========================================================================

const RISK_CARD_TYPES = new Set(["blocker", "risk", "schedule_risk", "financial_exposure"]);
const DECISION_CARD_TYPES = new Set(["decision", "open_question", "change_management", "requirement"]);
const FOCUS_CARD_TYPES = new Set([...RISK_CARD_TYPES, ...DECISION_CARD_TYPES]);

const FOCUS_RANK: Record<string, number> = {
  blocker: 0,
  risk: 1,
  schedule_risk: 2,
  financial_exposure: 3,
  decision: 4,
  open_question: 5,
  change_management: 6,
  requirement: 7,
};

/**
 * A title is "raw" when it's an un-synthesized source dump (an email/meeting
 * subject line) rather than an analyzed signal. ~22% of insight_cards, the
 * what-changed list, and the current_state arrays carry these from a backend
 * synthesis bug — they must never reach the UI.
 */
function isRawTitle(title: string | null | undefined): boolean {
  const value = (title ?? "").trim();
  if (!cleanText(value)) return true;
  if (looksLikeRawSource(value)) return true;
  if (/^(email|fwd?|re|canceled|cancelled|accepted|declined|tentative)\b[:\s]/i.test(value)) return true;
  return false;
}

/** Drop cards whose title is a raw email/source dump rather than a synthesized signal. */
function isCleanCard(card: InsightCard): boolean {
  return !isRawTitle(card.title);
}

function latestEvidenceDate(card: InsightCard): string {
  return card.evidence
    .map((evidence) => evidence.sourceOccurredAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? "";
}

function cardTone(card: InsightCard): StatusTone {
  if (RISK_CARD_TYPES.has(card.cardType)) return "risk";
  return "watch";
}

// --------------------------------------------------------------------------
// Thinking — health, focus, what changed
// --------------------------------------------------------------------------

function ProjectHealthHero({
  currentState,
  latestSnapshot,
  packet,
}: {
  currentState: ProjectCurrentStateRow | null;
  latestSnapshot: OperatingSnapshotRow | null;
  packet: ClientProjectIntelligencePacket | null;
}) {
  if (!currentState && !latestSnapshot) return null;

  const status = currentState?.health_status ?? "unknown";
  const tone = operatingHealthTone(status);
  const summarySource = isPacketNewerThanCurrentState(packet, currentState)
    ? packet?.currentStatus ?? packet?.executiveSummary ?? currentState?.current_summary
    : currentState?.current_summary ?? packet?.currentStatus ?? packet?.executiveSummary;
  const summary = safeNarrative(summarySource, 620);
  const sourceConfidence = asRecord(currentState?.source_confidence);
  const sourceCoverage = asRecord(sourceConfidence.source_coverage);
  const sourceCount = typeof sourceCoverage.source_count === "number" ? sourceCoverage.source_count : null;

  const label =
    status === "on_track"
      ? "On track"
      : status === "watch"
        ? "Attention needed"
        : status === "at_risk"
          ? "At risk"
          : status === "critical"
            ? "Critical"
            : "Status not yet established";

  const wrapTone =
    tone === "risk" ? "bg-status-error/10" : tone === "watch" ? "bg-status-warning/10" : "bg-status-success/10";
  const dotTone =
    tone === "risk" ? "bg-status-error" : tone === "watch" ? "bg-status-warning" : "bg-status-success";

  return (
    <section>
      <div className={`space-y-3 rounded-2xl px-6 py-5 ${wrapTone}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 text-base font-semibold ${toneClasses(tone)}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${dotTone}`} aria-hidden="true" />
            {label}
          </span>
          {sourceCount != null ? (
            <span className="ml-auto text-xs text-muted-foreground">
              Source coverage: {sourceCount} update{sourceCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <p className="max-w-4xl text-sm leading-7 text-foreground">
          {summary || "A written project summary isn’t available yet — the synthesis pipeline has not produced a clean read."}
        </p>
      </div>
    </section>
  );
}

function markdownSection(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return [];
  const sectionLines: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line.trim())) break;
    const cleaned = cleanText(line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""));
    if (cleaned && cleaned !== "json") sectionLines.push(cleaned);
  }
  return sectionLines;
}

function dailyBriefMarkdown(packet: ClientProjectIntelligencePacket): string {
  return (
    asString(asRecord(packet.packetJson).briefMarkdown) ||
    packet.strategicRead ||
    packet.executiveSummary ||
    ""
  );
}

function sourceCountText(packet: ClientProjectIntelligencePacket): string {
  const counts = asRecord(packet.sourceCoverage.sourceCounts);
  const total = Object.values(counts).reduce<number>((sum, value) => {
    return typeof value === "number" && Number.isFinite(value) ? sum + value : sum;
  }, 0);
  if (total > 0) return `${total} sources`;
  const sourceIds = packet.sourceCoverage.sourceIds;
  return Array.isArray(sourceIds) ? `${sourceIds.length} sources` : "source coverage recorded";
}

function DailyExecutiveBriefSection({ packet }: { packet: ClientProjectIntelligencePacket | null }) {
  if (!packet) return null;

  const markdown = dailyBriefMarkdown(packet);
  const executiveRead = markdownSection(markdown, "Executive read").join(" ");
  const decisions = markdownSection(markdown, "Critical decisions needed").slice(0, 5);
  const watchItems = [
    ...markdownSection(markdown, "Financial / watch items").slice(0, 3),
    ...markdownSection(markdown, "Schedule / operations watch").slice(0, 3),
  ].slice(0, 5);
  const businessDate = asString(packet.sourceCoverage.businessDate) || formatDate(packet.coveredStartAt);

  if (!executiveRead && decisions.length === 0 && watchItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <SectionHeader title="Daily executive brief" />
        <p className="text-xs text-muted-foreground">
          {businessDate} · {sourceCountText(packet)} · compiled {formatDateTime(packet.generatedAt)}
        </p>
      </div>
      {executiveRead ? (
        <p className="max-w-4xl text-sm leading-7 text-foreground">{safeNarrative(executiveRead, 900)}</p>
      ) : null}
      {decisions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Decisions</p>
          <ul className="space-y-2 text-sm leading-6 text-foreground">
            {decisions.map((item) => (
              <li key={item}>{safeNarrative(item, 360)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {watchItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Watch items</p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {watchItems.map((item) => (
              <li key={item}>{safeNarrative(item, 360)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function DailyExecutiveBriefUnavailable({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <section className="space-y-2">
      <SectionHeader title="Daily executive brief" />
      <ErrorState error={`Daily executive brief could not load: ${error}`} />
    </section>
  );
}

function nextDueTask(tasks: InternalTaskRow[]): InternalTaskRow | null {
  return [...tasks]
    .filter((task) => task.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .at(0) ?? null;
}

function buildImmediateAttentionItems({
  cards,
  changeEventCandidates,
  tasks,
  projectId,
}: {
  cards: InsightCard[];
  changeEventCandidates: ChangeEventCandidateRow[];
  tasks: InternalTaskRow[];
  projectId: number;
}): DashboardActionItem[] {
  const items: DashboardActionItem[] = [];
  const now = Date.now();
  const overdueTasks = tasks.filter((task) => {
    if (!task.due_date) return false;
    const dueMs = new Date(task.due_date).getTime();
    return !Number.isNaN(dueMs) && dueMs < now;
  });
  const nextTask = nextDueTask(tasks);

  if (overdueTasks.length > 0 || tasks.length > 0) {
    const label = overdueTasks.length > 0
      ? `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} already need follow-up`
      : `${tasks.length} open task${tasks.length === 1 ? "" : "s"} are part of the current work queue`;
    const detail = nextTask
      ? `Next due: ${cleanText(nextTask.title) || "Untitled task"}${nextTask.due_date ? ` on ${formatDate(nextTask.due_date)}` : ""}.`
      : "Open the project task list to review ownership and due dates.";
    items.push({
      key: "tasks",
      title: label,
      detail,
      meta: overdueTasks.length > 0 ? "Project tasks · overdue" : "Project tasks",
      href: `/${projectId}/tasks`,
      ctaLabel: "Open tasks",
      tone: overdueTasks.length > 0 ? "risk" : "watch",
    });
  }

  const focusCards = cards
    .filter((card) => FOCUS_CARD_TYPES.has(card.cardType))
    .sort(
      (a, b) =>
        (FOCUS_RANK[a.cardType] ?? 9) - (FOCUS_RANK[b.cardType] ?? 9) ||
        latestEvidenceDate(b).localeCompare(latestEvidenceDate(a)),
    )
    .slice(0, 3);

  focusCards.forEach((card) => {
    const dateLabel = latestEvidenceDate(card) ? formatTimelineDate(latestEvidenceDate(card)) : "";
    const detail = safeNarrative(card.nextAction || card.whyItMatters || card.summary, 170);
    items.push({
      key: card.id,
      title: cleanText(card.title),
      detail: detail || undefined,
      meta: [formatLabel(card.cardType), dateLabel, `${card.evidence.length} source${card.evidence.length === 1 ? "" : "s"}`]
        .filter(Boolean)
        .join(" · "),
      href: `#insight-card-${card.id}`,
      ctaLabel: "Open evidence",
      tone: cardTone(card),
    });
  });

  changeEventCandidates
    .filter((candidate) => !isRawTitle(candidate.title))
    .slice(0, 2)
    .forEach((candidate) => {
      items.push({
        key: candidate.id,
        title: candidate.title,
        detail: safeNarrative(candidate.reason || candidate.description, 170) || undefined,
        meta: [
          "Potential change order",
          formatLabel(candidate.confidence),
          formatLabel(candidate.status),
        ].join(" · "),
        href: `/${projectId}/change-events/new?candidateId=${candidate.id}`,
        ctaLabel: "Create change event",
        tone: "watch",
      });
    });

  return items.slice(0, 5);
}

function ImmediateAttentionSection({
  cards,
  changeEventCandidates,
  tasks,
  projectId,
}: {
  cards: InsightCard[];
  changeEventCandidates: ChangeEventCandidateRow[];
  tasks: InternalTaskRow[];
  projectId: number;
}) {
  const items = buildImmediateAttentionItems({ cards, changeEventCandidates, tasks, projectId });
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHeader title="Act now" />
      <div className="divide-y divide-border/60">
        {items.map((item) => {
          const Icon = item.tone === "risk" ? AlertTriangle : item.tone === "watch" ? HelpCircle : GitCommitHorizontal;
          return (
            <article key={item.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClasses(item.tone)}`} aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={item.href}>{item.ctaLabel}</Link>
                  </Button>
                </div>
                {item.detail ? <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WhatChangedSection({
  packet,
  projectId,
  sourceDocumentMap,
}: {
  packet: ClientProjectIntelligencePacket;
  projectId: number;
  sourceDocumentMap: Map<string, SourceDocumentRow>;
}) {
  const whatChanged = summaryItems(packet, "whatChanged", ["impact"])
    .filter((item) => !isRawTitle(item.title))
    .slice(0, 4);
  if (whatChanged.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHeader title="What changed" />
      <div className="divide-y divide-border/60">
        {[...whatChanged].reverse().map((item) => {
          const sources = supportingSourcesForIds(packet, item.sourceIds, sourceDocumentMap);
          return (
            <article key={item.title} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.occurredAt ? (
                  <span className="text-xs text-muted-foreground">{formatDate(item.occurredAt)}</span>
                ) : null}
              </div>
              {item.detail ? (
                <p className="text-sm leading-6 text-muted-foreground">{safeNarrative(item.detail, 420)}</p>
              ) : null}
              <SourceLinkRow projectId={projectId} sources={sources} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DailyDeepReadCandidateSection({
  candidates,
  error,
  projectId,
  sourceDocumentMap,
}: {
  candidates: DailyDeepReadCandidateRow[];
  error: string | null;
  projectId: number;
  sourceDocumentMap: Map<string, SourceDocumentRow>;
}) {
  if (candidates.length === 0 && !error) return null;

  const reviewCandidates: DailyDeepReadReviewCandidate[] = candidates.map((candidate) => {
    const sources = candidateSourceIds(candidate)
      .map((sourceId) => sourceDocumentMap.get(sourceId))
      .filter((source): source is SourceDocumentRow => Boolean(source))
      .slice(0, 3);
    const title = candidateDisplayText(candidate.title, 220) || formatLabel(candidate.signal_type);
    const summary =
      candidateDisplayText(candidate.summary, 360) ||
      candidateDisplayText(candidate.why_it_matters, 360) ||
      candidateDisplayText(candidate.excerpt, 360) ||
      null;
    const nextAction = candidateDisplayText(candidate.next_action, 220) || null;

    return {
      id: candidate.id,
      signalType: candidate.signal_type,
      status: candidate.status === "candidate" ? "candidate" : "needs_review",
      title,
      summary,
      nextAction,
      confidence: candidate.confidence,
      sources: sources.map((source) => ({
        label: sourceButtonLabel(source),
        record: sourceReferenceRecord(source, projectId),
      })),
    };
  });

  return (
    <DailyDeepReadCandidateReview
      candidates={reviewCandidates}
      error={error}
      projectId={projectId}
    />
  );
}

// --------------------------------------------------------------------------
// Evidence — risks & decisions, financial, timeline
// --------------------------------------------------------------------------

function RisksDecisionsSection({ cards, projectId }: { cards: InsightCard[]; projectId: number }) {
  const items = cards.filter((card) => RISK_CARD_TYPES.has(card.cardType) || DECISION_CARD_TYPES.has(card.cardType));
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHeader title="Risks &amp; decisions" />
      {/* InsightCardShowcase owns the expand-to-evidence drill-down per card
          (Read → Why it matters → Sources → email thread) and the
          #insight-card-{id} anchors that Executive focus links to. */}
      <InsightCardShowcase cards={items} projectId={projectId} />
    </section>
  );
}

function FinancialContextSection({
  operatingRecord,
  projectId,
  projectBudget,
}: {
  operatingRecord: OperatingRecordState;
  projectId: number;
  projectBudget?: number | null;
}) {
  const { currentState, latestSnapshot, changeEventCandidates } = operatingRecord;
  const financial = latestSnapshot?.financial_snapshot ?? {};

  const budget = moneyField(financial.budget) ?? projectBudget ?? null;
  const committed = moneyField(financial.committed);
  const directCosts = moneyField(financial.direct_costs);
  const changeOrders = moneyField(financial.change_orders_total);
  const financialRead =
    currentState?.financial_read && !looksLikeRawSource(currentState.financial_read) ? currentState.financial_read : "";

  const candidates = changeEventCandidates.filter((candidate) => !isRawTitle(candidate.title));
  const hasNumbers = budget != null || committed != null || directCosts != null || changeOrders != null;
  if (!hasNumbers && !financialRead && candidates.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title="Financial context" />
      {hasNumbers ? (
        <div className="space-y-3">
          <LabelValueRow label="Budget">{budget != null ? formatCurrency(budget) : "Not set"}</LabelValueRow>
          <LabelValueRow label="Committed">{formatCurrency(committed)}</LabelValueRow>
          <LabelValueRow label="Direct costs">{formatCurrency(directCosts)}</LabelValueRow>
          <LabelValueRow label="Change orders">{formatCurrency(changeOrders)}</LabelValueRow>
        </div>
      ) : null}
      {financialRead ? <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{financialRead}</p> : null}
      <p className="text-xs text-muted-foreground">
        Schedule SPI and percent-complete are intentionally omitted — schedule data is not yet reliable enough to show.
      </p>

      {candidates.length > 0 ? (
        <div className="space-y-3">
          <div className="divide-y divide-border/60">
            {candidates.map((candidate) => (
              <article key={candidate.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">{candidate.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {safeNarrative(candidate.reason || candidate.description, 260)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {formatLabel(candidate.confidence)} · Status: {formatLabel(candidate.status)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${projectId}/change-events/new?candidateId=${candidate.id}`}>Create with AI</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReliabilitySection({
  packet,
  pageState,
  operatingRecord,
}: {
  packet: ClientProjectIntelligencePacket | null;
  pageState: ReturnType<typeof buildIntelligencePageState> | null;
  operatingRecord: OperatingRecordState;
}) {
  const currentUpdatedAt = operatingRecord.currentState?.updated_at ?? null;
  const latestSourceAt =
    (typeof packet?.sourceCoverage.latestSourceAt === "string" ? packet.sourceCoverage.latestSourceAt : null) ??
    operatingRecord.latestSnapshot?.snapshot_at ??
    null;
  const warnings = pageState?.warnings ?? [];
  const limitations = pageState?.limitations ?? [];
  const packetFreshness = packet ? formatLabel(packet.freshnessStatus) : "Unavailable";

  return (
    <section className="space-y-3">
      <SectionHeader title="Trust this read" />
      <div className="space-y-3">
        <LabelValueRow label="Packet freshness">
          {packet ? `${packetFreshness} · compiled ${formatDateTime(packet.generatedAt)}` : "No current packet available"}
        </LabelValueRow>
        <LabelValueRow label="Operating record">
          {currentUpdatedAt ? `Updated ${formatDateTime(currentUpdatedAt)}` : "No current operating summary available"}
        </LabelValueRow>
        <LabelValueRow label="Latest source signal">
          {latestSourceAt ? formatDateTime(latestSourceAt) : "Not available"}
        </LabelValueRow>
      </div>

      {warnings.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-destructive">Warnings</p>
          <ul className="space-y-2 text-sm leading-6 text-foreground">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Evidence limits</p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {limitations.slice(0, 3).map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CurrentOperatingReadSection({
  packet,
  pageState,
  currentState,
}: {
  packet: ClientProjectIntelligencePacket | null;
  pageState: ReturnType<typeof buildIntelligencePageState> | null;
  currentState: ProjectCurrentStateRow | null;
}) {
  const primaryReadSource = isPacketNewerThanCurrentState(packet, currentState)
    ? packet?.currentStatus ?? packet?.executiveSummary ?? currentState?.current_summary
    : currentState?.current_summary ?? packet?.currentStatus ?? packet?.executiveSummary;
  const primaryRead = safeNarrative(primaryReadSource, 560) || pageState?.briefing.body || "";
  const whyItMatters = packet ? safeNarrative(packet.whyItMatters, 260) : "";
  const nextMoves = packet?.recommendedNextMoves.map((move) => cleanText(move)).filter(Boolean).slice(0, 3) ?? [];

  if (!primaryRead && !whyItMatters && nextMoves.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operating read</p>
        <SectionRuleHeading label={pageState?.briefing.title ?? "Current project intelligence"} className="mb-0 pb-0" />
      </div>
      {primaryRead ? <p className="max-w-4xl text-base leading-8 text-foreground">{primaryRead}</p> : null}
      {whyItMatters ? (
        <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{whyItMatters}</p>
      ) : null}
      {nextMoves.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Recommended next moves</p>
          <ol className="space-y-2">
            {nextMoves.map((move) => (
              <li key={move} className="text-sm leading-6 text-foreground">{move}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function SourceActivitySection({ projectId }: { projectId: number }) {
  return (
    <details className="space-y-4">
      <summary className="cursor-pointer list-none text-sm text-muted-foreground hover:text-foreground">
        View recent source activity
      </summary>
      <div className="pt-3">
        <DailyIngestionFeed projectId={projectId} />
      </div>
    </details>
  );
}

function TimelineRow({ card }: { card: InsightCard }) {
  const why = safeNarrative(card.whyItMatters, 160);
  return (
    <li className="relative pl-5">
      <span
        className={`absolute left-0 top-1.5 h-2 w-2 -translate-x-[4.5px] rounded-full ${
          RISK_CARD_TYPES.has(card.cardType) ? "bg-status-error" : "bg-status-warning"
        }`}
        aria-hidden="true"
      />
      <div className="text-xs text-muted-foreground">
        {formatTimelineDate(latestEvidenceDate(card) || null)} · {formatLabel(card.cardType)}
      </div>
      <a
        href={`#insight-card-${card.id}`}
        className="text-sm text-foreground underline-offset-4 hover:underline"
      >
        {cleanText(card.title)}
      </a>
      {why ? <p className="text-xs text-muted-foreground">{why}</p> : null}
    </li>
  );
}

function ProjectTimelineSection({ cards }: { cards: InsightCard[] }) {
  const dated = cards
    .filter((card) => latestEvidenceDate(card))
    .sort((a, b) => latestEvidenceDate(b).localeCompare(latestEvidenceDate(a)));
  if (dated.length === 0) return null;

  const head = dated.slice(0, 8);
  const rest = dated.slice(8);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Project timeline" />
        <span className="text-xs text-muted-foreground">how we got here</span>
      </div>
      <ol className="ml-1 space-y-3 border-l border-border/60 pl-4">
        {head.map((card) => (
          <TimelineRow key={card.id} card={card} />
        ))}
      </ol>
      {rest.length > 0 ? (
        <details className="ml-1 pl-4">
          <summary className="cursor-pointer list-none text-sm text-muted-foreground hover:text-foreground">
            Show {rest.length} earlier event{rest.length === 1 ? "" : "s"}
          </summary>
          <ol className="mt-3 space-y-3 border-l border-border/60 pl-4">
            {rest.map((card) => (
              <TimelineRow key={card.id} card={card} />
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function IntelligenceEmptyState({ project, reason }: { project: ProjectRow; reason: string }) {
  return (
    <EmptyState
      title="No project intelligence brief yet"
      description={`${project.name ?? `Project ${project.id}`} cannot show a living project intelligence brief until the pipeline has a current packet. ${reason}`}
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/ai">Open assistant</Link>
        </Button>
      }
    />
  );
}

// --------------------------------------------------------------------------
// Internal projects (projects.type === "Internal") — Operations intelligence.
// Reframes the same source-derived signals into the four things that actually
// matter for an internal initiative: issues that arose, processes to improve,
// follow-ups owed, and tasks. No construction KPIs, contracts, or financials.
// --------------------------------------------------------------------------

const INTERNAL_ISSUE_TYPES = new Set([
  "risk",
  "schedule_risk",
  "financial_exposure",
  "blocker",
  "flag",
  "open_question",
  "sentiment",
]);
const INTERNAL_PROCESS_TYPES = new Set(["process_issue", "product_need", "requirement"]);
const INTERNAL_FOLLOWUP_TYPES = new Set(["decision", "change_management"]);
const INTERNAL_TASK_EVENT_TYPES = new Set(["task"]);
// A signal whose lifecycle is closed should not read as still-open work.
const INTERNAL_CLOSED_STATUSES = new Set(["resolved", "did_not_materialize", "done", "complete", "completed"]);

const INTERNAL_PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

type InternalItem = {
  key: string;
  title: string;
  summary?: string;
  meta: string;
  owner?: string;
  date?: string;
  sourceDocumentId?: string | null;
  rank: number;
};

function eventToInternalItem(event: OperatingTimelineEventRow): InternalItem {
  const statusNote = event.current_status && event.current_status !== "open" ? formatLabel(event.current_status) : "";
  const meta = [
    formatLabel(event.event_type),
    event.priority !== "low" ? `${formatLabel(event.priority)} priority` : "",
    statusNote,
    formatTimelineDate(event.event_at),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    key: event.id,
    title: event.title,
    summary: safeNarrative(event.summary || event.why_it_matters, 280),
    meta,
    owner: event.owner_label ?? undefined,
    date: event.event_at,
    sourceDocumentId: event.source_document_id,
    rank: INTERNAL_PRIORITY_RANK[event.priority] ?? 2,
  };
}

function currentStateItems(value: unknown, badge: string): InternalItem[] {
  return (Array.isArray(value) ? value : [])
    .map((raw, index): InternalItem | null => {
      const record = asRecord(raw);
      const title = cleanUnknown(record.title) || cleanUnknown(record.summary);
      if (!title || isRawTitle(title)) return null;
      const detail = cleanUnknown(record.detail) || cleanUnknown(record.description) || cleanUnknown(record.reason);
      const detailSummary = detail && detail !== title ? safeNarrative(detail, 280) : undefined;
      return {
        key: `${badge}:${index}:${title.slice(0, 40)}`,
        title,
        summary: detailSummary,
        meta: badge,
        owner: cleanUnknown(record.owner) || undefined,
        date: cleanUnknown(record.occurredAt || record.date) || undefined,
        rank: 2,
      };
    })
    .filter((item): item is InternalItem => Boolean(item));
}

function dedupeInternalItems(items: InternalItem[]): InternalItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const norm = cleanText(item.title).toLowerCase();
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    })
    .sort((a, b) => a.rank - b.rank);
}

function InternalItemSection({
  eyebrow,
  items,
  projectId,
  sourceDocumentMap,
  limit = 8,
}: {
  eyebrow: string;
  items: InternalItem[];
  projectId: number;
  sourceDocumentMap: Map<string, SourceDocumentRow>;
  limit?: number;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, limit);
  return (
    <section className="space-y-3">
      <SectionHeader title={eyebrow} />
      <div className="divide-y divide-border/60">
        {shown.map((item) => {
          const source = item.sourceDocumentId ? sourceDocumentMap.get(item.sourceDocumentId) : undefined;
          return (
            <article key={item.key} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.meta}
                </span>
              </div>
              {item.summary ? (
                <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
              ) : null}
              {item.owner ? <p className="text-xs text-muted-foreground">Owner: {item.owner}</p> : null}
              {source ? <SourceLinkRow projectId={projectId} sources={[source]} /> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function internalTaskRank(task: InternalTaskRow, now: number): number {
  const due = task.due_date ? new Date(task.due_date).getTime() : null;
  const overdue = due != null && !Number.isNaN(due) && due < now;
  const priorityRank = INTERNAL_PRIORITY_RANK[(task.priority ?? "").toLowerCase()] ?? 2;
  return (overdue ? 0 : 10) + priorityRank;
}

function TaskSection({ tasks, nowMs }: { tasks: InternalTaskRow[]; nowMs: number }) {
  if (tasks.length === 0) return null;
  const ordered = [...tasks].sort((a, b) => internalTaskRank(a, nowMs) - internalTaskRank(b, nowMs)).slice(0, 12);
  return (
    <section className="space-y-3">
      <SectionHeader title="Tasks" />
      <div className="divide-y divide-border/60">
        {ordered.map((task) => {
          const dueMs = task.due_date ? new Date(task.due_date).getTime() : null;
          const overdue = dueMs != null && !Number.isNaN(dueMs) && dueMs < nowMs;
          return (
            <article key={task.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {cleanText(task.title) || safeNarrative(task.description, 100) || "Untitled task"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatLabel(task.status)}
                  {task.priority ? ` · ${formatLabel(task.priority)} priority` : ""}
                  {task.assignee_name ? ` · ${task.assignee_name}` : ""}
                </p>
              </div>
              {task.due_date ? (
                <span className={`shrink-0 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {overdue ? "Overdue " : "Due "}
                  {formatDate(task.due_date)}
                </span>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

async function loadProjectTasks(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: number,
): Promise<InternalTaskRow[]> {
  const columns = "id, title, description, status, due_date, priority, assignee_name, created_at";
  const [byArray, byScalar] = await Promise.all([
    supabase
      .from("tasks")
      .select(columns)
      .contains("project_ids", [projectId])
      .not("status", "in", '("done","cancelled")')
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("tasks")
      .select(columns)
      .eq("project_id", projectId)
      .not("status", "in", '("done","cancelled")')
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);
  const byId = new Map<string, InternalTaskRow>();
  for (const task of [...(byArray.data ?? []), ...(byScalar.data ?? [])]) {
    if (!byId.has(task.id)) byId.set(task.id, task);
  }
  return Array.from(byId.values());
}

function InternalIntelligenceView({
  project,
  operatingRecord,
  tasks,
  projectId,
  sourceDocumentMap,
  nowMs,
}: {
  project: ProjectRow;
  operatingRecord: OperatingRecordState;
  tasks: InternalTaskRow[];
  projectId: number;
  sourceDocumentMap: Map<string, SourceDocumentRow>;
  nowMs: number;
}) {
  const { currentState, timelineEvents } = operatingRecord;

  const openEvents = timelineEvents.filter(
    (event) => !INTERNAL_CLOSED_STATUSES.has((event.current_status ?? "").toLowerCase()),
  );
  const eventsOfType = (types: Set<string>) =>
    openEvents.filter((event) => types.has(event.event_type)).map(eventToInternalItem);

  // Timeline events are the cleanest, typed, dated source. Fall back to the
  // project_current_state arrays only when no events exist for a bucket.
  const issues = dedupeInternalItems(
    eventsOfType(INTERNAL_ISSUE_TYPES).length > 0
      ? eventsOfType(INTERNAL_ISSUE_TYPES)
      : [
          ...currentStateItems(currentState?.active_risks, "Risk"),
          ...currentStateItems(currentState?.needs_attention, "Needs attention"),
        ],
  );
  const processItems = dedupeInternalItems(eventsOfType(INTERNAL_PROCESS_TYPES));
  const followUps = dedupeInternalItems(
    eventsOfType(INTERNAL_FOLLOWUP_TYPES).length > 0
      ? eventsOfType(INTERNAL_FOLLOWUP_TYPES)
      : currentStateItems(currentState?.open_decisions, "Open decision"),
  );
  const taskEventItems = eventsOfType(INTERNAL_TASK_EVENT_TYPES);

  const executiveRead = safeNarrative(currentState?.current_summary, 620);
  const hasAnything =
    Boolean(executiveRead) ||
    issues.length > 0 ||
    processItems.length > 0 ||
    followUps.length > 0 ||
    tasks.length > 0 ||
    taskEventItems.length > 0;

  return (
    <>
      {executiveRead ? (
        <section className="space-y-3">
          <SectionHeader title="Current read" />
          <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{executiveRead}</p>
        </section>
      ) : null}

      <InternalItemSection
        eyebrow="Issues raised"
        items={issues}
        projectId={projectId}
        sourceDocumentMap={sourceDocumentMap}
      />

      <InternalItemSection
        eyebrow="Process improvements"
        items={processItems}
        projectId={projectId}
        sourceDocumentMap={sourceDocumentMap}
      />

      <InternalItemSection
        eyebrow="Follow-ups needed"
        items={followUps}
        projectId={projectId}
        sourceDocumentMap={sourceDocumentMap}
      />

      <TaskSection tasks={tasks} nowMs={nowMs} />

      {taskEventItems.length > 0 ? (
        <InternalItemSection
          eyebrow="Action items from sources"
          items={taskEventItems}
          projectId={projectId}
          sourceDocumentMap={sourceDocumentMap}
        />
      ) : null}

      <DailyIngestionFeed projectId={projectId} />

      {!hasAnything ? (
        <EmptyState
          title="No operations intelligence yet"
          description={`${project.name ?? `Project ${project.id}`} has no source-derived issues, follow-ups, or tasks yet. Once meetings, email, or Teams activity is ingested, they’ll surface here.`}
        />
      ) : null}
    </>
  );
}

export default async function ProjectIntelligencePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const numericProjectId = Number.parseInt(projectId, 10);

  if (Number.isNaN(numericProjectId)) {
    notFound();
  }

  // Every read below uses the service-role client (RLS bypassed), so project
  // membership must be enforced here — the [projectId] layout redirect is not
  // a data-layer boundary.
  const access = await verifyProjectAccess(numericProjectId);
  if (isAuthError(access)) {
    notFound();
  }

  const supabase = createServiceClient();
  const projectResult = await supabase
    .from("projects")
    .select("id, name, project_number, budget, budget_used, phase, stage, summary, work_scope, type")
    .eq("id", numericProjectId)
    .single();

  if (projectResult.error || !projectResult.data) {
    notFound();
  }

  const project = projectResult.data;

  // Internal initiatives (projects.type === "Internal") get the operations
  // intelligence layout: issues, process improvements, follow-ups, tasks —
  // not the construction KPI / contract / financial brief.
  if (project.type === "Internal") {
    const [operatingRecord, internalTasks] = await Promise.all([
      loadOperatingRecordState(supabase, numericProjectId),
      loadProjectTasks(supabase, numericProjectId),
    ]);
    const internalEvidenceIds = Array.from(
      new Set(
        operatingRecord.timelineEvents
          .map((event) => event.source_document_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const internalSourceMap = await loadSourceDocumentMap(supabase, internalEvidenceIds);
    const nowMs = Date.now();

    return (
      <PageShell
        variant="dashboard"
        title={`${project.name ?? `Project ${project.id}`} Intelligence`}
        description={[
          "Internal initiative",
          operatingRecord.currentState
            ? `Last updated ${formatDateTime(operatingRecord.currentState.updated_at)}`
            : "Last updated not available",
        ].join(" · ")}
        contentClassName="space-y-10"
      >
        <InternalIntelligenceView
          project={project}
          operatingRecord={operatingRecord}
          tasks={internalTasks}
          projectId={numericProjectId}
          sourceDocumentMap={internalSourceMap}
          nowMs={nowMs}
        />
      </PageShell>
    );
  }

  const target = await resolveIntelligenceTarget({
    query: project.name ?? `Project ${project.id}`,
    selectedProjectId: numericProjectId,
    supabase,
  });

  let packet: ClientProjectIntelligencePacket | null = null;
  let packetLoadError: string | null = null;

  if (target) {
    try {
      packet = await loadCurrentIntelligencePacket({
        targetId: target.id,
        supabase,
        includeSourcePreview: false,
        projectId: target.projectId,
      });
    } catch (error) {
      packetLoadError = error instanceof Error ? error.message : "Unexpected packet load failure.";
    }
  }

  const [operatingRecord, projectTasks, dailyBriefResult] = await Promise.all([
    loadOperatingRecordState(supabase, numericProjectId),
    loadProjectTasks(supabase, numericProjectId),
    loadCurrentIntelligencePacketBySlug({
      slug: "daily-executive-brief",
      supabase,
      includeSourcePreview: false,
    })
      .then((packet) => ({ packet, error: null }))
      .catch((error) => ({
        packet: null,
        error: error instanceof Error ? error.message : "Unexpected daily executive brief load failure.",
      })),
  ]);
  const pageState = packet ? buildIntelligencePageState(packet) : null;

  // insight_cards is the only clean, synthesized, evidence-linked source.
  // Drop raw-email contamination before anything reaches the thinking layer.
  const cleanCards = packet ? packet.cards.filter(isCleanCard) : [];
  const hasCards = cleanCards.length > 0;

  const hasOperatingRecord = Boolean(
    operatingRecord.currentState ||
      operatingRecord.latestSnapshot ||
      operatingRecord.changeEventCandidates.length ||
      operatingRecord.dailyDeepReadCandidates.length ||
      operatingRecord.dailyDeepReadCandidateError,
  );

  // Source documents for the "what changed" citation buttons (packet aliases).
  const evidenceSourceIds = Array.from(
    new Set(
      [
        ...(packet ? packetEvidence(packet).map((evidence) => evidence.sourceDocumentId) : []),
        ...operatingRecord.dailyDeepReadCandidates.flatMap(candidateSourceIds),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const sourceDocumentMap = await loadSourceDocumentMap(supabase, evidenceSourceIds);

  const hasAnyContent = hasCards || hasOperatingRecord || projectTasks.length > 0;

  return (
    <PageShell
      variant="dashboard"
      title={`${project.name ?? `Project ${project.id}`} Project Intelligence`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/${numericProjectId}/tasks`}>Open tasks</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/ai">Open assistant</Link>
          </Button>
        </div>
      }
      description={[
        stageLabel(project),
        intelligenceLastUpdatedAt(packet, operatingRecord.currentState)
          ? `Last updated ${formatDateTime(intelligenceLastUpdatedAt(packet, operatingRecord.currentState))}`
          : "Last updated not available",
      ].join(" · ")}
      contentClassName="space-y-8"
    >
      <ProjectHealthHero
        currentState={operatingRecord.currentState}
        latestSnapshot={operatingRecord.latestSnapshot}
        packet={packet}
      />
      <ProjectIntelligenceWorkflow
        projectId={numericProjectId}
        packet={packet}
        timelineEvents={operatingRecord.timelineEvents}
        tasks={projectTasks}
        reportSuggestions={operatingRecord.reportSuggestions}
      />
      <DailyExecutiveBriefSection packet={dailyBriefResult.packet} />
      <DailyExecutiveBriefUnavailable error={dailyBriefResult.error} />

      <DetailLayout
        sidebarAt="lg"
        sidebar={
          <>
            <ImmediateAttentionSection
              cards={cleanCards}
              changeEventCandidates={operatingRecord.changeEventCandidates}
              tasks={projectTasks}
              projectId={numericProjectId}
            />
            <ReliabilitySection packet={packet} pageState={pageState} operatingRecord={operatingRecord} />
            <FinancialContextSection
              operatingRecord={operatingRecord}
              projectId={numericProjectId}
              projectBudget={project.budget}
            />
          </>
        }
      >
        <CurrentOperatingReadSection
          packet={packet}
          pageState={pageState}
          currentState={operatingRecord.currentState}
        />
        <DailyDeepReadCandidateSection
          candidates={operatingRecord.dailyDeepReadCandidates}
          error={operatingRecord.dailyDeepReadCandidateError}
          projectId={numericProjectId}
          sourceDocumentMap={sourceDocumentMap}
        />
        {packet ? (
          <WhatChangedSection packet={packet} projectId={numericProjectId} sourceDocumentMap={sourceDocumentMap} />
        ) : null}
        {hasCards ? <RisksDecisionsSection cards={cleanCards} projectId={numericProjectId} /> : null}
        {hasCards ? <ProjectTimelineSection cards={cleanCards} /> : null}
        <SourceActivitySection projectId={numericProjectId} />
      </DetailLayout>

      {!hasAnyContent ? (
        !target ? (
          <IntelligenceEmptyState
            project={project}
            reason="Create an intelligence target before the living project brief can compile source-backed analysis."
          />
        ) : packetLoadError ? (
          <EmptyState
            title="Project intelligence brief could not load"
            description={`The current packet failed to load: ${packetLoadError}`}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/ai-system-health">Open AI system health</Link>
              </Button>
            }
          />
        ) : (
          <IntelligenceEmptyState
            project={project}
            reason="The target exists, but no current packet has been generated yet."
          />
        )
      ) : null}
    </PageShell>
  );
}
