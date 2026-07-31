/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  AssistantSkillTrace,
  type SkillUsage,
} from "../skill-usage-disclosure";
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

function skillUsage(overrides: Partial<SkillUsage> = {}): SkillUsage {
  return {
    totalSelected: 1,
    selectionReason: "category, project, and keyword relevance",
    skills: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Review stored materials before pay app approval",
        slug: "review-stored-materials-before-pay-app-approval",
        category: "pay_app_review",
        scope: "project",
        projectId: 1009,
        version: 2,
        riskLevel: "medium",
        score: 120,
        reasons: ["category:pay_app_review", "selected-project"],
      },
    ],
    ...overrides,
  };
}

describe("AssistantSkillTrace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, "", "/ai");
    apiFetchMock.mockResolvedValue({ success: true });
  });

  it("renders selected skill title, version, scope, and review link", () => {
    render(
      <AssistantSkillTrace
        usage={skillUsage()}
        messageId="message-1"
        sessionId="session-1"
      />,
    );

    expect(screen.getByText(/used 1 skill/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /review stored materials before pay app approval/i,
      }),
    ).toHaveAttribute(
      "href",
      "/ai/skills?skill=review-stored-materials-before-pay-app-approval",
    );
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText(/pay app review/i)).toBeInTheDocument();
    expect(screen.getByText("Project #1009")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review skills/i })).toHaveAttribute(
      "href",
      "/ai/skills",
    );
  });

  it("does not render when no skill usage exists", () => {
    const { container } = render(
      <AssistantSkillTrace messageId="message-1" sessionId="session-1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("records wrong-skill feedback with assistant answer source context", async () => {
    render(
      <AssistantSkillTrace
        usage={skillUsage()}
        messageId="message-1"
        sessionId="session-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /wrong/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/ai-assistant/skills/cccccccc-cccc-4ccc-8ccc-cccccccccccc/feedback",
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
        surface: "assistant_answer_skill_trace",
        route: "/ai",
        messageId: "message-1",
        sessionId: "session-1",
      },
    });
    expect(toastMock.success).toHaveBeenCalledWith("Skill sent for review");
    expect(screen.getByRole("button", { name: /queued/i })).toBeDisabled();
  });

  it("shows the actionable API error when feedback cannot be recorded", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("Skill was not found."));

    render(
      <AssistantSkillTrace
        usage={skillUsage()}
        messageId="message-1"
        sessionId="session-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /wrong/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Skill was not found.");
    });
  });
});
