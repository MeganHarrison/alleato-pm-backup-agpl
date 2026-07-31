/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  AssistantMemoryTrace,
  type MemoryUsage,
} from "../memory-usage-disclosure";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/toast/app-toast";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/lib/toast/app-toast", () => ({
  appToast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const toastMock = appToast as jest.Mocked<typeof appToast>;

function memoryUsage(overrides: Partial<MemoryUsage> = {}): MemoryUsage {
  return {
    totalUsed: 2,
    recentConversationsUsed: 1,
    memories: [
      {
        id: "memory-1",
        type: "preference",
        content: "Brandon prefers executive summaries with source-linked risks.",
        projectId: 43,
        visibility: "team",
        rankingReason: "project=selected; similarity=0.81; importance=0.70",
      },
      {
        id: "memory-2",
        type: "project_context",
        content: "Westfield owner decisions should be escalated before Friday.",
      },
    ],
    ...overrides,
  };
}

describe("AssistantMemoryTrace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, "", "/ai-assistant");
    apiFetchMock.mockResolvedValue({ success: true });
  });

  it("renders a quiet memory disclosure with concise snippets", () => {
    render(
      <AssistantMemoryTrace
        usage={memoryUsage()}
        messageId="message-1"
        sessionId="session-1"
      />,
    );

    expect(screen.getByText(/used 2 memories/i)).toBeInTheDocument();
    expect(screen.getByText(/recent conversations/i)).toBeInTheDocument();
    expect(
      screen.getByText(/executive summaries with source-linked risks/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Project #43")).toBeInTheDocument();
    expect(screen.getByText("Team memory")).toBeInTheDocument();
    expect(screen.getByText(/project=selected/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review memory/i })).toHaveAttribute(
      "href",
      "/settings/memory",
    );
  });

  it("does not render when no memory usage exists", () => {
    const { container } = render(
      <AssistantMemoryTrace messageId="message-1" sessionId="session-1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("records wrong-memory feedback with assistant answer source context", async () => {
    render(
      <AssistantMemoryTrace
        usage={memoryUsage()}
        messageId="message-1"
        sessionId="session-1"
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /wrong/i })[0]);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/ai-assistant/memories/memory-1/feedback",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
    });

    const payload = JSON.parse(
      String(apiFetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(payload).toMatchObject({
      reasonCategory: "wrong",
      source: {
        surface: "assistant_answer_memory_trace",
        route: "/ai-assistant",
        messageId: "message-1",
        sessionId: "session-1",
      },
    });
    expect(toastMock.success).toHaveBeenCalledWith("Memory sent for review");
    expect(screen.getByRole("button", { name: /queued/i })).toBeDisabled();
  });

  it("shows the actionable API error when feedback cannot be recorded", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("Memory was not found."));

    render(
      <AssistantMemoryTrace
        usage={memoryUsage()}
        messageId="message-1"
        sessionId="session-1"
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /wrong/i })[0]);

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Memory was not found.");
    });
  });
});
