import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { toSessionUuid } from "@/lib/ai/session-id";
import {
  upsertAgentLearning,
  type AgentLearning,
} from "@/lib/ai/services/agent-learning-service";
import {
  writeMemory,
  type MemoryType,
  type MemoryVisibility,
} from "@/lib/ai/services/ai-memory-service";
import {
  createSkill,
  type AiSkill,
  type AiSkillRiskLevel,
  type AiSkillScopeType,
} from "@/lib/ai/services/skill-library-service";
import type { Database, Json } from "@/types/database.types";

type Tables = Database["public"]["Tables"];

export type AiFeedbackEventRow = Tables["ai_feedback_events"]["Row"];
export type AiFeedbackEventInsert = Tables["ai_feedback_events"]["Insert"];
export type AiLearningPromotionRow = Tables["ai_learning_promotions"]["Row"];
export type AiLearningPromotionInsert = Tables["ai_learning_promotions"]["Insert"];
export type AiRetrievalFeedbackRow = Tables["ai_retrieval_feedback"]["Row"];
export type AiRetrievalFeedbackInsert = Tables["ai_retrieval_feedback"]["Insert"];
export type AiRetrievalWeightRow = Tables["ai_retrieval_weights"]["Row"];
export type AiRetrievalWeightInsert = Tables["ai_retrieval_weights"]["Insert"];
export type AiTaskFeedbackRow = Tables["ai_task_feedback"]["Row"];
export type IntelligenceReviewRow = Tables["intelligence_reviews"]["Row"];
export type IntelligenceReviewInsert = Tables["intelligence_reviews"]["Insert"];
export type DocumentAttributionCandidateRow =
  Tables["document_attribution_candidates"]["Row"];
export type DocumentAttributionCandidateInsert =
  Tables["document_attribution_candidates"]["Insert"];
export type ProjectAttributionRuleRow =
  Tables["project_attribution_rules"]["Row"];
export type ProjectAttributionRuleInsert =
  Tables["project_attribution_rules"]["Insert"];

export type AiFeedbackEventFamily =
  | "retrieval"
  | "attribution"
  | "assistant_response"
  | "tool_action"
  | "task_generation"
  | "packet_quality"
  | "document_review"
  | "user_preference"
  | "workflow_outcome"
  | "eval_failure";

export type AiFeedbackSignal =
  | "positive"
  | "negative"
  | "corrected"
  | "accepted"
  | "ignored"
  | "completed"
  | "failed"
  | "needs_review"
  | "stale"
  | "conflicting";

export type AiLearningPromotionStatus =
  | "candidate"
  | "approved"
  | "rejected"
  | "applied"
  | "expired"
  | "superseded";

export type AiLearningPromotionType =
  | "agent_prevention_prompt"
  | "positive_task_example"
  | "user_preference"
  | "project_lesson"
  | "retrieval_weight"
  | "attribution_rule"
  | "packet_rule"
  | "workflow_rule";

export type AiLearningRiskLevel = "low" | "medium" | "high";

export type AiRetrievalOutcome =
  | "helpful"
  | "unhelpful"
  | "wrong_project"
  | "stale"
  | "unsupported"
  | "unknown";

export class AiFeedbackEventError extends Error {
  constructor(
    public readonly table: string,
    public readonly operation: string,
    message: string,
  ) {
    super(`[${table}.${operation}] ${message}`);
    this.name = "AiFeedbackEventError";
  }
}

export interface RecordAiFeedbackEventParams {
  userId?: string | null;
  projectId?: number | null;
  targetId?: string | null;
  sessionId?: string | null;
  sourceTable?: string | null;
  sourceRecordId?: string | null;
  eventType: string;
  eventFamily: AiFeedbackEventFamily;
  surface: string;
  subjectType: string;
  subjectId?: string | null;
  signal: AiFeedbackSignal;
  reasonCategory?: string | null;
  freeText?: string | null;
  beforeSnapshot?: Json;
  afterSnapshot?: Json;
  sourceContext?: Json;
  metadata?: Json;
}

export interface CreateLearningPromotionParams {
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  status?: AiLearningPromotionStatus;
  promotionType: AiLearningPromotionType;
  projectId?: number | null;
  targetId?: string | null;
  sourceEventIds?: string[];
  destinationTable?: string | null;
  destinationRecordId?: string | null;
  confidence?: number;
  riskLevel?: AiLearningRiskLevel;
  proposedLearning: Json;
  reviewNotes?: string | null;
  expiresAt?: string | null;
  supersededBy?: string | null;
}

export interface UpdateLearningPromotionParams {
  promotionId: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  status?: AiLearningPromotionStatus;
  destinationTable?: string | null;
  destinationRecordId?: string | null;
  confidence?: number;
  riskLevel?: AiLearningRiskLevel;
  reviewNotes?: string | null;
  expiresAt?: string | null;
  supersededBy?: string | null;
}

export interface RecordRetrievalFeedbackParams {
  userId?: string | null;
  projectId?: number | null;
  targetId?: string | null;
  sessionId?: string | null;
  toolName: string;
  queryText: string;
  sourceDocumentId?: string | null;
  sourceChunkId?: string | null;
  rank?: number | null;
  score?: number | null;
  cited?: boolean;
  userReferenced?: boolean;
  usedInAnswer?: boolean;
  outcome?: AiRetrievalOutcome;
  metadata?: Json;
}

export type PacketCardFeedbackSignal = "useful" | "wrong" | "stale";

export type EmailDraftFeedbackSignal =
  | "good"
  | "bad"
  | "accepted"
  | "edited"
  | "ignored";

export type EmailDraftFeedbackReasonCategory =
  | "too_formal"
  | "too_long"
  | "too_short"
  | "too_soft"
  | "too_direct"
  | "wrong_tone"
  | "wrong_assumption"
  | "missing_context"
  | "good_tone"
  | "good_structure"
  | "other";

export interface RecordEmailDraftFeedbackParams {
  userId: string;
  mailboxUserId: string;
  graphDraftMessageId: string;
  graphSourceMessageId?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  sessionId?: string | null;
  signal: EmailDraftFeedbackSignal;
  reasonCategory?: EmailDraftFeedbackReasonCategory | null;
  feedbackText?: string | null;
  draftSnapshot?: Json;
  finalSnapshot?: Json;
  voiceProfilePath?: string | null;
  voiceProfileVersion?: string | null;
  metadata?: Json;
}

export interface RecordPacketCardFeedbackParams {
  userId: string;
  projectId?: number | null;
  sessionId?: string | null;
  insightCardId: string;
  signal: PacketCardFeedbackSignal;
  reason?: string | null;
  correction?: string | null;
  cardSnapshot?: Json;
  metadata?: Json;
}

export interface RecordPacketCardFeedbackResult {
  review: IntelligenceReviewRow;
  event: AiFeedbackEventRow;
}

