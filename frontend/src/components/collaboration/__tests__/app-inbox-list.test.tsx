/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import { AppInboxList } from "../app-inbox-list";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/hooks/use-collaboration-notifications", () => ({
  useCollaborationNotifications: jest.fn(),
}));

const useNotificationsMock =
  useCollaborationNotifications as jest.MockedFunction<
    typeof useCollaborationNotifications
  >;

function hookResult(
  overrides: Partial<ReturnType<typeof useCollaborationNotifications>> = {},
): ReturnType<typeof useCollaborationNotifications> {
  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    isFetchingMore: false,
    error: null,
    hasMore: false,
    refetch: jest.fn().mockResolvedValue(undefined),
    fetchMore: jest.fn().mockResolvedValue(undefined),
    markAsRead: jest.fn().mockResolvedValue(undefined),
    markReviewed: jest.fn().mockResolvedValue(undefined),
    confirmAiChangeEvent: jest.fn().mockResolvedValue(undefined),
    markAllAsRead: jest.fn().mockResolvedValue(undefined),
    deleteNotification: jest.fn().mockResolvedValue(undefined),
    deleteAll: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AppInboxList", () => {
  it("renders first-party notifications and marks unread rows as read", () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);
    useNotificationsMock.mockReturnValue(
      hookResult({
        markAsRead,
        notifications: [
          {
            id: "76af4e4c-52da-4a44-a49a-e878ca729f82",
            kind: "comment_mention",
            title: "Megan mentioned you",
            body: "Please review this drawing.",
            metadata: null,
            createdAt: "2026-07-13T12:00:00.000Z",
            readAt: null,
            entityType: "drawings",
            entityId: "drawing-42",
            projectId: 67,
            actorId: null,
          },
        ],
      }),
    );

    render(<AppInboxList />);

    fireEvent.click(screen.getByRole("link", { name: /Megan mentioned you/i }));
    expect(markAsRead).toHaveBeenCalledWith(
      "76af4e4c-52da-4a44-a49a-e878ca729f82",
    );
  });

  it("fails loudly and lets the user retry", () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    useNotificationsMock.mockReturnValue(
      hookResult({ error: "Request failed", refetch }),
    );

    render(<AppInboxList />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Notifications unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
