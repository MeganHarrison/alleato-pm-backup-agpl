import {
  applyAgentPreventionPromotion,
  applyAttributionRulePromotion,
  applyMemoryPromotion,
  applyPositiveTaskExamplePromotion,
  applySkillLibraryPromotion,
  generateEmailVoicePromotionCandidates,
  generateRetrievalPromotionCandidates,
  generateTaskPromotionCandidates,
  recordPacketCardFeedback,
} from "../feedback-event-service";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { upsertAgentLearning } from "@/lib/ai/services/agent-learning-service";
import { writeMemory } from "@/lib/ai/services/ai-memory-service";
import { createSkill } from "@/lib/ai/services/skill-library-service";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(),
  isRagDatabaseReadsEnabled: jest.fn(() => false),
}));

jest.mock("@/lib/ai/services/agent-learning-service", () => ({
  upsertAgentLearning: jest.fn(),
}));

jest.mock("@/lib/ai/services/ai-memory-service", () => ({
  writeMemory: jest.fn(),
}));

jest.mock("@/lib/ai/services/skill-library-service", () => ({
  createSkill: jest.fn(),
}));

type RetrievalFeedbackFixture = {
  id: string;
  created_at: string;
  user_id: string | null;
  project_id: number | null;
  target_id: string | null;
  session_id: string | null;
  tool_name: string;
  query_text: string;
  source_document_id: string | null;
  source_chunk_id: string | null;
  rank: number | null;
  score: number | null;
  cited: boolean;
  user_referenced: boolean;
  used_in_answer: boolean;
  outcome: string;
  metadata: Record<string, unknown>;
};

type TaskFeedbackFixture = {
  id: string;
  created_at: string;
  user_id: string;
  project_id: number | null;
  generated_task_id: string | null;
  task_id: string | null;
  signal: "good" | "bad";
  reason: string | null;
  reason_category: string | null;
  task_snapshot: Record<string, unknown>;
  session_id: string | null;
  learning_id: string | null;
  promoted: boolean;
};

