import { generateText } from "ai";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import { getLanguageModel } from "@/lib/ai/providers";
import { formatAIProviderFailure } from "@/lib/ai/provider-config";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  EMBEDDING,
  generateEmbedding,
  getOpenAI,
} from "@/lib/ai/tools/tool-utils";
import { retrieveChunks } from "@/lib/ai/retrieval/retrieve-chunks";
import { getProjectContent } from "@/lib/intelligence/content-source";
import { withExecutiveDailyBriefObservation } from "@/lib/ai/executive-daily-brief-langfuse";
import {
  buildAgentLearningContextBlock,
  getSurfaceScopedLearnings,
} from "@/lib/ai/services/agent-learning-service";
import { getExecutiveBriefBullets } from "@/lib/executive/executive-brief-bullets";
import {
  type FinancialPulseData,
  loadFinancialPulse,
} from "@/lib/executive/financial-pulse";
import {
  buildOwnerBriefingData,
  type OwnerBriefingCardItem,
  type OwnerBriefingProject,
} from "@/lib/executive/owner-briefing-builder";
import type { EvidenceRef } from "@/lib/ai-ops/contracts";

type BriefTone = "neutral" | "good" | "watch" | "risk";
type BriefSource = "Email" | "Teams" | "Meeting" | "Document";
type ExecutivePriorityLane =
  | "cashMargin"
  | "scheduleField"
  | "customerOwner"
  | "subcontractorVendor"
  | "designPreconstruction"
  | "internalAccountability";

export type ExecutiveOperatingBriefFocusItem = {
  item: BrandonBriefItem;
  score: number;
  materiality: string[];
  lane: ExecutivePriorityLane;
  whatChanged: string;
  whyItMatters: string;
  recommendedNextMove: string;
  owner?: string;
};

export type ExecutiveOperatingBriefShortItem = {
  item: BrandonBriefItem;
  score: number;
  materiality: string[];
  nextAction: string;
  owner?: string;
};

export type ExecutiveOperatingBriefRiskItem =
  ExecutiveOperatingBriefShortItem & {
    impact: string;
  };

export type ExecutiveOperatingBriefHealthItem = {
  area: string;
  status: "healthy" | "watch" | "risk";
  summary: string;
};

export type ExecutiveOperatingBriefPattern = {
  title: string;
  evidence: string[];
  significance: string;
  trend: "increasing" | "stable" | "improving";
};

export type ExecutiveOperatingBriefStrategicRisk = {
  title: string;
  likelihood: "low" | "medium" | "high";
  impact: string;
  trend: "increasing" | "stable" | "improving";
  nextAction: string;
};

export type ExecutiveOperatingBrief = {
  startHere: string[];
  hasUnusualExecutiveLoad: boolean;
  topExecutiveFocus: ExecutiveOperatingBriefFocusItem[];
  additionalMaterialItems: Record<
    ExecutivePriorityLane,
    ExecutiveOperatingBriefShortItem[]
  >;
  projectRiskRadar: ExecutiveOperatingBriefRiskItem[];
  cashAndMarginWatch: ExecutiveOperatingBriefRiskItem[];
  waitingOn: {
    brandonWaitingOn: ExecutiveOperatingBriefShortItem[];
    othersWaitingOnBrandon: ExecutiveOperatingBriefShortItem[];
  };
  peopleAndAccountability: ExecutiveOperatingBriefShortItem[];
  importantBusinessSignals: string[];
  recommendedMoves: string[];
  lowerPriorityMomentum: ExecutiveOperatingBriefShortItem[];
  businessHealth?: ExecutiveOperatingBriefHealthItem[];
  emergingPatterns?: ExecutiveOperatingBriefPattern[];
  strategicRisks?: ExecutiveOperatingBriefStrategicRisk[];
  opportunities?: string[];
  leadershipWatchlist?: string[];
  chiefOfStaffInsights?: string[];
};

// The Daily Brief looks back 3 business days (weekends skipped). This keeps a
// Monday brief anchored to the prior Thu/Fri without pulling in week-old noise.
export const DEFAULT_EXECUTIVE_WINDOW_DAYS = 3;
export const DEFAULT_EXECUTIVE_BRIEFING_SYNTHESIS_MODEL = "gpt-5.5";

export type BriefCitation = {
  source: BriefSource;
  sourceDetail: string;
  sourceUrl?: string;
  sourceId?: string;
  evidence?: string;
  date: string;
};

export type BrandonBriefItem = {
  title: string;
  summary: string;
  evidenceFacts?: string[];
  bullets: string[];
  recommendedAction?: string;
  whyItMatters?: string;
  // Primary citation (mirrors citations[0] for backward compat with stored follow-ups + existing UI/email).
  source: BriefSource;
  sourceDetail: string;
  sourceUrl?: string;
  sourceId?: string;
  evidence?: string;
  date: string;
  // Full citation list. Always at least one entry; multiple when an item is corroborated across sources.
  citations: BriefCitation[];
  // Canonical AI Ops evidence refs persisted with the packet for claim-level traceability.
  sourceRefs?: EvidenceRef[];
  project: string;
  // Internal database project ID used for routing — NOT displayed to users.
  projectInternalId?: number | null;
  owner?: string;
  status?: string;
  tone?: BriefTone;
  retrieval?: string;
};

export type BrandonBriefSourceCoverage = {
  label: BriefSource;
  detail: string;
  count: number;
  latest: string;
  status?: "loaded" | "empty" | "warning";
  warning?: string;
};

export type DailyBriefRefreshRecord = {
  version: number;
  generatedAt: string;
  storedAt: string;
  windowDays: number;
  itemCounts: {
    needsBrandon: number;
    waitingOnOthers: number;
    importantUpdates: number;
  };
};

export type BrandonDailyUpdatePacket = {
  generatedAt: string;
  windowDays: number;
  canonicalName?: "Daily Brief";
  audiencePreset?: "brandon";
  briefVersion?: number;
  refreshHistory?: DailyBriefRefreshRecord[];
  retrievalOrder: string[];
  sections: {
    needsBrandon: BrandonBriefItem[];
    waitingOnOthers: BrandonBriefItem[];
    importantUpdates: BrandonBriefItem[];
  };
  operatingBrief?: ExecutiveOperatingBrief;
  /** Structured financial data from Acumatica ERP — ground-truth AR, COs, budgets. */
  financialPulse?: FinancialPulseData;
  sourceCoverage: BrandonBriefSourceCoverage[];
  retrievalNotes: string[];
};

type RecentCommunicationSignalResult = {
  sections: BrandonDailyUpdatePacket["sections"];
  warnings: string[];
};

type OperatingRecordBriefResult = {
  sections: BrandonDailyUpdatePacket["sections"];
  warnings: string[];
  itemCount: number;
};

type FallbackMetadataResult = {
  rows: DocumentMetaRow[];
  warnings: string[];
};

type RecentTranscriptResult = {
  items: BrandonBriefItem[];
  warnings: string[];
};

type SupportedSectionsResult = {
  sections: BrandonDailyUpdatePacket["sections"];
  warnings: string[];
};

type UntypedSupabaseResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type UntypedSupabaseQuery = PromiseLike<UntypedSupabaseResult> & {
  select: (columns?: string) => UntypedSupabaseQuery;
  gte: (column: string, value: string) => UntypedSupabaseQuery;
  in: (column: string, values: unknown[]) => UntypedSupabaseQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => UntypedSupabaseQuery;
  limit: (count: number) => UntypedSupabaseQuery;
};

type UntypedSupabaseReader = {
  from: (table: string) => UntypedSupabaseQuery;
};

function executiveBriefingSynthesisModel() {
  const configured = process.env.EXECUTIVE_BRIEFING_SYNTHESIS_MODEL?.trim();
  return (configured || DEFAULT_EXECUTIVE_BRIEFING_SYNTHESIS_MODEL).replace(
    /^openai\//,
    "",
  );
}

type SourceGroup = {
  label: BriefSource;
  sourceTypes: string[];
  detail: string;
};

type QuerySpec = {
  section: keyof BrandonDailyUpdatePacket["sections"];
  title: string;
  query: string;
  owner?: string;
  status?: string;
  tone?: BriefTone;
};

type RagRow = {
  chunk_id?: string | null;
  document_id?: string | null;
  chunk_index?: number | null;
  chunk_text?: string | null;
  text?: string | null;
  similarity?: number | null;
  source_type?: string | null;
  doc_category?: string | null;
  doc_title?: string | null;
  doc_source?: string | null;
  doc_type?: string | null;
  doc_date?: string | null;
  doc_project_id?: number | null;
  doc_created_at?: string | null;
};

type DocumentMetaRow = {
  id: string;
  title: string | null;
  project: string | null;
  project_id: number | null;
  date: string | null;
  created_at: string | null;
  captured_at: string | null;
  source_system: string | null;
  source: string | null;
  type: string | null;
  category: string | null;
  summary: string | null;
  overview: string | null;
  action_items: string | null;
  content: string | null;
  raw_text: string | null;
  url: string | null;
  source_web_url: string | null;
  fireflies_link: string | null;
  meeting_link: string | null;
};

type RecentCommunicationRow = Pick<
  DocumentMetaRow,
  | "id"
  | "title"
  | "project"
  | "project_id"
  | "date"
  | "created_at"
  | "captured_at"
  | "summary"
  | "overview"
  | "action_items"
  | "source_web_url"
  | "url"
  | "category"
  | "type"
>;

type RecentSourceRow = {
  date?: string | null;
  created_at?: string | null;
  captured_at?: string | null;
  category?: string | null;
  type?: string | null;
};

type OperatingTimelineRow = {
  id: string;
  project_id: number | null;
  event_at: string | null;
  event_type: string | null;
  title: string | null;
  summary: string | null;
  why_it_matters: string | null;
  current_status: string | null;
  owner_label: string | null;
  priority: string | null;
  source_document_id: string | null;
  confidence: string | null;
};

type ChangeCandidateRow = {
  id: string;
  project_id: number | null;
  title: string | null;
  description: string | null;
  reason: string | null;
  potential_cost_impact: string | null;
  potential_schedule_impact: string | null;
  confidence: string | null;
  missing_information: unknown;
  status: string | null;
  created_at: string | null;
};

type ProjectLookupRow = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type CommunicationSignalSpec = {
  id: string;
  section: keyof BrandonDailyUpdatePacket["sections"];
  title: string;
  owner: string;
  status: string;
  tone: BriefTone;
  source: BriefSource;
  categories: Array<NonNullable<RecentCommunicationRow["category"]>>;
  required: string[];
  optional?: string[];
  recommendedAction: string;
  whyItMatters: string;
};

type RankedHit = {
  id: string;
  spec: QuerySpec;
  sourceGroup: SourceGroup;
  row: RagRow;
  metadata?: DocumentMetaRow;
  date: Date | null;
  similarity: number;
  text: string;
};

type RawHit = {
  spec: QuerySpec;
  sourceGroup: SourceGroup;
  row: RagRow;
};

type SynthesizedBriefItem = {
  title: string;
  summary: string;
  evidenceFacts?: string[];
  bullets?: string[];
  recommendedAction?: string;
  whyItMatters?: string;
  // Preferred: one or more candidate indexes whose citations should be attached to this item.
  sourceIndexes?: number[];
  // Backward-compat: older outputs may still emit a single sourceIndex.
  sourceIndex?: number;
  status?: string;
  tone?: BriefTone;
};

type SynthesizedBriefSections = {
  needsBrandon?: SynthesizedBriefItem[];
  waitingOnOthers?: SynthesizedBriefItem[];
  importantUpdates?: SynthesizedBriefItem[];
};

type EnrichedBriefItem = {
  section: keyof BrandonDailyUpdatePacket["sections"];
  index: number;
  summary?: string;
  evidenceFacts?: string[];
  bullets?: string[];
  recommendedAction?: string;
  whyItMatters?: string;
};

type EnrichedBriefItemsPayload = {
  items?: EnrichedBriefItem[];
};

const EXECUTIVE_PRIORITY_LANE_LABELS: Record<ExecutivePriorityLane, string> = {
  cashMargin: "Cash / Billing / Margin",
  scheduleField: "Schedule / Field",
  customerOwner: "Customer / Owner",
  subcontractorVendor: "Subcontractor / Vendor",
  designPreconstruction: "Design / Preconstruction",
  internalAccountability: "Internal Accountability",
};

const SOURCE_GROUPS: SourceGroup[] = [
  {
    label: "Email",
    sourceTypes: ["email"],
    detail: "Recent email evidence",
  },
  {
    label: "Teams",
    sourceTypes: ["teams_dm", "teams_channel"],
    detail: "Recent Teams direct and channel messages",
  },
  {
    label: "Meeting",
    sourceTypes: [
      "meeting_transcript",
      "meeting_summary",
      "meeting_segment_summary",
      "meeting_section",
      "meeting_notes",
      "meeting_summary_embed",
    ],
    detail: "Recent meeting transcripts and summaries",
  },
  {
    label: "Document",
    sourceTypes: ["onedrive_document"],
    detail: "Recent company documents and files",
  },
];

const QUERY_SPECS: QuerySpec[] = [
  {
    section: "needsBrandon",
    title: "Insurance, permit, license, or COI blocker",
    query:
      "urgent insurance issue permit blocker proof of workers compensation WC COI City of Indianapolis license compliance Brandon action needed",
    owner: "Brandon / operations / insurance",
    status: "Needs confirmation",
    tone: "risk",
  },
  {
    section: "needsBrandon",
    title: "Cash, payment, retainage, or collections action",
    query:
      "wire draw payment retainage collections invoice cash issue Brandon Misty finance accounting subcontractor paid unpaid release required",
    owner: "Finance / accounting",
    status: "Executive follow-through",
    tone: "risk",
  },
  {
    section: "needsBrandon",
    title: "People, access, legal, or company-property issue",
    query:
      "employee issue termination legal HR access remove credentials company property recover laptop hotel Brandon escalation",
    owner: "Operations / IT / HR",
    status: "Verify handled",
    tone: "risk",
  },
  {
    section: "waitingOnOthers",
    title: "Pricing, quote, or proposal waiting on someone else",
    query:
      "waiting on pricing quote proposal estimate subcontractor pricing building shell budget report Liverpool CECO Union Collective",
    owner: "Estimating / vendor",
    status: "Waiting on pricing",
    tone: "watch",
  },
  {
    section: "waitingOnOthers",
    title: "Drawings, survey, utility, or client approval blocker",
    query:
      "waiting on drawings survey client feedback design approval utility electrical HVAC civil permit project blocker",
    owner: "Project team / client",
    status: "Waiting on input",
    tone: "watch",
  },
  {
    section: "importantUpdates",
    title: "Project execution, schedule, or site coordination risk",
    query:
      "high priority project execution issue material delay crew coordination safety site logistics shutdown urgent blocker",
    owner: "Project owner",
    status: "Monitor",
    tone: "watch",
  },
  {
    section: "importantUpdates",
    title: "Business, backlog, margin, or finance signal",
    query:
      "financial statement profitability margin backlog cash flow AR AP invoice bill collections pay app retainage business signal",
    owner: "Leadership / finance",
    status: "Monitor",
    tone: "watch",
  },
];

const FALLBACK_KEYWORDS = [
  "Brandon",
  "insurance",
  "license",
  "workers compensation",
  "COI",
  "permit",
  "wire",
  "Wilmer",
  "subcontractor",
  "pricing",
  "quote",
  "proposal",
  "drawing",
  "survey",
  "client feedback",
  "couplings",
  "retainage",
];

const EXECUTIVE_BRIEFING_EMBEDDING_TIMEOUT_MS = 30_000;
const EXECUTIVE_BRIEFING_RAG_SEARCH_TIMEOUT_MS = 20_000;
// gpt-5.5 is a reasoning model and can take 2-3 minutes for a complex synthesis.
// These timeouts were previously 20s which caused consistent fallback to source-backed mode.
const EXECUTIVE_BRIEFING_SYNTHESIS_TIMEOUT_MS = 180_000;
const EXECUTIVE_BRIEFING_ENRICHMENT_TIMEOUT_MS = 120_000;

function withBriefingTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

function compactText(value: unknown, maxLength = 720): string {
  return normalizeText(value).slice(0, maxLength);
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\n\r\t ]+/g, " ")
    .trim();
}

function compactCompleteText(value: unknown, maxLength = 320): string {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("?"),
    clipped.lastIndexOf("!"),
  );
  if (sentenceEnd >= Math.min(80, maxLength - 1)) {
    return clipped.slice(0, sentenceEnd + 1).trim();
  }
  const lastSpace = clipped.lastIndexOf(" ");
  return clipped.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim();
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEasternDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

const EASTERN_WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function easternWeekdayIndex(date: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(date);
  return EASTERN_WEEKDAY_INDEX[label] ?? 1;
}

// Returns the start-of-window date key, counting back `windowDays` BUSINESS days
// (Mon–Fri) from today in Eastern time and skipping weekends. The window covers
// the last N business days so a Monday brief still includes the prior Thursday
// and Friday instead of dragging in week-old, no-longer-relevant noise.
function getWindowStartDateKey(windowDays: number): string {
  const target = Math.max(windowDays, 1);
  const cursor = new Date();
  let counted = 0;
  for (let guard = 0; guard < 31; guard += 1) {
    const day = easternWeekdayIndex(cursor);
    const isBusinessDay = day !== 0 && day !== 6;
    if (isBusinessDay) {
      counted += 1;
      if (counted >= target) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return getEasternDateKey(cursor);
}

export function getRecencyAnchor(row: RecentSourceRow): string | null {
  if (row.category === "document" || row.type === "document") {
    return newestValidDateString([row.date, row.captured_at, row.created_at]);
  }
  return row.date ?? row.captured_at ?? row.created_at ?? null;
}

function newestValidDateString(
  values: Array<string | null | undefined>,
): string | null {
  let newest: { raw: string; time: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const date = parseDate(value);
    if (!date) continue;
    const time = date.getTime();
    if (!newest || time > newest.time) {
      newest = { raw: value, time };
    }
  }
  return newest?.raw ?? null;
}

function isRecentSourceRow(
  row: RecentSourceRow,
  cutoffDateKey: string,
): boolean {
  const anchor = getRecencyAnchor(row);
  const parsed = parseDate(anchor);
  return parsed !== null && getEasternDateKey(parsed) >= cutoffDateKey;
}

export function getHitDateAnchor(
  hit: Pick<RankedHit, "metadata" | "row">,
): string | null {
  const rowSourceCategory =
    hit.metadata?.category ?? hit.row.doc_category ?? null;
  const anchorLikeSource: RecentSourceRow = {
    category: rowSourceCategory,
    date: hit.row.doc_date,
    created_at: hit.row.doc_created_at ?? null,
    captured_at: hit.metadata?.captured_at ?? null,
  };

  return getRecencyAnchor(anchorLikeSource);
}

function formatDate(value: Date | null): string {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatSourceDate(rawValue: string | null | undefined): string {
  if (!rawValue) return "Unknown date";
  const parsed = parseDate(rawValue);
  if (!parsed) return "Unknown date";

  const isUtcDayStamp = /T00:00:00(?:\.000)?(?:\+00:00|Z)$/i.test(rawValue);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(isUtcDayStamp ? { timeZone: "UTC" } : {}),
  }).format(parsed);
}

function formatMonthDayOrdinal(value: Date): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    value,
  );
  const day = value.getDate();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  return `${month} ${day}${suffix}, ${value.getFullYear()}`;
}

