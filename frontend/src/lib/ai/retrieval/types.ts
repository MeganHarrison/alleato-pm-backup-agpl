import type { AssistantIntent } from "@/lib/ai/intent-router";
import type { SourceSpecificRagKind } from "@/lib/ai/detect-rag-request";
import type { ClientProjectIntelligencePacket } from "@/lib/ai/intelligence/types";
import type {
  ChatTurnResearchContract,
  ExternalResearchSource,
  ResearchReceipt,
} from "./research-contract";

export type ExternalSource = ExternalResearchSource;
export type SubAgent = "cfo" | "coo" | "cro" | "chro" | "vpbd";

export type ResponseFormat =
  | "briefing_template"
  | "conversational"
  | "collection_analysis"
  | "project_scope_required"
  | "rfi_preview"
  | "brandon_daily"
  | "source_lookup"
  | "recent_email_inbox"
  | "source_specific_rag"
  | "app_help";

export type MeetingCollectionRequest = {
  corpus: "meeting_transcripts";
  operation: "analyze" | "summarize" | "compare" | "list" | "search";
  scope: "all_matches" | "matching_subset" | "single_entity";
  originalRequest: string;
  semanticCriteria: string;
  searchTerms: string[];
  excludeTerms: string[];
  titleContains?: string | null;
  category?: string | null;
  participant?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  entityId?: string | null;
  requiresExhaustiveCoverage: boolean;
};

export type MeetingCollectionItem = {
  id: string;
  title: string;
  date: string | null;
  category: string | null;
  projectId: number | null;
  project: string | null;
  participants: string | null;
  sourceRef: string;
  sourceUrl: string | null;
  transcript: string;
  transcriptCharacters: number;
};

export type MeetingCollectionFailure = {
  id: string | null;
  title: string | null;
  code:
    | "enumeration_failed"
    | "enumeration_limit_exceeded"
    | "record_limit_exceeded"
    | "meeting_not_found"
    | "meeting_access_denied"
    | "transcript_fetch_failed"
    | "transcript_missing";
  message: string;
};

export type MeetingCollectionResult = {
  request: MeetingCollectionRequest;
  status: "complete" | "incomplete" | "no_matches";
  coverage: {
    enumerated: number;
    candidateMatches: number;
    matched: number;
    retrieved: number;
    failed: number;
    transcriptCharacters: number;
    exhaustive: boolean;
  };
  items: MeetingCollectionItem[];
  failures: MeetingCollectionFailure[];
};

export type RetrievalPlan = {
  intent: AssistantIntent;
  responseFormat: ResponseFormat;
  sources: {
    intelligencePacket?: { mode: "additive" | "replace" };
    /** Completed Product Intelligence + governed Executive Report evidence. */
    intelligenceEvidence?: { mode: "current" | "historical" | "raw" };
    projectSnapshot?: { reason: "intent" | "fallback" };
    semanticVectorSearch?: { query: string };
    research?: ChatTurnResearchContract;
    recentEmails?: { daysBack: number; limit: number; reason: string };
    sourceSpecificRag?: { kind: SourceSpecificRagKind };
    reusePriorBriefing?: boolean;
    brandonDailyUpdate?: boolean;
    appExpert?: { question: string };
    meetingCollection?: MeetingCollectionRequest;
  };
  preconsult?: SubAgent[];
  selectedProjectId?: number;
  reason: string;
};

export type RetrievalContext = {
  intelligencePacket?: ClientProjectIntelligencePacket | null;
  intelligenceEvidence?: {
    current: ClientProjectIntelligencePacket | null;
    historical: Array<{ id: string; generatedAt: string; url: string; title: string; snippet: string }>;
    executiveReports: Array<{ id: string; businessDate: string; url: string; title: string; snippet: string }>;
    status: "complete" | "insufficient" | "failed";
    reason?: string;
  } | null;
  intelligenceTargetSlug?: string;
  projectSnapshot?: unknown;
  semanticVectorResults?: unknown;
  executiveBriefingRetrieval?: unknown;
  recentEmailInbox?: unknown;
  sourceSpecificRagAnswer?: { content: string; rows: unknown[] } | null;
  brandonDailyUpdatePacket?: unknown;
  appExpertPacket?: unknown;
  meetingCollection?: MeetingCollectionResult | null;
  researchReceipts?: ResearchReceipt[];
  reusedFromPriorBriefing?: boolean;
  warnings: Array<{ source: string; message: string }>;
  durationsMs: Record<string, number>;
};