export interface GenerateRetrievalPromotionCandidatesParams {
  windowDays?: number;
  minHelpfulSignals?: number;
  minProblemSignals?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface RetrievalPromotionCandidatePreview {
  signature: string;
  promotionType: Extract<AiLearningPromotionType, "retrieval_weight">;
  projectId: number | null;
  confidence: number;
  riskLevel: AiLearningRiskLevel;
  destinationTable: "ai_retrieval_feedback";
  destinationRecordId: string | null;
  sourceEventIds: string[];
  proposedLearning: Json;
}

export interface GenerateRetrievalPromotionCandidatesResult {
  inspectedRows: number;
  groupsInspected: number;
  candidatesFound: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  dryRun: boolean;
  candidates: RetrievalPromotionCandidatePreview[];
}

export interface GenerateTaskPromotionCandidatesParams {
  windowDays?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface GenerateEmailVoicePromotionCandidatesParams {
  windowDays?: number;
  minSignals?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface TaskPromotionCandidatePreview {
  signature: string;
  promotionType: Extract<AiLearningPromotionType, "positive_task_example">;
  projectId: number | null;
  confidence: number;
  riskLevel: AiLearningRiskLevel;
  destinationTable: "ai_task_feedback";
  destinationRecordId: string;
  sourceEventIds: string[];
  proposedLearning: Json;
}

export interface GenerateTaskPromotionCandidatesResult {
  inspectedRows: number;
  candidatesFound: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  dryRun: boolean;
  candidates: TaskPromotionCandidatePreview[];
}

export interface EmailVoicePromotionCandidatePreview {
  signature: string;
  promotionType: Extract<AiLearningPromotionType, "user_preference">;
  projectId: null;
  confidence: number;
  riskLevel: AiLearningRiskLevel;
  destinationTable: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md";
  destinationRecordId: string;
  sourceEventIds: string[];
  proposedLearning: Json;
}

export interface GenerateEmailVoicePromotionCandidatesResult {
  inspectedRows: number;
  groupsInspected: number;
  candidatesFound: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  dryRun: boolean;
  candidates: EmailVoicePromotionCandidatePreview[];
}

export interface ApplyRetrievalWeightPromotionParams {
  promotionId: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

export interface ApplyRetrievalWeightPromotionResult {
  promotion: AiLearningPromotionRow;
  retrievalWeight: AiRetrievalWeightRow;
}

export interface ApplyAgentPreventionPromotionParams {
  promotionId: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

export interface ApplyAgentPreventionPromotionResult {
  promotion: AiLearningPromotionRow;
  agentLearning: AgentLearning;
}

export interface ApplyPositiveTaskExamplePromotionParams {
  promotionId: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

export interface ApplyPositiveTaskExamplePromotionResult {
  promotion: AiLearningPromotionRow;
  taskFeedback: AiTaskFeedbackRow;
}

export interface ApplyMemoryPromotionParams {
  promotionId: string;
  reviewedBy: string;
  reviewNotes?: string | null;
}

export interface ApplyMemoryPromotionResult {
  promotion: AiLearningPromotionRow;
  memory: {
    id: string;
    action: "created" | "updated";
  };
}

export interface ApplySkillLibraryPromotionParams {
  promotionId: string;
  reviewedBy: string;
  reviewNotes?: string | null;
}

export interface ApplySkillLibraryPromotionResult {
  promotion: AiLearningPromotionRow;
  skill: AiSkill;
}

export interface ApplyAttributionRulePromotionParams {
  promotionId: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

export interface ApplyAttributionRulePromotionResult {
  promotion: AiLearningPromotionRow;
  /** Set when the promotion applied a single document attribution candidate. */
  attributionCandidate?: DocumentAttributionCandidateRow;
  /**
   * Set when the promotion applied a generalizable project attribution rule
   * (proposed_learning.ruleKind === "project_attribution_rule"). This is the
   * destination the backend ProjectAssigner reads at highest priority.
   */
  attributionRule?: ProjectAttributionRuleRow;
}

/**
 * Rule kinds the AI proposes from manual project assignments. These map directly
 * onto `project_attribution_rules.rule_type`.
 */
export type AttributionRuleKind =
  | "domain"
  | "email"
  | "title_keyword";

export interface RecordAttributionAssignmentFeedbackParams {
  userId?: string | null;
  /** Project the item was assigned to. */
  projectId: number;
  projectName?: string | null;
  /** Underlying table the item lives in. */
  sourceTable: "document_metadata" | "outlook_email_intake";
  /** Primary key of the assigned row (stringified for numeric ids). */
  sourceRecordId: string;
  /** meeting | email | teams | document */
  contentType: string;
  /** Sender / organizer email when known — used to mine domain + email rules. */
  fromEmail?: string | null;
  /** Salient keywords from the title/subject — used to mine title rules. */
  titleKeywords?: string[];
  /** The project the AI suggested, if any. */
  suggestedProjectId?: number | null;
  /** True when the assigned project equals the AI suggestion. */
  matchedSuggestion: boolean;
  surface?: string;
  sessionId?: string | null;
}

export interface GenerateAttributionRulePromotionCandidatesParams {
  windowDays?: number;
  /** Minimum consistent assignments for a pattern to become a candidate. */
  minSignals?: number;
  /** Minimum share of assignments that must agree on one project (0-1). */
  minConsistency?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface AttributionRulePromotionCandidatePreview {
  signature: string;
  promotionType: Extract<AiLearningPromotionType, "attribution_rule">;
  projectId: number;
  confidence: number;
  riskLevel: AiLearningRiskLevel;
  destinationTable: "project_attribution_rules";
  destinationRecordId: null;
  sourceEventIds: string[];
  proposedLearning: Json;
}

export interface GenerateAttributionRulePromotionCandidatesResult {
  inspectedRows: number;
  groupsInspected: number;
  candidatesFound: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  dryRun: boolean;
  candidates: AttributionRulePromotionCandidatePreview[];
}

export type AiRetrievalWeightStatus = "active" | "paused" | "superseded";

export interface UpdateRetrievalWeightStatusParams {
  promotionId: string;
  status: AiRetrievalWeightStatus;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
}

export interface UpdateRetrievalWeightStatusResult {
  promotion: AiLearningPromotionRow;
  retrievalWeight: AiRetrievalWeightRow;
}

export interface RetrievalWeightImpactPreviewRow {
  retrievalFeedbackId: string;
  sourceDocumentId: string | null;
  sourceChunkId: string | null;
  outcome: AiRetrievalOutcome;
  cited: boolean;
  usedInAnswer: boolean;
  originalScore: number;
  adjustedScore: number;
  originalRank: number;
  adjustedRank: number;
  matchedPromotionSource: boolean;
}

export interface PreviewRetrievalWeightPromotionImpactParams {
  promotionId: string;
  limit?: number;
}

export interface PreviewRetrievalWeightPromotionImpactResult {
  promotion: AiLearningPromotionRow;
  multiplier: number;
  inspectedRows: number;
  matchingRows: number;
  beforeTop: RetrievalWeightImpactPreviewRow[];
  afterTop: RetrievalWeightImpactPreviewRow[];
  matchedRankChange: {
    beforeBestRank: number | null;
    afterBestRank: number | null;
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertNonEmpty(value: string, fieldName: string, table: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AiFeedbackEventError(table, "validate", `${fieldName} is required`);
  }
  return trimmed;
}

function optionalUuid(
  value: string | null | undefined,
  fieldName: string,
  table: string,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!UUID_PATTERN.test(trimmed)) {
    throw new AiFeedbackEventError(
      table,
      "validate",
      `${fieldName} must be a UUID. Received: ${trimmed}`,
    );
  }
  return trimmed;
}

function optionalSessionUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return toSessionUuid(trimmed);
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function normalizeJson(value: Json | undefined): Json {
  return value ?? {};
}

export async function recordAiFeedbackEvent(
  params: RecordAiFeedbackEventParams,
): Promise<AiFeedbackEventRow> {
  const supabase = createServiceClient();
  const payload: AiFeedbackEventInsert = {
    user_id: optionalUuid(params.userId, "userId", "ai_feedback_events"),
    project_id: params.projectId ?? null,
    target_id: optionalUuid(params.targetId, "targetId", "ai_feedback_events"),
    session_id: optionalSessionUuid(params.sessionId),
    source_table: params.sourceTable ?? null,
    source_record_id: params.sourceRecordId ?? null,
    event_type: assertNonEmpty(params.eventType, "eventType", "ai_feedback_events"),
    event_family: params.eventFamily,
    surface: assertNonEmpty(params.surface, "surface", "ai_feedback_events"),
    subject_type: assertNonEmpty(params.subjectType, "subjectType", "ai_feedback_events"),
    subject_id: params.subjectId ?? null,
    signal: params.signal,
    reason_category: params.reasonCategory ?? null,
    free_text: params.freeText ?? null,
    before_snapshot: normalizeJson(params.beforeSnapshot),
    after_snapshot: normalizeJson(params.afterSnapshot),
    source_context: normalizeJson(params.sourceContext),
    metadata: normalizeJson(params.metadata),
  };

  const { data, error } = await supabase
    .from("ai_feedback_events")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new AiFeedbackEventError(
      "ai_feedback_events",
      "insert",
      error?.message ?? "insert returned no row",
    );
  }

  return data;
}

function emailDraftSignalToFeedbackSignal(
  signal: EmailDraftFeedbackSignal,
): AiFeedbackSignal {
  switch (signal) {
    case "good":
      return "positive";
    case "bad":
      return "negative";
    case "accepted":
      return "accepted";
    case "edited":
      return "corrected";
    case "ignored":
      return "ignored";
  }
}

export async function recordEmailDraftFeedback(
  params: RecordEmailDraftFeedbackParams,
): Promise<AiFeedbackEventRow> {
  const mailboxUserId = assertNonEmpty(
    params.mailboxUserId,
    "mailboxUserId",
    "ai_feedback_events",
  );
  const graphDraftMessageId = assertNonEmpty(
    params.graphDraftMessageId,
    "graphDraftMessageId",
    "ai_feedback_events",
  );

  return recordAiFeedbackEvent({
    userId: params.userId,
    sessionId: params.sessionId ?? null,
    sourceTable: "microsoft_graph_messages",
    sourceRecordId: graphDraftMessageId,
    eventType: "outlook_email_draft_feedback_recorded",
    eventFamily: "assistant_response",
    surface: "outlook_assistant",
    subjectType: "outlook_email_draft",
    subjectId: graphDraftMessageId,
    signal: emailDraftSignalToFeedbackSignal(params.signal),
    reasonCategory: params.reasonCategory ?? null,
    freeText: params.feedbackText?.trim() || null,
    beforeSnapshot: params.draftSnapshot,
    afterSnapshot: params.finalSnapshot,
    sourceContext: {
      mailboxUserId,
      graphDraftMessageId,
      graphSourceMessageId: params.graphSourceMessageId ?? null,
      conversationId: params.conversationId ?? null,
      subject: params.subject ?? null,
      voiceProfilePath: params.voiceProfilePath ?? null,
      voiceProfileVersion: params.voiceProfileVersion ?? null,
    },
    metadata: {
      visibility: "private",
      source: "outlook_email_draft_feedback",
      mailboxUserId,
      graphDraftMessageId,
      graphSourceMessageId: params.graphSourceMessageId ?? null,
      conversationId: params.conversationId ?? null,
      subject: params.subject ?? null,
      rawSignal: params.signal,
      voiceProfilePath: params.voiceProfilePath ?? null,
      voiceProfileVersion: params.voiceProfileVersion ?? null,
      ...(typeof params.metadata === "object" && params.metadata !== null
        ? params.metadata
        : {}),
    },
  });
}

export async function createLearningPromotion(
  params: CreateLearningPromotionParams,
): Promise<AiLearningPromotionRow> {
  const supabase = createServiceClient();
  const payload: AiLearningPromotionInsert = {
    reviewed_at: params.reviewedAt ?? null,
    reviewed_by: optionalUuid(params.reviewedBy, "reviewedBy", "ai_learning_promotions"),
    status: params.status ?? "candidate",
    promotion_type: params.promotionType,
    project_id: params.projectId ?? null,
    target_id: optionalUuid(params.targetId, "targetId", "ai_learning_promotions"),
    source_event_ids: params.sourceEventIds ?? [],
    destination_table: params.destinationTable ?? null,
    destination_record_id: params.destinationRecordId ?? null,
    confidence: clampConfidence(params.confidence),
    risk_level: params.riskLevel ?? "low",
    proposed_learning: normalizeJson(params.proposedLearning),
    review_notes: params.reviewNotes ?? null,
    expires_at: params.expiresAt ?? null,
    superseded_by: optionalUuid(params.supersededBy, "supersededBy", "ai_learning_promotions"),
  };

  const { data, error } = await supabase
    .from("ai_learning_promotions")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "insert",
      error?.message ?? "insert returned no row",
    );
  }

  return data;
}

export async function updateLearningPromotion(
  params: UpdateLearningPromotionParams,
): Promise<AiLearningPromotionRow> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }

  const payload: Tables["ai_learning_promotions"]["Update"] = {
    ...(params.reviewedAt !== undefined ? { reviewed_at: params.reviewedAt } : {}),
    ...(params.reviewedBy !== undefined
      ? {
          reviewed_by: optionalUuid(
            params.reviewedBy,
            "reviewedBy",
            "ai_learning_promotions",
          ),
        }
      : {}),
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.destinationTable !== undefined
      ? { destination_table: params.destinationTable }
      : {}),
    ...(params.destinationRecordId !== undefined
      ? { destination_record_id: params.destinationRecordId }
      : {}),
    ...(params.confidence !== undefined
      ? { confidence: clampConfidence(params.confidence) }
      : {}),
    ...(params.riskLevel !== undefined ? { risk_level: params.riskLevel } : {}),
    ...(params.reviewNotes !== undefined ? { review_notes: params.reviewNotes } : {}),
    ...(params.expiresAt !== undefined ? { expires_at: params.expiresAt } : {}),
    ...(params.supersededBy !== undefined
      ? {
          superseded_by: optionalUuid(
            params.supersededBy,
            "supersededBy",
            "ai_learning_promotions",
          ),
        }
      : {}),
  };

  const { data, error } = await supabase
    .from("ai_learning_promotions")
    .update(payload)
    .eq("id", promotionId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      error?.message ?? "update returned no row",
    );
  }

  return data;
}

export async function recordRetrievalFeedback(
  params: RecordRetrievalFeedbackParams,
): Promise<AiRetrievalFeedbackRow> {
  const supabase = createServiceClient();
  const payload: AiRetrievalFeedbackInsert = {
    user_id: optionalUuid(params.userId, "userId", "ai_retrieval_feedback"),
    project_id: params.projectId ?? null,
    target_id: optionalUuid(params.targetId, "targetId", "ai_retrieval_feedback"),
    session_id: optionalSessionUuid(params.sessionId),
    tool_name: assertNonEmpty(params.toolName, "toolName", "ai_retrieval_feedback"),
    query_text: assertNonEmpty(params.queryText, "queryText", "ai_retrieval_feedback"),
    source_document_id: params.sourceDocumentId ?? null,
    source_chunk_id: params.sourceChunkId ?? null,
    rank: params.rank ?? null,
    score: params.score ?? null,
    cited: params.cited ?? false,
    user_referenced: params.userReferenced ?? false,
    used_in_answer: params.usedInAnswer ?? false,
    outcome: params.outcome ?? "unknown",
    metadata: normalizeJson(params.metadata),
  };

  const { data, error } = await supabase
    .from("ai_retrieval_feedback")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new AiFeedbackEventError(
      "ai_retrieval_feedback",
      "insert",
      error?.message ?? "insert returned no row",
    );
  }

  return data;
}