function formatMonthDayOrdinalWithoutYear(value: Date): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    value,
  );
  const day = value.getDate();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  return `${month} ${day}${suffix}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(value.getDate() + days);
  return next;
}

function nextMonday(value: Date): Date {
  const daysUntil = (1 - value.getDay() + 7) % 7 || 7;
  return addDays(value, daysUntil);
}

function formatDateRange(start: Date, end: Date): string {
  if (start.getFullYear() === end.getFullYear()) {
    return `${formatMonthDayOrdinalWithoutYear(start)}-${formatMonthDayOrdinal(end)}`;
  }
  return `${formatMonthDayOrdinal(start)}-${formatMonthDayOrdinal(end)}`;
}

const weekdayIndexes: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function expandRelativeWeekdays(value: string, sourceDate: string): string {
  const baseDate = parseDate(sourceDate);
  if (!baseDate) return value;

  const withRelativePeriods = value
    .replace(/\bearly next week\b(?!,\s+[A-Z][a-z]+\s+\d)/gi, (match) => {
      const start = nextMonday(baseDate);
      const end = addDays(start, 2);
      return `${match}, ${formatDateRange(start, end)}`;
    })
    .replace(/\bnext week\b(?!,\s+(?:week of|[A-Z][a-z]+\s+\d))/gi, (match) => {
      const start = nextMonday(baseDate);
      return `${match}, week of ${formatMonthDayOrdinal(start)}`;
    });

  return withRelativePeriods.replace(
    /\bnext\s+(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b(?!,\s+[A-Z][a-z]+\s+\d)/gi,
    (match, weekday: string) => {
      const targetDay = weekdayIndexes[weekday.toLowerCase()];
      if (targetDay === undefined) return match;
      const daysUntil = (targetDay - baseDate.getDay() + 7) % 7 || 7;
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + daysUntil);
      return `${match}, ${formatMonthDayOrdinal(targetDate)}`;
    },
  );
}

function isWithinWindow(value: Date | null, cutoffDateKey: string): boolean {
  return value !== null && getEasternDateKey(value) >= cutoffDateKey;
}

function sourceDetail(hit: RankedHit): string {
  const title = hit.row.doc_title ?? hit.metadata?.title ?? "";
  return compactText(title, 90);
}

function projectLabel(hit: RankedHit): string {
  const project = hit.metadata?.project ?? null;
  return project ?? "No project linked";
}

function projectInternalIdFromHit(hit: RankedHit): number | null {
  return hit.row.doc_project_id ?? hit.metadata?.project_id ?? null;
}

function sourceUrl(row: DocumentMetaRow | undefined): string | undefined {
  const url =
    row?.source_web_url ??
    row?.fireflies_link ??
    row?.meeting_link ??
    row?.url ??
    null;
  return url?.startsWith("http") ? url : undefined;
}

function sourceUrlFromRecentRow(
  row: RecentCommunicationRow,
): string | undefined {
  const url = row.source_web_url ?? row.url ?? null;
  return url?.startsWith("http") ? url : undefined;
}

function evidenceText(hit: RankedHit): string {
  return normalizeText(hit.text);
}

function citationFromHit(hit: RankedHit): BriefCitation {
  const evidence = evidenceText(hit);
  return {
    source: hit.sourceGroup.label,
    sourceDetail: sourceDetail(hit),
    sourceUrl: sourceUrl(hit.metadata),
    sourceId: hit.row.document_id ?? hit.metadata?.id,
    evidence,
    date: formatDate(hit.date),
  };
}

function buildItem(hit: RankedHit): BrandonBriefItem {
  const citation = citationFromHit(hit);
  return {
    title: hit.spec.title,
    summary: citation.evidence ?? "",
    evidenceFacts: [],
    bullets: [],
    source: citation.source,
    sourceDetail: citation.sourceDetail,
    sourceUrl: citation.sourceUrl,
    sourceId: citation.sourceId,
    evidence: citation.evidence,
    date: citation.date,
    citations: [citation],
    project: projectLabel(hit),
    projectInternalId: projectInternalIdFromHit(hit),
    owner: hit.spec.owner,
    status: hit.spec.status,
    tone: hit.spec.tone,
    retrieval: `RAG: search_document_chunks(${hit.sourceGroup.sourceTypes.join(", ")}), sim ${hit.similarity.toFixed(3)}`,
  };
}

function makeFallbackItem(row: DocumentMetaRow): BrandonBriefItem | null {
  // Short text for the item summary; richer text (summary + overview + the
  // fuller `content` field) for the evidence the synthesis model actually
  // reads, so specifics like "7.7 feet from the power lines" survive instead of
  // being lost to a thin auto-summary clip.
  const text = compactText(
    row.summary ?? row.overview ?? row.action_items,
    520,
  );
  const richText = compactCompleteText(
    [row.summary, row.overview, row.content]
      .map((value) => normalizeText(value))
      .filter((value, index, arr) => value && arr.indexOf(value) === index)
      .join(" "),
    2200,
  );
  if (!text && !richText) return null;
  if (!row.title) return null;

  const source =
    row.source_system ??
    row.source ??
    row.type ??
    row.category ??
    "document_metadata";
  const sourceLink = sourceUrl(row);
  const normalizedSource = `${source} ${sourceLink ?? ""}`.toLowerCase();
  const sourceLabel: BriefSource = normalizedSource.includes("team")
    ? "Teams"
    : normalizedSource.includes("fireflies") ||
        normalizedSource.includes("meeting")
      ? "Meeting"
      : normalizedSource.includes("outlook") ||
          normalizedSource.includes("email")
        ? "Email"
        : "Document";
  const citation: BriefCitation = {
    source: sourceLabel,
    sourceDetail: compactText(row.title, 90),
    sourceUrl: sourceLink,
    sourceId: row.id,
    evidence: richText || text,
    date: formatSourceDate(row.date ?? row.created_at ?? row.captured_at),
  };
  if (citation.date === "Unknown date") return null;

  return {
    title: row.title,
    summary: text || richText,
    evidenceFacts: [],
    bullets: [],
    source: citation.source,
    sourceDetail: citation.sourceDetail,
    sourceUrl: citation.sourceUrl,
    sourceId: citation.sourceId,
    evidence: citation.evidence,
    date: citation.date,
    citations: [citation],
    project: row.project ?? "No project linked",
    projectInternalId: row.project_id ?? null,
    status: "Recent source review",
    tone: "neutral",
    retrieval:
      sourceLabel === "Meeting"
        ? "Recent meeting transcript source"
        : "Recent document_metadata keyword match",
  };
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 6);
}

function projectDisplayName(
  projectId: number | null,
  projectsById: Map<number, ProjectLookupRow>,
): string {
  if (!projectId) return "No project linked";
  const project = projectsById.get(projectId);
  const number = normalizeText(project?.project_number);
  const name = normalizeText(project?.name);
  if (number && name) return `${number} ${name}`;
  return name || number || `Project ${projectId}`;
}

function sectionForOperatingTimelineEvent(
  row: OperatingTimelineRow,
): keyof BrandonDailyUpdatePacket["sections"] {
  const priority = normalizeText(row.priority).toLowerCase();
  const status = normalizeText(row.current_status).toLowerCase();
  const type = normalizeText(row.event_type).toLowerCase();

  if (
    priority === "urgent" ||
    status === "needs_decision" ||
    type === "client_concern"
  ) {
    return "needsBrandon";
  }

  if (
    type === "risk" ||
    type === "issue" ||
    type === "schedule_impact" ||
    type === "cost_exposure" ||
    type === "change_event_signal"
  ) {
    return "waitingOnOthers";
  }

  return "importantUpdates";
}

function operatingTimelineItem(
  row: OperatingTimelineRow,
  projectsById: Map<number, ProjectLookupRow>,
): BrandonBriefItem | null {
  const title = compactText(row.title, 140);
  const summary = compactCompleteText(
    [row.summary, row.why_it_matters]
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .join(" "),
    900,
  );
  if (!title || !summary || !row.id || !row.event_at) return null;

  const date = formatSourceDate(row.event_at);
  if (date === "Unknown date") return null;

  const sourceDetail = `${compactText(row.event_type ?? "timeline event", 40)} operating record`;
  const citation: BriefCitation = {
    source: "Document",
    sourceDetail,
    sourceId: row.source_document_id ?? row.id,
    evidence: summary,
    date,
  };

  const tone: BriefTone =
    row.priority === "urgent" || row.priority === "high"
      ? "risk"
      : row.current_status === "resolved"
        ? "good"
        : "watch";

  return {
    title,
    summary,
    evidenceFacts: [row.summary, row.why_it_matters]
      .map((value) => compactCompleteText(value, 260))
      .filter(Boolean),
    bullets: [row.summary, row.why_it_matters]
      .map((value) => compactCompleteText(value, 180))
      .filter(Boolean)
      .slice(0, 4),
    recommendedAction:
      row.current_status === "needs_decision"
        ? "Confirm the owner decision needed and assign the next step today."
        : "Confirm the project owner has the next step documented.",
    whyItMatters: compactCompleteText(row.why_it_matters, 260) || undefined,
    source: citation.source,
    sourceDetail: citation.sourceDetail,
    sourceId: citation.sourceId,
    evidence: citation.evidence,
    date: citation.date,
    citations: [citation],
    project: projectDisplayName(row.project_id, projectsById),
    projectInternalId: row.project_id,
    owner: row.owner_label ?? "Project team",
    status: compactText(
      row.current_status ?? row.priority ?? "Operating record",
      80,
    ),
    tone,
    retrieval: `Project operating record timeline (${row.event_type ?? "event"}, confidence ${row.confidence ?? "unknown"})`,
  };
}

function changeCandidateItem(
  row: ChangeCandidateRow,
  projectsById: Map<number, ProjectLookupRow>,
): BrandonBriefItem | null {
  const title = compactText(row.title, 140);
  const evidenceParts = [
    row.description,
    row.reason,
    row.potential_cost_impact
      ? `Potential cost impact: ${row.potential_cost_impact}`
      : null,
    row.potential_schedule_impact
      ? `Potential schedule impact: ${row.potential_schedule_impact}`
      : null,
    ...asTextArray(row.missing_information).map(
      (item) => `Missing information: ${item}`,
    ),
  ];
  const evidence = compactCompleteText(
    evidenceParts
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .join(" "),
    1100,
  );
  if (!title || !evidence || !row.id || !row.created_at) return null;

  const date = formatSourceDate(row.created_at);
  if (date === "Unknown date") return null;

  const citation: BriefCitation = {
    source: "Document",
    sourceDetail: "Potential change-event operating record",
    sourceId: row.id,
    evidence,
    date,
  };

  return {
    title: `Potential change event: ${title}`,
    summary: evidence,
    evidenceFacts: evidenceParts
      .map((value) => compactCompleteText(value, 260))
      .filter(Boolean)
      .slice(0, 6),
    bullets: evidenceParts
      .map((value) => compactCompleteText(value, 180))
      .filter(Boolean)
      .slice(0, 4),
    recommendedAction:
      "Have the project team review this candidate and either create a change event or dismiss it with a reason.",
    whyItMatters:
      "Potential change exposure is cheaper to document while the source evidence is fresh.",
    source: citation.source,
    sourceDetail: citation.sourceDetail,
    sourceId: citation.sourceId,
    evidence: citation.evidence,
    date: citation.date,
    citations: [citation],
    project: projectDisplayName(row.project_id, projectsById),
    projectInternalId: row.project_id,
    owner: "Project manager",
    status: compactText(row.status ?? "candidate", 80),
    tone: row.confidence === "high" ? "risk" : "watch",
    retrieval: `Project operating record change_event_candidates (confidence ${row.confidence ?? "unknown"})`,
  };
}

async function loadOperatingRecordBriefItems(
  cutoffIso: string,
): Promise<OperatingRecordBriefResult> {
  const supabase = createServiceClient() as unknown as UntypedSupabaseReader;
  const sections: BrandonDailyUpdatePacket["sections"] = {
    needsBrandon: [],
    waitingOnOthers: [],
    importantUpdates: [],
  };
  const warnings: string[] = [];

  const [
    { data: timelineRows, error: timelineError },
    { data: candidateRows, error: candidateError },
  ] = await Promise.all([
    serviceDb.from("project_intelligence_timeline_events")
      .select(
        "id, project_id, event_at, event_type, title, summary, why_it_matters, current_status, owner_label, priority, source_document_id, confidence",
      )
      .gte("event_at", cutoffIso)
      .in("current_status", ["open", "monitoring", "needs_decision"])
      .order("event_at", { ascending: false })
      .limit(60),
    serviceDb.from("change_event_candidates")
      .select(
        "id, project_id, title, description, reason, potential_cost_impact, potential_schedule_impact, confidence, missing_information, status, created_at",
      )
      .in("status", ["candidate", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (timelineError) {
    warnings.push(
      `Operating timeline retrieval failed: ${timelineError.message}`,
    );
  }
  if (candidateError) {
    warnings.push(
      `Change-event candidate retrieval failed: ${candidateError.message}`,
    );
  }

  const rows = [
    ...((timelineRows ?? []) as OperatingTimelineRow[])
      .map((row) => row.project_id)
      .filter((id): id is number => typeof id === "number"),
    ...((candidateRows ?? []) as ChangeCandidateRow[])
      .map((row) => row.project_id)
      .filter((id): id is number => typeof id === "number"),
  ];
  const projectIds = Array.from(new Set(rows));
  const projectsById = new Map<number, ProjectLookupRow>();
  if (projectIds.length > 0) {
    const { data: projects, error: projectsError } = await serviceDb.from("projects")
      .select("id, name, project_number")
      .in("id", projectIds);
    if (projectsError) {
      warnings.push(
        `Operating record project lookup failed: ${projectsError.message}`,
      );
    } else {
      for (const project of (projects ?? []) as ProjectLookupRow[]) {
        projectsById.set(project.id, project);
      }
    }
  }

  for (const row of (timelineRows ?? []) as OperatingTimelineRow[]) {
    const item = operatingTimelineItem(row, projectsById);
    if (!item) continue;
    sections[sectionForOperatingTimelineEvent(row)].push(item);
  }

  for (const row of (candidateRows ?? []) as ChangeCandidateRow[]) {
    const item = changeCandidateItem(row, projectsById);
    if (item) sections.importantUpdates.push(item);
  }

  return {
    sections,
    warnings,
    itemCount:
      sections.needsBrandon.length +
      sections.waitingOnOthers.length +
      sections.importantUpdates.length,
  };
}

const COMMUNICATION_SIGNAL_SPECS: CommunicationSignalSpec[] = [
  {
    id: "insurance_compliance",
    section: "needsBrandon",
    title: "Insurance, COI, or permit issue still blocking the business",
    owner: "Brandon / operations / insurance",
    status: "Needs confirmation",
    tone: "risk",
    source: "Email",
    categories: ["email"],
    required: ["insurance"],
    optional: [
      "permit",
      "coi",
      "workers compensation",
      "license",
      "str26",
      "indianapolis",
    ],
    recommendedAction:
      "Confirm the current COI and workers compensation proof are in hand and that the permit or license blocker is fully cleared.",
    whyItMatters:
      "This is the kind of administrative failure that can quietly stop work or suspend the company until someone closes the loop.",
  },
  {
    id: "retainage_release",
    section: "needsBrandon",
    title: "Retainage or payment release issue needs a clean answer",
    owner: "Accounting / PM",
    status: "Needs confirmation",
    tone: "watch",
    source: "Email",
    categories: ["email"],
    required: ["retainage"],
    optional: ["release", "deem", "check run", "owed", "invoice", "payment"],
    recommendedAction:
      "Confirm the amount owed, whether the payment is actually queued, and whether the field team still sees a mismatch between Job Planner and Acumatica.",
    whyItMatters:
      "Payment ambiguity creates immediate trust and execution problems with subcontractors.",
  },
  {
    id: "pricing_wait",
    section: "waitingOnOthers",
    title: "Pricing or proposal follow-up is still waiting on someone else",
    owner: "Estimating / vendor",
    status: "Waiting on pricing",
    tone: "watch",
    source: "Email",
    categories: ["email"],
    required: ["pricing"],
    optional: ["quote", "proposal", "liverpool", "ceco", "development"],
    recommendedAction:
      "Push for the missing pricing input so the team can make a yes/no decision instead of carrying the thread another day.",
    whyItMatters:
      "This is pipeline work that tends to get ignored unless it is turned into a named executive follow-up.",
  },
  {
    id: "finance_dm",
    section: "needsBrandon",
    title: "Same-day Teams finance thread needs follow-through",
    owner: "Finance / accounting",
    status: "Executive follow-through",
    tone: "watch",
    source: "Teams",
    categories: ["teams_message"],
    required: ["financial"],
    optional: [
      "payment",
      "transaction",
      "wire",
      "accounting",
      "misty",
      "check",
    ],
    recommendedAction:
      "Confirm who owns the next step and whether the issue is resolved outside the DM thread.",
    whyItMatters:
      "Same-day finance DMs are often where cash or approval issues first show up before they are reflected anywhere else.",
  },
];

function getRecentCommunicationText(row: RecentCommunicationRow): string {
  return normalizeText(row.overview ?? row.summary ?? row.action_items);
}

function getSignalScore(
  haystack: string,
  spec: CommunicationSignalSpec,
): number {
  const requiredMatches = spec.required.filter((keyword) =>
    haystack.includes(keyword),
  );
  if (requiredMatches.length === 0) return 0;
  const optionalMatches = (spec.optional ?? []).filter((keyword) =>
    haystack.includes(keyword),
  );
  return requiredMatches.length * 5 + optionalMatches.length;
}

function buildCommunicationSignalItem(
  row: RecentCommunicationRow,
  spec: CommunicationSignalSpec,
  evidenceCount: number,
  additionalRows: RecentCommunicationRow[] = [],
): BrandonBriefItem | null {
  const evidence = getRecentCommunicationText(row);
  const summary = compactText(evidence, 360);
  if (!summary || !row.title) return null;

  const primaryCitation: BriefCitation = {
    source: spec.source,
    sourceDetail: compactText(row.title, 90),
    sourceUrl: sourceUrlFromRecentRow(row),
    sourceId: row.id,
    evidence,
    date: formatSourceDate(row.date ?? row.created_at ?? row.captured_at),
  };
  if (primaryCitation.date === "Unknown date") return null;

  const extraCitations: BriefCitation[] = additionalRows
    .slice(0, 4)
    .map((extra) => ({
      source: spec.source,
      sourceDetail: compactText(extra.title ?? "", 90),
      sourceUrl: sourceUrlFromRecentRow(extra),
      sourceId: extra.id,
      evidence: getRecentCommunicationText(extra),
      date: formatSourceDate(
        extra.date ?? extra.created_at ?? extra.captured_at,
      ),
    }))
    .filter(
      (citation) =>
        citation.sourceDetail &&
        citation.evidence &&
        citation.date !== "Unknown date",
    );

  return {
    title: spec.title,
    summary,
    evidenceFacts: [
      evidenceCount > 1
        ? `${evidenceCount} recent related communication records matched this issue.`
        : "",
      ...[primaryCitation, ...extraCitations]
        .map((citation) => compactText(citation.evidence, 180))
        .filter(Boolean),
    ]
      .filter(Boolean)
      .slice(0, 6),
    bullets: [
      evidenceCount > 1
        ? `${evidenceCount} recent related communication records matched this issue.`
        : "",
      row.title ? compactText(row.title, 140) : "",
      "",
    ].filter(Boolean),
    recommendedAction: spec.recommendedAction,
    whyItMatters: spec.whyItMatters,
    source: primaryCitation.source,
    sourceDetail: primaryCitation.sourceDetail,
    sourceUrl: primaryCitation.sourceUrl,
    sourceId: primaryCitation.sourceId,
    evidence: primaryCitation.evidence,
    date: primaryCitation.date,
    citations: [primaryCitation, ...extraCitations],
    project: row.project ?? "No project linked",
    projectInternalId: row.project_id ?? null,
    owner: spec.owner,
    status: spec.status,
    tone: spec.tone,
    retrieval: `Recent communication signal: ${spec.id}`,
  };
}

async function loadRecentCommunicationSignalItems(
  cutoffIso: string,
): Promise<RecentCommunicationSignalResult> {
  const supabase = createServiceClient();
  const cutoffDateKey = getEasternDateKey(
    parseDate(cutoffIso) ?? new Date(cutoffIso),
  );
  const sections: BrandonDailyUpdatePacket["sections"] = {
    needsBrandon: [],
    waitingOnOthers: [],
    importantUpdates: [],
  };
  const warnings: string[] = [];

  const selectClause =
    "id,title,project,project_id,date,created_at,captured_at,summary,overview,action_items,source_web_url,url,status,category,type";

  const [
    { data: emailRows, error: emailError },
    { data: teamsRows, error: teamsError },
  ] = await Promise.all([
    serviceDb.from("document_metadata")
      .select(selectClause)
      .eq("category", "email")
      .or(
        `date.gte.${cutoffIso},created_at.gte.${cutoffIso},captured_at.gte.${cutoffIso}`,
      )
      .order("created_at", { ascending: false })
      .limit(250),
    serviceDb.from("document_metadata")
      .select(selectClause)
      .eq("category", "teams_message")
      .or(
        `date.gte.${cutoffIso},created_at.gte.${cutoffIso},captured_at.gte.${cutoffIso}`,
      )
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  if (emailError) {
    warnings.push(`Email signal retrieval failed: ${emailError.message}`);
  }

  if (teamsError) {
    warnings.push(`Teams signal retrieval failed: ${teamsError.message}`);
  }

  if (emailError && teamsError) {
    return { sections, warnings };
  }

  const rows = (
    [...(emailRows ?? []), ...(teamsRows ?? [])] as RecentCommunicationRow[]
  ).filter((row) => isRecentSourceRow(row, cutoffDateKey));

  for (const spec of COMMUNICATION_SIGNAL_SPECS) {
    const matches = rows
      .filter((row) =>
        spec.categories.includes(
          (row.category ?? "") as NonNullable<
            RecentCommunicationRow["category"]
          >,
        ),
      )
      .map((row) => {
        const haystack =
          `${row.title ?? ""} ${getRecentCommunicationText(row)}`.toLowerCase();
        const score = getSignalScore(haystack, spec);
        return { row, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTime = parseDate(getRecencyAnchor(a.row))?.getTime() ?? 0;
        const bTime = parseDate(getRecencyAnchor(b.row))?.getTime() ?? 0;
        return bTime - aTime;
      });

    if (matches.length === 0) continue;
    const [primary, ...rest] = matches;
    const item = buildCommunicationSignalItem(
      primary.row,
      spec,
      matches.length,
      rest.map((entry) => entry.row),
    );
    if (item) {
      sections[spec.section].push(item);
    } else {
      warnings.push(
        `Recent communication signal ${spec.id} was suppressed because the matched row lacked source text, title, or a valid date.`,
      );
    }
  }

  return { sections, warnings };
}

async function runChunkSearch(
  query: string,
  sourceGroup: SourceGroup,
): Promise<RagRow[]> {
  return retrieveChunks({
    query,
    openai: getOpenAI(),
    ragClient: createRagServiceClient(),
    sourceTypes: sourceGroup.sourceTypes,
    matchCount: 10,
    matchThreshold: 0.08,
    errorLabel: `Daily Brief chunk search for ${sourceGroup.label}`,
  });
}

async function loadMetadata(
  documentIds: string[],
): Promise<Map<string, DocumentMetaRow>> {
  if (documentIds.length === 0) return new Map();
  const supabase = createServiceClient();

  // Chunk IDs to avoid URL length limits and reduce connection pressure.
  const CHUNK_SIZE = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < documentIds.length; i += CHUNK_SIZE) {
    chunks.push(documentIds.slice(i, i + CHUNK_SIZE));
  }

  const results: DocumentMetaRow[] = [];
  for (const chunk of chunks) {
    const { data, error } = await serviceDb.from("document_metadata")
      .select(
        "id,title,project,project_id,date,created_at,captured_at,source_system,source,type,category,summary,overview,action_items,content,raw_text,url,source_web_url,fireflies_link,meeting_link",
      )
      .in("id", chunk);

    if (error) {
      // Metadata is optional enrichment — log but don't abort the brief.
      console.warn(
        `[daily-brief] document_metadata chunk lookup failed (${chunk.length} ids): ${error.message}`,
      );
      continue;
    }
    results.push(...((data ?? []) as DocumentMetaRow[]));
  }

  return new Map(results.map((row) => [row.id, row]));
}

async function loadFallbackMetadata(
  cutoff: Date,
  limit = 8,
): Promise<FallbackMetadataResult> {
  const supabase = createServiceClient();
  const cutoffIso = cutoff.toISOString();
  const { data, error } = await serviceDb.from("document_metadata")
    .select(
      "id,title,project,project_id,date,created_at,captured_at,source_system,source,type,category,summary,overview,action_items,content,raw_text,url,source_web_url,fireflies_link,meeting_link",
    )
    .gte("created_at", cutoffIso)
    .or(
      FALLBACK_KEYWORDS.map((keyword) => `summary.ilike.%${keyword}%`).join(
        ",",
      ),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      rows: [],
      warnings: [`Document fallback retrieval failed: ${error.message}`],
    };
  }

  return {
    rows: (data ?? []) as DocumentMetaRow[],
    warnings: [],
  };
}

async function loadRecentMeetingTranscriptItems(
  cutoffIso: string,
  limit = 24,
): Promise<RecentTranscriptResult> {
  // Content Source owns the window predicate, the document_metadata read, and
  // int8 project-id resolution (deduped from ~6 copies). We keep only brandon's
  // own presentation mapping, sourced from each item's `raw` document row.
  let content;
  try {
    content = await getProjectContent({
      window: { since: cutoffIso },
      granularity: "full",
      sourceTypes: ["meeting"],
      limit,
    });
  } catch (error) {
    return {
      items: [],
      warnings: [
        `Recent meeting transcript retrieval failed: ${(error as Error).message}`,
      ],
    };
  }

  const items = content
    .map((c) => (c.raw ? makeFallbackItem(c.raw as unknown as DocumentMetaRow) : null))
    .filter((item): item is BrandonBriefItem => item !== null)
    .map((item) => ({
      ...item,
      source: "Meeting" as const,
      tone: item.tone === "neutral" ? ("watch" as const) : item.tone,
      status: "Recent meeting transcript",
      retrieval: "Transcript-first daily brief source",
    }));

  return { items, warnings: [] };
}

async function loadRecentSourceCoverage(
  cutoffIso: string,
): Promise<BrandonBriefSourceCoverage[]> {
  const supabase = createServiceClient();
  const cutoffDateKey = getEasternDateKey(
    parseDate(cutoffIso) ?? new Date(cutoffIso),
  );
  const queryCutoffIso = `${cutoffDateKey}T00:00:00.000Z`;

  const coverageQueries = await Promise.all(
    SOURCE_GROUPS.map(async (group) => {
      let rowsQuery = serviceDb.from("document_metadata")
        .select("date,created_at,captured_at,category,type")
        .or(
          `date.gte.${queryCutoffIso},created_at.gte.${queryCutoffIso},captured_at.gte.${queryCutoffIso}`,
        );

      if (group.label === "Email") {
        rowsQuery = rowsQuery.eq("category", "email");
      } else if (group.label === "Teams") {
        rowsQuery = rowsQuery.eq("category", "teams_message");
      } else if (group.label === "Meeting") {
        rowsQuery = rowsQuery.eq("type", "meeting");
      } else {
        rowsQuery = rowsQuery.eq("category", "document");
      }

      const { data: rows, error } = await rowsQuery.limit(2500);
      if (error) {
        return {
          label: group.label,
          detail: group.detail,
          count: 0,
          latest: "Unknown date",
          status: "warning" as const,
          warning: `${group.label} source coverage failed: ${error.message}`,
        };
      }

      const recentRows = ((rows ?? []) as RecentSourceRow[]).filter((row) =>
        isRecentSourceRow(row, cutoffDateKey),
      );
      const latestValue =
        recentRows
          .map((row) => getRecencyAnchor(row))
          .filter((value): value is string => Boolean(value))
          .sort()
          .reverse()[0] ?? null;

      return {
        label: group.label,
        detail: group.detail,
        count: recentRows.length,
        latest: formatSourceDate(latestValue),
        status:
          recentRows.length > 0 ? ("loaded" as const) : ("empty" as const),
      };
    }),
  );

  return coverageQueries;
}

export async function loadLiveBrandonSourceCoverage(
  windowDays = DEFAULT_EXECUTIVE_WINDOW_DAYS,
): Promise<BrandonBriefSourceCoverage[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(windowDays - 1, 0));
  return loadRecentSourceCoverage(cutoff.toISOString());
}

function dedupeHits(hits: RankedHit[]): RankedHit[] {
  const byDocument = new Map<string, RankedHit>();
  for (const hit of hits) {
    const documentId = hit.row.document_id ?? hit.row.chunk_id ?? hit.text;
    const existing = byDocument.get(documentId);
    if (!existing || hit.similarity > existing.similarity) {
      byDocument.set(documentId, hit);
    }
  }
  return [...byDocument.values()].sort((a, b) => b.similarity - a.similarity);
}

function assignHitsToSections(
  hits: RankedHit[],
  fallbacks: BrandonBriefItem[],
): BrandonDailyUpdatePacket["sections"] {
  const sections: BrandonDailyUpdatePacket["sections"] = {
    needsBrandon: [],
    waitingOnOthers: [],
    importantUpdates: [],
  };

  for (const hit of hits) {
    sections[hit.spec.section].push(buildItem(hit));
  }

  for (const fallback of fallbacks) {
    sections.importantUpdates.push(fallback);
  }

  return sections;
}

function mergeSeedItems(
  sections: BrandonDailyUpdatePacket["sections"],
  seedSections: BrandonDailyUpdatePacket["sections"],
): BrandonDailyUpdatePacket["sections"] {
  const dedupe = (items: BrandonBriefItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.title.toLowerCase()}|${item.project.toLowerCase()}|${item.sourceDetail.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    needsBrandon: dedupe([
      ...seedSections.needsBrandon,
      ...sections.needsBrandon,
    ]),
    waitingOnOthers: dedupe([
      ...seedSections.waitingOnOthers,
      ...sections.waitingOnOthers,
    ]),
    importantUpdates: dedupe([
      ...seedSections.importantUpdates,
      ...sections.importantUpdates,
    ]),
  };
}

function briefItemSupportIssues(item: BrandonBriefItem): string[] {
  const issues: string[] = [];

  if (!item.title.trim()) issues.push("missing title");
  if (!item.summary.trim()) issues.push("missing summary");
  if (!item.project.trim()) issues.push("missing project label");
  if (!item.sourceDetail.trim()) issues.push("missing source detail");
  if (!item.date.trim() || item.date === "Unknown date")
    issues.push("missing valid source date");
  if (!item.sourceId && !item.sourceUrl)
    issues.push("missing source id or source url");
  if (!Array.isArray(item.citations) || item.citations.length === 0) {
    issues.push("missing citations");
  }

  item.citations.forEach((citation, index) => {
    const prefix = `citation ${index + 1}`;
    if (!citation.sourceDetail.trim())
      issues.push(`${prefix} missing source detail`);
    if (!citation.evidence?.trim()) issues.push(`${prefix} missing evidence`);
    if (!citation.date.trim() || citation.date === "Unknown date")
      issues.push(`${prefix} missing valid source date`);
    if (!citation.sourceId && !citation.sourceUrl)
      issues.push(`${prefix} missing source id or source url`);
  });

  return issues;
}

export function shouldSuppressDailyBriefAccountingItem(
  item: BrandonBriefItem,
): boolean {
  const text = dailyBriefItemSearchText(item);
  const sourceDetail = item.sourceDetail.toLowerCase();
  const retrieval = (item.retrieval ?? "").toLowerCase();

  const isAccountingSource =
    sourceDetail.includes("acumatica") ||
    retrieval.startsWith("financial pulse:");
  if (!isAccountingSource) return false;

  return hasAny(text, [
    "accounts payable",
    "accounts receivable",
    "ar aging",
    "ap aging",
    "overdue ar",
    "open ar",
    "past due",
    "money due",
    "receivable",
    "collections",
    "invoice is due",
    "invoice due",
    "cash flow",
  ]);
}

function dailyBriefItemSearchText(item: BrandonBriefItem): string {
  return [
    item.title,
    item.summary,
    item.sourceDetail,
    item.recommendedAction,
    item.whyItMatters,
    item.evidence,
    ...(item.evidenceFacts ?? []),
    ...item.bullets,
    ...item.citations.map((citation) => citation.evidence ?? ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function shouldSuppressDailyBriefSolicitationItem(
  item: BrandonBriefItem,
): boolean {
  if (item.source !== "Email") return false;

  const text = dailyBriefItemSearchText(item);
  const hasExternalSolicitationMarker = hasAny(text, [
    "you don't often get email from",
    "learn why this is important",
    "immediate opportunity",
    "equity investor",
    "portfolio we are building",
    "marketing provide some background",
    "provide some background on us",
    "attached is the s/u",
    "box link below",
    "bury you with some information",
  ]);
  if (!hasExternalSolicitationMarker) return false;

  const hasActiveAlleatoExecutionMarker = hasAny(text, [
    "rfi",
    "submittal",
    "change order",
    "change event",
    "permit",
    "schedule delay",
    "field crew",
    "pay application",
    "commitment",
    "contract amendment",
    "client approval",
    "owner approval",
    "project manager",
    "work is blocked",
    "work blocked",
  ]);

  return !hasActiveAlleatoExecutionMarker;
}

export function shouldSuppressDailyBriefGenericItem(
  item: BrandonBriefItem,
): boolean {
  const title = item.title.trim().toLowerCase();
  const genericTitles = new Set([
    "risks and exposure",
    "recommended actions",
    "what changed",
    "recommended next steps",
    "next steps",
    "open items",
    "project update",
    "status update",
  ]);
  if (genericTitles.has(title)) return true;

  const text = dailyBriefItemSearchText(item);
  return (title.length < 8 || (genericTitles.has(title.replace(/:$/, "")) && !hasAny(text, [
    "permit",
    "rfi",
    "submittal",
    "change order",
    "client",
    "owner",
    "deadline",
  ])));
}

function filterSupportedSections(
  sections: BrandonDailyUpdatePacket["sections"],
): SupportedSectionsResult {
  const warnings: string[] = [];

  const filterItems = (
    section: keyof BrandonDailyUpdatePacket["sections"],
    items: BrandonBriefItem[],
  ) =>
    items.filter((item) => {
      if (shouldSuppressDailyBriefAccountingItem(item)) {
        warnings.push(
          `Suppressed ${section} item "${item.title || "(untitled)"}" because accounting aging and money-due signals are temporarily excluded from the Daily Brief.`,
        );
        return false;
      }
      if (shouldSuppressDailyBriefSolicitationItem(item)) {
        warnings.push(
          `Suppressed ${section} item "${item.title || "(untitled)"}" because it looks like external solicitation or cold opportunity email rather than an active Alleato project obligation.`,
        );
        return false;
      }
      if (shouldSuppressDailyBriefGenericItem(item)) {
        warnings.push(
          `Suppressed ${section} item "${item.title || "(untitled)"}" because the title is a generic card heading rather than an executive-ready business issue.`,
        );
        return false;
      }
      const issues = briefItemSupportIssues(item);
      if (issues.length === 0) return true;
      warnings.push(
        `Suppressed unsupported ${section} item "${item.title || "(untitled)"}": ${issues.join(", ")}.`,
      );
      return false;
    });

  return {
    sections: {
      needsBrandon: filterItems("needsBrandon", sections.needsBrandon),
      waitingOnOthers: filterItems("waitingOnOthers", sections.waitingOnOthers),
      importantUpdates: filterItems(
        "importantUpdates",
        sections.importantUpdates,
      ),
    },
    warnings,
  };
}

function capExecutiveBriefSections(
  sections: BrandonDailyUpdatePacket["sections"],
): BrandonDailyUpdatePacket["sections"] {
  const needsBrandon = rankBriefItems(sections.needsBrandon, "needsBrandon");
  const waitingOnOthers = rankBriefItems(
    sections.waitingOnOthers,
    "waitingOnOthers",
  );
  const importantUpdates = rankBriefItems(
    sections.importantUpdates,
    "importantUpdates",
  );
  const needsBrandonLimit = 5;
  const waitingLimit = 8;
  const updatesLimit = 6;
  const overflowFromNeeds = needsBrandon
    .slice(needsBrandonLimit)
    .map((item) => ({
      ...item,
      recommendedAction:
        item.recommendedAction ??
        "Assign the project owner to confirm whether this needs Brandon.",
    }));
  const waitingWithOverflow = rankBriefItems(
    [...waitingOnOthers, ...overflowFromNeeds],
    "waitingOnOthers",
  );

  return {
    needsBrandon: needsBrandon.slice(0, needsBrandonLimit),
    waitingOnOthers: waitingWithOverflow.slice(0, waitingLimit),
    importantUpdates: importantUpdates.slice(0, updatesLimit),
  };
}

function rankBriefItems(
  items: BrandonBriefItem[],
  section: keyof BrandonDailyUpdatePacket["sections"],
): BrandonBriefItem[] {
  return [...items].sort(
    (left, right) =>
      scoreBriefItem(right, section).score -
      scoreBriefItem(left, section).score,
  );
}

function countBriefItems(
  sections: BrandonDailyUpdatePacket["sections"],
): number {
  return (
    sections.needsBrandon.length +
    sections.waitingOnOthers.length +
    sections.importantUpdates.length
  );
}

function isMeetingTranscriptItem(item: BrandonBriefItem): boolean {
  const retrieval = item.retrieval?.toLowerCase() ?? "";
  return (
    item.source === "Meeting" &&
    (retrieval.includes("transcript") ||
      item.citations.some((citation) =>
        citation.sourceDetail.toLowerCase().includes("meeting"),
      ))
  );
}

export function executiveBriefSectionCounts(
  sections: BrandonDailyUpdatePacket["sections"],
) {
  return {
    needsBrandon: sections.needsBrandon.length,
    waitingOnOthers: sections.waitingOnOthers.length,
    importantUpdates: sections.importantUpdates.length,
    total: countBriefItems(sections),
  };
}

export function executiveBriefSourceDescriptors(
  sections: BrandonDailyUpdatePacket["sections"],
  limit = 20,
) {
  return [
    ...sections.needsBrandon.map((item) => ({
      section: "needsBrandon" as const,
      item,
    })),
    ...sections.waitingOnOthers.map((item) => ({
      section: "waitingOnOthers" as const,
      item,
    })),
    ...sections.importantUpdates.map((item) => ({
      section: "importantUpdates" as const,
      item,
    })),
  ]
    .slice(0, limit)
    .map(({ section, item }) => ({
      section,
      title: compactText(item.title, 120),
      project: compactText(item.project, 120),
      source: item.source,
      sourceDetail: compactText(item.sourceDetail, 120),
      sourceId: item.sourceId ?? null,
      date: item.date,
      retrieval: item.retrieval ?? null,
      citationCount: item.citations.length,
    }));
}

export function executiveBriefSourceSelectionSummary(
  sections: BrandonDailyUpdatePacket["sections"],
  warnings: string[] = [],
) {
  return {
    sectionCounts: executiveBriefSectionCounts(sections),
    selectedSources: executiveBriefSourceDescriptors(sections),
    warningCount: warnings.length,
    warnings: warnings.slice(0, 12),
  };
}

function rawHitGroupsSummary(groups: RawHit[][]) {
  const bySource: Record<string, number> = {};
  const byQuery: Record<string, number> = {};
  let totalRows = 0;
  let maxSimilarity = 0;

  for (const group of groups) {
    for (const hit of group) {
      totalRows += 1;
      bySource[hit.sourceGroup.label] =
        (bySource[hit.sourceGroup.label] ?? 0) + 1;
      byQuery[hit.spec.title] = (byQuery[hit.spec.title] ?? 0) + 1;
      maxSimilarity = Math.max(maxSimilarity, hit.row.similarity ?? 0);
    }
  }

  return {
    totalRows,
    groupCount: groups.length,
    bySource,
    byQuery,
    maxSimilarity: Number(maxSimilarity.toFixed(3)),
  };
}

export function limitSectionsForSynthesis(
  sections: BrandonDailyUpdatePacket["sections"],
): { sections: BrandonDailyUpdatePacket["sections"]; droppedCount: number } {
  const originalCount = countBriefItems(sections);
  const needsBrandon = rankBriefItems(
    sections.needsBrandon,
    "needsBrandon",
  ).slice(0, 5);
  const waitingOnOthers = rankBriefItems(
    sections.waitingOnOthers,
    "waitingOnOthers",
  ).slice(0, 5);
  const rankedImportantUpdates = rankBriefItems(
    sections.importantUpdates,
    "importantUpdates",
  );
  const protectedTranscriptUpdates = rankedImportantUpdates
    .filter(isMeetingTranscriptItem)
    .slice(0, 8);
  const importantUpdates = [
    ...protectedTranscriptUpdates,
    ...rankedImportantUpdates.filter(
      (item) => !protectedTranscriptUpdates.includes(item),
    ),
  ].slice(0, Math.max(6, protectedTranscriptUpdates.length));
  const limitedSections = { needsBrandon, waitingOnOthers, importantUpdates };

  return {
    sections: limitedSections,
    droppedCount: Math.max(originalCount - countBriefItems(limitedSections), 0),
  };
}

function sectionEntries(sections: BrandonDailyUpdatePacket["sections"]) {
  return [
    ...sections.needsBrandon.map((item) => ({
      section: "needsBrandon" as const,
      item,
    })),
    ...sections.waitingOnOthers.map((item) => ({
      section: "waitingOnOthers" as const,
      item,
    })),
    ...sections.importantUpdates.map((item) => ({
      section: "importantUpdates" as const,
      item,
    })),
  ];
}

function briefItemDedupeKey(item: BrandonBriefItem) {
  return [
    item.title.trim().toLowerCase(),
    item.project.trim().toLowerCase(),
    item.sourceId?.trim().toLowerCase() ?? item.sourceDetail.trim().toLowerCase(),
  ].join("|");
}

function normalizedMeetingProjectLabel(item: BrandonBriefItem): string {
  if (item.source !== "Meeting") return item.project;
  const current = item.project.trim();
  const generic = new Set([
    "",
    "no project linked",
    "alleato finance",
    "company-wide",
    "company wide",
    "w",
  ]);
  if (!generic.has(current.toLowerCase())) return current;

  const text = briefItemText(item);
  if (hasAny(text, ["440 w", "homeowners", "bid increase"])) return "440 W";
  if (hasAny(text, ["sprinkler", "mains", "verticals", "overhead tie"]))
    return "Alleato Internal Ops";
  if (hasAny(text, ["world insurance", "auto-owners", "certificate"]))
    return "Company insurance";
  if (
    hasAny(text, [
      "large pursuit",
      "pursuit",
      "two contractors",
      "same building",
      "award drops",
      "smaller scope",
    ])
  ) {
    return "Business Development";
  }

  const sourceDetail = compactText(item.sourceDetail, 80);
  return sourceDetail || "Company operations";
}

function normalizeMeetingProjectLabelsInSections(
  sections: BrandonDailyUpdatePacket["sections"],
): BrandonDailyUpdatePacket["sections"] {
  return mapBriefSections(sections, (item) => ({
    ...item,
    project: normalizedMeetingProjectLabel(item),
  }));
}

function uniqueProjectLabels(sections: BrandonDailyUpdatePacket["sections"]) {
  return new Set(
    sectionEntries(sections)
      .map(({ item }) => item.project.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function ensureExecutiveBriefSourceBreadth(
  sections: BrandonDailyUpdatePacket["sections"],
  sourceSections: BrandonDailyUpdatePacket["sections"],
  options: {
    minItems?: number;
    minProjectLabels?: number;
    maxAddedItems?: number;
  } = {},
): BrandonDailyUpdatePacket["sections"] {
  const minItems = options.minItems ?? 6;
  const minProjectLabels = options.minProjectLabels ?? 4;
  const maxAddedItems = options.maxAddedItems ?? 6;
  const currentProjectLabels = uniqueProjectLabels(sections);

  if (
    countBriefItems(sections) >= minItems &&
    currentProjectLabels.size >= minProjectLabels
  ) {
    return sections;
  }

  const result: BrandonDailyUpdatePacket["sections"] = {
    needsBrandon: [...sections.needsBrandon],
    waitingOnOthers: [...sections.waitingOnOthers],
    importantUpdates: [...sections.importantUpdates],
  };
  const seen = new Set(sectionEntries(result).map(({ item }) => briefItemDedupeKey(item)));
  const candidates = sectionEntries(sourceSections)
    .filter(({ item }) => !seen.has(briefItemDedupeKey(item)))
    .sort((left, right) => {
      const leftProjectSeen = currentProjectLabels.has(
        left.item.project.trim().toLowerCase(),
      );
      const rightProjectSeen = currentProjectLabels.has(
        right.item.project.trim().toLowerCase(),
      );
      if (leftProjectSeen !== rightProjectSeen) return leftProjectSeen ? 1 : -1;
      return (
        scoreBriefItem(right.item, right.section).score -
        scoreBriefItem(left.item, left.section).score
      );
    });

  let added = 0;
  for (const candidate of candidates) {
    if (added >= maxAddedItems) break;
    if (
      countBriefItems(result) >= minItems &&
      uniqueProjectLabels(result).size >= minProjectLabels
    ) {
      break;
    }
    result[candidate.section].push(candidate.item);
    currentProjectLabels.add(candidate.item.project.trim().toLowerCase());
    seen.add(briefItemDedupeKey(candidate.item));
    added += 1;
  }

  return result;
}

export function executiveBriefThinContentWarnings(
  sections: BrandonDailyUpdatePacket["sections"],
  sourceCoverage: BrandonBriefSourceCoverage[],
): string[] {
  const warnings: string[] = [];
  const itemCount = countBriefItems(sections);
  const projectCount = uniqueProjectLabels(sections).size;
  const meetingCount =
    sourceCoverage.find((source) => source.label === "Meeting")?.count ?? 0;
  const totalSourceCount = sourceCoverage.reduce(
    (total, source) => total + source.count,
    0,
  );

  if (meetingCount >= 5 && itemCount < 6) {
    warnings.push(
      `Executive Daily Brief degraded: ${meetingCount} meeting transcript(s) were available, but only ${itemCount} final item(s) survived synthesis. The generator must preserve more transcript-backed business context before the brief is trusted.`,
    );
  }

  if (meetingCount >= 10 && projectCount < 4) {
    warnings.push(
      `Executive Daily Brief degraded: ${meetingCount} meeting transcript(s) were available, but the final brief represents only ${projectCount} project/context label(s). This is a source-funnel collapse, not a healthy executive synthesis.`,
    );
  }

  if (totalSourceCount >= 50 && itemCount < 6) {
    warnings.push(
      `Executive Daily Brief degraded: ${totalSourceCount} source record(s) were loaded, but only ${itemCount} final item(s) were produced. Source coverage is not sufficient proof of brief quality.`,
    );
  }

  return warnings;
}

function stripJsonFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeSynthesizedItem(
  item: SynthesizedBriefItem,
  candidates: BrandonBriefItem[],
  usedSourceIndexes: Set<number>,
): BrandonBriefItem | null {
  const rawIndexes =
    item.sourceIndexes && item.sourceIndexes.length > 0
      ? item.sourceIndexes
      : typeof item.sourceIndex === "number"
        ? [item.sourceIndex]
        : [];
  const validIndexes = rawIndexes
    .filter(
      (idx) =>
        Number.isInteger(idx) &&
        candidates[idx] !== undefined &&
        !usedSourceIndexes.has(idx),
    )
    .slice(0, 5);
  if (validIndexes.length === 0) return null;
  if (!item.title || !item.summary) return null;

  for (const idx of validIndexes) {
    usedSourceIndexes.add(idx);
  }

  const primary = candidates[validIndexes[0]];
  const mergedCitations: BriefCitation[] = [];
  const seenCitationKeys = new Set<string>();
  for (const idx of validIndexes) {
    for (const citation of candidates[idx].citations) {
      const key = `${citation.source}|${citation.sourceId ?? citation.sourceUrl ?? citation.sourceDetail}`;
      if (seenCitationKeys.has(key)) continue;
      seenCitationKeys.add(key);
      mergedCitations.push(citation);
    }
  }

  const primaryCitation = mergedCitations[0] ?? primary.citations[0];

  const evidenceFacts = (item.evidenceFacts ?? [])
    .map((fact) => expandRelativeWeekdays(compactText(fact, 220), primary.date))
    .filter(Boolean)
    .slice(0, 6);
  const summary = expandRelativeWeekdays(
    compactText(item.summary, 420),
    primary.date,
  );
  const recommendedAction = item.recommendedAction
    ? expandRelativeWeekdays(
        compactText(item.recommendedAction, 220),
        primary.date,
      )
    : primary.recommendedAction;
  const whyItMatters = item.whyItMatters
    ? expandRelativeWeekdays(compactText(item.whyItMatters, 220), primary.date)
    : primary.whyItMatters;

  return {
    ...primary,
    title: compactText(item.title, 120),
    project: normalizedMeetingProjectLabel({
      ...primary,
      title: compactText(item.title, 120),
      summary,
      evidenceFacts,
      recommendedAction,
      whyItMatters,
      citations: mergedCitations,
      source: primaryCitation.source,
      sourceDetail: primaryCitation.sourceDetail,
      evidence: primaryCitation.evidence,
    }),
    summary,
    evidenceFacts,
    bullets: getExecutiveBriefBullets({
      bullets: item.bullets,
      evidenceFacts,
      summary,
      recommendedAction,
      whyItMatters,
      status: item.status ?? primary.status,
      citations: mergedCitations,
    }),
    recommendedAction,
    whyItMatters,
    status: item.status ?? primary.status,
    tone: item.tone ?? primary.tone,
    source: primaryCitation.source,
    sourceDetail: primaryCitation.sourceDetail,
    sourceUrl: primaryCitation.sourceUrl,
    sourceId: primaryCitation.sourceId,
    evidence: primaryCitation.evidence,
    date: primaryCitation.date,
    citations: mergedCitations,
  };
}

function fmtCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
}

function daysPastDue(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/**
 * Builds deterministic BrandonBriefItems from the financial pulse data.
 * These are ALWAYS included in the brief regardless of LLM synthesis — they
 * come from authoritative Acumatica ERP data, not from communication signals.
 */
function buildFinancialBriefItems(
  pulse: FinancialPulseData,
): BrandonDailyUpdatePacket["sections"] {
  const sections: BrandonDailyUpdatePacket["sections"] = {
    needsBrandon: [],
    waitingOnOthers: [],
    importantUpdates: [],
  };

  const todayStr = formatDate(new Date());

  // --- Overdue AR → needsBrandon (cash collection is owner-level) ---
  const overdueProjects = pulse.arByProject.filter(
    (ar) => ar.overdueBalance > 10_000,
  );
  if (overdueProjects.length > 0 && pulse.totalOverdueAR > 50_000) {
    const topOverdue = overdueProjects.slice(0, 6);
    const evidenceFacts = [
      `${fmtCurrency(pulse.totalOverdueAR)} total overdue across ${overdueProjects.length} project${overdueProjects.length !== 1 ? "s" : ""}`,
      ...topOverdue.map((ar) => {
        const days = daysPastDue(ar.latestDueDate);
        return `${ar.projectName} (${ar.jobNumber ?? ar.projectId}): ${fmtCurrency(ar.overdueBalance)} overdue${ar.latestDueDate ? ` — due ${ar.latestDueDate}${days > 0 ? `, ${days}d past due` : ""}` : ""}`;
      }),
    ];
    const evidenceText = evidenceFacts.join(". ");
    const citation: BriefCitation = {
      source: "Document",
      sourceDetail: "Acumatica ERP — AR Aging Report",
      sourceId: `financial-ar-${todayStr}`,
      evidence: evidenceText,
      date: todayStr,
    };
    sections.needsBrandon.push({
      title: `${fmtCurrency(pulse.totalOverdueAR)} overdue AR — collections needed on ${overdueProjects.length} project${overdueProjects.length !== 1 ? "s" : ""}`,
      summary: `${fmtCurrency(pulse.totalOverdueAR)} in outstanding invoices are past due. Largest: ${topOverdue[0].projectName} at ${fmtCurrency(topOverdue[0].overdueBalance)}${topOverdue[0].latestDueDate ? ` (due ${topOverdue[0].latestDueDate}, ${daysPastDue(topOverdue[0].latestDueDate)}d ago)` : ""}.`,
      evidenceFacts,
      bullets: [
        `${fmtCurrency(pulse.totalOverdueAR)} overdue across ${overdueProjects.length} projects`,
        ...topOverdue.slice(0, 3).map((ar) => {
          const days = daysPastDue(ar.latestDueDate);
          return `${ar.projectName}: ${fmtCurrency(ar.overdueBalance)} overdue${days > 0 ? ` (${days}d past due)` : ""}`;
        }),
        `Total open AR (incl. not-yet-due): ${fmtCurrency(pulse.totalOutstandingAR)}`,
      ],
      recommendedAction: `Confirm collections status on ${topOverdue
        .slice(0, 3)
        .map((ar) => ar.projectName)
        .join(
          ", ",
        )}. Verify accounting has follow-up queued for invoices past 30 days.`,
      whyItMatters: `${fmtCurrency(pulse.totalOverdueAR)} in overdue receivables directly impacts cash flow. The top project (${topOverdue[0].projectName}) alone is ${daysPastDue(topOverdue[0].latestDueDate)} days past due.`,
      source: "Document",
      sourceDetail: "Acumatica ERP — AR Aging Report",
      sourceId: `financial-ar-${todayStr}`,
      evidence: evidenceText,
      date: todayStr,
      citations: [citation],
      project: `Multiple (${overdueProjects.length} projects)`,
      owner: "Finance / Accounting / Brandon",
      status: "Collections required",
      tone: "risk",
      retrieval: "Financial pulse: acumatica_ar_invoices",
    });
  }

  // --- Open (not yet overdue) significant AR → importantUpdates ---
  const currentOpenProjects = pulse.arByProject.filter(
    (ar) => ar.totalBalance - ar.overdueBalance > 50_000,
  );
  if (currentOpenProjects.length > 0) {
    const totalCurrentOpen = currentOpenProjects.reduce(
      (sum, ar) => sum + (ar.totalBalance - ar.overdueBalance),
      0,
    );
    if (totalCurrentOpen > 100_000) {
      const citation: BriefCitation = {
        source: "Document",
        sourceDetail: "Acumatica ERP — AR Report",
        sourceId: `financial-ar-open-${todayStr}`,
        evidence: `${fmtCurrency(totalCurrentOpen)} in open (not-yet-overdue) AR across ${currentOpenProjects.length} projects.`,
        date: todayStr,
      };
      sections.importantUpdates.push({
        title: `${fmtCurrency(totalCurrentOpen)} in open AR invoices (not yet overdue) across ${currentOpenProjects.length} projects`,
        summary: citation.evidence!,
        evidenceFacts: currentOpenProjects
          .slice(0, 5)
          .map(
            (ar) =>
              `${ar.projectName}: ${fmtCurrency(ar.totalBalance - ar.overdueBalance)} open${ar.latestDueDate ? `, due ${ar.latestDueDate}` : ""}`,
          ),
        bullets: currentOpenProjects
          .slice(0, 4)
          .map(
            (ar) =>
              `${ar.projectName}: ${fmtCurrency(ar.totalBalance - ar.overdueBalance)} open${ar.latestDueDate ? `, due ${ar.latestDueDate}` : ""}`,
          ),
        source: "Document",
        sourceDetail: "Acumatica ERP — AR Report",
        sourceId: `financial-ar-open-${todayStr}`,
        evidence: citation.evidence,
        date: todayStr,
        citations: [citation],
        project: `Multiple (${currentOpenProjects.length} projects)`,
        owner: "Finance / Accounting",
        status: "Monitor",
        tone: "neutral",
        retrieval: "Financial pulse: acumatica_ar_invoices",
      });
    }
  }

  // --- Pending COs → importantUpdates ---
  if (
    pulse.pendingCOsByProject.length > 0 &&
    pulse.totalPendingCORevenue > 20_000
  ) {
    const topCOs = pulse.pendingCOsByProject.slice(0, 6);
    const evidenceFacts = [
      `${pulse.pendingCOsByProject.length} project${pulse.pendingCOsByProject.length !== 1 ? "s" : ""} with on-hold COs — ${fmtCurrency(pulse.totalPendingCORevenue)} total pending revenue (2026 only)`,
      ...topCOs.map(
        (co) =>
          `${co.projectName} (${co.jobNumber ?? co.projectId}): ${co.coCount} CO${co.coCount !== 1 ? "s" : ""} on hold, ${fmtCurrency(co.pendingRevenue)}${co.oldestDate ? ` — oldest since ${co.oldestDate}` : ""}`,
      ),
    ];
    const citation: BriefCitation = {
      source: "Document",
      sourceDetail: "Acumatica ERP — Change Order Report",
      sourceId: `financial-co-${todayStr}`,
      evidence: evidenceFacts[0],
      date: todayStr,
    };
    sections.importantUpdates.push({
      title: `${fmtCurrency(pulse.totalPendingCORevenue)} in pending COs on hold — ${pulse.pendingCOsByProject.length} projects awaiting approval`,
      summary: `${pulse.pendingCOsByProject.length} projects have change orders on hold totaling ${fmtCurrency(pulse.totalPendingCORevenue)} in pending revenue. These COs were created in 2026 and have not yet moved to approval.`,
      evidenceFacts,
      bullets: evidenceFacts.slice(0, 5),
      recommendedAction: `Confirm PMs on ${topCOs
        .slice(0, 3)
        .map((co) => co.projectName)
        .join(", ")} are moving pending COs to approval this week.`,
      whyItMatters:
        "On-hold change orders age out, complicate closeouts, and delay billing. Each week without approval costs revenue momentum.",
      source: "Document",
      sourceDetail: "Acumatica ERP — Change Order Report",
      sourceId: `financial-co-${todayStr}`,
      evidence: citation.evidence,
      date: todayStr,
      citations: [citation],
      project: `Multiple (${pulse.pendingCOsByProject.length} projects)`,
      owner: "Project managers / accounting",
      status: "Pending approval",
      tone: "watch",
      retrieval: "Financial pulse: acumatica_change_orders",
    });
  }

  return sections;
}

// Accounting money-owed language is excluded from the Daily Brief until the
// Acumatica feed is trusted again (product decision, 2026-06). The synthesis
// prompt forbids it, but we also strip it here so it can never leak into a
// shipped brief even if the model ignores the instruction.
const ACCOUNTING_SENTENCE_PATTERN =
  /\b(accounts?\s+receivable|accounts?\s+payable|a\/?r\b|a\/?p\b|days?\s+past\s+due|past\s+due|overdue|outstanding\s+(?:ar|a\/r|balance|invoice|invoices)|invoice\s+aging|\baging\b|collections?|amount[s]?\s+owed|\bowed\b)\b/i;

function dropAccountingClauses(value: string | undefined): string | undefined {
  if (!value) return value;
  const clauses = value
    .split(/;\s*/)
    .map((clause) => clause.trim())
    .filter((clause) => clause && !ACCOUNTING_SENTENCE_PATTERN.test(clause));
  let rejoined = clauses.join("; ").trim();
  // A leftover that is too short to be a real fact (e.g. an orphaned "blocker
  // is the water leak.") is not worth keeping on its own.
  if (rejoined.replace(/[.;,\s]+$/, "").length < 15) return undefined;
  // Re-capitalize if stripping a leading clause left a lowercase fragment.
  rejoined = rejoined.charAt(0).toUpperCase() + rejoined.slice(1);
  return rejoined;
}

function stripAccountingFromItem(
  item: BrandonBriefItem | null,
): BrandonBriefItem | null {
  if (!item) return null;
  const bullets = (item.bullets ?? [])
    .map((bullet) => dropAccountingClauses(bullet))
    .filter((bullet): bullet is string => Boolean(bullet));
  const evidenceFacts = (item.evidenceFacts ?? []).filter(
    (fact) => !ACCOUNTING_SENTENCE_PATTERN.test(fact),
  );
  const whyItMatters = dropAccountingClauses(item.whyItMatters);
  // A brief item with no surviving bullets is not worth showing. Pure
  // accounts-receivable/overdue items collapse to zero bullets here and are
  // dropped entirely; mixed items keep their non-accounting substance.
  if (bullets.length === 0) return null;
  return { ...item, bullets, evidenceFacts, whyItMatters };
}

function sanitizeAccountingSections(
  sections: BrandonDailyUpdatePacket["sections"],
): BrandonDailyUpdatePacket["sections"] {
  const clean = (items: BrandonBriefItem[]) =>
    items
      .map(stripAccountingFromItem)
      .filter((item): item is BrandonBriefItem => item !== null);
  return {
    needsBrandon: clean(sections.needsBrandon),
    waitingOnOthers: clean(sections.waitingOnOthers),
    importantUpdates: clean(sections.importantUpdates),
  };
}

// Pull the FULL embedded text for a set of source documents from the AI
// Database vector store (document_chunks), concatenated in chunk order. This is
// what lets the brief read the COMPLETE meeting transcript instead of the lossy
// document_metadata auto-summary — regardless of whether the item was surfaced
// by semantic RAG or by the keyword-metadata fallback. Best-effort: any failure
// just leaves the item on its existing (thinner) evidence.
async function loadFullDocumentText(
  documentIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(documentIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const rag = createRagServiceClient();
  const partsByDoc = new Map<string, Array<{ index: number; text: string }>>();
  const BATCH = 40;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { data, error } = await rag
      .from("document_chunks")
      .select("document_id, chunk_index, text")
      .in("document_id", batch);
    if (error || !data) continue;
    for (const row of data as Array<{
      document_id?: string | null;
      chunk_index?: number | null;
      text?: string | null;
    }>) {
      const id = row.document_id;
      const text = row.text;
      if (!id || !text) continue;
      if (!partsByDoc.has(id)) partsByDoc.set(id, []);
      partsByDoc.get(id)!.push({ index: row.chunk_index ?? 0, text });
    }
  }

  for (const [id, parts] of partsByDoc) {
    parts.sort((a, b) => a.index - b.index);
    out.set(
      id,
      compactCompleteText(parts.map((p) => p.text).join("\n"), 12000),
    );
  }
  return out;
}

// Replace each candidate item's thin evidence with the FULL embedded document
// text (the real transcript) when available, mutating the item AND its primary
// citation so BOTH the synthesis and the downstream enrichment read the
// complete meeting. This is the core fix for shallow briefs: items surfaced by
// the keyword-metadata fallback previously carried only the ~2,800-char
// auto-summary and never touched the rich chunks that exist in the vector store.
async function enrichSectionsWithFullDocumentText(
  sections: BrandonDailyUpdatePacket["sections"],
): Promise<number> {
  const allItems = [
    ...sections.needsBrandon,
    ...sections.waitingOnOthers,
    ...sections.importantUpdates,
  ];
  const fullTextByDoc = await loadFullDocumentText(
    allItems.map((item) => item.sourceId ?? "").filter(Boolean),
  );
  let enriched = 0;
  for (const item of allItems) {
    const full = item.sourceId ? fullTextByDoc.get(item.sourceId) : undefined;
    if (!full) continue;
    item.evidence = full;
    if (item.citations[0]) item.citations[0].evidence = full;
    enriched += 1;
  }
  return enriched;
}

async function synthesizeSections(
  sections: BrandonDailyUpdatePacket["sections"],
  financialPulse: FinancialPulseData | null,
): Promise<{
  sections: BrandonDailyUpdatePacket["sections"];
  modelUsed: string;
  warnings: string[];
  degraded: boolean;
}> {
  const candidates = [
    ...sections.needsBrandon,
    ...sections.waitingOnOthers,
    ...sections.importantUpdates,
  ];
  const synthesisModel = executiveBriefingSynthesisModel();
  if (candidates.length === 0 && !financialPulse) {
    return {
      sections,
      modelUsed: synthesisModel,
      warnings: [],
      degraded: false,
    };
  }

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date());

  const candidatePayload = candidates.map((item, index) => ({
    index,
    suggestedSection:
      index < sections.needsBrandon.length
        ? "needsBrandon"
        : index < sections.needsBrandon.length + sections.waitingOnOthers.length
          ? "waitingOnOthers"
          : "importantUpdates",
    retrievedTitle: item.title,
    project: item.project,
    source: item.source,
    sourceDetail: item.sourceDetail,
    sourceDate: item.date,
    status: item.status,
    owner: item.owner,
    evidence: compactCompleteText(
      [item.evidence, item.summary]
        .map((value) => normalizeText(value))
        .filter((value, idx, arr) => value && arr.indexOf(value) === idx)
        .join(" "),
      2500,
    ),
    existingCitationCount: item.citations.length,
  }));

  // Inject learnings from prior human feedback on the daily brief so the model
  // avoids previously-flagged mistakes. Scoped strictly to `daily_brief`
  // (cross-project) — failures here must not block synthesis.
  let briefLearningBlock: string | null = null;
  const synthesisWarnings: string[] = [];
  try {
    const learnings = await getSurfaceScopedLearnings({
      surface: "daily_brief",
      limit: 3,
    });
    briefLearningBlock = buildAgentLearningContextBlock(learnings).block;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    synthesisWarnings.push(
      `Daily Brief learning context lookup failed; continuing without feedback learnings. ${message}`,
    );
  }

  const instructions =
    "You are Brandon's trusted operating partner. Brandon owns Alleato Group, a commercial construction company. You write his daily brief. He is busy and practical. He wants to know what is going on, what it means, what needs his decision, and who owns the next step. " +
    "Today is " +
    todayLabel +
    ". Use this exact date whenever you write 'today', 'this week', or 'Friday'. Write the exact calendar date next to any day name, for example 'Friday, June 12'. " +
    "\n\nHOW TO WRITE (this matters more than anything):\n" +
    "- Write in plain, everyday English. Short, complete sentences. Imagine explaining it out loud to a smart person who is not in the meeting.\n" +
    "- NO jargon, buzzwords, or metaphors. Never write words like 'operationally steady', 'cadence', 'bandwidth', 'margin exposure', 'nudge', 'leverage', 'optionality'. Just say the plain thing.\n" +
    "- The FIRST time you use any construction or business acronym (BZA, RFI, COI, UCC, PCO, CO, GC, TI, AHU), spell it out in parentheses right after it. Example: 'BZA (Board of Zoning Appeals)'.\n" +
    "- Every sentence must be complete and make sense on its own. Never split a number across two sentences. Write '7.7 feet', never '7.' then '7 feet'.\n" +
    "- NEVER paste raw text from the source. The evidence you are given may be cut off mid-word or mid-number. If a fact looks incomplete or you are not sure of it, leave it out. Only state things you are confident are complete and correct.\n" +
    "- Do not repeat the same fact twice. Every bullet must add something new.\n" +
    "\n\nWHAT EACH ITEM NEEDS:\n" +
    "- title: a short, plain headline that describes the actual situation in everyday words (not a category name). Example: 'A city permit deadline this Friday could slip'.\n" +
    "- bullets: 2 to 4 bullets. Each one is a single plain, complete sentence stating one concrete fact — who, what, the number or date, and the blocker or decision if there is one. KEEP THE EXACT SPECIFICS from the evidence: real measurements (e.g. '7.7 feet from the power lines'), distances, quantities, named deadlines, calendar dates, and dollar amounts that are NOT accounts-receivable. Never blur a specific number into vague wording — write '7.7 feet from the power lines', not 'near the power lines'; write 'the July 7 BZA hearing', not 'an upcoming hearing'. Keep each bullet under 35 words. Do NOT use scaffolding phrases like 'business impact is', 'decision needed is', 'blocker is', or 'status is' — just say the fact plainly. Do not write more than 4 bullets. Do not pad or repeat.\n" +
    "- whyItMatters: exactly ONE plain sentence that names the specific risk, deadline, or decision and its concrete consequence. Use the real names, numbers, and dates — e.g. 'If Duke Energy does not confirm the setback before the June 12 filing, the July 7 BZA hearing slips.' NEVER write vague filler like 'staying on schedule matters', 'a clear list will help', or 'this needs coordination'. If the evidence is thin, name what is confirmed and the one specific thing to check. This is the one place you add judgment — make it concrete and useful.\n" +
    "- recommendedAction: one plain sentence naming who should do what next.\n" +
    "- summary: one plain sentence describing the item.\n" +
    "- evidenceFacts: 2 to 4 plain factual sentences pulled only from the given evidence. No invented facts.\n" +
    "- sourceIndexes: array of the candidate index numbers this item is built from, most relevant first.\n" +
    "- status: a short plain status phrase. tone: one of risk, watch, good, neutral.\n" +
    "\n\nJUDGMENT:\n" +
    "- Do NOT write a meeting recap. Do not organize around who met, agenda order, or what was discussed. Organize around the executive question: what changed, why it matters, what pattern it fits, what business outcome it affects, and what leadership should do.\n" +
    "- Treat Meeting candidates marked as transcript-first sources as the primary material for cross-meeting synthesis. Use email, Teams, financial, document, and project intelligence candidates to confirm or sharpen the meeting read, not to replace it.\n" +
    "- Internally evaluate each candidate through this hierarchy before writing: observation -> significance -> pattern detection -> business impact -> priority -> recommendation.\n" +
    "- Prefer cross-meeting or cross-source insight over isolated facts. If multiple meetings point to the same issue, write the larger business pattern and cite the supporting candidates.\n" +
    "- Every included item must affect at least one executive outcome: schedule, profit, cash, client satisfaction, growth, risk, team performance, or reputation. Drop anything that does not.\n" +
    "- needsBrandon: only things Brandon personally has to decide, approve, confirm, or escalate. Keep this short and real.\n" +
    "- waitingOnOthers: work that is pending on the project team, a client, a vendor, estimating, finance, or design.\n" +
    "- importantUpdates: material context worth knowing that needs no action from Brandon today.\n" +
    "- When several candidates are about the same project and same issue (even from a different email, meeting, or Teams thread), MERGE them into one item and list every candidate index in sourceIndexes. Each candidate index may be used in only one item.\n" +
    "- Think like an owner: connect the dots. If a budget problem is really a missing-decision problem, or a late drawing is becoming a trust problem, say so plainly in whyItMatters.\n" +
    "- HARD RULE — leave out all accounting money figures: do NOT mention accounts receivable (AR), accounts payable (AP), overdue balances, amounts owed, days past due, invoice aging, cash flow, or collections ANYWHERE — not in a title, bullet, summary, evidence fact, or the 'what this means' line. If a source's only substance is money owed or overdue, drop it entirely. (Pending change-order scope is fine; dollar balances owed are not.)\n" +
    "- HARD RULE — drop external solicitations, cold outreach, vendor marketing, investment/equity opportunities, and generic business-development pitches unless the evidence shows an active Alleato project obligation, client commitment, signed pursuit, or Brandon has already assigned an internal owner. Do not turn a salesperson's requested follow-up into a Brandon action item.\n" +
    "- If a source is too vague to be useful, leave it out entirely.\n" +
    "\nReturn ONLY valid JSON with keys needsBrandon, waitingOnOthers, importantUpdates, each an array of item objects." +
    (briefLearningBlock ? `\n\n${briefLearningBlock}` : "");

  const user =
    "Write today's brief for Brandon from the source candidates below. " +
    "Lead with what genuinely needs his decision today, then what is waiting on other people, then context worth knowing. " +
    "Be honest about how much needs his attention — if it is a quiet day, a short brief is correct. Do not manufacture urgency. " +
    "Return no more than 4 needsBrandon items, 6 waitingOnOthers items, and 4 importantUpdates items. Fewer is better. " +
    "Never use category headings like 'Risks and exposure', 'Recommended actions', or 'What changed' as item titles. " +
    "Remember: plain language, complete sentences, spell out acronyms, one useful insight sentence per item in whyItMatters, and never paste cut-off source text.\n" +
    "\n\nSOURCE CANDIDATES:\n" +
    JSON.stringify(candidatePayload, null, 2);

  try {
    const result = await withBriefingTimeout(
      generateText({
        model: getLanguageModel(synthesisModel),
        instructions,
        messages: [{ role: "user", content: user }],
        telemetry: aiTelemetry({
          functionId: "executive-daily-brief.synthesize-sections",
          metadata: {
            workflow: "executive_daily_brief",
            candidateCount: candidatePayload.length,
            needsBrandonCandidateCount: sections.needsBrandon.length,
            waitingOnOthersCandidateCount: sections.waitingOnOthers.length,
            importantUpdatesCandidateCount: sections.importantUpdates.length,
          },
        }),
      }),
      EXECUTIVE_BRIEFING_SYNTHESIS_TIMEOUT_MS,
      "Executive briefing synthesis",
    );

    const raw = result.text.trim();
    if (!raw) {
      throw new Error("AI SDK generateText returned an empty response.");
    }
    const parsed = JSON.parse(stripJsonFence(raw)) as SynthesizedBriefSections;
    const usedSourceIndexes = new Set<number>();
    return {
      sections: {
        needsBrandon: (parsed.needsBrandon ?? [])
          .map((item) =>
            normalizeSynthesizedItem(item, candidates, usedSourceIndexes),
          )
          .map(stripAccountingFromItem)
          .filter((item): item is BrandonBriefItem => item !== null),
        waitingOnOthers: (parsed.waitingOnOthers ?? [])
          .map((item) =>
            normalizeSynthesizedItem(item, candidates, usedSourceIndexes),
          )
          .map(stripAccountingFromItem)
          .filter((item): item is BrandonBriefItem => item !== null),
        importantUpdates: (parsed.importantUpdates ?? [])
          .map((item) =>
            normalizeSynthesizedItem(item, candidates, usedSourceIndexes),
          )
          .map(stripAccountingFromItem)
          .filter((item): item is BrandonBriefItem => item !== null),
      },
      modelUsed: synthesisModel,
      warnings: synthesisWarnings,
      degraded: false,
    };
  } catch (error) {
    const message = formatAIProviderFailure(
      error,
      "Executive briefing synthesis",
    );
    return {
      sections,
      modelUsed: synthesisModel,
      warnings: [
        `Executive briefing synthesis failed with ${synthesisModel}; using pre-synthesis source assignments. ${message}`,
      ],
      degraded: true,
    };
  }
}

function mapBriefSections(
  sections: BrandonDailyUpdatePacket["sections"],
  mapper: (
    item: BrandonBriefItem,
    section: keyof BrandonDailyUpdatePacket["sections"],
    index: number,
  ) => BrandonBriefItem,
): BrandonDailyUpdatePacket["sections"] {
  return {
    needsBrandon: sections.needsBrandon.map((item, index) =>
      mapper(item, "needsBrandon", index),
    ),
    waitingOnOthers: sections.waitingOnOthers.map((item, index) =>
      mapper(item, "waitingOnOthers", index),
    ),
    importantUpdates: sections.importantUpdates.map((item, index) =>
      mapper(item, "importantUpdates", index),
    ),
  };
}

function enforceExecutiveBriefBullets(
  sections: BrandonDailyUpdatePacket["sections"],
): BrandonDailyUpdatePacket["sections"] {
  return mapBriefSections(sections, (item) => ({
    ...item,
    bullets: getExecutiveBriefBullets(item),
  }));
}

function itemEvidencePayload(item: BrandonBriefItem) {
  return item.citations.map((citation, citationIndex) => ({
    citationIndex,
    source: citation.source,
    sourceDetail: citation.sourceDetail,
    date: citation.date,
    evidence: citation.evidence ?? "",
  }));
}

function fallbackEvidenceFacts(item: BrandonBriefItem): string[] {
  const existingFacts = item.evidenceFacts?.filter(Boolean) ?? [];
  if (existingFacts.length > 0) return existingFacts.slice(0, 6);
  const bulletFacts = item.bullets.filter(Boolean);
  if (bulletFacts.length > 0) return bulletFacts.slice(0, 6);
  return item.citations
    .map((citation) => compactCompleteText(citation.evidence, 260))
    .filter(Boolean)
    .slice(0, 6);
}

function briefItemText(item: BrandonBriefItem): string {
  return [
    item.title,
    item.summary,
    item.recommendedAction,
    item.whyItMatters,
    item.status,
    item.owner,
    item.project,
    ...item.bullets,
    ...(item.evidenceFacts ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function hasAny(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

function scoreBriefItem(
  item: BrandonBriefItem,
  section: keyof BrandonDailyUpdatePacket["sections"],
): { score: number; materiality: string[]; lane: ExecutivePriorityLane } {
  const text = briefItemText(item);
  let score =
    section === "needsBrandon" ? 24 : section === "waitingOnOthers" ? 16 : 8;
  const materiality: string[] = [];

  if (
    hasAny(text, [
      "$",
      "payment",
      "invoice",
      "billing",
      "cash",
      "retainage",
      "margin",
      "overage",
      "unbilled",
      "receivable",
      "change order",
      "buyout",
    ])
  ) {
    score += 22;
    materiality.push("Financial impact");
  }
  if (
    hasAny(text, [
      "schedule",
      "delay",
      "deadline",
      "late",
      "permit",
      "lead time",
      "shutdown",
      "field",
      "crew",
      "material shortage",
    ])
  ) {
    score += 18;
    materiality.push("Schedule impact");
  }
  if (
    hasAny(text, [
      "owner",
      "client",
      "customer",
      "relationship",
      "approval",
      "gpc",
      "uniqlo",
      "city",
    ])
  ) {
    score += 16;
    materiality.push("Customer relationship impact");
  }
  if (
    hasAny(text, [
      "contract",
      "legal",
      "insurance",
      "license",
      "coi",
      "workers compensation",
      "lien",
      "claim",
      "compliance",
    ])
  ) {
    score += 16;
    materiality.push("Legal or contractual risk");
  }
  if (
    hasAny(text, [
      "today",
      "same-day",
      "urgent",
      "due",
      "by ",
      "before",
      "tomorrow",
      "this week",
    ])
  ) {
    score += 12;
    materiality.push("Urgency");
  }
  if (
    hasAny(text, [
      "brandon",
      "executive",
      "approve",
      "decide",
      "escalate",
      "call",
      "confirm",
      "owner-level",
    ])
  ) {
    score += 18;
    materiality.push("Brandon uniquely needed");
  }
  if (
    hasAny(text, [
      "compounding",
      "drift",
      "leak",
      "repeat",
      "stale",
      "aging",
      "carry-forward",
    ])
  ) {
    score += 10;
    materiality.push("Compounding risk");
  }
  if (
    hasAny(text, ["blocked", "blocker", "waiting", "depends", "stuck", "hold"])
  ) {
    score += 12;
    materiality.push("Blocking other people");
  }
  if (item.tone === "risk") score += 14;
  if (item.tone === "watch") score += 6;

  let lane: ExecutivePriorityLane = "internalAccountability";
  if (
    hasAny(text, [
      "$",
      "payment",
      "invoice",
      "billing",
      "cash",
      "retainage",
      "margin",
      "overage",
      "unbilled",
      "receivable",
      "change order",
      "buyout",
    ])
  ) {
    lane = "cashMargin";
  } else if (
    hasAny(text, [
      "schedule",
      "delay",
      "field",
      "crew",
      "site",
      "material",
      "permit",
      "shutdown",
    ])
  ) {
    lane = "scheduleField";
  } else if (
    hasAny(text, ["owner", "client", "customer", "approval", "relationship"])
  ) {
    lane = "customerOwner";
  } else if (
    hasAny(text, [
      "subcontractor",
      "vendor",
      "supplier",
      "quote",
      "pricing",
      "proposal",
    ])
  ) {
    lane = "subcontractorVendor";
  } else if (
    hasAny(text, [
      "design",
      "drawing",
      "preconstruction",
      "estimate",
      "pricing",
      "permit package",
      "survey",
    ])
  ) {
    lane = "designPreconstruction";
  }

  return {
    score,
    materiality:
      materiality.length > 0 ? materiality : ["Material business signal"],
    lane,
  };
}

function operatingShortItem(
  item: BrandonBriefItem,
  section: keyof BrandonDailyUpdatePacket["sections"],
): ExecutiveOperatingBriefShortItem {
  const scored = scoreBriefItem(item, section);
  return {
    item: compactOperatingBriefItem(item),
    score: scored.score,
    materiality: scored.materiality,
    nextAction:
      item.recommendedAction ?? "Assign a named owner and next action today.",
    owner: item.owner,
  };
}

function compactOperatingBriefItem(item: BrandonBriefItem): BrandonBriefItem {
  const citations = item.citations.slice(0, 2).map((citation) => ({
    ...citation,
    evidence: citation.evidence
      ? compactCompleteText(citation.evidence, 240)
      : citation.evidence,
  }));

  return {
    ...item,
    project: normalizedMeetingProjectLabel(item),
    summary: compactCompleteText(item.summary, 360),
    evidence: item.evidence
      ? compactCompleteText(item.evidence, 240)
      : undefined,
    evidenceFacts: (item.evidenceFacts ?? [])
      .map((fact) => compactCompleteText(fact, 220))
      .slice(0, 3),
    bullets: item.bullets
      .map((bullet) => compactCompleteText(bullet, 220))
      .slice(0, 3),
    citations,
  };
}

function getImpactText(item: BrandonBriefItem): string {
  const text = [
    item.summary,
    item.whyItMatters,
    ...(item.evidenceFacts ?? []),
    ...item.bullets,
  ].join(" ");
  const money = text.match(
    /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|m|k|\+))?/i,
  )?.[0];
  const schedule = text.match(
    /\b(?:\d+\s*(?:day|week|month)s?|due\s+[A-Z][a-z]+\s+\d+|deadline[^.;]*)/i,
  )?.[0];
  if (money && schedule) return `${money}; ${schedule}`;
  if (money) return money;
  if (schedule) return schedule;
  if (
    hasAny(text.toLowerCase(), ["client", "owner", "relationship", "approval"])
  ) {
    return "Relationship impact stated; exact dollar or schedule impact unknown.";
  }
  return "Exact dollar, schedule, or relationship impact unknown.";
}

function recommendedMove(item: BrandonBriefItem): string {
  if (item.recommendedAction) return item.recommendedAction;
  const owner = item.owner ? ` with ${item.owner}` : "";
  return `Confirm the owner, next step, and due date${owner}.`;
}

// A plain "what this means" sentence for an item. Prefers the synthesized
// whyItMatters; otherwise derives a clean line from the concrete impact. NEVER
// returns the internal scoring labels ("Financial impact, Schedule impact, …"),
// which are bookkeeping, not prose an owner should read.
function cleanWhyItMatters(item: BrandonBriefItem): string {
  const explicit = normalizeText(item.whyItMatters);
  if (explicit) return explicit.endsWith(".") ? explicit : `${explicit}.`;
  const impact = getImpactText(item);
  const lowered = impact.toLowerCase();
  if (
    impact &&
    !lowered.startsWith("exact ") &&
    !lowered.startsWith("relationship impact stated")
  ) {
    return `Concrete impact: ${impact}.`;
  }
  return "Confirm the owner and the next step so this does not stall.";
}

function uniqueRecommendedMoves(
  items: ExecutiveOperatingBriefShortItem[],
): string[] {
  const moves: string[] = [];
  const seen = new Set<string>();
  for (const entry of items) {
    const raw = recommendedMove(entry.item);
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    moves.push(raw);
  }
  return moves;
}

function businessSignalFromLane(
  lane: ExecutivePriorityLane,
  items: ExecutiveOperatingBriefShortItem[],
): string | null {
  if (items.length === 0) return null;
  const label = EXECUTIVE_PRIORITY_LANE_LABELS[lane];
  const top = items[0];
  return `${label}: ${items.length} material item${items.length === 1 ? "" : "s"} surfaced; highest signal is ${top.item.project} - ${top.item.title}.`;
}

type ScoredBriefEntry = ReturnType<typeof scoreBriefItem> & {
  section: keyof BrandonDailyUpdatePacket["sections"];
  item: BrandonBriefItem;
};

function evidenceLine(entry: ScoredBriefEntry): string {
  return `${entry.item.project}: ${entry.item.title}`;
}

function entriesMatching(
  entries: ScoredBriefEntry[],
  words: string[],
): ScoredBriefEntry[] {
  return entries.filter((entry) => hasAny(briefItemText(entry.item), words));
}

function buildBusinessHealth(
  entries: ScoredBriefEntry[],
): ExecutiveOperatingBriefHealthItem[] {
  const areaSpecs: Array<{
    area: string;
    words: string[];
    healthyWords?: string[];
  }> = [
    {
      area: "Projects",
      words: ["project", "schedule", "field", "permit", "design", "owner"],
      healthyWords: ["complete", "approved", "resolved", "healthy"],
    },
    {
      area: "Finance",
      words: [
        "payment",
        "invoice",
        "margin",
        "wip",
        "reconciliation",
        "payroll",
        "reporting cadence",
        "retainage",
        "erp",
        "acumatica",
        "cash flow",
      ],
      healthyWords: ["standardized", "reconciled", "improved", "stable"],
    },
    {
      area: "Operations",
      words: [
        "process",
        "workflow",
        "standard",
        "communication",
        "documentation",
        "reporting",
        "owner",
      ],
      healthyWords: ["standardized", "documented", "repeatable", "improved"],
    },
    {
      area: "People",
      words: ["crew", "manpower", "hiring", "onboarding", "vp"],
      healthyWords: ["assigned", "covered", "onboard", "ready"],
    },
    {
      area: "Technology",
      words: ["api", "software", "integration", "platform"],
      healthyWords: ["integrated", "automated", "standardized", "ready"],
    },
  ];

  return areaSpecs.map((spec) => {
    const matches = entriesMatching(entries, spec.words);
    const highest = matches[0];
    const riskCount = matches.filter(
      (entry) => entry.item.tone === "risk" || entry.score >= 70,
    ).length;
    const healthyCount = matches.filter((entry) =>
      hasAny(briefItemText(entry.item), spec.healthyWords ?? []),
    ).length;
    const status: ExecutiveOperatingBriefHealthItem["status"] =
      riskCount > 0
        ? "risk"
        : matches.length > healthyCount
          ? "watch"
          : "healthy";
    const summary = highest
      ? `${highest.item.title} is the clearest current signal for ${spec.area.toLowerCase()}. ${cleanWhyItMatters(highest.item)}`
      : `No material ${spec.area.toLowerCase()} issue surfaced in this source window.`;
    return { area: spec.area, status, summary };
  });
}

function buildPattern(
  title: string,
  matches: ScoredBriefEntry[],
  significance: string,
): ExecutiveOperatingBriefPattern | null {
  const unique = Array.from(
    new Map(matches.map((entry) => [evidenceLine(entry), entry])).values(),
  );
  if (unique.length < 2) return null;
  const riskCount = unique.filter(
    (entry) => entry.item.tone === "risk" || entry.score >= 65,
  ).length;
  return {
    title,
    evidence: unique.slice(0, 3).map(evidenceLine),
    significance,
    trend: riskCount >= 2 ? "increasing" : "stable",
  };
}

function buildEmergingPatterns(
  entries: ScoredBriefEntry[],
): ExecutiveOperatingBriefPattern[] {
  const predefinedPatterns = [
    buildPattern(
      "External dependency management is the main execution risk",
      entriesMatching(entries, [
        "permit",
        "utility",
        "subcontractor",
        "vendor",
        "supplier",
        "material",
        "delivery",
        "owner approval",
        "client input",
        "waiting",
      ]),
      "The repeated signal is not internal effort; it is schedule certainty depending on outside parties closing their loops.",
    ),
    buildPattern(
      "Alleato is standardizing its operating system",
      entriesMatching(entries, [
        "standard",
        "workflow",
        "process",
        "repeatable",
        "documentation",
        "building connected",
        "reconciliation",
        "reporting",
      ]),
      "This is the kind of process maturity that reduces Brandon-dependent interpretation and lets teams operate from shared rules.",
    ),
    buildPattern(
      "Field communication is still consuming management attention",
      entriesMatching(entries, [
        "field",
        "photo",
        "daily report",
        "work log",
        "communication",
        "progress report",
      ]),
      "The recurring issue is not just missing updates; it is management time spent reconstructing reality after the fact.",
    ),
    buildPattern(
      "Financial conversations are moving toward management rhythm",
      entriesMatching(entries, [
        "wip",
        "reconciliation",
        "payroll",
        "reporting cadence",
        "financial",
        "margin",
      ]),
      "The finance signal is stronger when it points to repeatable review and reporting behavior rather than one-off cleanup.",
    ),
  ].filter((pattern): pattern is ExecutiveOperatingBriefPattern =>
    Boolean(pattern),
  );

  if (predefinedPatterns.length >= 2 || entries.length < 2) {
    return predefinedPatterns;
  }

  const usedEvidence = new Set(
    predefinedPatterns.flatMap((pattern) => pattern.evidence),
  );
  const strongestUnused = entries
    .filter((entry) => !usedEvidence.has(evidenceLine(entry)))
    .slice(0, 3);
  const fallbackEvidence =
    strongestUnused.length >= 2 ? strongestUnused : entries.slice(0, 3);
  const riskCount = fallbackEvidence.filter(
    (entry) => entry.item.tone === "risk" || entry.score >= 65,
  ).length;
  const hasFinance = fallbackEvidence.some(
    (entry) => entry.lane === "cashMargin",
  );
  const hasExecution = fallbackEvidence.some((entry) =>
    ["scheduleField", "customerOwner", "subcontractorVendor"].includes(
      entry.lane,
    ),
  );
  const title =
    hasFinance && hasExecution
      ? "Approval and revenue follow-through are the current operating constraint"
      : "The material signals are concentrated enough to require follow-through";

  return [
    ...predefinedPatterns,
    {
      title,
      evidence: fallbackEvidence.map(evidenceLine),
      significance:
        "The common pattern is not volume; it is that the surfaced items need clear ownership, approval status, and next-step closure before they stop carrying business risk.",
      trend: riskCount >= 2 ? "increasing" : "stable",
    },
  ];
}

function likelihoodFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 78) return "high";
  if (score >= 58) return "medium";
  return "low";
}

function buildStrategicRisks(
  riskRadar: ExecutiveOperatingBriefRiskItem[],
): ExecutiveOperatingBriefStrategicRisk[] {
  return riskRadar.slice(0, 6).map((entry) => ({
    title: `${entry.item.project}: ${entry.item.title}`,
    likelihood: likelihoodFromScore(entry.score),
    impact: entry.impact,
    trend:
      entry.score >= 70 || entry.item.tone === "risk" ? "increasing" : "stable",
    nextAction: entry.nextAction,
  }));
}

function isFinancialAggregateBriefItem(item: BrandonBriefItem): boolean {
  const text = briefItemText(item);
  return (
    item.project.toLowerCase().startsWith("multiple (") ||
    item.sourceDetail.toLowerCase().includes("acumatica") ||
    hasAny(text, ["pending cos", "pending co", "on-hold change orders"])
  );
}

function buildOpportunities(entries: ScoredBriefEntry[]): string[] {
  const opportunities = [
    {
      words: ["standard", "workflow", "process", "documentation", "repeatable"],
      line: "Convert the clearest repeatable process into a written operating standard before the next project cycle.",
    },
    {
      words: ["closeout", "punch list", "turnover"],
      line: "Use upcoming closeout work to release trapped value and reduce stale follow-up load.",
    },
    {
      words: ["api", "integration", "automation", "software"],
      line: "Keep evaluating software by whether it can become part of the AI operating system, not just whether it solves a local task.",
    },
    {
      words: ["estimating", "bid package", "proposal", "building connected"],
      line: "Treat estimating standardization as leverage: cleaner bid packages reduce scope misses before construction starts.",
    },
  ];

  return opportunities
    .filter((opportunity) =>
      entries.some((entry) =>
        hasAny(briefItemText(entry.item), opportunity.words),
      ),
    )
    .map((opportunity) => opportunity.line);
}

function buildLeadershipWatchlist(entries: ScoredBriefEntry[]): string[] {
  return entries
    .filter(
      (entry) =>
        !isFinancialAggregateBriefItem(entry.item) &&
        (entry.section === "waitingOnOthers" ||
          entry.item.tone === "risk" ||
          hasAny(briefItemText(entry.item), [
            "permit",
            "lead time",
            "delivery",
            "approval",
            "closeout",
            "hiring",
            "manpower",
            "material",
          ])),
    )
    .slice(0, 8)
    .map(
      (entry) =>
        `${entry.item.project}: ${entry.item.title} - ${recommendedMove(entry.item)}`,
    );
}

function buildChiefOfStaffInsights(
  entries: ScoredBriefEntry[],
  patterns: ExecutiveOperatingBriefPattern[],
  opportunities: string[],
): string[] {
  const insights: string[] = [];
  const systemDesignCount = entriesMatching(entries, [
    "standard",
    "workflow",
    "process",
    "documentation",
    "api",
    "integration",
    "automation",
  ]).length;
  const externalDependencyCount = entriesMatching(entries, [
    "waiting",
    "permit",
    "vendor",
    "subcontractor",
    "client input",
    "owner approval",
    "delivery",
  ]).length;

  if (patterns.length > 0) {
    insights.push(
      `The most useful read is pattern-level: ${patterns[0].title.toLowerCase()}.`,
    );
  }
  if (systemDesignCount >= 2) {
    insights.push(
      "Brandon is spending more attention on system design than isolated problem solving; the brief should preserve those operating-system signals.",
    );
  }
  if (externalDependencyCount >= 2) {
    insights.push(
      "The execution risk is shifting toward external dependency follow-through, so watch ownership and due dates more closely than internal activity volume.",
    );
  }
  if (
    opportunities.length > 0 &&
    (patterns.length > 0 || systemDesignCount >= 2)
  ) {
    insights.push(
      "The opportunity is leverage: turn the strongest repeated practice into a company standard while the evidence is fresh.",
    );
  }

  return insights.length > 0
    ? insights
    : [
        "No cross-meeting chief-of-staff insight rose above the source evidence threshold.",
      ];
}

export function buildExecutiveOperatingBrief(
  sections: BrandonDailyUpdatePacket["sections"],
): ExecutiveOperatingBrief {
  const all = [
    ...sections.needsBrandon.map((item) => ({
      section: "needsBrandon" as const,
      item,
    })),
    ...sections.waitingOnOthers.map((item) => ({
      section: "waitingOnOthers" as const,
      item,
    })),
    ...sections.importantUpdates.map((item) => ({
      section: "importantUpdates" as const,
      item,
    })),
  ].map(({ section, item }) => {
    const scored = scoreBriefItem(item, section);
    return { section, item, ...scored };
  });

  const ranked = all.sort((a, b) => b.score - a.score);
  const topThreshold = ranked[4]?.score ?? ranked.at(-1)?.score ?? 0;
  const topExecutiveFocus = ranked
    .filter(
      (entry, index) => index < 3 || entry.score >= Math.max(70, topThreshold),
    )
    .map((entry) => {
      const item = compactOperatingBriefItem(entry.item);
      return {
        item,
        score: entry.score,
        materiality: entry.materiality,
        lane: entry.lane,
        whatChanged: item.summary,
        whyItMatters: cleanWhyItMatters(item),
        recommendedNextMove: recommendedMove(item),
        owner: item.owner,
      };
    });
  const topKeys = new Set(
    topExecutiveFocus.map(
      (entry) =>
        `${entry.item.title}|${entry.item.project}|${entry.item.sourceId ?? entry.item.sourceDetail}`,
    ),
  );
  const additionalMaterialItems = (
    Object.keys(EXECUTIVE_PRIORITY_LANE_LABELS) as ExecutivePriorityLane[]
  ).reduce<Record<ExecutivePriorityLane, ExecutiveOperatingBriefShortItem[]>>(
    (acc, lane) => {
      acc[lane] = [];
      return acc;
    },
    {} as Record<ExecutivePriorityLane, ExecutiveOperatingBriefShortItem[]>,
  );
  const lowerPriorityMomentum: ExecutiveOperatingBriefShortItem[] = [];

  for (const entry of ranked) {
    const key = `${entry.item.title}|${entry.item.project}|${entry.item.sourceId ?? entry.item.sourceDetail}`;
    if (topKeys.has(key)) continue;
    const short = operatingShortItem(entry.item, entry.section);
    if (entry.score >= 45 || entry.item.tone === "risk") {
      additionalMaterialItems[entry.lane].push(short);
    } else {
      lowerPriorityMomentum.push(short);
    }
  }

  const riskRadar = ranked
    .filter(
      (entry) =>
        !isFinancialAggregateBriefItem(entry.item) &&
        (entry.item.tone === "risk" ||
          entry.score >= 58 ||
          hasAny(briefItemText(entry.item), [
            "risk",
            "delay",
            "blocked",
            "margin",
            "overage",
            "unapproved",
            "unbilled",
          ])),
    )
    .map((entry) => ({
      ...operatingShortItem(entry.item, entry.section),
      impact: getImpactText(entry.item),
    }));

  const cashAndMarginWatch = ranked
    .filter(
      (entry) =>
        entry.lane === "cashMargin" &&
        !isFinancialAggregateBriefItem(entry.item),
    )
    .map((entry) => ({
      ...operatingShortItem(entry.item, entry.section),
      impact: getImpactText(entry.item),
    }));

  const brandonWaitingOn = sections.waitingOnOthers
    .map((item) => operatingShortItem(item, "waitingOnOthers"))
    .sort((a, b) => b.score - a.score);
  const othersWaitingOnBrandon = sections.needsBrandon
    .map((item) => operatingShortItem(item, "needsBrandon"))
    .sort((a, b) => b.score - a.score);
  const peopleAndAccountability = ranked
    .filter(
      (entry) =>
        !isFinancialAggregateBriefItem(entry.item) &&
        hasAny(briefItemText(entry.item), [
          "owner",
          "assignee",
          "assign",
          "stale",
          "aging",
          "follow-up",
          "accountability",
          "unassigned",
          "who owns",
        ]),
    )
    .map((entry) => operatingShortItem(entry.item, entry.section));
  const allShort = ranked.map((entry) =>
    operatingShortItem(entry.item, entry.section),
  );
  const importantBusinessSignals = (
    Object.keys(EXECUTIVE_PRIORITY_LANE_LABELS) as ExecutivePriorityLane[]
  )
    .map((lane) => {
      const laneItems = allShort.filter(
        (entry) => scoreBriefItem(entry.item, "importantUpdates").lane === lane,
      );
      return businessSignalFromLane(lane, laneItems);
    })
    .filter((signal): signal is string => Boolean(signal));

  const recommendedMoves = uniqueRecommendedMoves(allShort).filter(Boolean);
  const businessHealth = buildBusinessHealth(ranked);
  const emergingPatterns = buildEmergingPatterns(ranked);
  const strategicRisks = buildStrategicRisks(riskRadar);
  const opportunities = buildOpportunities(ranked);
  const leadershipWatchlist = buildLeadershipWatchlist(ranked);
  const chiefOfStaffInsights = buildChiefOfStaffInsights(
    ranked,
    emergingPatterns,
    opportunities,
  );
  const first = ranked[0];
  const startHere = first
    ? [
        `Start with ${first.item.project}: ${first.item.title}.`,
        `${cleanWhyItMatters(first.item)} ${recommendedMove(first.item)}`.trim(),
      ]
    : ["No material executive items surfaced from the current source window."];

  return {
    startHere,
    hasUnusualExecutiveLoad:
      topExecutiveFocus.length > 5 || riskRadar.length > 5,
    topExecutiveFocus,
    additionalMaterialItems,
    projectRiskRadar: riskRadar,
    cashAndMarginWatch,
    waitingOn: {
      brandonWaitingOn,
      othersWaitingOnBrandon,
    },
    peopleAndAccountability,
    importantBusinessSignals,
    recommendedMoves,
    lowerPriorityMomentum,
    businessHealth,
    emergingPatterns,
    strategicRisks,
    opportunities,
    leadershipWatchlist,
    chiefOfStaffInsights,
  };
}

export function hydrateExecutiveOperatingBrief(
  packet: Pick<BrandonDailyUpdatePacket, "sections" | "operatingBrief">,
): ExecutiveOperatingBrief {
  const derived = buildExecutiveOperatingBrief(packet.sections);
  const stored = packet.operatingBrief;
  if (!stored) return derived;

  return {
    ...derived,
    ...stored,
    businessHealth:
      stored.businessHealth && stored.businessHealth.length > 0
        ? stored.businessHealth
        : derived.businessHealth,
    emergingPatterns:
      stored.emergingPatterns && stored.emergingPatterns.length > 0
        ? stored.emergingPatterns
        : derived.emergingPatterns,
    strategicRisks:
      stored.strategicRisks && stored.strategicRisks.length > 0
        ? stored.strategicRisks
        : derived.strategicRisks,
    opportunities:
      stored.opportunities && stored.opportunities.length > 0
        ? stored.opportunities
        : derived.opportunities,
    leadershipWatchlist:
      stored.leadershipWatchlist && stored.leadershipWatchlist.length > 0
        ? stored.leadershipWatchlist
        : derived.leadershipWatchlist,
    chiefOfStaffInsights:
      stored.chiefOfStaffInsights && stored.chiefOfStaffInsights.length > 0
        ? stored.chiefOfStaffInsights
        : derived.chiefOfStaffInsights,
  };
}

async function enrichBriefSections(
  sections: BrandonDailyUpdatePacket["sections"],
  financialPulse: FinancialPulseData | null,
): Promise<{
  sections: BrandonDailyUpdatePacket["sections"];
  warnings: string[];
}> {
  const items = [
    ...sections.needsBrandon.map((item, index) => ({
      section: "needsBrandon" as const,
      index,
      item,
    })),
    ...sections.waitingOnOthers.map((item, index) => ({
      section: "waitingOnOthers" as const,
      index,
      item,
    })),
    ...sections.importantUpdates.map((item, index) => ({
      section: "importantUpdates" as const,
      index,
      item,
    })),
  ];

  if (items.length === 0) return { sections, warnings: [] };

  const synthesisModel = executiveBriefingSynthesisModel();
  const payload = items.map(({ section, index, item }) => ({
    section,
    index,
    title: item.title,
    currentSummary: item.summary,
    currentRecommendedAction: item.recommendedAction,
    currentWhyItMatters: item.whyItMatters,
    project: item.project,
    status: item.status,
    owner: item.owner,
    citations: itemEvidencePayload(item),
  }));

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date());

  const instructions =
    "You refine executive briefing items for Brandon, owner of Alleato Group, a commercial construction company. " +
    "Today is " +
    todayLabel +
    ". Use only the supplied citation evidence. Do not invent or infer beyond it.\n" +
    "For each item, return a tighter summary, 2 to 4 bullets, 2 to 4 evidenceFacts, one recommendedAction, and one whyItMatters.\n" +
    "WRITE IN PLAIN ENGLISH — the same rules as the brief itself:\n" +
    "- Short, complete, everyday sentences. No jargon, buzzwords, or metaphors.\n" +
    "- Each bullet is one plain statement of a concrete fact (who, what, the number or date, the blocker or decision). Keep each under 35 words.\n" +
    "- KEEP THE EXACT SPECIFICS from the evidence: measurements (e.g. '7.7 feet from the power lines'), distances, quantities, named deadlines, and calendar dates. Never blur a specific number into vague wording (write '7.7 feet from the power lines', not 'near the power lines'; write 'the July 7 BZA hearing', not 'an upcoming hearing').\n" +
    "- Do NOT use scaffolding phrases like 'business impact is', 'decision needed is', 'blocker is', or 'status is'. Just state the fact; let the date or blocker sit naturally in the sentence.\n" +
    "- Spell out any construction or business acronym the first time (e.g. 'BZA (Board of Zoning Appeals)').\n" +
    "- whyItMatters is exactly ONE plain sentence that names the specific risk, deadline, or decision and its concrete consequence, using the real names/numbers/dates. Never write vague filler like 'staying on schedule matters' or 'a clear list will help'.\n" +
    "- Never split a number across sentences (write '7.7 feet'). If a detail looks cut off, leave it out.\n" +
    "- Do NOT mention accounts receivable, accounts payable, overdue balances, amounts owed, days past due, invoice aging, cash flow, or collections anywhere.\n" +
    "If the evidence does not support a fact, omit it. Return ONLY valid JSON.";
  const user =
    'Refine these executive briefing items. Return JSON as {"items":[{"section":"needsBrandon|waitingOnOthers|importantUpdates","index":0,"summary":"...","bullets":["..."],"evidenceFacts":["..."],"recommendedAction":"...","whyItMatters":"..."}]}.' +
    "\n\n" +
    JSON.stringify(payload, null, 2);
  void financialPulse;

  try {
    const result = await withBriefingTimeout(
      generateText({
        model: getLanguageModel(synthesisModel),
        instructions,
        messages: [{ role: "user", content: user }],
        telemetry: aiTelemetry({
          functionId: "executive-daily-brief.enrich-evidence",
          metadata: {
            workflow: "executive_daily_brief",
            needsBrandonItemCount: sections.needsBrandon.length,
            waitingOnOthersItemCount: sections.waitingOnOthers.length,
            importantUpdatesItemCount: sections.importantUpdates.length,
          },
        }),
      }),
      EXECUTIVE_BRIEFING_ENRICHMENT_TIMEOUT_MS,
      "Executive briefing evidence enrichment",
    );

    const raw = result.text.trim();
    if (!raw)
      throw new Error("AI SDK generateText returned an empty response.");
    const parsed = JSON.parse(stripJsonFence(raw)) as EnrichedBriefItemsPayload;
    const enrichedByKey = new Map<string, EnrichedBriefItem>();
    for (const item of parsed.items ?? []) {
      if (
        !item ||
        !["needsBrandon", "waitingOnOthers", "importantUpdates"].includes(
          item.section,
        ) ||
        !Number.isInteger(item.index)
      ) {
        continue;
      }
      enrichedByKey.set(`${item.section}:${item.index}`, item);
    }

    return {
      sections: mapBriefSections(sections, (item, section, index) => {
        const enriched = enrichedByKey.get(`${section}:${index}`);
        if (!enriched) {
          return { ...item, evidenceFacts: fallbackEvidenceFacts(item) };
        }
        const anchorDate = item.date;
        const evidenceFacts = (enriched.evidenceFacts ?? [])
          .map((fact) =>
            expandRelativeWeekdays(compactCompleteText(fact, 320), anchorDate),
          )
          .filter(Boolean)
          .slice(0, 6);
        const summary = enriched.summary
          ? expandRelativeWeekdays(
              compactCompleteText(enriched.summary, 500),
              anchorDate,
            )
          : item.summary;
        const recommendedAction = enriched.recommendedAction
          ? expandRelativeWeekdays(
              compactCompleteText(enriched.recommendedAction, 320),
              anchorDate,
            )
          : item.recommendedAction;
        const whyItMatters = enriched.whyItMatters
          ? expandRelativeWeekdays(
              compactCompleteText(enriched.whyItMatters, 320),
              anchorDate,
            )
          : item.whyItMatters;
        return {
          ...item,
          summary,
          evidenceFacts:
            evidenceFacts.length > 0
              ? evidenceFacts
              : fallbackEvidenceFacts(item),
          bullets: getExecutiveBriefBullets({
            bullets: enriched.bullets ?? item.bullets,
            evidenceFacts:
              evidenceFacts.length > 0
                ? evidenceFacts
                : fallbackEvidenceFacts(item),
            summary,
            recommendedAction,
            whyItMatters,
            status: item.status,
            citations: item.citations,
          }),
          recommendedAction,
          whyItMatters,
        };
      }),
      warnings: [],
    };
  } catch (error) {
    const message = formatAIProviderFailure(
      error,
      "Executive briefing evidence enrichment",
    );
    return {
      sections: mapBriefSections(sections, (item) => ({
        ...item,
        evidenceFacts: fallbackEvidenceFacts(item),
      })),
      warnings: [
        `Executive briefing evidence enrichment failed with ${synthesisModel}; using source-backed fallback facts. ${message}`,
      ],
    };
  }
}

async function loadProjectNumberMap(): Promise<Map<number, string>> {
  const supabase = createServiceClient();
  const { data } = await serviceDb.from("projects")
    .select("id, project_number")
    .not("project_number", "is", null);
  const map = new Map<number, string>();
  for (const row of data ?? []) {
    if (row.project_number) map.set(row.id, row.project_number);
  }
  return map;
}

export function applyProjectNumbers(
  sections: BrandonDailyUpdatePacket["sections"],
  projectNumberMap: Map<number, string>,
): BrandonDailyUpdatePacket["sections"] {
  if (projectNumberMap.size === 0) return sections;
  return mapBriefSections(sections, (item) => {
    if (!item.projectInternalId) return item;
    const projectNumber = projectNumberMap.get(item.projectInternalId);
    if (!projectNumber) return item;
    // Strip any leading project-number token before re-prefixing. The token may
    // be a bare number ("67 ") OR a dashed number ("25-126 ") — projectDisplayName
    // now emits the dashed form. The old /^\d+\s*/ regex stripped only "25",
    // leaving "-126 Vermillion Rise Warehouse", which then re-prefixed into the
    // garbled "25-126 -126 Vermillion Rise Warehouse". Match the full token.
    const stripped = item.project.replace(/^\d+(?:-\d+)*\s+/, "").trim();
    const nameOnly = stripped === projectNumber ? "" : stripped;
    return {
      ...item,
      project: nameOnly ? `${projectNumber} ${nameOnly}` : projectNumber,
    };
  });
}

/**
 * Feature flag for Phase 3 of the daily-briefs strategy: source the brief from
 * the curated insight_cards layer (Pipeline B) instead of re-running RAG vector
 * search over 900-char document chunks every morning. Default OFF so production
 * is unchanged until the flag is flipped; flip back for instant rollback.
 */
function isInsightCardBriefEnabled(): boolean {
  const flag =
    process.env.EXECUTIVE_BRIEF_FROM_INSIGHT_CARDS?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

const INSIGHT_CARD_TONE: Record<string, BriefTone> = {
  risk: "risk",
  blocker: "risk",
  schedule_risk: "risk",
  financial_exposure: "risk",
  decision: "watch",
  change_management: "watch",
  open_question: "watch",
};

/**
 * Cross-time recurrence note: insight_cards.source_count increments each time a
 * new evidence document promotes the same normalized signal, so >1 means the
 * issue has resurfaced across multiple meetings/messages. Surfacing this is the
 * "this keeps coming up" intelligence ("missed this 3 updates running") that a
 * point-in-time RAG brief can't express.
 */
function insightCardRecurrenceNote(card: OwnerBriefingCardItem): string | null {
  if (card.sourceCount < 2) return null;
  const since = card.firstSeenAt ? formatSourceDate(card.firstSeenAt) : null;
  return since
    ? `Recurring: surfaced in ${card.sourceCount} updates since ${since}.`
    : `Recurring: surfaced in ${card.sourceCount} updates.`;
}

function insightCardToBriefItem(
  card: OwnerBriefingCardItem,
  project: OwnerBriefingProject,
): BrandonBriefItem {
  const date =
    formatSourceDate(card.lastSeenAt ?? card.firstSeenAt ?? null) ||
    new Date().toISOString();
  // Ensure every citation has non-empty evidence so filterSupportedSections
  // does not suppress cards whose why_it_matters is empty/null.
  const evidence =
    card.whyItMatters?.trim() || card.summary?.trim() || card.title;
  const recurrenceNote = insightCardRecurrenceNote(card);
  const citation: BriefCitation = {
    source: "Meeting",
    sourceDetail: project.projectName,
    sourceId: card.cardId,
    evidence,
    date,
  };
  return {
    title: card.title,
    summary: card.summary ?? card.title,
    bullets: [],
    evidenceFacts: recurrenceNote ? [recurrenceNote] : undefined,
    recommendedAction: card.nextAction ?? undefined,
    whyItMatters: card.whyItMatters ?? undefined,
    source: "Meeting",
    sourceDetail: project.projectName,
    sourceId: card.cardId,
    evidence,
    date,
    citations: [citation],
    project: project.projectName,
    projectInternalId: project.projectId,
    owner: card.suggestedOwnerLabel ?? undefined,
    tone: INSIGHT_CARD_TONE[card.cardType] ?? "neutral",
    retrieval: `insight_cards: ${card.cardType}, confidence ${card.confidence}`,
  };
}

/**
 * Bucket owner-relevant insight cards into the three brief sections.
 * Decisions/risks/blockers/financial/schedule cards → needsBrandon; action cards
 * owned by someone else → waitingOnOthers (unowned actions fall back to
 * needsBrandon). Pure (no I/O) so it is unit-testable. No LLM re-summarization —
 * card content is used verbatim so the full-fidelity intelligence the compilers
 * extracted survives into the brief.
 */
export function bucketInsightCardBriefSections(
  topProjects: OwnerBriefingProject[],
): BrandonDailyUpdatePacket["sections"] {
  const needsBrandon: BrandonBriefItem[] = [];
  const waitingOnOthers: BrandonBriefItem[] = [];
  const importantUpdates: BrandonBriefItem[] = [];

  for (const project of topProjects) {
    for (const card of project.decisionsNeeded) {
      needsBrandon.push(insightCardToBriefItem(card, project));
    }
    for (const card of project.actionsRequired) {
      const item = insightCardToBriefItem(card, project);
      if (card.suggestedOwnerLabel) {
        waitingOnOthers.push(item);
      } else {
        needsBrandon.push(item);
      }
    }
  }

  return { needsBrandon, waitingOnOthers, importantUpdates };
}

/**
 * Build the three brief sections directly from owner-relevant insight cards
 * (Pipeline B), bypassing RAG chunk search and chunk-synthesis entirely.
 */
async function buildBriefSectionsFromInsightCards(): Promise<{
  sections: BrandonDailyUpdatePacket["sections"];
  warnings: string[];
}> {
  const recipientName =
    process.env.EXECUTIVE_BRIEF_RECIPIENT_NAME?.trim() || "Brandon";
  const data = await buildOwnerBriefingData({ recipientName });

  const warnings: string[] = [];
  if (data.topProjects.length === 0) {
    warnings.push(
      "Daily Brief (insight-cards mode) found no owner-relevant cards. Confirm the meeting/Teams compilers are promoting signals to insight_cards.",
    );
  }

  return {
    sections: bucketInsightCardBriefSections(data.topProjects),
    warnings,
  };
}

export async function generateBrandonDailyUpdate(
  options: { windowDays?: number; sourceBackedOnly?: boolean } = {},
): Promise<BrandonDailyUpdatePacket> {
  const windowDays = options.windowDays ?? DEFAULT_EXECUTIVE_WINDOW_DAYS;
  const sourceBackedOnly = options.sourceBackedOnly ?? false;
  const windowStartDateKey = getWindowStartDateKey(windowDays);
  const cutoff = new Date(`${windowStartDateKey}T00:00:00-04:00`);
  const cutoffIso = cutoff.toISOString();
  const [
    fallbackResult,
    recentTranscriptResult,
    financialPulseResult,
    operatingRecordResult,
  ] =
    await withExecutiveDailyBriefObservation(
      "executive-daily-brief.source-preflight",
      {
        type: "retriever",
        input: { windowDays, windowStartDateKey, cutoffIso, sourceBackedOnly },
        metadata: { stage: "source_preflight" },
        output: (result) => {
          const [fallback, transcripts, financial, operating] = result as [
            FallbackMetadataResult,
            RecentTranscriptResult,
            FinancialPulseData,
            OperatingRecordBriefResult,
          ];
          return {
            fallbackRows: fallback.rows.length,
            fallbackWarningCount: fallback.warnings.length,
            recentTranscriptItemCount: transcripts.items.length,
            recentTranscriptWarningCount: transcripts.warnings.length,
            financialProjectCount: financial.arByProject.length,
            financialPendingCOProjectCount:
              financial.pendingCOsByProject.length,
            financialWarningCount: financial.warnings.length,
            operatingItemCount: operating.itemCount,
            operatingSectionCounts: executiveBriefSectionCounts(
              operating.sections,
            ),
            operatingWarningCount: operating.warnings.length,
          };
        },
      },
      async () =>
        Promise.all([
          loadFallbackMetadata(cutoff),
          loadRecentMeetingTranscriptItems(cutoffIso),
          loadFinancialPulse().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              generatedAt: new Date().toISOString(),
              totalOutstandingAR: 0,
              totalOverdueAR: 0,
              arByProject: [],
              totalPendingCORevenue: 0,
              pendingCOsByProject: [],
              warnings: [`Financial pulse load failed: ${msg}`],
            } satisfies FinancialPulseData;
          }),
          loadOperatingRecordBriefItems(cutoffIso),
        ]),
    );
  const financialPulse: FinancialPulseData = financialPulseResult;

  const preflightWarnings: string[] = [];
  let openai: ReturnType<typeof getOpenAI> | null = null;

  if (sourceBackedOnly) {
    preflightWarnings.push(
      "Daily Brief manual refresh used source-backed fallback mode, so vector search and LLM enrichment were skipped to keep the foreground action bounded.",
    );
  } else {
    try {
      openai = getOpenAI();
    } catch (error) {
      preflightWarnings.push(
        `${formatAIProviderFailure(error, "Executive briefing provider setup")} The Daily Brief will continue with source-backed fallback retrieval.`,
      );
    }
  }

  if (!sourceBackedOnly && !openai) {
    preflightWarnings.push(
      "Daily Brief vector search was skipped because no OpenAI-compatible embedding client was available.",
    );
  }

  let embeddingsBySpec: Array<{ spec: QuerySpec; queryEmbedding: string }>;
  if (openai) {
    try {
      embeddingsBySpec = await withExecutiveDailyBriefObservation(
        "executive-daily-brief.embedding-queries",
        {
          type: "embedding",
          input: {
            queryCount: QUERY_SPECS.length,
            embeddingModel: EMBEDDING.LARGE,
            queryTitles: QUERY_SPECS.map((spec) => spec.title),
          },
          metadata: { stage: "embedding_queries" },
          output: (result) => ({
            embeddingCount: (
              result as Array<{ spec: QuerySpec; queryEmbedding: string }>
            ).length,
          }),
        },
        async () =>
          Promise.all(
            QUERY_SPECS.map(async (spec) => ({
              spec,
              queryEmbedding: await withBriefingTimeout(
                generateEmbedding(openai, spec.query, EMBEDDING.LARGE),
                EXECUTIVE_BRIEFING_EMBEDDING_TIMEOUT_MS,
                `Daily Brief embedding query "${spec.title}"`,
              ),
            })),
          ),
      );
    } catch (error) {
      preflightWarnings.push(
        `${formatAIProviderFailure(error, "Executive briefing embedding generation")} The Daily Brief will continue with source-backed fallback retrieval.`,
      );
      embeddingsBySpec = [];
    }
  } else {
    embeddingsBySpec = [];
  }

  const chunkSearchWarnings: string[] = [];
  const rawHitGroups = embeddingsBySpec.length
    ? await withExecutiveDailyBriefObservation(
        "executive-daily-brief.vector-chunk-search",
        {
          type: "retriever",
          input: {
            queryCount: embeddingsBySpec.length,
            sourceGroups: SOURCE_GROUPS.map((group) => ({
              label: group.label,
              sourceTypes: group.sourceTypes,
            })),
            matchCount: 10,
            matchThreshold: 0.08,
            timeoutMs: EXECUTIVE_BRIEFING_RAG_SEARCH_TIMEOUT_MS,
          },
          metadata: { stage: "vector_chunk_search" },
          output: (result) => ({
            ...rawHitGroupsSummary(result as RawHit[][]),
            warningCount: chunkSearchWarnings.length,
            warnings: chunkSearchWarnings.slice(0, 8),
          }),
        },
        async () =>
          (
            await Promise.allSettled(
              embeddingsBySpec.flatMap(({ spec }) =>
                SOURCE_GROUPS.map(async (sourceGroup) => {
                  const rows = await withBriefingTimeout(
                    runChunkSearch(spec.query, sourceGroup),
                    EXECUTIVE_BRIEFING_RAG_SEARCH_TIMEOUT_MS,
                    `Daily Brief chunk search for ${spec.title} (${sourceGroup.label})`,
                  );
                  return rows.map((row) => ({ spec, sourceGroup, row }));
                }),
              ),
            )
          ).flatMap((result) => {
            if (result.status === "fulfilled") {
              return [result.value];
            }
            chunkSearchWarnings.push(
              `Daily Brief chunk search degraded: ${formatAIProviderFailure(
                result.reason,
                "Executive briefing RAG search",
              )}`,
            );
            return [];
          }),
      )
    : [];
  const rawHits = rawHitGroups.flat();

  const documentIds = [
    ...new Set(
      rawHits.map((hit) => hit.row.document_id).filter(Boolean) as string[],
    ),
  ];
  const metadata = await withExecutiveDailyBriefObservation(
    "executive-daily-brief.source-metadata-lookup",
    {
      type: "retriever",
      input: {
        documentIdCount: documentIds.length,
        documentIds: documentIds.slice(0, 30),
      },
      metadata: { stage: "source_metadata_lookup" },
      output: (result) => ({
        metadataRows: (result as Map<string, DocumentMetaRow>).size,
      }),
    },
    async () => loadMetadata(documentIds),
  );

  const rankedHits = rawHits
    .map((hit): RankedHit => {
      const meta = hit.row.document_id
        ? metadata.get(hit.row.document_id)
        : undefined;
      const date = parseDate(getHitDateAnchor({ ...hit, metadata: meta }));
      const text = normalizeText(
        hit.row.chunk_text ??
          hit.row.text ??
          meta?.summary ??
          meta?.overview ??
          meta?.action_items ??
          meta?.content ??
          meta?.raw_text,
      );
      return {
        id:
          hit.row.document_id ??
          hit.row.chunk_id ??
          `${hit.spec.title}-${hit.sourceGroup.label}`,
        ...hit,
        metadata: meta,
        date,
        similarity: hit.row.similarity ?? 0,
        text,
      };
    })
    .filter((hit) => hit.text.length > 30)
    .filter((hit) => isWithinWindow(hit.date, windowStartDateKey))
    // Raised from 0.25 → 0.35 to reduce low-signal noise in the brief.
    .filter((hit) => hit.similarity >= 0.35);

  const dedupedHits = dedupeHits(rankedHits);

  const { seededSections, synthesisInput } =
    await withExecutiveDailyBriefObservation(
      "executive-daily-brief.source-candidate-selection",
      {
        type: "chain",
        input: {
          sourceBackedOnly,
          operatingItemCount: operatingRecordResult.itemCount,
          rawHitCount: rawHits.length,
          rankedHitCount: rankedHits.length,
          dedupedHitCount: dedupedHits.length,
          fallbackRowCount: fallbackResult.rows.length,
          recentTranscriptItemCount: recentTranscriptResult.items.length,
        },
        metadata: { stage: "source_candidate_selection" },
        output: (result) => {
          const selected = result as {
            fallbackItems: BrandonBriefItem[];
            seededSections: BrandonDailyUpdatePacket["sections"];
            synthesisInput: {
              sections: BrandonDailyUpdatePacket["sections"];
              droppedCount: number;
            };
          };
          return {
            fallbackItemCount: selected.fallbackItems.length,
            seeded: executiveBriefSourceSelectionSummary(
              selected.seededSections,
            ),
            synthesisInput: executiveBriefSourceSelectionSummary(
              selected.synthesisInput.sections,
            ),
            droppedBeforeSynthesis: selected.synthesisInput.droppedCount,
          };
        },
      },
      async () => {
        const items = fallbackResult.rows
          .map(makeFallbackItem)
          .filter((item): item is BrandonBriefItem => item !== null);
        const seeded = mergeSeedItems(
          assignHitsToSections(dedupedHits, [
            ...recentTranscriptResult.items,
            ...items,
          ]),
          operatingRecordResult.sections,
        );
        const limited = sourceBackedOnly
          ? { sections: seeded, droppedCount: 0 }
          : limitSectionsForSynthesis(seeded);
        return {
          fallbackItems: items,
          seededSections: seeded,
          synthesisInput: limited,
        };
      },
    );
  const sectionsForSynthesis = synthesisInput.sections;
  if (synthesisInput.droppedCount > 0) {
    preflightWarnings.push(
      `Daily Brief synthesis candidate set was capped from ${countBriefItems(seededSections)} to ${countBriefItems(sectionsForSynthesis)} item(s) before GPT synthesis to prevent timeout and raw fallback drift.`,
    );
  }

  // Pull the full embedded transcript text for every surfaced item BEFORE
  // synthesis, so both synthesis and enrichment read the complete meeting
  // instead of the lossy auto-summary the keyword-fallback path carries.
  const fullTextEnrichedCount = sourceBackedOnly
    ? 0
    : await withExecutiveDailyBriefObservation(
        "executive-daily-brief.full-text-enrichment",
        {
          type: "retriever",
          input: executiveBriefSourceSelectionSummary(sectionsForSynthesis),
          metadata: { stage: "full_text_enrichment" },
          output: (result) => ({
            enrichedItemCount: result as number,
            candidateCount: countBriefItems(sectionsForSynthesis),
          }),
        },
        async () =>
          enrichSectionsWithFullDocumentText(sectionsForSynthesis).catch(
            () => 0,
          ),
      );

  const synthesizedResult = sourceBackedOnly
    ? {
        sections: sectionsForSynthesis,
        modelUsed: "source-backed-fallback",
        warnings: [
          "Daily Brief synthesis skipped in source-backed fallback mode.",
        ],
        degraded: false,
      }
    : await synthesizeSections(sectionsForSynthesis, financialPulse);
  const breadthCheckedSynthesisSections = ensureExecutiveBriefSourceBreadth(
    synthesizedResult.sections,
    seededSections,
  );

  const communicationSignalResult = await withExecutiveDailyBriefObservation(
    "executive-daily-brief.communication-signals",
    {
      type: "retriever",
      input: {
        cutoffIso,
        signalSpecCount: COMMUNICATION_SIGNAL_SPECS.length,
      },
      metadata: { stage: "communication_signals" },
      output: (result) => {
        const signals = result as RecentCommunicationSignalResult;
        return executiveBriefSourceSelectionSummary(
          signals.sections,
          signals.warnings,
        );
      },
    },
    async () => loadRecentCommunicationSignalItems(cutoffIso),
  );

  // Build deterministic financial brief items — always included regardless of LLM behavior.
  const financialBriefItems = buildFinancialBriefItems(financialPulse);

  // Merge order: financial items first (highest priority), then communication signals, then LLM synthesis.
  const supportedResult = await withExecutiveDailyBriefObservation(
    "executive-daily-brief.supported-source-filter",
    {
      type: "chain",
      input: {
        synthesized: executiveBriefSectionCounts(breadthCheckedSynthesisSections),
        communicationSignals: executiveBriefSectionCounts(
          communicationSignalResult.sections,
        ),
        financial: executiveBriefSectionCounts(financialBriefItems),
      },
      metadata: { stage: "supported_source_filter" },
      output: (result) => {
        const supported = result as SupportedSectionsResult;
        return executiveBriefSourceSelectionSummary(
          supported.sections,
          supported.warnings,
        );
      },
    },
    async () =>
      filterSupportedSections(
        mergeSeedItems(
          mergeSeedItems(
            breadthCheckedSynthesisSections,
            communicationSignalResult.sections,
          ),
          financialBriefItems,
        ),
      ),
  );
  const enrichedResult = sourceBackedOnly
    ? {
        sections: supportedResult.sections,
        warnings: [
          "Daily Brief evidence enrichment skipped in source-backed fallback mode.",
        ],
      }
    : synthesizedResult.degraded
      ? {
          sections: mapBriefSections(supportedResult.sections, (item) => ({
            ...item,
            evidenceFacts: fallbackEvidenceFacts(item),
          })),
          warnings: [
            "Daily Brief evidence enrichment skipped because synthesis already degraded to source-backed fallback mode.",
          ],
        }
      : await enrichBriefSections(supportedResult.sections, financialPulse);
  const projectNumberMap = await loadProjectNumberMap();
  const numberedSections = applyProjectNumbers(
    enrichedResult.sections,
    projectNumberMap,
  );
  // Final guardrail: strip accounts-receivable/overdue/collections language from
  // the fully-merged, enriched brief — no matter whether it entered via the LLM,
  // the deterministic financial items, or the merge. AR stays out of the brief
  // until the Acumatica feed is trusted again (product decision, 2026-06).
  const sections = normalizeMeetingProjectLabelsInSections(
    capExecutiveBriefSections(
      sanitizeAccountingSections(enforceExecutiveBriefBullets(numberedSections)),
    ),
  );
  const operatingBrief = buildExecutiveOperatingBrief(sections);
  const sourceCoverage = await withExecutiveDailyBriefObservation(
    "executive-daily-brief.source-coverage",
    {
      type: "retriever",
      input: { cutoffIso, sourceGroups: SOURCE_GROUPS.map((g) => g.label) },
      metadata: { stage: "source_coverage" },
      output: (result) => ({
        sources: (result as BrandonBriefSourceCoverage[]).map((source) => ({
          label: source.label,
          count: source.count,
          latest: source.latest,
          status: source.status,
          hasWarning: Boolean(source.warning),
        })),
      }),
    },
    async () => loadRecentSourceCoverage(cutoffIso),
  );
  const sourceCoverageWarnings = sourceCoverage
    .map((source) => source.warning)
    .filter((warning): warning is string => Boolean(warning));
  const thinContentWarnings = executiveBriefThinContentWarnings(
    sections,
    sourceCoverage,
  );
  const sourceHealthWarnings = [
    ...fallbackResult.warnings,
    ...recentTranscriptResult.warnings,
    ...financialPulse.warnings,
    ...preflightWarnings,
    ...chunkSearchWarnings,
    ...operatingRecordResult.warnings,
    ...synthesizedResult.warnings,
    ...communicationSignalResult.warnings,
    ...supportedResult.warnings,
    ...enrichedResult.warnings,
    ...sourceCoverageWarnings,
    ...thinContentWarnings,
  ];

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    retrievalOrder: [
      "1. Acumatica ERP financial data (AR, change orders) — authoritative ground truth",
      "2. Recent email evidence",
      "3. Recent Teams messages",
      "4. Recent meeting transcripts and summaries",
      "5. Project operating records: timeline events and potential change-event candidates",
      "6. Recent document records",
      "7. Older knowledge only as secondary context",
    ],
    sections,
    operatingBrief,
    financialPulse,
    sourceCoverage,
    retrievalNotes: [
      ...(operatingRecordResult.itemCount > 0
        ? [
            `Daily Brief source: merged ${operatingRecordResult.itemCount} project operating record(s) from project_intelligence_timeline_events and change_event_candidates into the RAG vector search candidate set.`,
            `Daily Brief synthesis input: ${countBriefItems(sectionsForSynthesis)} highest-ranked item(s) were sent to GPT from ${countBriefItems(seededSections)} available candidate(s).`,
          ]
        : []),
      `Executive briefing source of truth: recap_kind=executive_briefing. Backend recap_kind=meeting_digest is the legacy meeting digest and must not be treated as the CEO operating brief.`,
      `Executive synthesis model: ${synthesizedResult.modelUsed}. Override with EXECUTIVE_BRIEFING_SYNTHESIS_MODEL only when the CEO brief intentionally needs a different model.`,
      `Project operating records: ${operatingRecordResult.itemCount} timeline/change-event candidate item(s) were added to the synthesis candidate set from project_intelligence_timeline_events and change_event_candidates.`,
      `Transcript-first synthesis: ${recentTranscriptResult.items.length} recent meeting transcript item(s) were inserted before source ranking so cross-meeting patterns are not dependent on keyword RAG hits.`,
      `Financial pulse: ${financialPulse.totalOutstandingAR > 0 ? `$${Math.round(financialPulse.totalOutstandingAR / 1000)}K total outstanding AR, $${Math.round(financialPulse.totalOverdueAR / 1000)}K overdue across ${financialPulse.arByProject.length} projects; ${financialPulse.pendingCOsByProject.length} projects with pending COs ($${Math.round(financialPulse.totalPendingCORevenue / 1000)}K revenue)` : "No financial data available"}.`,
      `Full-transcript enrichment: ${fullTextEnrichedCount} surfaced item(s) were upgraded from the lossy document_metadata auto-summary to the complete embedded transcript text from the vector store (document_chunks in the AI Database) before synthesis.`,
      "The briefing window covers the last 3 business days in Eastern time (weekends skipped) so a Monday brief still includes the prior Thursday and Friday without dragging in week-old noise.",
      "Financial data from Acumatica ERP (AR invoices, change orders) is treated as authoritative ground truth in the synthesis — these figures cannot be hallucinated.",
      "RAG similarity threshold is 0.35 (raised from 0.25) to reduce low-signal noise.",
      "Low-confidence items are excluded unless they have recent source evidence.",
      "Every surfaced item keeps its source title, date, and link when the ingestion data provides one.",
      "The CEO operating brief ranks by financial impact, schedule impact, customer impact, contractual risk, urgency, Brandon uniqueness, compounding risk, and blocked work; material overflow is kept in additional lanes instead of dropped.",
      ...sourceHealthWarnings.map(
        (warning) => `Source health warning: ${warning}`,
      ),
    ],
  };
}
