import type { Database } from "@/types/database.types";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type IntelligenceTargetType =
  | "client_project"
  | "internal_initiative"
  | "vendor_platform"
  | "company_process";

export type PacketFreshnessStatus =
  | "fresh"
  | "stale"
  | "partial"
  | "working_sample"
  | "failed";

export type InsightCardType =
  | "risk"
  | "decision"
  | "blocker"
  | "task"
  | "product_need"
  | "process_issue"
  | "project_update"
  | "open_question"
  | "requirement"
  | "financial_exposure"
  | "change_management"
  | "schedule_risk"
  | "sentiment"
  | "initiative_signal";

export type ConfidenceLevel = "high" | "medium" | "low";

export type IntelligenceTargetRow = Tables<"intelligence_targets">;
export type IntelligencePacketRow = Tables<"intelligence_packets">;
export type InsightCardRow = Tables<"insight_cards">;
export type InsightCardEvidenceRow = Tables<"insight_card_evidence">;
export type IntelligencePacketCardRow = Tables<"intelligence_packet_cards">;

export type ResolvedIntelligenceTarget = {
  id: string;
  targetType: IntelligenceTargetType;
  name: string;
  slug: string;
  projectId: number | null;
  status: string;
  resolutionReason: string;
  source: "selected_project" | "target_match" | "project_match";
};

export type SourceCoverageSummary = {
  freshnessStatus?: PacketFreshnessStatus;
  documentMetadataRows?: number;
  aiMemoryRows?: number;
  projectEmailRows?: number;
  latestSourceAt?: string | null;
  linkedEvidenceCount?: number;
  gaps?: string[];
  [key: string]: unknown;
};

export type ConfidenceSummary = {
  overall?: ConfidenceLevel;
  status?: ConfidenceLevel;
  financialExposure?: ConfidenceLevel;
  changeManagement?: ConfidenceLevel;
  followUps?: ConfidenceLevel;
  reason?: string;
  [key: string]: unknown;
};

export type InsightCardEvidence = {
  id: string;
  sourceDocumentId: string | null;
  sourceChunkId: string | null;
  sourceMessageId: string | null;
  sourceType: string;
  sourceCategory: string | null;
  sourceTitle: string | null;
  sourceOccurredAt: string | null;
  participants: string[];
  sourceContentPreview: string | null;
  excerpt: string | null;
  summary: string | null;
  relevanceReason: string;
  evidenceRole: string;
  confidence: ConfidenceLevel;
};

export type InsightCardFeedbackSignal = "useful" | "wrong" | "stale";

export type InsightCardReviewFeedback = {
  id: string;
  status: string;
  signal: InsightCardFeedbackSignal;
  reason: string | null;
  correction: string | null;
  createdAt: string;
};

export type InsightCard = {
  id: string;
  title: string;
  cardType: InsightCardType;
  section: string | null;
  rank: number | null;
  summary: string;
  whyItMatters: string | null;
  currentStatus: string;
  confidence: ConfidenceLevel;
  attributionStatus: string;
  nextAction: string | null;
  sourceCount: number;
  metadata: Record<string, unknown>;
  evidence: InsightCardEvidence[];
  latestFeedback: InsightCardReviewFeedback | null;
};

export type ClientProjectIntelligencePacket = {
  id: string;
  targetId: string;
  packetType: string;
  packetVersion: string;
  generatedAt: string;
  coveredStartAt: string | null;
  coveredEndAt: string | null;
  freshnessStatus: PacketFreshnessStatus;
  executiveSummary: string;
  currentStatus: string | null;
  strategicRead: string | null;
  whyItMatters: string | null;
  recommendedNextMoves: string[];
  confidenceSummary: ConfidenceSummary;
  sourceCoverage: SourceCoverageSummary;
  operatingRecord?: {
    currentState?: Record<string, unknown> | null;
    latestSnapshot?: Record<string, unknown> | null;
    timelineEvents?: Record<string, unknown>[];
    changeEventCandidates?: Record<string, unknown>[];
  } | null;
  reviewQueueCount: number;
  staleItemCount: number;
  packetJson: Record<string, unknown>;
  compilerVersion: string | null;
  cards: InsightCard[];
  // Derived staleness fields — computed at load time, not stored in DB.
  // generated_at older than PACKET_STALE_AFTER_HOURS triggers a warning in the
  // system prompt so the model does not assert the packet is current.
  ageHours: number;
  isStale: boolean;
};

/**
 * How old a packet may be before we flag it as stale. Current packets should
 * come from `project_intelligence_synthesis_v1`; stale packets are warnings,
 * not proof that the synthesis path is active.
 */
export const PACKET_STALE_AFTER_HOURS = 8;