type AiFeedbackEventFixture = {
  id: string;
  created_at: string;
  user_id: string | null;
  project_id: number | null;
  target_id: string | null;
  session_id: string | null;
  source_table: string | null;
  source_record_id: string | null;
  event_type: string;
  event_family: string;
  surface: string;
  subject_type: string;
  subject_id: string | null;
  signal: string;
  reason_category: string | null;
  free_text: string | null;
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  source_context: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

const createServiceClientMock = createServiceClient as jest.Mock;
const createRagServiceClientMock = createRagServiceClient as jest.Mock;
const upsertAgentLearningMock = upsertAgentLearning as jest.Mock;
const writeMemoryMock = writeMemory as jest.Mock;
const createSkillMock = createSkill as jest.Mock;

function retrievalFeedback(
  overrides: Partial<RetrievalFeedbackFixture>,
): RetrievalFeedbackFixture {
  return {
    id: crypto.randomUUID(),
    created_at: "2026-05-07T14:00:00.000Z",
    user_id: null,
    project_id: 983,
    target_id: null,
    session_id: null,
    tool_name: "semanticSearch",
    query_text: "What is the sprinkler delay risk?",
    source_document_id: "doc-1",
    source_chunk_id: "chunk-1",
    rank: 1,
    score: 0.82,
    cited: true,
    user_referenced: false,
    used_in_answer: true,
    outcome: "helpful",
    metadata: {
      title: "Sprinkler Delay Meeting",
    },
    ...overrides,
  };
}

function taskFeedback(
  overrides: Partial<TaskFeedbackFixture>,
): TaskFeedbackFixture {
  return {
    id: crypto.randomUUID(),
    created_at: "2026-05-07T14:00:00.000Z",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    project_id: 983,
    generated_task_id: null,
    task_id: null,
    signal: "good",
    reason: "Specific and actionable.",
    reason_category: null,
    task_snapshot: {
      name: "Confirm sprinkler shop drawing resubmittal date",
      assignee: "Sam",
      dueDate: "2026-05-12",
      priority: "high",
      notes: "Needed before owner update",
    },
    session_id: null,
    learning_id: null,
    promoted: false,
    ...overrides,
  };
}

function emailDraftFeedbackEvent(
  overrides: Partial<AiFeedbackEventFixture>,
): AiFeedbackEventFixture {
  return {
    id: crypto.randomUUID(),
    created_at: "2026-05-13T22:00:00.000Z",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    project_id: null,
    target_id: null,
    session_id: null,
    source_table: "microsoft_graph_messages",
    source_record_id: "draft-message-id",
    event_type: "outlook_email_draft_feedback_recorded",
    event_family: "assistant_response",
    surface: "outlook_assistant",
    subject_type: "outlook_email_draft",
    subject_id: "draft-message-id",
    signal: "corrected",
    reason_category: "too_formal",
    free_text: "This sounds too polished.",
    before_snapshot: {},
    after_snapshot: {},
    source_context: {
      mailboxUserId: "bclymer@alleatogroup.com",
      graphDraftMessageId: "draft-message-id",
      voiceProfilePath: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      voiceProfileVersion: "2026-05-19",
    },
    metadata: {
      visibility: "private",
    },
    ...overrides,
  };
}

function mockSupabase(params: {
  retrievalRows: RetrievalFeedbackFixture[];
  existingPromotions?: Array<{ proposed_learning: Record<string, unknown> }>;
}) {
  const retrievalQuery = {
    select: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: params.retrievalRows,
      error: null,
    }),
  };
  const promotionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({
      data: params.existingPromotions ?? [],
      error: null,
    }),
  };

  createServiceClientMock.mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "ai_retrieval_feedback") return retrievalQuery;
      if (table === "ai_learning_promotions") return promotionsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
}

function mockAgentPromotionApplySupabase(params: {
  promotion: Record<string, unknown>;
  updatedPromotion: Record<string, unknown>;
}) {
  const selectPromotionQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.promotion,
      error: null,
    }),
  };
  const updatePromotionQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.updatedPromotion,
      error: null,
    }),
  };
  const feedbackEventQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
      },
      error: null,
    }),
  };
  const applySupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_learning_promotions") {
        throw new Error(`Unexpected apply table: ${table}`);
      }
      return {
        select: selectPromotionQuery.select,
        eq: selectPromotionQuery.eq,
        single: selectPromotionQuery.single,
        update: jest.fn().mockReturnValue(updatePromotionQuery),
      };
    }),
  };
  const eventSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_feedback_events") {
        throw new Error(`Unexpected event table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(feedbackEventQuery),
      };
    }),
  };

  createServiceClientMock
    .mockReturnValueOnce(applySupabase)
    .mockReturnValueOnce(eventSupabase);

  return {
    applySupabase,
    eventSupabase,
  };
}

function mockTaskPromotionGeneratorSupabase(params: {
  taskRows: TaskFeedbackFixture[];
  existingPromotions?: Array<{ proposed_learning: Record<string, unknown> }>;
}) {
  const taskQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: params.taskRows,
      error: null,
    }),
  };
  const promotionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({
      data: params.existingPromotions ?? [],
      error: null,
    }),
  };

  createServiceClientMock.mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "ai_task_feedback") return taskQuery;
      if (table === "ai_learning_promotions") return promotionsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
}

function mockEmailVoicePromotionGeneratorSupabase(params: {
  feedbackRows: AiFeedbackEventFixture[];
  existingPromotions?: Array<{ proposed_learning: Record<string, unknown> }>;
}) {
  const feedbackQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: params.feedbackRows,
      error: null,
    }),
  };
  const promotionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({
      data: params.existingPromotions ?? [],
      error: null,
    }),
  };

  createServiceClientMock.mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "ai_feedback_events") return feedbackQuery;
      if (table === "ai_learning_promotions") return promotionsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
}

function mockPositiveTaskApplySupabase(params: {
  promotion: Record<string, unknown>;
  taskFeedback: Record<string, unknown>;
  updatedPromotion: Record<string, unknown>;
}) {
  const selectPromotionQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.promotion,
      error: null,
    }),
  };
  const taskFeedbackUpdateQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.taskFeedback,
      error: null,
    }),
  };
  const promotionUpdateQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.updatedPromotion,
      error: null,
    }),
  };
  const feedbackEventQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
      },
      error: null,
    }),
  };
  const applySupabase = {
    from: jest.fn((table: string) => {
      if (table === "ai_learning_promotions") {
        return {
          select: selectPromotionQuery.select,
          eq: selectPromotionQuery.eq,
          single: selectPromotionQuery.single,
          update: jest.fn().mockReturnValue(promotionUpdateQuery),
        };
      }
      if (table === "ai_task_feedback") {
        return {
          update: jest.fn().mockReturnValue(taskFeedbackUpdateQuery),
        };
      }
      throw new Error(`Unexpected positive task apply table: ${table}`);
    }),
  };
  const eventSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_feedback_events") {
        throw new Error(`Unexpected event table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(feedbackEventQuery),
      };
    }),
  };

  createServiceClientMock
    .mockReturnValueOnce(applySupabase)
    .mockReturnValueOnce(eventSupabase);
}

