import type { CollaborationNotification } from "@/hooks/use-collaboration-notifications";
import {
  getHomepageInboxSignal,
  getHomepagePrimaryAction,
  getHomepageQueueSummary,
} from "../homepage-signals";

function notification(
  overrides: Partial<CollaborationNotification> = {},
): CollaborationNotification {
  return {
    id: "4bd4b63f-4b5f-48dc-9f7a-8190580f4b0d",
    kind: "comment",
    title: "Review invoice note",
    body: "Invoice comment needs a reply.",
    metadata: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    readAt: null,
    entityType: "invoices",
    entityId: "218",
    projectId: 876,
    actorId: null,
    ...overrides,
  };
}

describe("homepage source signals", () => {
  it("keeps task work ahead of approval and notification queues", () => {
    expect(
      getHomepagePrimaryAction({
        todayTaskCount: 1,
        openTaskCount: 3,
        aiApprovalCount: 2,
        unreadNotificationCount: 4,
        firstTaskHref: "/1009/tasks",
      }),
    ).toEqual({
      title: "Open the work queue",
      meta: "Tasks, assignments, and project queues stay one click away.",
      href: "/1009/tasks",
      actionLabel: "Open tasks",
    });
  });

  it("prioritizes AI approvals before generic unread notifications", () => {
    expect(
      getHomepagePrimaryAction({
        todayTaskCount: 0,
        openTaskCount: 0,
        aiApprovalCount: 2,
        unreadNotificationCount: 4,
      }),
    ).toMatchObject({
      title: "Review waiting decisions",
      href: "/ai/approvals",
      actionLabel: "Review AI",
    });
  });

  it("uses unread notifications as a live inbox source when no task or approval is waiting", () => {
    expect(
      getHomepageQueueSummary({
        todayTaskCount: 0,
        openTaskCount: 0,
        aiApprovalCount: 0,
        unreadNotificationCount: 5,
      }),
    ).toBe("5 unread notifications waiting in the inbox.");

    expect(
      getHomepagePrimaryAction({
        todayTaskCount: 0,
        openTaskCount: 0,
        aiApprovalCount: 0,
        unreadNotificationCount: 5,
      }),
    ).toMatchObject({
      title: "Review unread notifications",
      href: "/notifications",
    });
  });

  it("builds a canonical inbox signal from the first unread notification", () => {
    const signal = getHomepageInboxSignal([notification()], false);

    expect(signal).toEqual({
      title: "Inbox priority",
      meta: "1 unread notification. First: Invoice comment needs a reply.",
      href: "/876/invoicing/218",
      actionLabel: "Review",
      count: 1,
    });
  });

  it("does not pretend inbox priority is live while notifications are still loading", () => {
    expect(getHomepageInboxSignal([], true)).toEqual({
      title: "Inbox priority",
      meta: "Checking unread collaboration notifications.",
      href: "/notifications",
      actionLabel: "Review",
      count: 0,
    });
  });
});
