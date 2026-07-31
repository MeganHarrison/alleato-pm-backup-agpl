import { generateText, Output } from "ai";
import { z } from "zod";

import { getLanguageModel } from "@/lib/ai/providers";
import { toSessionUuid } from "@/lib/ai/session-id";
import {
  createLearningPromotion,
  recordAiFeedbackEvent,
  type AiFeedbackEventRow,
  type AiLearningPromotionRow,
  type AiLearningPromotionType,
  type AiLearningRiskLevel,
} from "@/lib/ai/services/feedback-event-service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";

type ChatHistoryRow = Pick<
  Database["public"]["Tables"]["chat_history"]["Row"],
  "id" | "role" | "content" | "metadata" | "created_at"
>;

type LearningProposalKind = "memory" | "skill";

export type HumanGatedLearningProposalReason =
  | "feature_disabled"
  | "insufficient_context"
  | "no_candidates"
  | "invalid_candidate"
  | "duplicate_candidate"
  | "persistence_failed"
  | "metadata_update_failed"
  | "extraction_failed";

export type HumanGatedLearningProposalResult =
  | {
      status: "skipped";
      reason: Exclude<
        HumanGatedLearningProposalReason,
        "persistence_failed" | "metadata_update_failed" | "extraction_failed"
      >;
      inspectedMessages: number;
      candidatesFound: number;
      candidatesCreated: number;
      duplicateCandidates: number;
      metadataUpdated: boolean;
    }
  | {
      status: "proposed";
      reason: null;
      inspectedMessages: number;
      candidatesFound: number;
      candidatesCreated: number;
      duplicateCandidates: number;
      promotionIds: string[];
      metadataUpdated: boolean;
    }
  | {
      status: "failed";
      reason: Extract<
        HumanGatedLearningProposalReason,
        "persistence_failed" | "metadata_update_failed" | "extraction_failed"
      >;
      inspectedMessages: number;
      candidatesFound: number;
      candidatesCreated: number;
      duplicateCandidates: number;
      error: string;
      metadataUpdated: boolean;
    };

export interface HumanGatedLearningProposalParams {
  sessionId: string;
  userId: string;
  selectedProjectId?: number | null;
  responseMessageId?: string | null;
}

export interface HumanGatedLearningProposalCandidate {
  kind: LearningProposalKind;
  title: string;
  content: string;
  rationale: string;
  confidence: number;
  riskLevel: AiLearningRiskLevel;
  category?: string | null;
  appliesTo?: "personal" | "project" | "team" | "company" | null;
  exampleInput?: string | null;
  exampleOutput?: string | null;
}

interface ProposalDependencies {
  isEnabled?: () => boolean;
  fetchMessages?: (params: {
    sessionId: string;
    userId: string;
  }) => Promise<ChatHistoryRow[]>;
  extractCandidates?: (
    transcript: string,
  ) => Promise<HumanGatedLearningProposalCandidate[]>;
  findDuplicate?: (signature: string) => Promise<AiLearningPromotionRow | null>;
  recordEvent?: (
    params: Parameters<typeof recordAiFeedbackEvent>[0],
  ) => Promise<AiFeedbackEventRow>;
  createPromotion?: (
    params: Parameters<typeof createLearningPromotion>[0],
  ) => Promise<AiLearningPromotionRow>;
  updateResponseMetadata?: (params: {
    sessionId: string;
    userId: string;
    responseMessageId?: string | null;
    result: HumanGatedLearningProposalResult;
  }) => Promise<boolean>;
}

const MAX_MESSAGES = 24;
const MAX_CHARS_PER_MESSAGE = 1600;
const MIN_MESSAGES = 4;
const MAX_CANDIDATES = 3;

const candidateSchema = z.object({
  candidates: z
    .array(
      z.object({
        kind: z.enum(["memory", "skill"]),
        title: z.string().min(8).max(180),
        content: z.string().min(20).max(2000),
        rationale: z.string().min(12).max(1000),
        confidence: z.number().min(0.1).max(1),
        riskLevel: z.enum(["low", "medium", "high"]).default("low"),
        category: z.string().min(1).max(120).nullable().optional(),
        appliesTo: z
          .enum(["personal", "project", "team", "company"])
          .nullable()
          .optional(),
        exampleInput: z.string().max(1000).nullable().optional(),
        exampleOutput: z.string().max(1000).nullable().optional(),
      }),
    )
    .max(MAX_CANDIDATES),
});