export async function recordRetrievalFeedbackBatch(
  rows: RecordRetrievalFeedbackParams[],
): Promise<AiRetrievalFeedbackRow[]> {
  if (rows.length === 0) return [];

  const supabase = createServiceClient();
  const payload: AiRetrievalFeedbackInsert[] = rows.map((params) => ({
    user_id: optionalUuid(params.userId, "userId", "ai_retrieval_feedback"),
    project_id: params.projectId ?? null,
    target_id: optionalUuid(params.targetId, "targetId", "ai_retrieval_feedback"),
    session_id: optionalSessionUuid(params.sessionId),
    tool_name: assertNonEmpty(params.toolName, "toolName", "ai_retrieval_feedback"),
    query_text: assertNonEmpty(params.queryText, "queryText", "ai_retrieval_feedback"),
    source_document_id: params.sourceDocumentId ?? null,
    source_chunk_id: params.sourceChunkId ?? null,
    rank: params.rank ?? null,
    score: params.score ?? null,
    cited: params.cited ?? false,
    user_referenced: params.userReferenced ?? false,
    used_in_answer: params.usedInAnswer ?? false,
    outcome: params.outcome ?? "unknown",
    metadata: normalizeJson(params.metadata),
  }));

  const { data, error } = await supabase
    .from("ai_retrieval_feedback")
    .insert(payload)
    .select("*");

  if (error || !data) {
    throw new AiFeedbackEventError(
      "ai_retrieval_feedback",
      "insert_batch",
      error?.message ?? "batch insert returned no rows",
    );
  }

  return data;
}

function packetCardFeedbackEventSignal(
  signal: PacketCardFeedbackSignal,
): AiFeedbackSignal {
  if (signal === "useful") return "positive";
  if (signal === "stale") return "stale";
  return "negative";
}

