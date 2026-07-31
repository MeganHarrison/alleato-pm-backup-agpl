import {
  createLearningPromotion,
  recordAiFeedbackEvent,
} from "../feedback-event-service";
import {
  submitTeachAlleatoIntake,
  TeachAlleatoIntakePromotionError,
  type TeachAlleatoIntakeInput,
} from "../teach-alleato-intake-service";

jest.mock("../feedback-event-service", () => ({
  recordAiFeedbackEvent: jest.fn(),
  createLearningPromotion: jest.fn(),
}));

const recordAiFeedbackEventMock = recordAiFeedbackEvent as jest.MockedFunction<
  typeof recordAiFeedbackEvent
>;
const createLearningPromotionMock =
  createLearningPromotion as jest.MockedFunction<
    typeof createLearningPromotion
  >;

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROMOTION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function intake(
  overrides: Partial<TeachAlleatoIntakeInput> = {},
): TeachAlleatoIntakeInput {
  return {
    whatShouldAlleatoLearn:
      "When reviewing pay apps, compare stored materials against the latest approved subcontract SOV before drafting a response.",
    appliesTo: "project",
    workflowCategory: "pay_app_review",
    exampleInput: "Subcontractor requests stored materials on application 4.",
    exampleOutput:
      "Flag stored materials lines that exceed the approved SOV balance.",
    sourceEvidenceLink: "https://example.com/pay-app-evidence",
    uploadIds: ["upload-1"],
    suggestedReviewer: "ops@alleatogroup.com",
    whyThisMatters:
      "This prevents Alleato from approving unsupported stored materials.",
    perceivedRiskLevel: "medium",
    projectId: 1009,
    route: "/ai-assistant/teach",
    sessionId: "teach-session-1",
    metadata: {
      source: "unit-test",
    },
    ...overrides,
  };
}

describe("submitTeachAlleatoIntake", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordAiFeedbackEventMock.mockResolvedValue({
      id: EVENT_ID,
      project_id: 1009,
    } as Awaited<ReturnType<typeof recordAiFeedbackEvent>>);
    createLearningPromotionMock.mockResolvedValue({
      id: PROMOTION_ID,
      source_event_ids: [EVENT_ID],
      promotion_type: "project_lesson",
    } as Awaited<ReturnType<typeof createLearningPromotion>>);
  });

  it("records the feedback event and stages a skill-shaped project lesson candidate", async () => {
    const result = await submitTeachAlleatoIntake({
      userId: USER_ID,
      intake: intake(),
    });

    expect(result.event.id).toBe(EVENT_ID);
    expect(result.promotions).toHaveLength(1);
    expect(recordAiFeedbackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        projectId: 1009,
        eventType: "teach_alleato_intake_submitted",
        eventFamily: "workflow_outcome",
        surface: "teach_alleato",
        subjectType: "teach_alleato_intake",
        signal: "needs_review",
        reasonCategory: "pay_app_review",
      }),
    );
    expect(createLearningPromotionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionType: "project_lesson",
        projectId: 1009,
        sourceEventIds: [EVENT_ID],
        destinationTable: "ai_memories",
        riskLevel: "medium",
        proposedLearning: expect.objectContaining({
          action: "review_teach_alleato_intake",
          ruleKind: "teach_alleato_skill_candidate",
          sourceEventId: EVENT_ID,
          proposedDestination: "ai_memories",
          content: expect.stringContaining("pay apps"),
          type: "lesson",
          visibility: "team",
          skillCandidate: expect.objectContaining({
            body: expect.stringContaining("pay apps"),
            category: "pay_app_review",
            sourceEventIds: [EVENT_ID],
            scope: {
              type: "project",
              projectId: 1009,
            },
          }),
        }),
      }),
    );
  });

  it("uses an existing agent-prevention promotion type for correction-style intake", async () => {
    await submitTeachAlleatoIntake({
      userId: USER_ID,
      intake: intake({
        appliesTo: "team",
        projectId: null,
        workflowCategory: "wrong_assumption_prevention",
        perceivedRiskLevel: "high",
      }),
    });

    expect(createLearningPromotionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionType: "agent_prevention_prompt",
        projectId: null,
        destinationTable: "agent_learnings",
        riskLevel: "high",
        proposedLearning: expect.objectContaining({
          proposedDestination: "agent_learnings",
          source: "admin_feedback",
          problemSignature: expect.stringContaining(
            "wrong_assumption_prevention",
          ),
          symptoms: expect.stringContaining("prevents Alleato"),
          preventionPrompt: expect.stringContaining("pay apps"),
          scopeTags: ["teach_alleato", "wrong_assumption_prevention", "team"],
          pagePath: "/ai-assistant/teach",
        }),
      }),
    );
  });

  it("stages personal teaching as private memory owned by the source user", async () => {
    await submitTeachAlleatoIntake({
      userId: USER_ID,
      intake: intake({
        appliesTo: "personal",
        projectId: null,
        workflowCategory: "communication_preference",
      }),
    });

    expect(createLearningPromotionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionType: "user_preference",
        projectId: null,
        destinationTable: "ai_memories",
        proposedLearning: expect.objectContaining({
          sourceUserId: USER_ID,
          content: expect.stringContaining("pay apps"),
          type: "preference",
          visibility: "private",
        }),
      }),
    );
  });

  it("fails loudly with the created event id when promotion creation fails", async () => {
    createLearningPromotionMock.mockRejectedValueOnce(
      new Error("ai_learning_promotions insert denied"),
    );

    await expect(
      submitTeachAlleatoIntake({
        userId: USER_ID,
        intake: intake(),
      }),
    ).rejects.toMatchObject({
      eventId: EVENT_ID,
      message: expect.stringContaining("ai_learning_promotions insert denied"),
    });

    expect(recordAiFeedbackEventMock).toHaveBeenCalledTimes(1);
    expect(createLearningPromotionMock).toHaveBeenCalledTimes(1);
  });
});