function learningProposalsEnabled(): boolean {
  return process.env.AI_ASSISTANT_LEARNING_PROPOSALS_ENABLED === "true";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0.1, value));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function signatureForCandidate(
  candidate: HumanGatedLearningProposalCandidate,
): string {
  return [
    "human_gated_learning_v1",
    candidate.kind,
    normalizeText(candidate.title).toLowerCase(),
    normalizeText(candidate.content).toLowerCase().slice(0, 240),
  ].join(":");
}

function promotionTypeForCandidate(
  candidate: HumanGatedLearningProposalCandidate,
): AiLearningPromotionType {
  if (candidate.kind === "memory") {
    return candidate.appliesTo === "project" ? "project_lesson" : "user_preference";
  }
  return "workflow_rule";
}

function destinationTableForCandidate(
  candidate: HumanGatedLearningProposalCandidate,
): "ai_memories" | "ai_skill_candidates" {
  return candidate.kind === "memory" ? "ai_memories" : "ai_skill_candidates";
}

function buildTranscript(messages: ChatHistoryRow[]): string {
  return messages
    .map((message) => {
      const role = message.role === "assistant" ? "Assistant" : "User";
      return `${role}: ${message.content.slice(0, MAX_CHARS_PER_MESSAGE)}`;
    })
    .join("\n\n");
}

function validCandidates(
  candidates: HumanGatedLearningProposalCandidate[],
): HumanGatedLearningProposalCandidate[] {
  return candidates
    .filter((candidate) => {
      return (
        (candidate.kind === "memory" || candidate.kind === "skill") &&
        normalizeText(candidate.title).length >= 8 &&
        normalizeText(candidate.content).length >= 20 &&
        normalizeText(candidate.rationale).length >= 12
      );
    })
    .slice(0, MAX_CANDIDATES);
}

async function fetchConversationMessages(params: {
  sessionId: string;
  userId: string;
}): Promise<ChatHistoryRow[]> {
    const sessionUuid = toSessionUuid(params.sessionId);
  const { data, error } = await serviceDb.from("chat_history")
    .select("id, role, content, metadata, created_at")
    .eq("session_id", sessionUuid)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);

  if (error) {
    throw new Error(`Failed to fetch chat history for learning proposals: ${error.message}`);
  }

  return [...(data ?? [])]
    .reverse()
    .filter((message) => normalizeText(message.content).length > 0);
}

async function extractLearningCandidates(
  transcript: string,
): Promise<HumanGatedLearningProposalCandidate[]> {
  const result = await generateText({
    model: getLanguageModel("openai/gpt-4.1-nano"),
    output: Output.object({
      schema: candidateSchema,
      name: "human_gated_learning_candidates",
      description:
        "Memory or Skill Library candidates that require human review before use.",
    }),
    instructions: `You propose learning candidates for a construction project management assistant.

Return only candidates that should be reviewed by a human before becoming durable memory or Skill Library behavior.

Allowed candidate kinds:
- memory: durable user preference, project lesson, or company/project context.
- skill: durable workflow instruction, pitfall, or repeatable technique.

Rules:
- Do not propose transient facts, one-off task narration, or unresolved guesses.
- Prefer corrections, explicit preferences, reusable workflow lessons, and repeated patterns.
- Never claim the learning is applied. It is only a review candidate.
- Keep candidates specific and reviewable. Include source-grounded rationale.
- Return an empty candidates array when nothing is worth review.
`,
    prompt: `Review this assistant conversation and propose human-reviewed learning candidates only:\n\n${transcript}`,
  });

  return result.output.candidates;
}