function packetCardReviewReason(params: {
  signal: PacketCardFeedbackSignal;
  reason?: string | null;
  correction?: string | null;
}): string {
  const parts = [
    `packet_card_${params.signal}`,
    params.reason?.trim() ? `Reason: ${params.reason.trim()}` : null,
    params.correction?.trim() ? `Correction: ${params.correction.trim()}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join("\n");
}

export async function recordPacketCardFeedback(
  params: RecordPacketCardFeedbackParams,
): Promise<RecordPacketCardFeedbackResult> {
  const supabase = createServiceClient();
  const insightCardId = optionalUuid(
    params.insightCardId,
    "insightCardId",
    "intelligence_reviews",
  );

  if (!insightCardId) {
    throw new AiFeedbackEventError(
      "intelligence_reviews",
      "validate",
      "insightCardId is required",
    );
  }

  const proposedValue: Json = {
    signal: params.signal,
    reason: params.reason ?? null,
    correction: params.correction ?? null,
    cardSnapshot: normalizeJson(params.cardSnapshot),
    metadata: normalizeJson(params.metadata),
  };
  const reviewPayload: IntelligenceReviewInsert = {
    review_type: "packet_card_feedback",
    status: params.signal === "useful" ? "approved" : "open",
    insight_card_id: insightCardId,
    review_reason: packetCardReviewReason(params),
    proposed_value: proposedValue,
    reviewed_value:
      params.signal === "useful"
        ? {
            acceptedPositiveSignal: true,
            signal: params.signal,
          }
        : null,
    reviewed_by:
      params.signal === "useful"
        ? optionalUuid(params.userId, "userId", "intelligence_reviews")
        : null,
    reviewed_at: params.signal === "useful" ? new Date().toISOString() : null,
  };

  const { data: review, error: reviewError } = await supabase
    .from("intelligence_reviews")
    .insert(reviewPayload)
    .select("*")
    .single();

  if (reviewError || !review) {
    throw new AiFeedbackEventError(
      "intelligence_reviews",
      "insert",
      reviewError?.message ?? "insert returned no row",
    );
  }

  const event = await recordAiFeedbackEvent({
    userId: params.userId,
    projectId: params.projectId ?? null,
    sessionId: params.sessionId ?? null,
    sourceTable: "intelligence_reviews",
    sourceRecordId: review.id,
    eventType: "packet_card_feedback_recorded",
    eventFamily: "packet_quality",
    surface: "project_intelligence",
    subjectType: "insight_card",
    subjectId: insightCardId,
    signal: packetCardFeedbackEventSignal(params.signal),
    reasonCategory: `packet_card_${params.signal}`,
    freeText: params.correction ?? params.reason ?? null,
    afterSnapshot: normalizeJson(params.cardSnapshot),
    sourceContext: {
      reviewId: review.id,
      reviewStatus: review.status,
      signal: params.signal,
      proposedValue,
    },
    metadata: {
      reviewId: review.id,
      signal: params.signal,
      visibility: "team",
      ...(jsonRecord(params.metadata ?? null)),
    },
  });

  return {
    review,
    event,
  };
}

function jsonRecord(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredLearningString(
  learning: Record<string, unknown>,
  fieldName: string,
): string {
  const value = learning[fieldName];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new AiFeedbackEventError(
    "ai_learning_promotions",
    "validate",
    `promotion proposed_learning.${fieldName} is required`,
  );
}

function optionalLearningString(
  learning: Record<string, unknown>,
  fieldName: string,
): string | null {
  const value = learning[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalLearningNumber(
  learning: Record<string, unknown>,
  fieldName: string,
): number | null {
  const value = learning[fieldName];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalLearningStringArray(
  learning: Record<string, unknown>,
  fieldName: string,
): string[] {
  const value = learning[fieldName];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function optionalLearningRecord(
  learning: Record<string, unknown>,
  fieldName: string,
): Record<string, unknown> {
  return jsonRecord(learning[fieldName] as Json | null);
}

function optionalLearningRiskLevel(
  learning: Record<string, unknown>,
  fieldName: string,
): AiSkillRiskLevel | undefined {
  const value = optionalLearningString(learning, fieldName);
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return undefined;
}

function optionalLearningScopeType(
  learning: Record<string, unknown>,
  fieldName: string,
): AiSkillScopeType | undefined {
  const value = optionalLearningString(learning, fieldName);
  if (
    value === "personal" ||
    value === "project" ||
    value === "team" ||
    value === "company"
  ) {
    return value;
  }
  return undefined;
}

function appendAttributionApprovedTag(tags: string | null): string {
  const values = String(tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!values.includes("project_backfill:admin_approved")) {
    values.push("project_backfill:admin_approved");
  }
  return values.join(",");
}

function agentLearningSource(
  learning: Record<string, unknown>,
): "thumbs_down" | "admin_feedback" | "eval_failure" {
  const source = learning.source;
  if (
    source === "thumbs_down" ||
    source === "admin_feedback" ||
    source === "eval_failure"
  ) {
    return source;
  }
  return "admin_feedback";
}

function memoryTypeFromPromotion(
  promotion: AiLearningPromotionRow,
  learning: Record<string, unknown>,
): MemoryType {
  const type = learning.type;
  if (
    type === "fact" ||
    type === "preference" ||
    type === "lesson" ||
    type === "commitment" ||
    type === "context"
  ) {
    return type;
  }
  if (promotion.promotion_type === "user_preference") return "preference";
  if (promotion.promotion_type === "project_lesson") return "lesson";
  throw new AiFeedbackEventError(
    "ai_learning_promotions",
    "validate",
    `Promotion type ${promotion.promotion_type} cannot be written as memory`,
  );
}

function memoryVisibilityFromLearning(
  learning: Record<string, unknown>,
  memoryType: MemoryType,
): MemoryVisibility {
  const visibility = learning.visibility;
  if (visibility === "private" || visibility === "team") return visibility;
  return memoryType === "fact" || memoryType === "lesson" ? "team" : "private";
}

function learningSourceMatchesRetrievalFeedback(
  learning: Record<string, unknown>,
  row: AiRetrievalFeedbackRow,
): boolean {
  const sourceChunkId = optionalLearningString(learning, "sourceChunkId");
  const sourceDocumentId = optionalLearningString(learning, "sourceDocumentId");
  if (sourceChunkId && row.source_chunk_id) {
    return sourceChunkId === row.source_chunk_id;
  }
  if (sourceDocumentId && row.source_document_id) {
    return sourceDocumentId === row.source_document_id;
  }
  return false;
}

function normalizeRetrievalOutcome(value: string): AiRetrievalOutcome {
  if (
    value === "helpful" ||
    value === "unhelpful" ||
    value === "wrong_project" ||
    value === "stale" ||
    value === "unsupported" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function retrievalWeightMultiplier(action: string, confidence: number): number {
  if (action === "boost") {
    return Math.round((1 + Math.min(0.5, confidence * 0.5)) * 100) / 100;
  }
  if (action === "downrank_review") {
    return Math.round((1 - Math.min(0.35, confidence * 0.35)) * 100) / 100;
  }
  throw new AiFeedbackEventError(
    "ai_learning_promotions",
    "validate",
    `Unsupported retrieval weight action: ${action}`,
  );
}

function retrievalWeightStatusSignal(
  status: AiRetrievalWeightStatus,
): AiFeedbackSignal {
  if (status === "active") return "accepted";
  if (status === "paused") return "needs_review";
  return "stale";
}

function normalizeQuerySignature(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 10)
    .join(" ");
}

function retrievalPromotionGroupKey(row: AiRetrievalFeedbackRow): string | null {
  const metadata = jsonRecord(row.metadata);
  const sourceKey =
    row.source_chunk_id ??
    row.source_document_id ??
    (typeof metadata.recordId === "string" ? metadata.recordId : null);
  if (!sourceKey) return null;

  return [
    row.tool_name,
    row.project_id ?? "global",
    sourceKey,
    normalizeQuerySignature(row.query_text),
  ].join("|");
}

function retrievalPromotionSignature(groupKey: string, direction: "boost" | "downrank_review"): string {
  return `retrieval_weight:${direction}:${groupKey}`;
}

function retrievalPromotionTitle(params: {
  direction: "boost" | "downrank_review";
  toolName: string;
  sourceTitle?: string | null;
  querySignature: string;
}): string {
  const source = params.sourceTitle?.trim() || "retrieved source";
  const action = params.direction === "boost" ? "Boost" : "Review/down-rank";
  return `${action} ${source} for ${params.toolName}: ${params.querySignature}`;
}

function retrievalPromotionConfidence(params: {
  positiveCount: number;
  problemCount: number;
  totalCount: number;
}): number {
  const signalCount = Math.max(params.positiveCount, params.problemCount);
  const base = signalCount / Math.max(params.totalCount, signalCount);
  const volumeBonus = Math.min(0.2, signalCount * 0.03);
  return Math.min(0.95, Math.max(0.55, base + volumeBonus));
}

async function existingPromotionSignatures(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("ai_learning_promotions")
    .select("proposed_learning")
    .eq("promotion_type", "retrieval_weight")
    .in("status", ["candidate", "approved", "applied"]);

  if (error) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      error.message,
    );
  }

  return new Set(
    (data ?? [])
      .map((row) => jsonRecord(row.proposed_learning).signature)
      .filter((signature): signature is string => typeof signature === "string"),
  );
}

async function existingPromotionSignaturesForType(
  supabase: ReturnType<typeof createServiceClient>,
  promotionType: AiLearningPromotionType,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("ai_learning_promotions")
    .select("proposed_learning")
    .eq("promotion_type", promotionType)
    .in("status", ["candidate", "approved", "applied"]);

  if (error) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      error.message,
    );
  }

  return new Set(
    (data ?? [])
      .map((row) => jsonRecord(row.proposed_learning).signature)
      .filter((signature): signature is string => typeof signature === "string"),
  );
}

function taskSnapshotRecord(row: AiTaskFeedbackRow): Record<string, unknown> {
  return jsonRecord(row.task_snapshot);
}

function taskPromotionSignature(row: AiTaskFeedbackRow): string {
  const snapshot = taskSnapshotRecord(row);
  const name = optionalLearningString(snapshot, "name") ?? "";
  const priority = optionalLearningString(snapshot, "priority") ?? "";
  return [
    "positive_task_example",
    row.project_id ?? "global",
    normalizeQuerySignature(name),
    priority.toLowerCase(),
    row.id,
  ].join("|");
}

function taskPromotionTitle(row: AiTaskFeedbackRow): string {
  const snapshot = taskSnapshotRecord(row);
  const name = optionalLearningString(snapshot, "name") ?? "AI-generated task";
  return `Promote task example: ${name.slice(0, 120)}`;
}

const BRANDON_EMAIL_VOICE_PROFILE_PATH =
  "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md";
const BRANDON_EMAIL_VOICE_PROFILE_VERSION = "2026-05-19";

const EMAIL_VOICE_REASON_RULES: Record<
  string,
  { proposedRule: string; profileSection: string; riskLevel: AiLearningRiskLevel }
> = {
  too_formal: {
    profileSection: "Avoid",
    proposedRule:
      "Use plainer wording and remove polished consultant phrasing from Brandon draft replies.",
    riskLevel: "low",
  },
  too_long: {
    profileSection: "Structure",
    proposedRule:
      "Cut draft replies down before presenting them. Keep only the answer, the direct ask, and the next action unless the thread requires detail.",
    riskLevel: "low",
  },
  too_short: {
    profileSection: "Structure",
    proposedRule:
      "Add enough context for the recipient to act when a short reply would be ambiguous.",
    riskLevel: "medium",
  },
  too_soft: {
    profileSection: "Core Voice",
    proposedRule:
      "Make the direction more direct when Brandon is assigning work, asking for cost clarity, or deciding what to carry.",
    riskLevel: "medium",
  },
  too_direct: {
    profileSection: "Core Voice",
    proposedRule:
      "Keep the direction clear, but add a brief courtesy phrase when the recipient relationship or thread tone needs it.",
    riskLevel: "medium",
  },
  wrong_tone: {
    profileSection: "Core Voice",
    proposedRule:
      "Rewrite drafts to sound less ghostwritten: shorter sentences, practical wording, and fewer transitions.",
    riskLevel: "medium",
  },
  wrong_assumption: {
    profileSection: "Drafting Rules",
    proposedRule:
      "Do not infer uncertain facts in Brandon replies. Ask for confirmation or state what needs to be verified.",
    riskLevel: "low",
  },
  missing_context: {
    profileSection: "Drafting Rules",
    proposedRule:
      "Use the email thread context before drafting and include the missing job, trade, cost, or responsibility detail when it changes the ask.",
    riskLevel: "medium",
  },
  good_tone: {
    profileSection: "Core Voice",
    proposedRule:
      "Reinforce the current direct, practical, short Brandon tone when drafting similar replies.",
    riskLevel: "low",
  },
  good_structure: {
    profileSection: "Structure",
    proposedRule:
      "Reinforce the structure that worked: answer first, direct ask second, simple next step last.",
    riskLevel: "low",
  },
  other: {
    profileSection: "Drafting Rules",
    proposedRule:
      "Review repeated custom Outlook draft feedback and update the Brandon voice profile with the specific recurring preference.",
    riskLevel: "medium",
  },
};

function feedbackEventRecord(value: Json | null): Record<string, unknown> {
  return jsonRecord(value);
}

function emailVoiceGroupKey(row: AiFeedbackEventRow): string | null {
  if (row.event_type !== "outlook_email_draft_feedback_recorded") return null;
  const metadata = feedbackEventRecord(row.metadata);
  const sourceContext = feedbackEventRecord(row.source_context);
  const voiceProfilePath =
    optionalLearningString(sourceContext, "voiceProfilePath") ??
    optionalLearningString(metadata, "voiceProfilePath") ??
    BRANDON_EMAIL_VOICE_PROFILE_PATH;
  const reasonCategory = row.reason_category || "other";
  return [
    "email_voice_profile",
    voiceProfilePath,
    reasonCategory,
    row.signal,
  ].join("|");
}

function emailVoiceSignature(groupKey: string): string {
  return `outlook_email_voice|${groupKey}`;
}

function emailVoiceConfidence(signalCount: number, inspectedRows: number): number {
  const base = signalCount / Math.max(inspectedRows, signalCount);
  const volumeBonus = Math.min(0.25, signalCount * 0.04);
  return Math.min(0.9, Math.max(0.6, base + volumeBonus));
}

function emailVoiceTitle(reasonCategory: string, signal: string): string {
  return `Update Brandon email voice profile: ${reasonCategory.replaceAll("_", " ")} (${signal})`;
}

export async function generateEmailVoicePromotionCandidates(
  params: GenerateEmailVoicePromotionCandidatesParams = {},
): Promise<GenerateEmailVoicePromotionCandidatesResult> {
  const windowDays = Math.min(90, Math.max(1, params.windowDays ?? 30));
  const minSignals = Math.min(25, Math.max(2, params.minSignals ?? 2));
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const dryRun = params.dryRun ?? false;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_feedback_events")
    .select("*")
    .eq("event_type", "outlook_email_draft_feedback_recorded")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1_000);

  if (error) {
    throw new AiFeedbackEventError(
      "ai_feedback_events",
      "select",
      error.message,
    );
  }

  const rows = (data ?? []) as AiFeedbackEventRow[];
  const grouped = new Map<string, AiFeedbackEventRow[]>();
  for (const row of rows) {
    const key = emailVoiceGroupKey(row);
    if (!key) continue;
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }

  const existingSignatures = await existingPromotionSignaturesForType(
    supabase,
    "user_preference",
  );
  const candidates: EmailVoicePromotionCandidatePreview[] = [];

  for (const [groupKey, groupRows] of grouped) {
    if (candidates.length >= limit) break;
    if (groupRows.length < minSignals) continue;

    const representative = groupRows[0];
    if (!representative) continue;

    const reasonCategory = representative.reason_category || "other";
    const rule = EMAIL_VOICE_REASON_RULES[reasonCategory] ?? EMAIL_VOICE_REASON_RULES.other;
    const sourceEventIds = groupRows.map((row) => row.id);
    const signature = emailVoiceSignature(groupKey);
    if (existingSignatures.has(signature)) continue;

    const sourceContext = feedbackEventRecord(representative.source_context);
    const metadata = feedbackEventRecord(representative.metadata);
    const voiceProfilePath =
      optionalLearningString(sourceContext, "voiceProfilePath") ??
      optionalLearningString(metadata, "voiceProfilePath") ??
      BRANDON_EMAIL_VOICE_PROFILE_PATH;
    const voiceProfileVersion =
      optionalLearningString(sourceContext, "voiceProfileVersion") ??
      optionalLearningString(metadata, "voiceProfileVersion") ??
      BRANDON_EMAIL_VOICE_PROFILE_VERSION;

    const proposedLearning: Json = {
      signature,
      ruleKind: "email_voice_profile_update",
      title: emailVoiceTitle(reasonCategory, representative.signal),
      profilePath: voiceProfilePath,
      profileVersion: voiceProfileVersion,
      profileSection: rule.profileSection,
      proposedRule: rule.proposedRule,
      reasonCategory,
      signal: representative.signal,
      evidenceWindowDays: windowDays,
      signalCount: groupRows.length,
      sampleFeedback: groupRows
        .map((row) => row.free_text)
        .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
        .slice(0, 5),
      rationale:
        "Repeated Outlook draft feedback for Brandon crossed the configured threshold. Review before updating the Markdown voice profile.",
    };

    candidates.push({
      signature,
      promotionType: "user_preference",
      projectId: null,
      confidence: emailVoiceConfidence(groupRows.length, rows.length),
      riskLevel: rule.riskLevel,
      destinationTable: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      destinationRecordId: voiceProfilePath,
      sourceEventIds,
      proposedLearning,
    });
  }

  if (dryRun || candidates.length === 0) {
    return {
      inspectedRows: rows.length,
      groupsInspected: grouped.size,
      candidatesFound: candidates.length,
      candidatesCreated: 0,
      candidatesSkipped: candidates.length,
      dryRun,
      candidates,
    };
  }

  const payload: AiLearningPromotionInsert[] = candidates.map((candidate) => ({
    status: "candidate",
    promotion_type: candidate.promotionType,
    project_id: null,
    target_id: null,
    source_event_ids: candidate.sourceEventIds,
    destination_table: candidate.destinationTable,
    destination_record_id: candidate.destinationRecordId,
    confidence: candidate.confidence,
    risk_level: candidate.riskLevel,
    proposed_learning: candidate.proposedLearning,
    review_notes: null,
  }));

  const { data: created, error: insertError } = await supabase
    .from("ai_learning_promotions")
    .insert(payload)
    .select("*");

  if (insertError || !created) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "insert_batch",
      insertError?.message ?? "batch insert returned no rows",
    );
  }

  return {
    inspectedRows: rows.length,
    groupsInspected: grouped.size,
    candidatesFound: candidates.length,
    candidatesCreated: created.length,
    candidatesSkipped: candidates.length - created.length,
    dryRun,
    candidates,
  };
}

export async function generateTaskPromotionCandidates(
  params: GenerateTaskPromotionCandidatesParams = {},
): Promise<GenerateTaskPromotionCandidatesResult> {
  const windowDays = Math.min(90, Math.max(1, params.windowDays ?? 30));
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const dryRun = params.dryRun ?? false;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_task_feedback")
    .select("*")
    .eq("signal", "good")
    .eq("promoted", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1_000);

  if (error) {
    throw new AiFeedbackEventError(
      "ai_task_feedback",
      "select",
      error.message,
    );
  }

  const rows = (data ?? []) as AiTaskFeedbackRow[];
  const existingSignatures = await existingPromotionSignaturesForType(
    supabase,
    "positive_task_example",
  );
  const candidates: TaskPromotionCandidatePreview[] = [];

  for (const row of rows) {
    if (candidates.length >= limit) break;

    const snapshot = taskSnapshotRecord(row);
    const name = optionalLearningString(snapshot, "name");
    const priority = optionalLearningString(snapshot, "priority");
    if (!name || !priority) continue;

    const signature = taskPromotionSignature(row);
    if (existingSignatures.has(signature)) continue;

    const proposedLearning: Json = {
      signature,
      ruleKind: "positive_task_example",
      title: taskPromotionTitle(row),
      feedbackId: row.id,
      taskSnapshot: row.task_snapshot,
      reason: row.reason,
      reasonCategory: row.reason_category,
      rationale:
        "User marked this generated task as good. After admin review, it can be used as a bounded few-shot task-quality example.",
    };

    candidates.push({
      signature,
      promotionType: "positive_task_example",
      projectId: row.project_id,
      confidence: 0.78,
      riskLevel: "low",
      destinationTable: "ai_task_feedback",
      destinationRecordId: row.id,
      sourceEventIds: [row.id],
      proposedLearning,
    });
  }

  if (dryRun || candidates.length === 0) {
    return {
      inspectedRows: rows.length,
      candidatesFound: candidates.length,
      candidatesCreated: 0,
      candidatesSkipped: candidates.length,
      dryRun,
      candidates,
    };
  }

  const payload: AiLearningPromotionInsert[] = candidates.map((candidate) => ({
    status: "candidate",
    promotion_type: candidate.promotionType,
    project_id: candidate.projectId,
    target_id: null,
    source_event_ids: candidate.sourceEventIds,
    destination_table: candidate.destinationTable,
    destination_record_id: candidate.destinationRecordId,
    confidence: candidate.confidence,
    risk_level: candidate.riskLevel,
    proposed_learning: candidate.proposedLearning,
    review_notes: null,
  }));

  const { data: created, error: insertError } = await supabase
    .from("ai_learning_promotions")
    .insert(payload)
    .select("*");

  if (insertError || !created) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "insert_batch",
      insertError?.message ?? "batch insert returned no rows",
    );
  }

  return {
    inspectedRows: rows.length,
    candidatesFound: candidates.length,
    candidatesCreated: created.length,
    candidatesSkipped: candidates.length - created.length,
    dryRun,
    candidates,
  };
}

export async function generateRetrievalPromotionCandidates(
  params: GenerateRetrievalPromotionCandidatesParams = {},
): Promise<GenerateRetrievalPromotionCandidatesResult> {
  const windowDays = Math.min(90, Math.max(1, params.windowDays ?? 30));
  const minHelpfulSignals = Math.min(25, Math.max(2, params.minHelpfulSignals ?? 3));
  const minProblemSignals = Math.min(25, Math.max(2, params.minProblemSignals ?? 2));
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const dryRun = params.dryRun ?? false;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_retrieval_feedback")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2_000);

  if (error) {
    throw new AiFeedbackEventError(
      "ai_retrieval_feedback",
      "select",
      error.message,
    );
  }

  const rows = data ?? [];
  const grouped = new Map<string, AiRetrievalFeedbackRow[]>();
  for (const row of rows) {
    const key = retrievalPromotionGroupKey(row);
    if (!key) continue;
    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }

  const existingSignatures = await existingPromotionSignatures(supabase);
  const candidates: RetrievalPromotionCandidatePreview[] = [];

  for (const [groupKey, groupRows] of grouped) {
    if (candidates.length >= limit) break;

    const helpfulRows = groupRows.filter((row) =>
      row.outcome === "helpful" && (row.cited || row.used_in_answer),
    );
    const problemRows = groupRows.filter((row) =>
      row.outcome === "unhelpful" ||
      row.outcome === "wrong_project" ||
      row.outcome === "stale" ||
      row.outcome === "unsupported",
    );

    const direction =
      helpfulRows.length >= minHelpfulSignals && problemRows.length === 0
        ? "boost"
        : problemRows.length >= minProblemSignals
          ? "downrank_review"
          : null;
    if (!direction) continue;

    const sourceRows = direction === "boost" ? helpfulRows : problemRows;
    const representative = sourceRows[0] ?? groupRows[0];
    if (!representative) continue;

    const metadata = jsonRecord(representative.metadata);
    const querySignature = normalizeQuerySignature(representative.query_text);
    const signature = retrievalPromotionSignature(groupKey, direction);
    if (existingSignatures.has(signature)) continue;

    const sourceEventIds = sourceRows.map((row) => row.id);
    const confidence = retrievalPromotionConfidence({
      positiveCount: helpfulRows.length,
      problemCount: problemRows.length,
      totalCount: groupRows.length,
    });
    const proposedLearning: Json = {
      signature,
      ruleKind: "retrieval_weight",
      action: direction,
      title: retrievalPromotionTitle({
        direction,
        toolName: representative.tool_name,
        sourceTitle: typeof metadata.title === "string" ? metadata.title : null,
        querySignature,
      }),
      toolName: representative.tool_name,
      projectId: representative.project_id,
      sourceDocumentId: representative.source_document_id,
      sourceChunkId: representative.source_chunk_id,
      querySignature,
      evidenceWindowDays: windowDays,
      signalCounts: {
        helpful: helpfulRows.length,
        problem: problemRows.length,
        total: groupRows.length,
      },
      rationale:
        direction === "boost"
          ? "Same source/chunk was repeatedly cited or used in helpful answers with no problem signals in the review window."
          : "Same source/chunk repeatedly produced unsupported, stale, wrong-project, or unhelpful retrieval outcomes and needs review before ranking changes.",
    };

    candidates.push({
      signature,
      promotionType: "retrieval_weight",
      projectId: representative.project_id,
      confidence,
      riskLevel: direction === "boost" ? "low" : "medium",
      destinationTable: "ai_retrieval_feedback",
      destinationRecordId: representative.id,
      sourceEventIds,
      proposedLearning,
    });
  }

  if (dryRun || candidates.length === 0) {
    return {
      inspectedRows: rows.length,
      groupsInspected: grouped.size,
      candidatesFound: candidates.length,
      candidatesCreated: 0,
      candidatesSkipped: candidates.length,
      dryRun,
      candidates,
    };
  }

  const payload: AiLearningPromotionInsert[] = candidates.map((candidate) => ({
    status: "candidate",
    promotion_type: candidate.promotionType,
    project_id: candidate.projectId,
    target_id: null,
    source_event_ids: candidate.sourceEventIds,
    destination_table: candidate.destinationTable,
    destination_record_id: candidate.destinationRecordId,
    confidence: candidate.confidence,
    risk_level: candidate.riskLevel,
    proposed_learning: candidate.proposedLearning,
    review_notes: null,
  }));

  const { data: created, error: insertError } = await supabase
    .from("ai_learning_promotions")
    .insert(payload)
    .select("*");

  if (insertError || !created) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "insert_batch",
      insertError?.message ?? "batch insert returned no rows",
    );
  }

  return {
    inspectedRows: rows.length,
    groupsInspected: grouped.size,
    candidatesFound: candidates.length,
    candidatesCreated: created.length,
    candidatesSkipped: candidates.length - created.length,
    dryRun,
    candidates,
  };
}

export async function applyRetrievalWeightPromotion(
  params: ApplyRetrievalWeightPromotionParams,
): Promise<ApplyRetrievalWeightPromotionResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.promotion_type !== "retrieval_weight") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only retrieval_weight promotions can be applied by this writer. Received: ${promotion.promotion_type}`,
    );
  }

  if (promotion.status !== "approved") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only approved retrieval_weight promotions can be applied. Received: ${promotion.status}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);
  const action = requiredLearningString(learning, "action");
  const querySignature = requiredLearningString(learning, "querySignature");
  const toolName = requiredLearningString(learning, "toolName");
  const payload: AiRetrievalWeightInsert = {
    promotion_id: promotion.id,
    project_id: promotion.project_id,
    tool_name: toolName,
    source_document_id: optionalLearningString(learning, "sourceDocumentId"),
    source_chunk_id: optionalLearningString(learning, "sourceChunkId"),
    query_signature: querySignature,
    action,
    weight_multiplier: retrievalWeightMultiplier(action, promotion.confidence),
    confidence: promotion.confidence,
    status: "active",
    metadata: {
      promotionType: promotion.promotion_type,
      sourceEventIds: promotion.source_event_ids,
      proposedLearning: promotion.proposed_learning,
    },
  };

  const { data: retrievalWeight, error: insertError } = await supabase
    .from("ai_retrieval_weights")
    .upsert(payload, { onConflict: "promotion_id" })
    .select("*")
    .single();

  if (insertError || !retrievalWeight) {
    throw new AiFeedbackEventError(
      "ai_retrieval_weights",
      "upsert",
      insertError?.message ?? "upsert returned no row",
    );
  }

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "ai_retrieval_weights",
      destination_record_id: retrievalWeight.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: params.reviewedBy,
    projectId: promotion.project_id,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "retrieval_weight_applied",
    eventFamily: "retrieval",
    surface: "admin_ai_learning_promotions",
    subjectType: "ai_retrieval_weight",
    subjectId: retrievalWeight.id,
    signal: "accepted",
    reasonCategory: "retrieval_weight_apply",
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: promotion.status,
      destinationTable: promotion.destination_table,
      destinationRecordId: promotion.destination_record_id,
    },
    afterSnapshot: {
      status: updatedPromotion.status,
      destinationTable: updatedPromotion.destination_table,
      destinationRecordId: updatedPromotion.destination_record_id,
      retrievalWeightStatus: retrievalWeight.status,
      weightMultiplier: retrievalWeight.weight_multiplier,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: "apply",
      retrievalWeightId: retrievalWeight.id,
      previousStatus: promotion.status,
      newStatus: updatedPromotion.status,
    },
  });

  return {
    promotion: updatedPromotion,
    retrievalWeight,
  };
}

