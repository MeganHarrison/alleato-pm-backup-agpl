/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiResponseFeedback } from "../AiResponseFeedback";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/report-non-critical-failure", () => ({
  reportNonCriticalFailure: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("AiResponseFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiFetchMock.mockResolvedValue({ success: true });
  });

  it("sends message id and Langfuse trace id with feedback", async () => {
    render(
      <AiResponseFeedback
        subject={{
          surface: "ai_assistant",
          subjectType: "assistant_message",
          subjectId: "message-1",
          messageId: "message-1",
          traceId: "abcdef1234567890abcdef1234567890",
          sessionId: "session-1",
          projectId: 1009,
          contentSnapshot: {
            text: "The generated answer.",
            model: "gpt-4.1",
          },
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Mark as good response"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/ai-assistant/feedback",
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      }),
    );

    const requestBody = JSON.parse(
      (apiFetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(requestBody).toMatchObject({
      sessionId: "session-1",
      messageId: "message-1",
      traceId: "abcdef1234567890abcdef1234567890",
      feedback: "up",
      surface: "ai_assistant",
      subjectType: "assistant_message",
      subjectId: "message-1",
      projectId: 1009,
    });
  });
});
