"use client";

import * as React from "react";

import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import {
  ActivityFeedList,
  initials,
  type ActivityFeedItem,
} from "@/components/notifications/activity-feed";
import { Button } from "@/components/ui/button";
import { getCollaborationNotificationHref } from "@/lib/collaboration/notification-links";

function inferSourceLabel(
  item: ReturnType<
    typeof useCollaborationNotifications
  >["notifications"][number],
) {
  if (typeof item.entityType === "string" && item.entityType.trim()) {
    return item.entityType.replace(/[_-]/g, " ");
  }
  if (item.projectId) {
    return `Project ${item.projectId}`;
  }
  return "Notification";
}

/**
 * The unified notification inbox used by both the header bell and the
 * /notifications page. Reads from first-party `collaboration_notifications`
 * and renders canonical record links plus unread state.
 *
 * @param onNavigate  Called before navigating away (e.g. to close the panel).
 * @param unreadOnly  Show only unread notifications.
 */
export function AppInboxList({
  onNavigate,
  unreadOnly = false,
}: {
  onNavigate?: () => void;
  unreadOnly?: boolean;
}) {
  const {
    notifications,
    isLoading,
    error,
    hasMore,
    refetch,
    fetchMore,
    isFetchingMore,
    markAsRead,
    deleteNotification,
  } = useCollaborationNotifications({ unreadOnly });

  const items = React.useMemo<ActivityFeedItem[]>(
    () =>
      notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        href: getCollaborationNotificationHref(notification),
        createdAt: notification.createdAt,
        avatarLabel: initials(notification.title),
        sourceLabel: inferSourceLabel(notification),
        isUnread: notification.readAt === null,
        kind: notification.kind.includes("comment") ? "comment" : "project",
        onClick: () => {
          if (!notification.readAt) {
            void markAsRead(notification.id);
          }
          onNavigate?.();
        },
        onDelete: () => {
          void deleteNotification(notification.id);
        },
      })),
    [deleteNotification, markAsRead, notifications, onNavigate],
  );

  if (error && !isLoading) {
    return (
      <div
        className="flex flex-col items-center gap-3 px-4 py-8 text-center"
        role="alert"
      >
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            Notifications unavailable
          </p>
          <p className="text-xs text-muted-foreground">
            The notification service could not be reached.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ActivityFeedList
        items={items}
        isLoading={isLoading}
        emptyTitle={unreadOnly ? "You're all caught up" : "No activity yet"}
        emptyDescription="You'll be notified about comments, mentions, and project activity."
      />
      {hasMore ? (
        <div className="px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void fetchMore()}
            disabled={isFetchingMore}
            className="h-auto px-0 py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {isFetchingMore ? "Loading more" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