export async function previewRetrievalWeightPromotionImpact(
  params: PreviewRetrievalWeightPromotionImpactParams,
): Promise<PreviewRetrievalWeightPromotionImpactResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.promotion_type !== "retrieval_weight") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only retrieval_weight promotions can be previewed by this reader. Received: ${promotion.promotion_type}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);
  const action = requiredLearningString(learning, "action");
  const toolName = requiredLearningString(learning, "toolName");
  const querySignature = requiredLearningString(learning, "querySignature");
  const multiplier = retrievalWeightMultiplier(action, promotion.confidence);
  const previewLimit = Math.min(25, Math.max(5, params.limit ?? 10));

  let query = supabase
    .from("ai_retrieval_feedback")
    .select("*")
    .eq("tool_name", toolName)
    .order("created_at", { ascending: false })
    .limit(500);

  if (promotion.project_id !== null) {
    query = query.eq("project_id", promotion.project_id);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new AiFeedbackEventError(
      "ai_retrieval_feedback",
      "select",
      error.message,
    );
  }

  const relevantRows = (rows ?? []).filter(
    (row) => normalizeQuerySignature(row.query_text) === querySignature,
  );
  const scoredRows = relevantRows.map((row) => {
    const originalScore = typeof row.score === "number" ? row.score : 0;
    const matchedPromotionSource = learningSourceMatchesRetrievalFeedback(learning, row);
    return {
      row,
      originalScore,
      adjustedScore: matchedPromotionSource
        ? originalScore * multiplier
        : originalScore,
      matchedPromotionSource,
    };
  });

  const beforeSorted = [...scoredRows].sort(
    (a, b) => b.originalScore - a.originalScore,
  );
  const afterSorted = [...scoredRows].sort(
    (a, b) => b.adjustedScore - a.adjustedScore,
  );
  const originalRankById = new Map(
    beforeSorted.map((item, index) => [item.row.id, index + 1]),
  );
  const adjustedRankById = new Map(
    afterSorted.map((item, index) => [item.row.id, index + 1]),
  );

  const toPreviewRow = (
    item: (typeof scoredRows)[number],
  ): RetrievalWeightImpactPreviewRow => ({
    retrievalFeedbackId: item.row.id,
    sourceDocumentId: item.row.source_document_id,
    sourceChunkId: item.row.source_chunk_id,
    outcome: normalizeRetrievalOutcome(item.row.outcome),
    cited: item.row.cited,
    usedInAnswer: item.row.used_in_answer,
    originalScore: item.originalScore,
    adjustedScore: item.adjustedScore,
    originalRank: originalRankById.get(item.row.id) ?? 0,
    adjustedRank: adjustedRankById.get(item.row.id) ?? 0,
    matchedPromotionSource: item.matchedPromotionSource,
  });

  const matchedBeforeRanks = scoredRows
    .filter((item) => item.matchedPromotionSource)
    .map((item) => originalRankById.get(item.row.id))
    .filter((rank): rank is number => typeof rank === "number");
  const matchedAfterRanks = scoredRows
    .filter((item) => item.matchedPromotionSource)
    .map((item) => adjustedRankById.get(item.row.id))
    .filter((rank): rank is number => typeof rank === "number");

  return {
    promotion,
    multiplier,
    inspectedRows: rows?.length ?? 0,
    matchingRows: relevantRows.length,
    beforeTop: beforeSorted.slice(0, previewLimit).map(toPreviewRow),
    afterTop: afterSorted.slice(0, previewLimit).map(toPreviewRow),
    matchedRankChange: {
      beforeBestRank:
        matchedBeforeRanks.length > 0 ? Math.min(...matchedBeforeRanks) : null,
      afterBestRank:
        matchedAfterRanks.length > 0 ? Math.min(...matchedAfterRanks) : null,
    },
  };
}

