/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactNode } from "react";

import type { CollaborationNotification } from "@/hooks/use-collaboration-notifications";
import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import AiApprovalsPage from "../page";

jest.mock("@/components/layout", () => ({
  PageShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

jest.mock("@/components/layout/spacing", () => ({
  SectionRuleHeading: ({ label }: { label: string }) => <div>{label}</div>,
}));

jest.mock("@/hooks/use-collaboration-notifications", () => ({
  useCollaborationNotifications: jest.fn(),
}));

const mockUseCollaborationNotifications =
  useCollaborationNotifications as jest.MockedFunction<
    typeof useCollaborationNotifications
  >;

function notification(
  overrides: Partial<CollaborationNotification> = {},
): CollaborationNotification {
  return {
    id: "decision-1",
    kind: "ai_notification_decision",
    title: "Change event draft",
    body: "Review generated change event",
    createdAt: "2026-06-26T12:00:00.000Z",
    readAt: null,
    entityType: "change_events",
    entityId: "ce-1",
    projectId: 25125,
    actorId: null,
    metadata: {
      eventType: "ai_change_event_awaiting_approval",
      requiredAction: "Review before commit.",
      reason: "AI generated a record preview.",
      preview: {
        table: "change_events",
        fields: {
          title: "Electrical change",
          start_date: "2026-07-01",
          line_items: [{ description: "Rough-in", amount: 12500 }],
          scope: "Owner requested change",
        },
      },
    },
    ...overrides,
  };
}

describe("AiApprovalsPage", () => {
  it("filters to AI approval decisions and gates review completion checks", () => {
    const markReviewed = jest.fn();
    const confirmAiChangeEvent = jest.fn();
    const deleteNotification = jest.fn();

    mockUseCollaborationNotifications.mockReturnValue({
      notifications: [
        notification(),
        notification({
          id: "routine-memory",
          title: "Memory updated",
          metadata: { eventType: "ai_memory_updated" },
        }),
      ],
      unreadCount: 1,
      isLoading: false,
      isFetchingMore: false,
      error: null,
      hasMore: false,
      fetchMore: jest.fn(),
      markAsRead: jest.fn(),
      markReviewed,
      confirmAiChangeEvent,
      markAllAsRead: jest.fn(),
      deleteNotification,
      deleteAll: jest.fn(),
    });

    render(<AiApprovalsPage />);

    expect(screen.getByText("Change event draft")).toBeInTheDocument();
    expect(screen.queryByText("Memory updated")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Route: interrupt · approvals queue, in app, assistant widget",
      ),
    ).toBeInTheDocument();

    const markReviewedButton = screen.getByRole("button", {
      name: "Mark reviewed",
    });
    expect(markReviewedButton).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText("Generated fields match the intended record."),
    );
    fireEvent.click(screen.getByLabelText("Dates are correct."));
    fireEvent.click(
      screen.getByLabelText("Line items and totals are correct."),
    );
    fireEvent.click(
      screen.getByLabelText("Scope and revenue assumptions are correct."),
    );

    expect(markReviewedButton).toBeEnabled();
    fireEvent.click(markReviewedButton);

    expect(markReviewed).toHaveBeenCalledWith("decision-1", {
      checkedIds: [
        "generated-fields",
        "dates",
        "line-items",
        "scope-revenue",
      ],
      checkedLabels: [
        "Generated fields match the intended record.",
        "Dates are correct.",
        "Line items and totals are correct.",
        "Scope and revenue assumptions are correct.",
      ],
    });
  });

  it("confirms a change-event preview after review checks are complete", () => {
    const markReviewed = jest.fn();
    const confirmAiChangeEvent = jest.fn();
    const deleteNotification = jest.fn();

    mockUseCollaborationNotifications.mockReturnValue({
      notifications: [notification()],
      unreadCount: 1,
      isLoading: false,
      isFetchingMore: false,
      error: null,
      hasMore: false,
      fetchMore: jest.fn(),
      markAsRead: jest.fn(),
      markReviewed,
      confirmAiChangeEvent,
      markAllAsRead: jest.fn(),
      deleteNotification,
      deleteAll: jest.fn(),
    });

    render(<AiApprovalsPage />);

    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText("Generated fields match the intended record."),
    );
    fireEvent.click(screen.getByLabelText("Dates are correct."));
    fireEvent.click(
      screen.getByLabelText("Line items and totals are correct."),
    );
    fireEvent.click(
      screen.getByLabelText("Scope and revenue assumptions are correct."),
    );

    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    expect(confirmAiChangeEvent).toHaveBeenCalledWith("decision-1", {
      checkedIds: [
        "generated-fields",
        "dates",
        "line-items",
        "scope-revenue",
      ],
      checkedLabels: [
        "Generated fields match the intended record.",
        "Dates are correct.",
        "Line items and totals are correct.",
        "Scope and revenue assumptions are correct.",
      ],
    });
    expect(markReviewed).not.toHaveBeenCalled();
  });
});
