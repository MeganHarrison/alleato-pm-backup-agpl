import { NextRequest } from "next/server";

import { ingestAdminFeedbackLearning } from "@/lib/ai/services/agent-learning-service";
import { recordAiFeedbackEvent } from "@/lib/ai/services/feedback-event-service";
import { serviceDb } from "@/lib/supabase/service-db";
import { requireAiLearningPromotionsAdmin } from "../_shared";
import { POST } from "../route";

jest.mock("@/lib/ai/services/agent-learning-service", () => ({
  ingestAdminFeedbackLearning: jest.fn(),
}));

jest.mock("@/lib/ai/services/feedback-event-service", () => ({
  applyAgentPreventionPromotion: jest.fn(),
  applyAttributionRulePromotion: jest.fn(),
  applyMemoryPromotion: jest.fn(),
  applyPositiveTaskExamplePromotion: jest.fn(),
  applyRetrievalWeightPromotion: jest.fn(),
  applySkillLibraryPromotion: jest.fn(),
  recordAiFeedbackEvent: jest.fn(),
  updateRetrievalWeightStatus: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: {
    from: jest.fn(),
  },
}));

jest.mock("../_shared", () => ({
  requireAiLearningPromotionsAdmin: jest.fn(),
}));

const promotionId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const correction =
  "Do not generalize this rule; verify the project source before answering.";

const candidate = {
  id: promotionId,
  status: "candidate",
  project_id: 983,
  promotion_type: "agent_prevention_prompt",
  proposed_learning: {
    title: "Always use the latest project source",
    sourceRoute: "/983/ai",
  },
  confidence: 0.76,
  risk_level: "medium",
};

function singleQuery(result: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn().mockResolvedValue(result),
  };
  return query;
}

function updateQuery(result: unknown, onUpdate: (value: unknown) => void) {
  const query = {
    update: jest.fn((value: unknown) => {
      onUpdate(value);
      return query;
    }),
    eq: jest.fn(() => query),
    select: jest.fn(() => query),
    single: jest.fn().mockResolvedValue(result),
  };
  return query;
}

function configureReviewQueries() {
  let call = 0;
  let updatePayload: unknown;
  let linkPayload: unknown;
  jest.mocked(serviceDb.from).mockImplementation(() => {
    call += 1;
    if (call === 1) {
      return singleQuery({ data: candidate, error: null }) as never;
    }
    if (call === 2) {
      return updateQuery(
        {
          data: {
            ...candidate,
            status: "rejected",
            review_notes: correction,
          },
          error: null,
        },
        (value) => {
          updatePayload = value;
        },
      ) as never;
    }
    if (call === 3) {
      return updateQuery(
        {
          data: {
            ...candidate,
            status: "rejected",
            review_notes: correction,
            destination_table: "agent_learnings",
            destination_record_id: "33333333-3333-4333-8333-333333333333",
          },
          error: null,
        },
        (value) => {
          linkPayload = value;
        },
      ) as never;
    }
    throw new Error(`Unexpected serviceDb.from call ${call}`);
  });
  return {
    readUpdatePayload: () => updatePayload,
    readLinkPayload: () => linkPayload,
  };
}

function request(reviewNotes?: string) {
  return new NextRequest("http://localhost/api/admin/ai-learning-promotions", {
    method: "POST",
    body: JSON.stringify({
      promotionId,
      action: "reject",
      reviewNotes,
    }),
  });
}

function retryRequest() {
  return new NextRequest("http://localhost/api/admin/ai-learning-promotions", {
    method: "POST",
    body: JSON.stringify({
      promotionId,
      action: "retry_feedback",
    }),
  });
}