export async function applyAgentPreventionPromotion(
  params: ApplyAgentPreventionPromotionParams,
): Promise<ApplyAgentPreventionPromotionResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.promotion_type !== "agent_prevention_prompt") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only agent_prevention_prompt promotions can be applied by this writer. Received: ${promotion.promotion_type}`,
    );
  }

  if (promotion.status !== "approved") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only approved agent_prevention_prompt promotions can be applied. Received: ${promotion.status}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);
  const agentLearning = await upsertAgentLearning({
    title: requiredLearningString(learning, "title"),
    source: agentLearningSource(learning),
    status: "active",
    problemSignature: requiredLearningString(learning, "problemSignature"),
    symptoms: requiredLearningString(learning, "symptoms"),
    rootCause: optionalLearningString(learning, "rootCause"),
    fixPattern: optionalLearningString(learning, "fixPattern"),
    preventionPrompt: requiredLearningString(learning, "preventionPrompt"),
    scopeTags: optionalLearningStringArray(learning, "scopeTags"),
    pagePath: optionalLearningString(learning, "pagePath"),
    toolId: optionalLearningNumber(learning, "toolId"),
    projectId: promotion.project_id,
    confidence: promotion.confidence,
    evidence: {
      promotionId: promotion.id,
      sourceEventIds: promotion.source_event_ids,
      proposedLearning: promotion.proposed_learning,
      reviewNotes: params.reviewNotes ?? null,
    },
  });

  if (!agentLearning) {
    throw new AiFeedbackEventError(
      "agent_learnings",
      "upsert",
      "agent learning destination writer returned no row",
    );
  }

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "agent_learnings",
      destination_record_id: agentLearning.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: params.reviewedBy,
    projectId: promotion.project_id,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "agent_prevention_prompt_applied",
    eventFamily: "eval_failure",
    surface: "admin_ai_learning_promotions",
    subjectType: "agent_learning",
    subjectId: agentLearning.id,
    signal: "accepted",
    reasonCategory: "agent_prevention_prompt_apply",
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: promotion.status,
      destinationTable: promotion.destination_table,
      destinationRecordId: promotion.destination_record_id,
    },
    afterSnapshot: {
      status: updatedPromotion.status,
      destinationTable: updatedPromotion.destination_table,
      destinationRecordId: updatedPromotion.destination_record_id,
      agentLearningStatus: agentLearning.status,
      occurrences: agentLearning.occurrences,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: "apply",
      agentLearningId: agentLearning.id,
      previousStatus: promotion.status,
      newStatus: updatedPromotion.status,
    },
  });

  return {
    promotion: updatedPromotion,
    agentLearning,
  };
}

export async function applyPositiveTaskExamplePromotion(
  params: ApplyPositiveTaskExamplePromotionParams,
): Promise<ApplyPositiveTaskExamplePromotionResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.promotion_type !== "positive_task_example") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only positive_task_example promotions can be applied by this writer. Received: ${promotion.promotion_type}`,
    );
  }

  if (promotion.status !== "approved") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only approved positive_task_example promotions can be applied. Received: ${promotion.status}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);
  const feedbackId = requiredLearningString(learning, "feedbackId");
  const { data: taskFeedback, error: feedbackError } = await supabase
    .from("ai_task_feedback")
    .update({ promoted: true })
    .eq("id", feedbackId)
    .eq("signal", "good")
    .select("*")
    .single();

  if (feedbackError || !taskFeedback) {
    throw new AiFeedbackEventError(
      "ai_task_feedback",
      "update",
      feedbackError?.message ?? "task feedback promotion update returned no row",
    );
  }

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "ai_task_feedback",
      destination_record_id: taskFeedback.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: params.reviewedBy,
    projectId: promotion.project_id,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "positive_task_example_applied",
    eventFamily: "task_generation",
    surface: "admin_ai_learning_promotions",
    subjectType: "ai_task_feedback",
    subjectId: taskFeedback.id,
    signal: "accepted",
    reasonCategory: "positive_task_example_apply",
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: promotion.status,
      destinationTable: promotion.destination_table,
      destinationRecordId: promotion.destination_record_id,
    },
    afterSnapshot: {
      status: updatedPromotion.status,
      destinationTable: updatedPromotion.destination_table,
      destinationRecordId: updatedPromotion.destination_record_id,
      promoted: taskFeedback.promoted,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: "apply",
      taskFeedbackId: taskFeedback.id,
      previousStatus: promotion.status,
      newStatus: updatedPromotion.status,
    },
  });

  return {
    promotion: updatedPromotion,
    taskFeedback: taskFeedback as AiTaskFeedbackRow,
  };
}

