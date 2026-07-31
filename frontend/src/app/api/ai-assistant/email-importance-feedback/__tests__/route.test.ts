process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { DELETE, POST } from "../route";
import {
  clearEmailImportanceFeedback,
  recordEmailImportanceFeedback,
} from "@/lib/ai/services/email-importance-feedback-service";
import { getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/ai/services/email-importance-feedback-service", () => ({
  clearEmailImportanceFeedback: jest.fn(),
  getLatestEmailImportanceFeedback: jest.fn(),
  recordEmailImportanceFeedback: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const recordEmailImportanceFeedbackMock =
  recordEmailImportanceFeedback as jest.MockedFunction<
    typeof recordEmailImportanceFeedback
  >;
const clearEmailImportanceFeedbackMock =
  clearEmailImportanceFeedback as jest.MockedFunction<
    typeof clearEmailImportanceFeedback
  >;

describe("/api/ai-assistant/email-importance-feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
    recordEmailImportanceFeedbackMock.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    } as Awaited<ReturnType<typeof recordEmailImportanceFeedback>>);
    clearEmailImportanceFeedbackMock.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    } as Awaited<ReturnType<typeof clearEmailImportanceFeedback>>);
  });

  it("records an email importance reason", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/ai-assistant/email-importance-feedback",
        {
          method: "POST",
          body: JSON.stringify({
            emailId: 42,
            projectId: 876,
            signal: "not_important",
            reasonCategory: "marketing_noise",
            reason: "Vendor blast",
            emailSnapshot: { id: 42, subject: "Promo" },
          }),
        },
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(recordEmailImportanceFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        emailId: 42,
        projectId: 876,
        signal: "not_important",
        reasonCategory: "marketing_noise",
        reason: "Vendor blast",
      }),
    );
  });

  it("records a clear event when importance feedback is reverted", async () => {
    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/ai-assistant/email-importance-feedback",
        {
          method: "DELETE",
          body: JSON.stringify({
            emailId: 42,
            projectId: 876,
            emailSnapshot: { id: 42, subject: "Promo" },
          }),
        },
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      feedback: null,
    });
    expect(clearEmailImportanceFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        emailId: 42,
        projectId: 876,
      }),
    );
  });
});