function mockPacketCardFeedbackSupabase(params: {
  review: Record<string, unknown>;
}) {
  const reviewQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.review,
      error: null,
    }),
  };
  const feedbackEventQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
      },
      error: null,
    }),
  };
  const reviewSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "intelligence_reviews") {
        throw new Error(`Unexpected review table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(reviewQuery),
      };
    }),
  };
  const eventSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_feedback_events") {
        throw new Error(`Unexpected event table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(feedbackEventQuery),
      };
    }),
  };

  createServiceClientMock
    .mockReturnValueOnce(reviewSupabase)
    .mockReturnValueOnce(eventSupabase);
}

function mockMemoryPromotionApplySupabase(params: {
  promotion: Record<string, unknown>;
  updatedPromotion: Record<string, unknown>;
}) {
  const selectPromotionQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.promotion,
      error: null,
    }),
  };
  const updatePromotionQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.updatedPromotion,
      error: null,
    }),
  };
  const feedbackEventQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
      },
      error: null,
    }),
  };
  const applySupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_learning_promotions") {
        throw new Error(`Unexpected memory apply table: ${table}`);
      }
      return {
        select: selectPromotionQuery.select,
        eq: selectPromotionQuery.eq,
        single: selectPromotionQuery.single,
        update: jest.fn().mockReturnValue(updatePromotionQuery),
      };
    }),
  };
  const eventSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_feedback_events") {
        throw new Error(`Unexpected event table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(feedbackEventQuery),
      };
    }),
  };

  createServiceClientMock
    .mockReturnValueOnce(applySupabase)
    .mockReturnValueOnce(eventSupabase);
}

function mockSkillPromotionApplySupabase(params: {
  promotion: Record<string, unknown>;
  updatedPromotion: Record<string, unknown>;
}) {
  const selectPromotionQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.promotion,
      error: null,
    }),
  };
  const updatePromotionQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.updatedPromotion,
      error: null,
    }),
  };
  const feedbackEventQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
      },
      error: null,
    }),
  };
  const applySupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_learning_promotions") {
        throw new Error(`Unexpected skill apply table: ${table}`);
      }
      return {
        select: selectPromotionQuery.select,
        eq: selectPromotionQuery.eq,
        single: selectPromotionQuery.single,
        update: jest.fn().mockReturnValue(updatePromotionQuery),
      };
    }),
  };
  const eventSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_feedback_events") {
        throw new Error(`Unexpected event table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(feedbackEventQuery),
      };
    }),
  };

  createServiceClientMock
    .mockReturnValueOnce(applySupabase)
    .mockReturnValueOnce(eventSupabase);
}