export async function applyMemoryPromotion(
  params: ApplyMemoryPromotionParams,
): Promise<ApplyMemoryPromotionResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );
  const reviewedBy = optionalUuid(
    params.reviewedBy,
    "reviewedBy",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }
  if (!reviewedBy) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "reviewedBy is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (
    promotion.promotion_type !== "user_preference" &&
    promotion.promotion_type !== "project_lesson"
  ) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only memory promotions can be applied by this writer. Received: ${promotion.promotion_type}`,
    );
  }

  if (promotion.status !== "approved") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only approved memory promotions can be applied. Received: ${promotion.status}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);
  const memoryType = memoryTypeFromPromotion(promotion, learning);
  const memoryResult = await writeMemory({
    userId: reviewedBy,
    type: memoryType,
    content: requiredLearningString(learning, "content"),
    projectId: promotion.project_id,
    confidence: promotion.confidence,
    importance: optionalLearningNumber(learning, "importance") ?? 0.7,
    source: "manual",
    visibility: memoryVisibilityFromLearning(learning, memoryType),
  });

  if ("error" in memoryResult) {
    throw new AiFeedbackEventError(
      "ai_memories",
      "write",
      memoryResult.error,
    );
  }

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "ai_memories",
      destination_record_id: memoryResult.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: reviewedBy,
    projectId: promotion.project_id,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "memory_promotion_applied",
    eventFamily:
      promotion.promotion_type === "user_preference"
        ? "user_preference"
        : "workflow_outcome",
    surface: "admin_ai_learning_promotions",
    subjectType: "ai_memory",
    subjectId: memoryResult.id,
    signal: "accepted",
    reasonCategory: `${promotion.promotion_type}_apply`,
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: promotion.status,
      destinationTable: promotion.destination_table,
      destinationRecordId: promotion.destination_record_id,
    },
    afterSnapshot: {
      status: updatedPromotion.status,
      destinationTable: updatedPromotion.destination_table,
      destinationRecordId: updatedPromotion.destination_record_id,
      memoryAction: memoryResult.action,
      memoryType,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: "apply",
      memoryId: memoryResult.id,
      memoryAction: memoryResult.action,
      previousStatus: promotion.status,
      newStatus: updatedPromotion.status,
    },
  });

  return {
    promotion: updatedPromotion,
    memory: memoryResult,
  };
}

export async function applySkillLibraryPromotion(
  params: ApplySkillLibraryPromotionParams,
): Promise<ApplySkillLibraryPromotionResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );
  const reviewedBy = optionalUuid(
    params.reviewedBy,
    "reviewedBy",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }
  if (!reviewedBy) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "reviewedBy is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.status !== "approved") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only approved Skill Library promotions can be applied. Received: ${promotion.status}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);
  const skillCandidate = optionalLearningRecord(learning, "skillCandidate");
  const skillScope = optionalLearningRecord(skillCandidate, "scope");
  const skillMetadata = optionalLearningRecord(skillCandidate, "metadata");
  const hasSkillCandidate =
    Object.keys(skillCandidate).length > 0 ||
    promotion.destination_table === "ai_skill_candidates" ||
    optionalLearningString(learning, "proposedDestination") === "skill_library";

  if (!hasSkillCandidate) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotion is not a Skill Library candidate",
    );
  }

  const scopeType =
    optionalLearningScopeType(skillScope, "type") ??
    optionalLearningScopeType(learning, "appliesTo") ??
    "team";
  const projectId =
    optionalLearningNumber(skillScope, "projectId") ?? promotion.project_id;
  const sourceEventIds = Array.from(
    new Set([
      ...optionalLearningStringArray(skillCandidate, "sourceEventIds"),
      ...promotion.source_event_ids,
    ]),
  );
  const examples = Array.isArray(skillCandidate.examples)
    ? (skillCandidate.examples as Array<{
        input?: string | null;
        output?: string | null;
        notes?: string | null;
      }>)
    : [];

  const skill = await createSkill({
    title:
      optionalLearningString(skillCandidate, "title") ??
      requiredLearningString(learning, "title"),
    slug: optionalLearningString(skillCandidate, "slug"),
    summary:
      optionalLearningString(skillCandidate, "summary") ??
      optionalLearningString(learning, "whyThisMatters") ??
      requiredLearningString(learning, "rationale"),
    body:
      optionalLearningString(skillCandidate, "body") ??
      optionalLearningString(skillCandidate, "instructions") ??
      requiredLearningString(learning, "title"),
    instructions:
      optionalLearningString(skillCandidate, "instructions") ??
      optionalLearningString(skillCandidate, "body") ??
      requiredLearningString(learning, "title"),
    category:
      optionalLearningString(skillCandidate, "category") ??
      requiredLearningString(learning, "workflowCategory"),
    scopeType,
    projectId: scopeType === "project" ? projectId : null,
    ownerUserId:
      optionalLearningString(skillCandidate, "ownerUserId") ??
      optionalLearningString(learning, "sourceUserId") ??
      (scopeType === "personal" ? reviewedBy : null),
    reviewerUserId: reviewedBy,
    status: "active",
    version: optionalLearningNumber(skillCandidate, "version") ?? 1,
    examples,
    sourceEventIds,
    riskLevel:
      optionalLearningRiskLevel(skillCandidate, "riskLevel") ??
      optionalLearningRiskLevel(learning, "perceivedRiskLevel") ??
      "low",
    metadata: {
      ...skillMetadata,
      sourcePromotionId: promotion.id,
      sourcePromotionType: promotion.promotion_type,
      reviewNotes: params.reviewNotes ?? null,
    },
  });

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "ai_skills",
      destination_record_id: skill.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: reviewedBy,
    projectId: promotion.project_id,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "skill_library_promotion_applied",
    eventFamily: "workflow_outcome",
    surface: "admin_ai_learning_promotions",
    subjectType: "ai_skill",
    subjectId: skill.id,
    signal: "accepted",
    reasonCategory: "skill_library_apply",
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: promotion.status,
      destinationTable: promotion.destination_table,
      destinationRecordId: promotion.destination_record_id,
    },
    afterSnapshot: {
      status: updatedPromotion.status,
      destinationTable: updatedPromotion.destination_table,
      destinationRecordId: updatedPromotion.destination_record_id,
      skillId: skill.id,
      skillTitle: skill.title,
      skillStatus: skill.status,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: "apply",
      skillId: skill.id,
      previousStatus: promotion.status,
      newStatus: updatedPromotion.status,
    },
  });

  return {
    promotion: updatedPromotion,
    skill,
  };
}

// ---------------------------------------------------------------------------
// Project attribution learning loop
//
// Every manual project assignment in the Assignment Inbox records an
// `ai_feedback_events` row (event_family "attribution"). The generator below
// mines those events for repeatable patterns (sender domain, sender email,
// title keyword) and proposes generalizable `project_attribution_rules` for
// admin review. Once approved + applied, the backend ProjectAssigner reads the
// rule at highest priority — so future items auto-match without manual work.
// ---------------------------------------------------------------------------

const ATTRIBUTION_EVENT_TYPE = "project_assignment_recorded";

/** Public / first-party domains that must never become an attribution rule. */
const ATTRIBUTION_DOMAIN_EXCLUSIONS = new Set([
  "alleatogroup.com",
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
]);

const ATTRIBUTION_TITLE_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "has", "are",
  "was", "were", "you", "your", "our", "their", "his", "her", "its", "meeting",
  "call", "email", "re", "fwd", "fw", "update", "weekly", "daily", "notes",
  "discussion", "review", "sync", "catch", "general", "team", "project",
  "regarding", "about", "please", "thanks", "thank", "hi", "hello", "all",
]);

function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

/** Pull salient lowercase tokens from a title/subject for keyword rule mining. */
export function extractTitleKeywords(
  title: string | null | undefined,
  max = 6,
): string[] {
  if (!title) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of title.toLowerCase().split(/[^a-z0-9]+/)) {
    const token = raw.trim();
    if (token.length < 4) continue;
    if (ATTRIBUTION_TITLE_STOPWORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeAttributionPattern(pattern: string): string {
  return pattern
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attributionRuleSignature(
  ruleType: AttributionRuleKind,
  pattern: string,
  projectId: number,
): string {
  return `project_attribution_rule|${ruleType}|${normalizeAttributionPattern(pattern)}|${projectId}`;
}

/** Lower priority value = matched first by the backend ProjectAssigner. */
function attributionRulePriority(ruleType: AttributionRuleKind): number {
  if (ruleType === "email") return 12;
  if (ruleType === "domain") return 22;
  return 42; // title_keyword — broadest, lowest precedence
}

function attributionRuleConfidence(signalCount: number, consistency: number): number {
  const volume = Math.min(0.2, signalCount * 0.04);
  return Math.min(0.97, Math.max(0.7, 0.6 + volume + (consistency - 0.8)));
}

/**
 * Record one manual project assignment as an attribution feedback event. Safe to
 * call from request handlers — failures are surfaced via AiFeedbackEventError.
 */
export async function recordAttributionAssignmentFeedback(
  params: RecordAttributionAssignmentFeedbackParams,
): Promise<AiFeedbackEventRow> {
  const domain = extractEmailDomain(params.fromEmail);
  const titleKeywords = (params.titleKeywords ?? []).filter(
    (keyword) => typeof keyword === "string" && keyword.trim().length > 0,
  );

  return recordAiFeedbackEvent({
    userId: params.userId,
    projectId: params.projectId,
    sessionId: params.sessionId ?? null,
    sourceTable: params.sourceTable,
    sourceRecordId: params.sourceRecordId,
    eventType: ATTRIBUTION_EVENT_TYPE,
    eventFamily: "attribution",
    surface: params.surface ?? "assignment_inbox",
    subjectType: params.contentType,
    subjectId: params.sourceRecordId,
    signal: params.matchedSuggestion ? "accepted" : "corrected",
    reasonCategory: params.matchedSuggestion
      ? "suggestion_accepted"
      : "manual_assignment",
    sourceContext: {
      sourceTable: params.sourceTable,
      sourceRecordId: params.sourceRecordId,
      contentType: params.contentType,
      projectId: params.projectId,
      projectName: params.projectName ?? null,
      suggestedProjectId: params.suggestedProjectId ?? null,
      fromEmail: params.fromEmail?.trim().toLowerCase() ?? null,
      fromDomain: domain,
      titleKeywords,
    },
    metadata: {
      action: "assign",
      matchedSuggestion: params.matchedSuggestion,
      signals: {
        domain,
        email: params.fromEmail?.trim().toLowerCase() ?? null,
        titleKeywords,
      },
    },
  });
}

interface AttributionPatternGroup {
  ruleType: AttributionRuleKind;
  pattern: string;
  byProject: Map<number, { count: number; eventIds: string[]; projectName: string | null }>;
  total: number;
}

function attributionGroupKey(ruleType: AttributionRuleKind, pattern: string): string {
  return `${ruleType}|${normalizeAttributionPattern(pattern)}`;
}

export async function generateAttributionRulePromotionCandidates(
  params: GenerateAttributionRulePromotionCandidatesParams = {},
): Promise<GenerateAttributionRulePromotionCandidatesResult> {
  const windowDays = Math.min(180, Math.max(1, params.windowDays ?? 60));
  const minSignals = Math.min(25, Math.max(2, params.minSignals ?? 3));
  const minConsistency = Math.min(1, Math.max(0.5, params.minConsistency ?? 0.8));
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const dryRun = params.dryRun ?? false;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_feedback_events")
    .select("*")
    .eq("event_family", "attribution")
    .eq("event_type", ATTRIBUTION_EVENT_TYPE)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5_000);

  if (error) {
    throw new AiFeedbackEventError("ai_feedback_events", "select", error.message);
  }

  const rows = (data ?? []) as AiFeedbackEventRow[];
  const groups = new Map<string, AttributionPatternGroup>();

  const register = (
    ruleType: AttributionRuleKind,
    pattern: string,
    projectId: number,
    projectName: string | null,
    eventId: string,
  ) => {
    const normalized = normalizeAttributionPattern(pattern);
    if (!normalized) return;
    if (ruleType === "domain" && ATTRIBUTION_DOMAIN_EXCLUSIONS.has(normalized)) return;
    if (ruleType === "email") {
      const domain = extractEmailDomain(normalized);
      if (domain && ATTRIBUTION_DOMAIN_EXCLUSIONS.has(domain)) return;
    }
    const key = attributionGroupKey(ruleType, pattern);
    let group = groups.get(key);
    if (!group) {
      group = { ruleType, pattern: normalized, byProject: new Map(), total: 0 };
      groups.set(key, group);
    }
    const bucket = group.byProject.get(projectId) ?? {
      count: 0,
      eventIds: [],
      projectName,
    };
    bucket.count += 1;
    bucket.eventIds.push(eventId);
    if (projectName && !bucket.projectName) bucket.projectName = projectName;
    group.byProject.set(projectId, bucket);
    group.total += 1;
  };

  for (const row of rows) {
    const context = jsonRecord(row.source_context);
    const projectId = optionalLearningNumber(context, "projectId") ?? row.project_id;
    if (!projectId || projectId <= 0) continue;
    const projectName = optionalLearningString(context, "projectName");

    const domain = optionalLearningString(context, "fromDomain");
    if (domain) register("domain", domain, projectId, projectName, row.id);

    const email = optionalLearningString(context, "fromEmail");
    if (email) register("email", email, projectId, projectName, row.id);

    for (const keyword of optionalLearningStringArray(context, "titleKeywords")) {
      register("title_keyword", keyword, projectId, projectName, row.id);
    }
  }

  const existingPromotionSigs = await existingPromotionSignaturesForType(
    supabase,
    "attribution_rule",
  );

  // Skip patterns already covered by an active rule.
  const { data: activeRules } = await supabase
    .from("project_attribution_rules")
    .select("project_id, rule_type, pattern_normalized")
    .eq("status", "active")
    .limit(5_000);
  const activeRuleSigs = new Set(
    (activeRules ?? []).map((rule) =>
      attributionRuleSignature(
        rule.rule_type as AttributionRuleKind,
        rule.pattern_normalized,
        rule.project_id,
      ),
    ),
  );

  const candidates: AttributionRulePromotionCandidatePreview[] = [];

  for (const group of groups.values()) {
    if (candidates.length >= limit) break;
    if (group.total < minSignals) continue;

    let dominantProjectId = 0;
    let dominant = { count: 0, eventIds: [] as string[], projectName: null as string | null };
    for (const [projectId, bucket] of group.byProject) {
      if (bucket.count > dominant.count) {
        dominant = bucket;
        dominantProjectId = projectId;
      }
    }
    if (dominantProjectId <= 0) continue;
    if (dominant.count < minSignals) continue;

    const consistency = dominant.count / group.total;
    if (consistency < minConsistency) continue;

    const signature = attributionRuleSignature(
      group.ruleType,
      group.pattern,
      dominantProjectId,
    );
    if (existingPromotionSigs.has(signature)) continue;
    if (activeRuleSigs.has(signature)) continue;

    const confidence = attributionRuleConfidence(dominant.count, consistency);
    const proposedLearning: Json = {
      signature,
      ruleKind: "project_attribution_rule",
      ruleType: group.ruleType,
      pattern: group.pattern,
      patternNormalized: normalizeAttributionPattern(group.pattern),
      projectId: dominantProjectId,
      projectName: dominant.projectName,
      priority: attributionRulePriority(group.ruleType),
      title: `Auto-assign ${group.ruleType.replace("_", " ")} "${group.pattern}" → ${
        dominant.projectName ?? `Project ${dominantProjectId}`
      }`,
      signalCount: dominant.count,
      totalSignals: group.total,
      consistency: Math.round(consistency * 100) / 100,
      evidenceWindowDays: windowDays,
      rationale:
        `You assigned ${dominant.count} item(s) matching ${group.ruleType.replace("_", " ")} ` +
        `"${group.pattern}" to ${dominant.projectName ?? `Project ${dominantProjectId}`}. ` +
        "Approve to let the matcher auto-route future items with this pattern.",
    };

    candidates.push({
      signature,
      promotionType: "attribution_rule",
      projectId: dominantProjectId,
      confidence,
      riskLevel: group.ruleType === "title_keyword" ? "medium" : "low",
      destinationTable: "project_attribution_rules",
      destinationRecordId: null,
      sourceEventIds: dominant.eventIds.slice(0, 50),
      proposedLearning,
    });
  }

  if (dryRun || candidates.length === 0) {
    return {
      inspectedRows: rows.length,
      groupsInspected: groups.size,
      candidatesFound: candidates.length,
      candidatesCreated: 0,
      candidatesSkipped: candidates.length,
      dryRun,
      candidates,
    };
  }

  const payload: AiLearningPromotionInsert[] = candidates.map((candidate) => ({
    status: "candidate",
    promotion_type: candidate.promotionType,
    project_id: candidate.projectId,
    target_id: null,
    source_event_ids: candidate.sourceEventIds,
    destination_table: candidate.destinationTable,
    destination_record_id: null,
    confidence: candidate.confidence,
    risk_level: candidate.riskLevel,
    proposed_learning: candidate.proposedLearning,
    review_notes: null,
  }));

  const { data: created, error: insertError } = await supabase
    .from("ai_learning_promotions")
    .insert(payload)
    .select("*");

  if (insertError || !created) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "insert_batch",
      insertError?.message ?? "batch insert returned no rows",
    );
  }

  return {
    inspectedRows: rows.length,
    groupsInspected: groups.size,
    candidatesFound: candidates.length,
    candidatesCreated: created.length,
    candidatesSkipped: candidates.length - created.length,
    dryRun,
    candidates,
  };
}

/**
 * Apply an approved attribution_rule promotion whose proposed_learning describes
 * a generalizable rule (ruleKind === "project_attribution_rule"). Upserts into
 * `project_attribution_rules` — the table the backend ProjectAssigner reads.
 */
async function applyProjectAttributionRulePromotion(
  promotion: AiLearningPromotionRow,
  learning: Record<string, unknown>,
  params: ApplyAttributionRulePromotionParams,
): Promise<ApplyAttributionRulePromotionResult> {
  const supabase = createServiceClient();
  const reviewedBy = optionalUuid(
    params.reviewedBy,
    "reviewedBy",
    "project_attribution_rules",
  );

  const ruleType = (optionalLearningString(learning, "ruleType") ??
    "title_keyword") as AttributionRuleKind;
  const pattern = requiredLearningString(learning, "pattern");
  const projectId =
    optionalLearningNumber(learning, "projectId") ?? promotion.project_id;
  if (!projectId || projectId <= 0) {
    throw new AiFeedbackEventError(
      "project_attribution_rules",
      "validate",
      "proposed_learning.projectId is required",
    );
  }
  const patternNormalized = normalizeAttributionPattern(pattern);
  if (!patternNormalized) {
    throw new AiFeedbackEventError(
      "project_attribution_rules",
      "validate",
      "attribution rule pattern must contain searchable text",
    );
  }

  const priority =
    optionalLearningNumber(learning, "priority") ??
    attributionRulePriority(ruleType);

  const { data: rule, error: ruleError } = await supabase
    .from("project_attribution_rules")
    .upsert(
      {
        project_id: projectId,
        rule_type: ruleType,
        pattern,
        pattern_normalized: patternNormalized,
        confidence: clampConfidence(promotion.confidence),
        priority,
        source: "ai_learning_promotion",
        notes: optionalLearningString(learning, "rationale"),
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,rule_type,pattern_normalized" },
    )
    .select("*")
    .single();

  if (ruleError || !rule) {
    throw new AiFeedbackEventError(
      "project_attribution_rules",
      "upsert",
      ruleError?.message ?? "rule upsert returned no row",
    );
  }

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "project_attribution_rules",
      destination_record_id: rule.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: params.reviewedBy,
    projectId,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "attribution_rule_applied",
    eventFamily: "attribution",
    surface: "admin_ai_learning_promotions",
    subjectType: "project_attribution_rule",
    subjectId: rule.id,
    signal: "accepted",
    reasonCategory: "attribution_rule_apply",
    freeText: params.reviewNotes ?? null,
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: "apply",
      ruleKind: "project_attribution_rule",
      ruleId: rule.id,
      ruleType,
      pattern: patternNormalized,
    },
  });

  return { promotion: updatedPromotion, attributionRule: rule };
}

export async function applyAttributionRulePromotion(
  params: ApplyAttributionRulePromotionParams,
): Promise<ApplyAttributionRulePromotionResult> {
  const supabase = createServiceClient();
  const ragSupabase = createRagServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_learning_promotions",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      "promotionId is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.promotion_type !== "attribution_rule") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only attribution_rule promotions can be applied by this writer. Received: ${promotion.promotion_type}`,
    );
  }

  if (promotion.status !== "approved") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only approved attribution_rule promotions can be applied. Received: ${promotion.status}`,
    );
  }

  const learning = jsonRecord(promotion.proposed_learning);

  // Generalizable rule mined from manual assignments → project_attribution_rules.
  if (optionalLearningString(learning, "ruleKind") === "project_attribution_rule") {
    return applyProjectAttributionRulePromotion(promotion, learning, params);
  }

  const candidateId = optionalLearningString(learning, "candidateId");
  const reviewedBy = optionalUuid(
    params.reviewedBy,
    "reviewedBy",
    "document_attribution_candidates",
  );

  let attributionCandidate: DocumentAttributionCandidateRow;
  if (candidateId) {
    const { data: candidate, error: candidateError } = await ragSupabase
      .from("document_attribution_candidates")
      .update({
        status: "approved",
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", candidateId)
      .select("*")
      .single();

    if (candidateError || !candidate) {
      throw new AiFeedbackEventError(
        "document_attribution_candidates",
        "update",
        candidateError?.message ?? "candidate approval returned no row",
      );
    }
    attributionCandidate = candidate as DocumentAttributionCandidateRow;
  } else {
    const sourceDocumentId = requiredLearningString(learning, "sourceDocumentId");
    const candidateProjectId = optionalLearningNumber(learning, "candidateProjectId");
    if (!candidateProjectId) {
      throw new AiFeedbackEventError(
        "document_attribution_candidates",
        "validate",
        "proposed_learning.candidateProjectId is required when candidateId is absent",
      );
    }

    const payload: DocumentAttributionCandidateInsert = {
      source_document_id: sourceDocumentId,
      candidate_project_id: candidateProjectId,
      candidate_project_name: optionalLearningString(learning, "candidateProjectName"),
      confidence: clampConfidence(promotion.confidence),
      confidence_label: optionalLearningString(learning, "confidenceLabel"),
      attribution_method:
        optionalLearningString(learning, "attributionMethod") ??
        "ai_learning_promotion",
      evidence_terms: optionalLearningStringArray(learning, "evidenceTerms"),
      matched_fields: optionalLearningStringArray(learning, "matchedFields"),
      evidence: normalizeJson(learning.evidence as Json | undefined),
      reasoning: optionalLearningString(learning, "reasoning"),
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      compiler_version: optionalLearningString(learning, "compilerVersion"),
    };

    const { data: candidate, error: candidateError } = await ragSupabase
      .from("document_attribution_candidates")
      .insert(payload)
      .select("*")
      .single();

    if (candidateError || !candidate) {
      throw new AiFeedbackEventError(
        "document_attribution_candidates",
        "insert",
        candidateError?.message ?? "candidate insert returned no row",
      );
    }
    attributionCandidate = candidate as DocumentAttributionCandidateRow;
  }

  if (!attributionCandidate.candidate_project_id) {
    throw new AiFeedbackEventError(
      "document_attribution_candidates",
      "validate",
      "approved attribution candidate has no project id",
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("document_metadata")
    .select("id, tags, project_id, project")
    .eq("id", attributionCandidate.source_document_id)
    .single();

  if (documentError || !document) {
    throw new AiFeedbackEventError(
      "document_metadata",
      "select",
      documentError?.message ?? "linked source document was not found",
    );
  }

  const { error: documentUpdateError } = await supabase
    .from("document_metadata")
    .update({
      project_id: attributionCandidate.candidate_project_id,
      project: attributionCandidate.candidate_project_name,
      tags: appendAttributionApprovedTag(document.tags),
    })
    .eq("id", attributionCandidate.source_document_id);

  if (documentUpdateError) {
    throw new AiFeedbackEventError(
      "document_metadata",
      "update",
      documentUpdateError.message,
    );
  }

  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: "applied",
      destination_table: "document_attribution_candidates",
      destination_record_id: attributionCandidate.id,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: params.reviewedBy,
    projectId: Number(attributionCandidate.candidate_project_id),
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "attribution_rule_applied",
    eventFamily: "attribution",
    surface: "admin_ai_learning_promotions",
    subjectType: "document_attribution_candidate",
    subjectId: attributionCandidate.id,
    signal: "accepted",
    reasonCategory: "attribution_rule_apply",
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: promotion.status,
      destinationTable: promotion.destination_table,
      destinationRecordId: promotion.destination_record_id,
      documentProjectId: document.project_id,
      documentProject: document.project,
    },
    afterSnapshot: {
      status: updatedPromotion.status,
      destinationTable: updatedPromotion.destination_table,
      destinationRecordId: updatedPromotion.destination_record_id,
      documentProjectId: attributionCandidate.candidate_project_id,
      documentProject: attributionCandidate.candidate_project_name,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
      sourceDocumentId: attributionCandidate.source_document_id,
    },
    metadata: {
      action: "apply",
      attributionCandidateId: attributionCandidate.id,
      sourceDocumentId: attributionCandidate.source_document_id,
      previousStatus: promotion.status,
      newStatus: updatedPromotion.status,
    },
  });

  return {
    promotion: updatedPromotion,
    attributionCandidate,
  };
}

export async function updateRetrievalWeightStatus(
  params: UpdateRetrievalWeightStatusParams,
): Promise<UpdateRetrievalWeightStatusResult> {
  const supabase = createServiceClient();
  const promotionId = optionalUuid(
    params.promotionId,
    "promotionId",
    "ai_retrieval_weights",
  );

  if (!promotionId) {
    throw new AiFeedbackEventError(
      "ai_retrieval_weights",
      "validate",
      "promotionId is required",
    );
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("ai_learning_promotions")
    .select("*")
    .eq("id", promotionId)
    .single();

  if (promotionError || !promotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "select",
      promotionError?.message ?? "promotion was not found",
    );
  }

  if (promotion.promotion_type !== "retrieval_weight") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only retrieval_weight promotions have retrieval weight controls. Received: ${promotion.promotion_type}`,
    );
  }

  if (promotion.status !== "applied" && promotion.status !== "superseded") {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "validate",
      `Only applied or superseded retrieval_weight promotions can be controlled. Received: ${promotion.status}`,
    );
  }

  const { data: previousRetrievalWeight, error: previousWeightError } =
    await supabase
      .from("ai_retrieval_weights")
      .select("*")
      .eq("promotion_id", promotion.id)
      .single();

  if (previousWeightError || !previousRetrievalWeight) {
    throw new AiFeedbackEventError(
      "ai_retrieval_weights",
      "select",
      previousWeightError?.message ?? "retrieval weight was not found",
    );
  }

  const { data: retrievalWeight, error: weightError } = await supabase
    .from("ai_retrieval_weights")
    .update({
      status: params.status,
    })
    .eq("promotion_id", promotion.id)
    .select("*")
    .single();

  if (weightError || !retrievalWeight) {
    throw new AiFeedbackEventError(
      "ai_retrieval_weights",
      "update",
      weightError?.message ?? "retrieval weight update returned no row",
    );
  }

  const promotionStatus: AiLearningPromotionStatus =
    params.status === "superseded" ? "superseded" : "applied";
  const { data: updatedPromotion, error: updateError } = await supabase
    .from("ai_learning_promotions")
    .update({
      status: promotionStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: optionalUuid(
        params.reviewedBy,
        "reviewedBy",
        "ai_learning_promotions",
      ),
      review_notes: params.reviewNotes ?? promotion.review_notes,
    })
    .eq("id", promotion.id)
    .select("*")
    .single();

  if (updateError || !updatedPromotion) {
    throw new AiFeedbackEventError(
      "ai_learning_promotions",
      "update",
      updateError?.message ?? "promotion status update returned no row",
    );
  }

  await recordAiFeedbackEvent({
    userId: params.reviewedBy,
    projectId: promotion.project_id,
    sourceTable: "ai_learning_promotions",
    sourceRecordId: promotion.id,
    eventType: "retrieval_weight_status_changed",
    eventFamily: "retrieval",
    surface: "admin_ai_learning_promotions",
    subjectType: "ai_retrieval_weight",
    subjectId: retrievalWeight.id,
    signal: retrievalWeightStatusSignal(params.status),
    reasonCategory: "retrieval_weight_control",
    freeText: params.reviewNotes ?? null,
    beforeSnapshot: {
      status: previousRetrievalWeight.status,
      promotionStatus: promotion.status,
      weightMultiplier: previousRetrievalWeight.weight_multiplier,
    },
    afterSnapshot: {
      status: retrievalWeight.status,
      promotionStatus: updatedPromotion.status,
      weightMultiplier: retrievalWeight.weight_multiplier,
    },
    sourceContext: {
      promotionId: promotion.id,
      promotionType: promotion.promotion_type,
      proposedLearning: promotion.proposed_learning,
    },
    metadata: {
      action: params.status,
      retrievalWeightId: retrievalWeight.id,
      previousStatus: previousRetrievalWeight.status,
      newStatus: retrievalWeight.status,
    },
  });

  return {
    promotion: updatedPromotion,
    retrievalWeight,
  };
}
