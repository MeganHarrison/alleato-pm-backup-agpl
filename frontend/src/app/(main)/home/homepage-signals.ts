import type { CollaborationNotification } from "@/hooks/use-collaboration-notifications";
import { getCollaborationNotificationHref } from "@/lib/collaboration/notification-links";

export type HomepagePrimaryAction = {
  title: string;
  meta: string;
  href: string;
  actionLabel: string;
};

export type HomepageInboxSignal = {
  title: string;
  meta: string;
  href: string;
  actionLabel: string;
  count: number;
};

type QueueInput = {
  todayTaskCount: number;
  openTaskCount: number;
  aiApprovalCount: number;
  unreadNotificationCount: number;
  firstTaskHref?: string | null;
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function cleanString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstUnreadNotification(
  notifications: CollaborationNotification[],
): CollaborationNotification | null {
  return notifications.find((notification) => !notification.readAt) ?? null;
}

export function getHomepageQueueSummary({
  todayTaskCount,
  openTaskCount,
  aiApprovalCount,
  unreadNotificationCount,
}: Omit<QueueInput, "firstTaskHref">): string {
  if (todayTaskCount > 0) {
    return `${pluralize(todayTaskCount, "task")} due today. ${pluralize(
      openTaskCount,
      "open task",
    )} in your feed.`;
  }

  if (openTaskCount > 0) {
    return `${pluralize(openTaskCount, "open task")} in your feed.`;
  }

  if (aiApprovalCount > 0) {
    return `${pluralize(aiApprovalCount, "AI decision")} waiting for review.`;
  }

  if (unreadNotificationCount > 0) {
    return `${pluralize(unreadNotificationCount, "unread notification")} waiting in the inbox.`;
  }

  return "No dated or assigned tasks are blocking the start of the day.";
}

export function getHomepagePrimaryAction({
  todayTaskCount,
  openTaskCount,
  aiApprovalCount,
  unreadNotificationCount,
  firstTaskHref,
}: QueueInput): HomepagePrimaryAction {
  if (todayTaskCount > 0 || openTaskCount > 0) {
    return {
      title: "Open the work queue",
      meta: "Tasks, assignments, and project queues stay one click away.",
      href: firstTaskHref ?? "/tasks",
      actionLabel: "Open tasks",
    };
  }

  if (aiApprovalCount > 0) {
    return {
      title: "Review waiting decisions",
      meta: `${pluralize(aiApprovalCount, "AI decision")} waiting for review.`,
      href: "/ai/approvals",
      actionLabel: "Review AI",
    };
  }

  if (unreadNotificationCount > 0) {
    return {
      title: "Review unread notifications",
      meta: `${pluralize(unreadNotificationCount, "unread notification")} from collaboration sources.`,
      href: "/notifications",
      actionLabel: "Review",
    };
  }

  return {
    title: "Open the work queue",
    meta: "Tasks, assignments, and project queues stay one click away.",
    href: "/tasks",
    actionLabel: "Open tasks",
  };
}

export function getHomepageInboxSignal(
  notifications: CollaborationNotification[],
  isLoading: boolean,
): HomepageInboxSignal {
  if (isLoading) {
    return {
      title: "Inbox priority",
      meta: "Checking unread collaboration notifications.",
      href: "/notifications",
      actionLabel: "Review",
      count: 0,
    };
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.readAt,
  );
  const firstUnread = firstUnreadNotification(notifications);

  if (unreadNotifications.length === 0 || !firstUnread) {
    return {
      title: "Inbox priority",
      meta: "No unread collaboration notifications.",
      href: "/notifications",
      actionLabel: "View",
      count: 0,
    };
  }

  const sourceTitle = cleanString(firstUnread.title) ?? "Untitled notification";
  const sourceBody = cleanString(firstUnread.body);

  return {
    title: "Inbox priority",
    meta: `${pluralize(
      unreadNotifications.length,
      "unread notification",
    )}. First: ${sourceBody ?? sourceTitle}`,
    href: getCollaborationNotificationHref(firstUnread),
    actionLabel: "Review",
    count: unreadNotifications.length,
  };
}
