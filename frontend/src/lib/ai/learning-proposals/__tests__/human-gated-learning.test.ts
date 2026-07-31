import {
  proposeHumanGatedLearningCandidates,
  type HumanGatedLearningProposalCandidate,
} from "../human-gated-learning";
import type {
  AiFeedbackEventRow,
  AiLearningPromotionRow,
} from "@/lib/ai/services/feedback-event-service";

jest.mock("ai", () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn((value) => value),
  },
}));

jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(() => "mock-model"),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

function messages(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    id: `message-${index + 1}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content:
      index % 2 === 0
        ? "When I ask for planning docs, keep the answer direct and split the task list by goal."
        : "Understood. I will keep implementation goals split and explicit.",
    metadata: {},
    created_at: `2026-06-19T18:0${index}:00.000Z`,
  }));
}

function eventFixture(): AiFeedbackEventRow {
  return {
    id: "event-1",
    created_at: "2026-06-19T18:00:00.000Z",
    user_id: "user-1",
    project_id: null,
    target_id: null,
    session_id: null,
    source_table: "chat_history",
    source_record_id: "message-4",
    event_type: "human_gated_learning_candidates_proposed",
    event_family: "workflow_outcome",
    surface: "ai_assistant_chat",
    subject_type: "assistant_learning_loop",
    subject_id: null,
    signal: "needs_review",
    reason_category: "post_response_learning_review",
    free_text: null,
    before_snapshot: {},
    after_snapshot: {},
    source_context: {},
    metadata: {},
  };
}

function promotionFixture(
  overrides: Partial<AiLearningPromotionRow> = {},
): AiLearningPromotionRow {
  return {
    id: "promotion-1",
    created_at: "2026-06-19T18:00:00.000Z",
    updated_at: "2026-06-19T18:00:00.000Z",
    reviewed_at: null,
    reviewed_by: null,
    status: "candidate",
    promotion_type: "user_preference",
    project_id: null,
    target_id: null,
    source_event_ids: ["event-1"],
    destination_table: "ai_memories",
    destination_record_id: null,
    confidence: 0.86,
    risk_level: "low",
    proposed_learning: {},
    review_notes: null,
    expires_at: null,
    superseded_by: null,
    ...overrides,
  };
}

const memoryCandidate: HumanGatedLearningProposalCandidate = {
  kind: "memory",
  title: "Direct goal task-list preference",
  content:
    "The user prefers implementation plans split by goal with direct task lists.",
  rationale:
    "The user explicitly asked whether to provide the full goal or Goal 4 instructions.",
  confidence: 0.88,
  riskLevel: "low",
  appliesTo: "personal",
};

const skillCandidate: HumanGatedLearningProposalCandidate = {
  kind: "skill",
  title: "Split implementation goals before coding",
  content:
    "When executing multi-goal implementation plans, complete and verify one goal before starting the next.",
  rationale:
    "The conversation established a reusable workflow for Codex goal execution.",
  confidence: 0.82,
  riskLevel: "medium",
  appliesTo: "team",
  category: "codex_execution",
  exampleInput: "Continue from Goal 4.",
  exampleOutput: "Set up Goal 4 task and verification before Goal 5.",
};

describe("proposeHumanGatedLearningCandidates", () => {
  it("is default-off and does not create promotions", async () => {
    const createPromotion = jest.fn();

    const result = await proposeHumanGatedLearningCandidates(
      {
        sessionId: "session-1",
        userId: "user-1",
        responseMessageId: "response-1",
      },
      {
        isEnabled: () => false,
        createPromotion,
        updateResponseMetadata: jest.fn().mockResolvedValue(true),
      },
    );

    expect(result).toMatchObject({
      status: "skipped",
      reason: "feature_disabled",
      candidatesCreated: 0,
      metadataUpdated: true,
    });
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it("creates review candidates only, never approved memory or skill writes", async () => {
    const createPromotion = jest
      .fn()
      .mockResolvedValueOnce(promotionFixture({ id: "memory-promotion" }))
      .mockResolvedValueOnce(
        promotionFixture({
          id: "skill-promotion",
          promotion_type: "workflow_rule",
          destination_table: "ai_skill_candidates",
          risk_level: "medium",
        }),
      );

    const result = await proposeHumanGatedLearningCandidates(
      {
        sessionId: "session-1",
        userId: "user-1",
        selectedProjectId: 983,
        responseMessageId: "response-1",
      },
      {
        isEnabled: () => true,
        fetchMessages: jest.fn().mockResolvedValue(messages()),
        extractCandidates: jest
          .fn()
          .mockResolvedValue([memoryCandidate, skillCandidate]),
        findDuplicate: jest.fn().mockResolvedValue(null),
        recordEvent: jest.fn().mockResolvedValue(eventFixture()),
        createPromotion,
        updateResponseMetadata: jest.fn().mockResolvedValue(true),
      },
    );

    expect(result).toMatchObject({
      status: "proposed",
      candidatesFound: 2,
      candidatesCreated: 2,
      promotionIds: ["memory-promotion", "skill-promotion"],
      metadataUpdated: true,
    });
    expect(createPromotion).toHaveBeenCalledTimes(2);
    expect(createPromotion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        promotionType: "user_preference",
        destinationTable: "ai_memories",
        destinationRecordId: null,
        proposedLearning: expect.objectContaining({
          action: "human_gated_memory_proposal",
          reviewRequired: true,
          autoPromotionBlocked: true,
        }),
      }),
    );
    expect(createPromotion).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        promotionType: "workflow_rule",
        destinationTable: "ai_skill_candidates",
        destinationRecordId: null,
        proposedLearning: expect.objectContaining({
          action: "human_gated_skill_proposal",
          reviewRequired: true,
          autoPromotionBlocked: true,
          skillCandidate: expect.objectContaining({
            category: "codex_execution",
          }),
        }),
      }),
    );
  });

  it("skips duplicate candidates with explicit metadata", async () => {
    const result = await proposeHumanGatedLearningCandidates(
      {
        sessionId: "session-1",
        userId: "user-1",
      },
      {
        isEnabled: () => true,
        fetchMessages: jest.fn().mockResolvedValue(messages()),
        extractCandidates: jest.fn().mockResolvedValue([memoryCandidate]),
        findDuplicate: jest.fn().mockResolvedValue(promotionFixture()),
        recordEvent: jest.fn().mockResolvedValue(eventFixture()),
        createPromotion: jest.fn(),
        updateResponseMetadata: jest.fn().mockResolvedValue(false),
      },
    );

    expect(result).toMatchObject({
      status: "skipped",
      reason: "duplicate_candidate",
      candidatesFound: 1,
      candidatesCreated: 0,
      duplicateCandidates: 1,
    });
  });

  it("fails loudly when promotion persistence fails", async () => {
    const result = await proposeHumanGatedLearningCandidates(
      {
        sessionId: "session-1",
        userId: "user-1",
      },
      {
        isEnabled: () => true,
        fetchMessages: jest.fn().mockResolvedValue(messages()),
        extractCandidates: jest.fn().mockResolvedValue([memoryCandidate]),
        findDuplicate: jest.fn().mockResolvedValue(null),
        recordEvent: jest.fn().mockResolvedValue(eventFixture()),
        createPromotion: jest.fn().mockRejectedValue(new Error("insert denied")),
        updateResponseMetadata: jest.fn().mockResolvedValue(false),
      },
    );

    expect(result).toMatchObject({
      status: "failed",
      reason: "persistence_failed",
      candidatesFound: 1,
      candidatesCreated: 0,
      error: "insert denied",
    });
  });
});
