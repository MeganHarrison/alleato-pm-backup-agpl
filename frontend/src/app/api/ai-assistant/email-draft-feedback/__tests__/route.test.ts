process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { POST } from "../route";
import { recordEmailDraftFeedback } from "@/lib/ai/services/feedback-event-service";
import { getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/ai/services/feedback-event-service", () => ({
  recordEmailDraftFeedback: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const recordEmailDraftFeedbackMock =
  recordEmailDraftFeedback as jest.MockedFunction<typeof recordEmailDraftFeedback>;

describe("/api/ai-assistant/email-draft-feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
    recordEmailDraftFeedbackMock.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    } as Awaited<ReturnType<typeof recordEmailDraftFeedback>>);
  });

  it("records Outlook draft feedback with the Brandon voice profile defaults", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/ai-assistant/email-draft-feedback", {
        method: "POST",
        body: JSON.stringify({
          mailboxUserId: "bclymer@alleatogroup.com",
          graphDraftMessageId: "draft-message-id",
          graphSourceMessageId: "source-message-id",
          conversationId: "conversation-id",
          subject: "RE: Brookville Road Goodwill",
          signal: "edited",
          reasonCategory: "too_formal",
          feedbackText: "Shorten this and make it sound less polished.",
          draftSnapshot: {
            body: "Original draft",
          },
          finalSnapshot: {
            body: "Edited draft",
          },
        }),
      }),
      { params: Promise.resolve({}) },
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      storedIn: "ai_feedback_events",
      voiceProfilePath: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      voiceProfileVersion: "2026-05-19",
    });
    expect(recordEmailDraftFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        mailboxUserId: "bclymer@alleatogroup.com",
        graphDraftMessageId: "draft-message-id",
        graphSourceMessageId: "source-message-id",
        conversationId: "conversation-id",
        signal: "edited",
        reasonCategory: "too_formal",
        voiceProfilePath: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
        voiceProfileVersion: "2026-05-19",
      }),
    );
  });

  it("fails loudly when the draft id is missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/ai-assistant/email-draft-feedback", {
        method: "POST",
        body: JSON.stringify({
          mailboxUserId: "bclymer@alleatogroup.com",
          signal: "good",
        }),
      }),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error_code: "INVALID_PAYLOAD",
      where_it_failed: "/api/ai-assistant/email-draft-feedback#POST",
    });
    expect(recordEmailDraftFeedbackMock).not.toHaveBeenCalled();
  });
});