async function findDuplicatePromotion(
  signature: string,
): Promise<AiLearningPromotionRow | null> {
    const { data, error } = await serviceDb.from("ai_learning_promotions")
    .select("*")
    .eq("status", "candidate")
    .in("destination_table", ["ai_memories", "ai_skill_candidates"])
    .limit(50);

  if (error) {
    throw new Error(`Learning proposal duplicate check failed: ${error.message}`);
  }

  return (
    (data ?? []).find((promotion) => {
      const proposed = asRecord(promotion.proposed_learning);
      return proposed.learningLoopSignature === signature;
    }) ?? null
  );
}

function buildProposedLearning(params: {
  candidate: HumanGatedLearningProposalCandidate;
  signature: string;
  sessionId: string;
  userId: string;
  selectedProjectId?: number | null;
  eventId: string;
  messageIds: string[];
}): Json {
  const { candidate } = params;
  const base = {
    action:
      candidate.kind === "memory"
        ? "human_gated_memory_proposal"
        : "human_gated_skill_proposal",
    title: normalizeText(candidate.title),
    content: normalizeText(candidate.content),
    rationale: normalizeText(candidate.rationale),
    sourceSurface: "ai_assistant_chat",
    sourceRoute: "/ai",
    sourceUserId: params.userId,
    sourceSessionId: params.sessionId,
    sourceEventId: params.eventId,
    sourceMessageIds: params.messageIds,
    learningLoopSignature: params.signature,
    proposedDestination:
      candidate.kind === "memory" ? "memory_review" : "skill_library",
    perceivedRiskLevel: candidate.riskLevel,
    appliesTo: candidate.appliesTo ?? (candidate.kind === "memory" ? "personal" : "team"),
    workflowCategory: candidate.category ?? "assistant_learning",
    projectId: params.selectedProjectId ?? null,
    reviewRequired: true,
    autoPromotionBlocked: true,
  };

  if (candidate.kind === "skill") {
    return {
      ...base,
      skillCandidate: {
        title: normalizeText(candidate.title),
        summary: normalizeText(candidate.rationale),
        body: normalizeText(candidate.content),
        instructions: normalizeText(candidate.content),
        category: candidate.category ?? "assistant_learning",
        riskLevel: candidate.riskLevel,
        scope: {
          type: candidate.appliesTo ?? "team",
          projectId: params.selectedProjectId ?? null,
        },
        examples:
          candidate.exampleInput || candidate.exampleOutput
            ? [
                {
                  input: candidate.exampleInput ?? null,
                  output: candidate.exampleOutput ?? null,
                  notes: "Proposed by the human-gated assistant learning loop.",
                },
              ]
            : [],
        sourceEventIds: [params.eventId],
        metadata: {
          source: "human_gated_learning_loop",
          learningLoopSignature: params.signature,
        },
      },
    } as Json;
  }

  return {
    ...base,
    memoryType: candidate.appliesTo === "project" ? "lesson" : "preference",
    visibility: candidate.appliesTo === "project" ? "team" : "private",
  } as Json;
}

function metadataForResult(result: HumanGatedLearningProposalResult): Json {
  return {
    status: result.status,
    reason: result.reason,
    inspectedMessages: result.inspectedMessages,
    candidatesFound: result.candidatesFound,
    candidatesCreated: result.candidatesCreated,
    duplicateCandidates: result.duplicateCandidates,
    metadataUpdated: result.metadataUpdated,
    promotionIds: "promotionIds" in result ? result.promotionIds : [],
    error: "error" in result ? result.error : null,
  } as Json;
}