describe("POST /api/admin/ai-learning-promotions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireAiLearningPromotionsAdmin).mockResolvedValue({
      id: adminId,
    } as never);
    jest
      .mocked(recordAiFeedbackEvent)
      .mockResolvedValue({ id: "event" } as never);
    jest
      .mocked(ingestAdminFeedbackLearning)
      .mockResolvedValue({ id: "learning" } as never);
  });

  it("requires specific corrective feedback before rejecting a candidate", async () => {
    const response = await POST(request("Too vague"));

    expect(response.status).toBe(400);
    expect(serviceDb.from).not.toHaveBeenCalled();
    expect(ingestAdminFeedbackLearning).not.toHaveBeenCalled();
  });

  it("records the rejection and activates the admin correction for future agent context", async () => {
    const { readUpdatePayload, readLinkPayload } = configureReviewQueries();

    const response = await POST(request(correction));

    expect(response.status).toBe(200);
    expect(readUpdatePayload()).toMatchObject({
      status: "rejected",
      reviewed_by: adminId,
      review_notes: correction,
    });
    expect(ingestAdminFeedbackLearning).toHaveBeenCalledWith({
      feedbackItemId: promotionId,
      title: "Rejected learning: Always use the latest project source",
      comment: correction,
      pagePath: "/983/ai",
      projectId: 983,
      status: "active",
      resolutionSummary: correction,
    });
    expect(readLinkPayload()).toEqual({
      destination_table: "agent_learnings",
      destination_record_id: "learning",
    });
  });

  it("fails loudly when the review is saved but the correction cannot be activated", async () => {
    configureReviewQueries();
    jest
      .mocked(ingestAdminFeedbackLearning)
      .mockRejectedValue(new Error("agent_learnings write failed"));

    const response = await POST(request(correction));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).toContain(
      "rejection was saved, but the corrective agent learning was not activated",
    );
    expect(JSON.stringify(body)).toContain(promotionId);
  });

  it("treats a null learning writer result as a loud partial failure", async () => {
    configureReviewQueries();
    jest.mocked(ingestAdminFeedbackLearning).mockResolvedValue(null);

    const response = await POST(request(correction));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).toContain(
      "agent learning writer returned no row",
    );
  });

  it("activates the correction and returns an explicit warning when review-event audit logging fails", async () => {
    configureReviewQueries();
    jest
      .mocked(recordAiFeedbackEvent)
      .mockRejectedValue(new Error("feedback event write failed"));

    const response = await POST(request(correction));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.auditWarning).toContain(
      "review audit event could not be recorded",
    );
    expect(ingestAdminFeedbackLearning).toHaveBeenCalled();
  });

  it("retries a saved rejected correction after the learning writer recovers", async () => {
    let call = 0;
    jest.mocked(serviceDb.from).mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return singleQuery({
          data: {
            ...candidate,
            status: "rejected",
            review_notes: correction,
          },
          error: null,
        }) as never;
      }
      if (call === 2) {
        return updateQuery(
          {
            data: {
              ...candidate,
              status: "rejected",
              review_notes: correction,
              destination_table: "agent_learnings",
              destination_record_id: "learning",
            },
            error: null,
          },
          () => undefined,
        ) as never;
      }
      throw new Error(`Unexpected serviceDb.from call ${call}`);
    });

    const response = await POST(retryRequest());

    expect(response.status).toBe(200);
    expect(ingestAdminFeedbackLearning).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackItemId: promotionId,
        comment: correction,
        status: "active",
      }),
    );
    expect(recordAiFeedbackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "learning_promotion_feedback_retried",
        signal: "corrected",
      }),
    );
  });

  it("reports an audit warning without claiming teaching failed when retry-event logging fails", async () => {
    let call = 0;
    jest.mocked(serviceDb.from).mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return singleQuery({
          data: {
            ...candidate,
            status: "rejected",
            review_notes: correction,
          },
          error: null,
        }) as never;
      }
      if (call === 2) {
        return updateQuery(
          {
            data: {
              ...candidate,
              status: "rejected",
              review_notes: correction,
              destination_table: "agent_learnings",
              destination_record_id: "learning",
            },
            error: null,
          },
          () => undefined,
        ) as never;
      }
      throw new Error(`Unexpected serviceDb.from call ${call}`);
    });
    jest
      .mocked(recordAiFeedbackEvent)
      .mockRejectedValue(new Error("feedback event write failed"));

    const response = await POST(retryRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.agentLearning.id).toBe("learning");
    expect(body.auditWarning).toContain("audit event could not be recorded");
  });
});
