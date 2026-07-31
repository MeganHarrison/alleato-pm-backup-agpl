"use client";

import { createClient } from "@/lib/supabase/client";
import { getCurrentBrowserUser } from "@/lib/supabase/current-user";
import { apiFetch } from "@/lib/api-client";
import type { Json } from "@/types/database.types";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

export interface CollaborationNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  metadata: Json | null;
  createdAt: string;
  readAt: string | null;
  entityType: string | null;
  entityId: string | null;
  projectId: number | null;
  /** The user who triggered this notification. Null for system/automated notices. */
  actorId: string | null;
}

interface NotificationsResponse {
  notifications: CollaborationNotification[];
  unreadCount: number;
  hasMore: boolean;
}

export type NotificationReviewPayload = {
  checkedIds?: string[];
  checkedLabels?: string[];
};

const PAGE_SIZE = 25;

export function collaborationNotificationChannelName(
  userId: string,
  instanceId: string,
): string {
  const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `notifications:${userId}:${safeInstanceId}`;
}

type UseCollaborationNotificationsOptions = {
  enabled?: boolean;
  kind?: string;
  projectId?: number | null;
  unreadOnly?: boolean;
  limit?: number;
};

export function useCollaborationNotifications(
  options?: UseCollaborationNotificationsOptions,
) {
  const subscriptionInstanceId = useId();
  const enabled = options?.enabled ?? true;
  const [notifications, setNotifications] = useState<
    CollaborationNotification[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const baseQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(options?.limit ?? PAGE_SIZE),
    });
    if (options?.kind) {
      params.set("kind", options.kind);
    }
    if (options?.projectId) {
      params.set("projectId", String(options.projectId));
    }
    if (options?.unreadOnly) {
      params.set("unreadOnly", "true");
    }
    return params;
  }, [options?.kind, options?.limit, options?.projectId, options?.unreadOnly]);

  const fetchPage = useCallback(
    async ({
      append,
      cursorValue,
    }: {
      append: boolean;
      cursorValue?: string | null;
    }) => {
      const params = new URLSearchParams(baseQuery);
      if (cursorValue) {
        params.set("cursor", cursorValue);
      }

      const data = await apiFetch<NotificationsResponse>(
        `/api/collaboration/notifications?${params.toString()}`,
        { cache: "no-store" },
      );
      setError(null);
      setNotifications((prev) =>
        append
          ? [...prev, ...(data.notifications ?? [])]
          : (data.notifications ?? []),
      );
      setUnreadCount(data.unreadCount ?? 0);
      setHasMore(Boolean(data.hasMore));

      const nextCursor = data.notifications?.at(-1)?.createdAt ?? null;
      setCursor(nextCursor);
    },
    [baseQuery],
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!enabled) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const supabase = createClient();
        const user = await getCurrentBrowserUser(supabase);
        if (!cancelled) {
          setUserId(user?.id ?? null);
        }

        await fetchPage({ append: false, cursorValue: null });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to load collaboration notifications.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchPage]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(
        collaborationNotificationChannelName(userId, subscriptionInstanceId),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collaboration_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchPage({ append: false, cursorValue: null });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchPage, subscriptionInstanceId]);

  const fetchMore = useCallback(async () => {
    if (!hasMore || !cursor || isFetchingMore) return;

    setIsFetchingMore(true);
    try {
      await fetchPage({ append: true, cursorValue: cursor });
    } finally {
      setIsFetchingMore(false);
    }
  }, [hasMore, cursor, isFetchingMore, fetchPage]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchPage({ append: false, cursorValue: null });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load collaboration notifications.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage]);

  const mutate = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        await apiFetch("/api/collaboration/notifications", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        await fetchPage({ append: false, cursorValue: null });
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to update collaboration notification.";
        setError(message);
        throw err;
      }
    },
    [fetchPage],
  );

  const markAsRead = useCallback(
    (id: string) => mutate({ action: "mark-read", id }),
    [mutate],
  );
  const markReviewed = useCallback(
    (id: string, review?: NotificationReviewPayload) =>
      mutate({ action: "mark-reviewed", id, review }),
    [mutate],
  );
  const confirmAiChangeEvent = useCallback(
    (id: string, review?: NotificationReviewPayload) =>
      mutate({ action: "confirm-ai-change-event", id, review }),
    [mutate],
  );
  const markAllAsRead = useCallback(
    () => mutate({ action: "mark-all-read" }),
    [mutate],
  );
  const deleteNotification = useCallback(
    (id: string) => mutate({ action: "delete", id }),
    [mutate],
  );
  const deleteAll = useCallback(
    () => mutate({ action: "delete-all" }),
    [mutate],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    isFetchingMore,
    error,
    hasMore,
    refetch,
    fetchMore,
    markAsRead,
    markReviewed,
    confirmAiChangeEvent,
    markAllAsRead,
    deleteNotification,
    deleteAll,
  };
}