async function updateAssistantResponseMetadata(params: {
  sessionId: string;
  userId: string;
  responseMessageId?: string | null;
  result: HumanGatedLearningProposalResult;
}): Promise<boolean> {
  if (!params.responseMessageId) return false;

    const sessionUuid = toSessionUuid(params.sessionId);
  const { data: rows, error: selectError } = await serviceDb.from("chat_history")
    .select("id, metadata")
    .eq("session_id", sessionUuid)
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .contains("metadata", { response_message_id: params.responseMessageId })
    .limit(1);

  if (selectError) {
    throw new Error(`Learning proposal metadata lookup failed: ${selectError.message}`);
  }

  const row = rows?.[0];
  if (!row) return false;

  const metadata = asRecord(row.metadata);
  const { error: updateError } = await serviceDb.from("chat_history")
    .update({
      metadata: {
        ...metadata,
        human_gated_learning_proposals: metadataForResult(params.result),
      } as Json,
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(`Learning proposal metadata update failed: ${updateError.message}`);
  }

  return true;
}

function skippedResult(params: {
  reason: Extract<
    HumanGatedLearningProposalResult,
    { status: "skipped" }
  >["reason"];
  inspectedMessages?: number;
  candidatesFound?: number;
  duplicateCandidates?: number;
}): HumanGatedLearningProposalResult {
  return {
    status: "skipped",
    reason: params.reason,
    inspectedMessages: params.inspectedMessages ?? 0,
    candidatesFound: params.candidatesFound ?? 0,
    candidatesCreated: 0,
    duplicateCandidates: params.duplicateCandidates ?? 0,
    metadataUpdated: false,
  };
}

function failedResult(params: {
  reason: Extract<
    HumanGatedLearningProposalResult,
    { status: "failed" }
  >["reason"];
  inspectedMessages: number;
  candidatesFound: number;
  candidatesCreated: number;
  duplicateCandidates: number;
  error: string;
}): HumanGatedLearningProposalResult {
  return {
    status: "failed",
    reason: params.reason,
    inspectedMessages: params.inspectedMessages,
    candidatesFound: params.candidatesFound,
    candidatesCreated: params.candidatesCreated,
    duplicateCandidates: params.duplicateCandidates,
    error: params.error,
    metadataUpdated: false,
  };
}

async function withMetadataUpdate(
  result: HumanGatedLearningProposalResult,
  params: HumanGatedLearningProposalParams,
  deps: Required<Pick<ProposalDependencies, "updateResponseMetadata">>,
): Promise<HumanGatedLearningProposalResult> {
  try {
    const metadataUpdated = await deps.updateResponseMetadata({
      sessionId: params.sessionId,
      userId: params.userId,
      responseMessageId: params.responseMessageId,
      result,
    });
    return { ...result, metadataUpdated };
  } catch (error) {
    return {
      status: "failed",
      reason: "metadata_update_failed",
      inspectedMessages: result.inspectedMessages,
      candidatesFound: result.candidatesFound,
      candidatesCreated: result.candidatesCreated,
      duplicateCandidates: result.duplicateCandidates,
      error: error instanceof Error ? error.message : "Unknown metadata update error",
      metadataUpdated: false,
    };
  }
}

export async function proposeHumanGatedLearningCandidates(
  params: HumanGatedLearningProposalParams,
  deps: ProposalDependencies = {},
): Promise<HumanGatedLearningProposalResult> {
  const dependencies = {
    isEnabled: deps.isEnabled ?? learningProposalsEnabled,
    fetchMessages: deps.fetchMessages ?? fetchConversationMessages,
    extractCandidates: deps.extractCandidates ?? extractLearningCandidates,
    findDuplicate: deps.findDuplicate ?? findDuplicatePromotion,
    recordEvent: deps.recordEvent ?? recordAiFeedbackEvent,
    createPromotion: deps.createPromotion ?? createLearningPromotion,
    updateResponseMetadata: deps.updateResponseMetadata ?? updateAssistantResponseMetadata,
  };

  if (!dependencies.isEnabled()) {
    return withMetadataUpdate(
      skippedResult({ reason: "feature_disabled" }),
      params,
      dependencies,
    );
  }

  let messages: ChatHistoryRow[];
  try {
    messages = await dependencies.fetchMessages({
      sessionId: params.sessionId,
      userId: params.userId,
    });
  } catch (error) {
    return withMetadataUpdate(
      failedResult({
        reason: "persistence_failed",
        inspectedMessages: 0,
        candidatesFound: 0,
        candidatesCreated: 0,
        duplicateCandidates: 0,
        error: error instanceof Error ? error.message : "Unknown chat history fetch error",
      }),
      params,
      dependencies,
    );
  }

  if (messages.length < MIN_MESSAGES) {
    return withMetadataUpdate(
      skippedResult({
        reason: "insufficient_context",
        inspectedMessages: messages.length,
      }),
      params,
      dependencies,
    );
  }

  let candidates: HumanGatedLearningProposalCandidate[];
  try {
    candidates = await dependencies.extractCandidates(buildTranscript(messages));
  } catch (error) {
    return withMetadataUpdate(
      failedResult({
        reason: "extraction_failed",
        inspectedMessages: messages.length,
        candidatesFound: 0,
        candidatesCreated: 0,
        duplicateCandidates: 0,
        error: error instanceof Error ? error.message : "Unknown learning extraction error",
      }),
      params,
      dependencies,
    );
  }

  if (candidates.length === 0) {
    return withMetadataUpdate(
      skippedResult({
        reason: "no_candidates",
        inspectedMessages: messages.length,
      }),
      params,
      dependencies,
    );
  }

  const valid = validCandidates(candidates);
  if (valid.length === 0) {
    return withMetadataUpdate(
      skippedResult({
        reason: "invalid_candidate",
        inspectedMessages: messages.length,
        candidatesFound: candidates.length,
      }),
      params,
      dependencies,
    );
  }

  const messageIds = messages.map((message) => message.id);
  const promotionIds: string[] = [];
  let duplicateCandidates = 0;

  try {
    const event = await dependencies.recordEvent({
      userId: params.userId,
      projectId: params.selectedProjectId ?? null,
      sessionId: params.sessionId,
      sourceTable: "chat_history",
      sourceRecordId: messages[messages.length - 1]?.id ?? null,
      eventType: "human_gated_learning_candidates_proposed",
      eventFamily: "workflow_outcome",
      surface: "ai_assistant_chat",
      subjectType: "assistant_learning_loop",
      signal: "needs_review",
      reasonCategory: "post_response_learning_review",
      sourceContext: {
        route: "/ai",
        sessionId: params.sessionId,
        responseMessageId: params.responseMessageId ?? null,
        messageIds,
      },
      metadata: {
        source: "human_gated_learning_loop",
        reviewRequired: true,
        autoPromotionBlocked: true,
        referenceUsage: {
          hermesBackgroundReview: "ADAPT prompt intent only",
          hermesCurator: "REFERENCE lifecycle gates only",
          hermesMemoryProvider: "REFERENCE hook shape only",
        },
      },
    });

    for (const candidate of valid) {
      const signature = signatureForCandidate(candidate);
      const duplicate = await dependencies.findDuplicate(signature);
      if (duplicate) {
        duplicateCandidates += 1;
        continue;
      }

      const promotion = await dependencies.createPromotion({
        promotionType: promotionTypeForCandidate(candidate),
        projectId:
          candidate.appliesTo === "project" ? params.selectedProjectId ?? null : null,
        sourceEventIds: [event.id],
        destinationTable: destinationTableForCandidate(candidate),
        destinationRecordId: null,
        confidence: clampConfidence(candidate.confidence),
        riskLevel: candidate.riskLevel,
        proposedLearning: buildProposedLearning({
          candidate,
          signature,
          sessionId: params.sessionId,
          userId: params.userId,
          selectedProjectId: params.selectedProjectId ?? null,
          eventId: event.id,
          messageIds,
        }),
        reviewNotes:
          "Created by the default-off human-gated assistant learning loop. Human approval is required before this affects memory or Skill Library behavior.",
      });
      promotionIds.push(promotion.id);
    }
  } catch (error) {
    return withMetadataUpdate(
      failedResult({
        reason: "persistence_failed",
        inspectedMessages: messages.length,
        candidatesFound: valid.length,
        candidatesCreated: promotionIds.length,
        duplicateCandidates,
        error:
          error instanceof Error ? error.message : "Unknown learning proposal persistence error",
      }),
      params,
      dependencies,
    );
  }

  if (promotionIds.length === 0) {
    return withMetadataUpdate(
      skippedResult({
        reason: "duplicate_candidate",
        inspectedMessages: messages.length,
        candidatesFound: valid.length,
        duplicateCandidates,
      }),
      params,
      dependencies,
    );
  }

  return withMetadataUpdate(
    {
      status: "proposed",
      reason: null,
      inspectedMessages: messages.length,
      candidatesFound: valid.length,
      candidatesCreated: promotionIds.length,
      duplicateCandidates,
      promotionIds,
      metadataUpdated: false,
    },
    params,
    dependencies,
  );
}
