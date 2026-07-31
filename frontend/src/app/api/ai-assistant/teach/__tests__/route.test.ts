process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { POST } from "../route";
import { submitTeachAlleatoIntake } from "@/lib/ai/services/teach-alleato-intake-service";
import { getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/ai/services/teach-alleato-intake-service", () => ({
  teachAlleatoIntakeSchema:
    jest.requireActual("@/lib/ai/services/teach-alleato-intake-service")
      .teachAlleatoIntakeSchema,
  submitTeachAlleatoIntake: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const submitTeachAlleatoIntakeMock =
  submitTeachAlleatoIntake as jest.MockedFunction<
    typeof submitTeachAlleatoIntake
  >;

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/ai-assistant/teach", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/ai-assistant/teach", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "user@example.com",
    });
    submitTeachAlleatoIntakeMock.mockResolvedValue({
      event: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      promotions: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ],
    } as Awaited<ReturnType<typeof submitTeachAlleatoIntake>>);
  });

  it("submits authenticated Teach Alleato intake", async () => {
    const response = await POST(
      request({
        whatShouldAlleatoLearn:
          "Teach Alleato to compare pay-app stored materials to the approved SOV.",
        appliesTo: "project",
        workflowCategory: "pay_app_review",
        whyThisMatters: "It prevents unsupported stored material approvals.",
        perceivedRiskLevel: "medium",
        projectId: 1009,
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      promotionIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      storedIn: {
        event: "ai_feedback_events",
        promotions: "ai_learning_promotions",
      },
    });
    expect(submitTeachAlleatoIntakeMock).toHaveBeenCalledWith({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      intake: expect.objectContaining({
        whatShouldAlleatoLearn:
          "Teach Alleato to compare pay-app stored materials to the approved SOV.",
        appliesTo: "project",
        workflowCategory: "pay_app_review",
        whyThisMatters: "It prevents unsupported stored material approvals.",
        perceivedRiskLevel: "medium",
        projectId: 1009,
      }),
    });
  });

  it("fails loudly when required fields are missing", async () => {
    const response = await POST(
      request({
        appliesTo: "project",
        workflowCategory: "pay_app_review",
        perceivedRiskLevel: "medium",
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error_code: "INVALID_PAYLOAD",
      where_it_failed: "/api/ai-assistant/teach#POST",
    });
    expect(submitTeachAlleatoIntakeMock).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    getApiRouteUserMock.mockResolvedValueOnce(null);

    const response = await POST(
      request({
        whatShouldAlleatoLearn: "Teach Alleato this workflow.",
        appliesTo: "team",
        workflowCategory: "workflow_rule",
        whyThisMatters: "The team repeats this decision weekly.",
        perceivedRiskLevel: "low",
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      error_code: "AUTH_EXPIRED",
      where_it_failed: "/api/ai-assistant/teach#POST",
    });
    expect(submitTeachAlleatoIntakeMock).not.toHaveBeenCalled();
  });
});