function mockAttributionRuleApplySupabase(params: {
  promotion: Record<string, unknown>;
  attributionCandidate: Record<string, unknown>;
  document: Record<string, unknown>;
  updatedPromotion: Record<string, unknown>;
}) {
  const promotionSelectQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.promotion,
      error: null,
    }),
  };
  const candidateUpdateQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.attributionCandidate,
      error: null,
    }),
  };
  const documentSelectQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.document,
      error: null,
    }),
  };
  const documentUpdateQuery = {
    eq: jest.fn().mockResolvedValue({
      error: null,
    }),
  };
  const promotionUpdateQuery = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: params.updatedPromotion,
      error: null,
    }),
  };
  const feedbackEventQuery = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "99999999-9999-4999-8999-999999999999",
      },
      error: null,
    }),
  };
  const applySupabase = {
    from: jest.fn((table: string) => {
      if (table === "ai_learning_promotions") {
        return {
          select: promotionSelectQuery.select,
          eq: promotionSelectQuery.eq,
          single: promotionSelectQuery.single,
          update: jest.fn().mockReturnValue(promotionUpdateQuery),
        };
      }
      if (table === "document_metadata") {
        return {
          select: documentSelectQuery.select,
          eq: documentSelectQuery.eq,
          single: documentSelectQuery.single,
          update: jest.fn().mockReturnValue(documentUpdateQuery),
        };
      }
      throw new Error(`Unexpected attribution apply table: ${table}`);
    }),
  };
  const ragSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "document_attribution_candidates") {
        throw new Error(`Unexpected attribution RAG table: ${table}`);
      }
      return {
        update: jest.fn().mockReturnValue(candidateUpdateQuery),
      };
    }),
  };
  const eventSupabase = {
    from: jest.fn((table: string) => {
      if (table !== "ai_feedback_events") {
        throw new Error(`Unexpected event table: ${table}`);
      }
      return {
        insert: jest.fn().mockReturnValue(feedbackEventQuery),
      };
    }),
  };

  createServiceClientMock
    .mockReturnValueOnce(applySupabase)
    .mockReturnValueOnce(eventSupabase);
  createRagServiceClientMock.mockReturnValueOnce(ragSupabase);
}

describe("feedback event service retrieval promotions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a boost candidate from repeated helpful cited retrieval feedback", async () => {
    mockSupabase({
      retrievalRows: [
        retrievalFeedback({ id: "11111111-1111-4111-8111-111111111111" }),
        retrievalFeedback({ id: "22222222-2222-4222-8222-222222222222" }),
        retrievalFeedback({ id: "33333333-3333-4333-8333-333333333333" }),
      ],
    });

    const result = await generateRetrievalPromotionCandidates({
      dryRun: true,
      minHelpfulSignals: 3,
    });

    expect(result.candidatesFound).toBe(1);
    expect(result.candidatesCreated).toBe(0);
    expect(result.candidates[0]?.promotionType).toBe("retrieval_weight");
    expect(result.candidates[0]?.projectId).toBe(983);
    expect(result.candidates[0]?.sourceEventIds).toHaveLength(3);
    expect(result.candidates[0]?.proposedLearning).toMatchObject({
      action: "boost",
      toolName: "semanticSearch",
      sourceDocumentId: "doc-1",
      sourceChunkId: "chunk-1",
      querySignature: "what the sprinkler delay risk",
      signalCounts: {
        helpful: 3,
        problem: 0,
        total: 3,
      },
    });
  });

  it("does not create a candidate from a single weak signal", async () => {
    mockSupabase({
      retrievalRows: [
        retrievalFeedback({
          cited: false,
          used_in_answer: false,
        }),
      ],
    });

    const result = await generateRetrievalPromotionCandidates({
      dryRun: true,
      minHelpfulSignals: 3,
      minProblemSignals: 2,
    });

    expect(result.candidatesFound).toBe(0);
    expect(result.groupsInspected).toBe(1);
  });

  it("creates a down-rank review candidate from repeated problem outcomes", async () => {
    mockSupabase({
      retrievalRows: [
        retrievalFeedback({
          id: "44444444-4444-4444-8444-444444444444",
          outcome: "unsupported",
          cited: false,
          used_in_answer: false,
        }),
        retrievalFeedback({
          id: "55555555-5555-4555-8555-555555555555",
          outcome: "wrong_project",
          cited: false,
          used_in_answer: false,
        }),
      ],
    });

    const result = await generateRetrievalPromotionCandidates({
      dryRun: true,
      minProblemSignals: 2,
    });

    expect(result.candidatesFound).toBe(1);
    expect(result.candidates[0]?.riskLevel).toBe("medium");
    expect(result.candidates[0]?.proposedLearning).toMatchObject({
      action: "downrank_review",
      signalCounts: {
        helpful: 0,
        problem: 2,
        total: 2,
      },
    });
  });

  it("applies an approved prevention prompt promotion into active agent learnings", async () => {
    const promotionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const agentLearningId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const reviewedBy = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const promotion = {
      id: promotionId,
      status: "approved",
      promotion_type: "agent_prevention_prompt",
      project_id: 983,
      source_event_ids: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
      destination_table: null,
      destination_record_id: null,
      confidence: 0.81,
      proposed_learning: {
        title: "Prevent unsupported assistant answers",
        source: "eval_failure",
        problemSignature: "assistant answered without source evidence",
        symptoms: "Response cited no retrieved documents.",
        rootCause: "The agent finalized before checking retrieval evidence.",
        fixPattern: "Require source evidence before final answer.",
        preventionPrompt:
          "Before answering, verify retrieved evidence supports the claim.",
        scopeTags: ["assistant", "retrieval", "citations"],
        pagePath: "/ai",
        toolId: 42,
      },
    };
    const updatedPromotion = {
      ...promotion,
      status: "applied",
      destination_table: "agent_learnings",
      destination_record_id: agentLearningId,
    };
    mockAgentPromotionApplySupabase({
      promotion,
      updatedPromotion,
    });
    upsertAgentLearningMock.mockResolvedValue({
      id: agentLearningId,
      title: "Prevent unsupported assistant answers",
      source: "eval_failure",
      status: "active",
      prevention_prompt:
        "Before answering, verify retrieved evidence supports the claim.",
      scope_tags: ["assistant", "retrieval", "citations"],
      tool_id: 42,
      project_id: 983,
      occurrences: 1,
      confidence: 0.81,
    });

    const result = await applyAgentPreventionPromotion({
      promotionId,
      reviewedBy,
      reviewNotes: "Verified failure pattern.",
    });

    expect(upsertAgentLearningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Prevent unsupported assistant answers",
        source: "eval_failure",
        status: "active",
        problemSignature: "assistant answered without source evidence",
        symptoms: "Response cited no retrieved documents.",
        rootCause: "The agent finalized before checking retrieval evidence.",
        fixPattern: "Require source evidence before final answer.",
        preventionPrompt:
          "Before answering, verify retrieved evidence supports the claim.",
        scopeTags: ["assistant", "retrieval", "citations"],
        pagePath: "/ai",
        toolId: 42,
        projectId: 983,
        confidence: 0.81,
      }),
    );
    expect(result.agentLearning.id).toBe(agentLearningId);
    expect(result.promotion.destination_table).toBe("agent_learnings");
    expect(result.promotion.destination_record_id).toBe(agentLearningId);
  });

  it("creates positive task example candidates from good unpromoted task feedback", async () => {
    const feedbackId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    mockTaskPromotionGeneratorSupabase({
      taskRows: [
        taskFeedback({
          id: feedbackId,
        }),
      ],
    });

    const result = await generateTaskPromotionCandidates({
      dryRun: true,
      limit: 10,
    });

    expect(result.candidatesFound).toBe(1);
    expect(result.candidatesCreated).toBe(0);
    expect(result.candidates[0]).toMatchObject({
      promotionType: "positive_task_example",
      projectId: 983,
      destinationTable: "ai_task_feedback",
      destinationRecordId: feedbackId,
      sourceEventIds: [feedbackId],
    });
    expect(result.candidates[0]?.proposedLearning).toMatchObject({
      ruleKind: "positive_task_example",
      feedbackId,
      rationale:
        "User marked this generated task as good. After admin review, it can be used as a bounded few-shot task-quality example.",
    });
  });

  it("creates Brandon email voice profile candidates from repeated draft feedback", async () => {
    mockEmailVoicePromotionGeneratorSupabase({
      feedbackRows: [
        emailDraftFeedbackEvent({
          id: "11111111-1111-4111-8111-111111111111",
          free_text: "Too formal.",
        }),
        emailDraftFeedbackEvent({
          id: "22222222-2222-4222-8222-222222222222",
          source_record_id: "draft-message-id-2",
          subject_id: "draft-message-id-2",
          source_context: {
            mailboxUserId: "bclymer@alleatogroup.com",
            graphDraftMessageId: "draft-message-id-2",
            voiceProfilePath: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
            voiceProfileVersion: "2026-05-19",
          },
          free_text: "Still too polished.",
        }),
      ],
    });

    const result = await generateEmailVoicePromotionCandidates({
      dryRun: true,
      minSignals: 2,
    });

    expect(result.inspectedRows).toBe(2);
    expect(result.groupsInspected).toBe(1);
    expect(result.candidatesFound).toBe(1);
    expect(result.candidatesCreated).toBe(0);
    expect(result.candidates[0]).toMatchObject({
      promotionType: "user_preference",
      projectId: null,
      destinationTable: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      destinationRecordId: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      sourceEventIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    expect(result.candidates[0]?.proposedLearning).toMatchObject({
      ruleKind: "email_voice_profile_update",
      profilePath: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      profileSection: "Avoid",
      reasonCategory: "too_formal",
      signal: "corrected",
      signalCount: 2,
      proposedRule:
        "Use plainer wording and remove polished consultant phrasing from Brandon draft replies.",
    });
  });

  it("applies a positive task example promotion by promoting the source feedback", async () => {
    const promotionId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const feedbackId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const reviewedBy = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const promotion = {
      id: promotionId,
      status: "approved",
      promotion_type: "positive_task_example",
      project_id: 983,
      source_event_ids: [feedbackId],
      destination_table: "ai_task_feedback",
      destination_record_id: feedbackId,
      confidence: 0.78,
      proposed_learning: {
        title: "Promote task example",
        feedbackId,
      },
    };
    const promotedFeedback = taskFeedback({
      id: feedbackId,
      promoted: true,
    });
    const updatedPromotion = {
      ...promotion,
      status: "applied",
    };
    mockPositiveTaskApplySupabase({
      promotion,
      taskFeedback: promotedFeedback,
      updatedPromotion,
    });

    const result = await applyPositiveTaskExamplePromotion({
      promotionId,
      reviewedBy,
      reviewNotes: "Good example.",
    });

    expect(result.taskFeedback.id).toBe(feedbackId);
    expect(result.taskFeedback.promoted).toBe(true);
    expect(result.promotion.status).toBe("applied");
  });

  it("records packet card feedback as an intelligence review and normalized event", async () => {
    const reviewId = "12121212-1212-4212-8212-121212121212";
    const cardId = "34343434-3434-4434-8434-343434343434";
    mockPacketCardFeedbackSupabase({
      review: {
        id: reviewId,
        review_type: "packet_card_feedback",
        status: "open",
        insight_card_id: cardId,
        target_link_id: null,
        evidence_id: null,
        review_reason: "packet_card_wrong",
        proposed_value: {},
        reviewed_value: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: "2026-05-07T14:00:00.000Z",
        updated_at: "2026-05-07T14:00:00.000Z",
      },
    });

    const result = await recordPacketCardFeedback({
      userId: "56565656-5656-4565-8565-565656565656",
      projectId: 983,
      insightCardId: cardId,
      signal: "wrong",
      correction: "Use the updated owner decision instead.",
      cardSnapshot: {
        title: "Old decision",
      },
    });

    expect(result.review.id).toBe(reviewId);
    expect(result.review.status).toBe("open");
    expect(result.event.id).toBe("99999999-9999-4999-8999-999999999999");
  });

  it("applies memory promotions through the shared memory service", async () => {
    const promotionId = "78787878-7878-4787-8787-787878787878";
    const memoryId = "89898989-8989-4898-8989-898989898989";
    const reviewedBy = "56565656-5656-4565-8565-565656565656";
    const promotion = {
      id: promotionId,
      status: "approved",
      promotion_type: "user_preference",
      project_id: null,
      source_event_ids: [],
      destination_table: null,
      destination_record_id: null,
      confidence: 0.84,
      proposed_learning: {
        content: "User prefers concise executive summaries.",
        visibility: "private",
        importance: 0.8,
      },
    };
    const updatedPromotion = {
      ...promotion,
      status: "applied",
      destination_table: "ai_memories",
      destination_record_id: memoryId,
    };
    mockMemoryPromotionApplySupabase({
      promotion,
      updatedPromotion,
    });
    writeMemoryMock.mockResolvedValue({
      id: memoryId,
      action: "created",
    });

    const result = await applyMemoryPromotion({
      promotionId,
      reviewedBy,
      reviewNotes: "Confirmed preference.",
    });

    expect(writeMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: reviewedBy,
        type: "preference",
        content: "User prefers concise executive summaries.",
        confidence: 0.84,
        importance: 0.8,
        source: "manual",
        visibility: "private",
      }),
    );
    expect(result.memory.id).toBe(memoryId);
    expect(result.promotion.destination_table).toBe("ai_memories");
  });

  it("applies Skill Library promotions into active ai_skills records", async () => {
    const promotionId = "70707070-7070-4707-8707-707070707070";
    const skillId = "71717171-7171-4717-8717-717171717171";
    const reviewedBy = "56565656-5656-4565-8565-565656565656";
    const sourceEventId = "72727272-7272-4727-8727-727272727272";
    const promotion = {
      id: promotionId,
      status: "approved",
      promotion_type: "workflow_rule",
      project_id: 1009,
      source_event_ids: [sourceEventId],
      destination_table: "ai_skills",
      destination_record_id: "stored-material-review",
      confidence: 0.76,
      proposed_learning: {
        title: "Review stored materials",
        workflowCategory: "pay_app_review",
        perceivedRiskLevel: "medium",
        sourceUserId: reviewedBy,
        skillCandidate: {
          title: "Review stored materials",
          slug: "review-stored-materials",
          summary: "Check stored material lines before approval.",
          body: "Compare stored material lines against approved SOV balances.",
          instructions:
            "Flag stored material lines that exceed approved SOV balances.",
          category: "pay_app_review",
          scope: { type: "project", projectId: 1009 },
          ownerUserId: reviewedBy,
          examples: [
            {
              input: "Pay app has stored materials.",
              output: "Ask the PM for backup before approval.",
            },
          ],
          sourceEventIds: [sourceEventId],
          riskLevel: "medium",
          metadata: { source: "unit-test" },
        },
      },
    };
    const updatedPromotion = {
      ...promotion,
      status: "applied",
      destination_table: "ai_skills",
      destination_record_id: skillId,
    };
    const skill = {
      id: skillId,
      title: "Review stored materials",
      slug: "review-stored-materials",
      summary: "Check stored material lines before approval.",
      body: "Compare stored material lines against approved SOV balances.",
      instructions:
        "Flag stored material lines that exceed approved SOV balances.",
      category: "pay_app_review",
      scopeType: "project",
      projectId: 1009,
      ownerUserId: reviewedBy,
      reviewerUserId: reviewedBy,
      status: "active",
      version: 1,
      supersedesSkillId: null,
      examples: [],
      sourceEventIds: [sourceEventId],
      riskLevel: "medium",
      usageCount: 0,
      lastUsedAt: null,
      reviewedAt: null,
      reviewNotes: null,
      metadata: {},
      createdAt: "2026-06-18T21:00:00.000Z",
      updatedAt: "2026-06-18T21:00:00.000Z",
    };
    mockSkillPromotionApplySupabase({
      promotion,
      updatedPromotion,
    });
    createSkillMock.mockResolvedValue(skill);

    const result = await applySkillLibraryPromotion({
      promotionId,
      reviewedBy,
      reviewNotes: "Approved for project pay app review.",
    });

    expect(createSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Review stored materials",
        slug: "review-stored-materials",
        status: "active",
        category: "pay_app_review",
        scopeType: "project",
        projectId: 1009,
        ownerUserId: reviewedBy,
        reviewerUserId: reviewedBy,
        sourceEventIds: [sourceEventId],
        riskLevel: "medium",
      }),
    );
    expect(result.skill.id).toBe(skillId);
    expect(result.promotion.destination_table).toBe("ai_skills");
    expect(result.promotion.destination_record_id).toBe(skillId);
  });

  it("applies attribution rule promotions by approving the candidate and assigning the source document", async () => {
    const promotionId = "90909090-9090-4909-8909-909090909090";
    const candidateId = "91919191-9191-4919-8919-919191919191";
    const reviewedBy = "56565656-5656-4565-8565-565656565656";
    const sourceDocumentId = "source-doc-1";
    const promotion = {
      id: promotionId,
      status: "approved",
      promotion_type: "attribution_rule",
      project_id: 983,
      source_event_ids: [],
      destination_table: null,
      destination_record_id: null,
      confidence: 0.91,
      proposed_learning: {
        candidateId,
        sourceDocumentId,
        candidateProjectName: "Warehouse A",
      },
    };
    const attributionCandidate = {
      id: candidateId,
      source_document_id: sourceDocumentId,
      source_message_ids: [],
      candidate_project_id: 983,
      candidate_project_name: "Warehouse A",
      candidate_target_id: null,
      confidence: 0.91,
      confidence_label: "high",
      attribution_method: "participant_project_match",
      evidence_terms: ["Warehouse A"],
      matched_fields: ["title"],
      evidence: {},
      reasoning: "Title matched project alias.",
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: "2026-05-07T14:00:00.000Z",
      compiler_version: null,
      created_at: "2026-05-07T14:00:00.000Z",
      updated_at: "2026-05-07T14:00:00.000Z",
    };
    const updatedPromotion = {
      ...promotion,
      status: "applied",
      destination_table: "document_attribution_candidates",
      destination_record_id: candidateId,
    };
    mockAttributionRuleApplySupabase({
      promotion,
      attributionCandidate,
      document: {
        id: sourceDocumentId,
        tags: "teams",
        project_id: null,
        project: null,
      },
      updatedPromotion,
    });

    const result = await applyAttributionRulePromotion({
      promotionId,
      reviewedBy,
      reviewNotes: "Confirmed project match.",
    });

    expect(result.attributionCandidate.id).toBe(candidateId);
    expect(result.promotion.destination_table).toBe(
      "document_attribution_candidates",
    );
    expect(result.promotion.destination_record_id).toBe(candidateId);
  });
});
