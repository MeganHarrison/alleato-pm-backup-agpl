"use client";

import { useEffect, useMemo, useState } from "react";

import type { AllCommentItem } from "@/app/api/comments/all/route";
import {
  cleanCommentPreview,
  documentLabel,
  matchesCurrentUser,
  matchesMention,
  sortComments,
} from "@/app/(main)/comments/comments-page-utils";
import { apiFetch } from "@/lib/api-client";
import { getCurrentBrowserUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/client";
import {
  getCommentDiscussionHref,
  getCommentFollowUpAction,
} from "@/lib/collaboration/notification-links";

export interface CommentActivityItem {
  id: string;
  annotationId: string;
  authorName: string;
  title: string;
  body: string;
  href: string;
  followUpHref?: string;
  followUpLabel?: string;
  createdAt: number | null;
  documentLabel: string;
  activityType: "mention" | "reply";
}

function getLatestMessage(comment: AllCommentItem) {
  const sortedMessages = [...comment.messages].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
  return sortedMessages.at(-1) ?? null;
}

function samePerson(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function buildCommentActivityItems(
  comments: AllCommentItem[],
  currentUserName?: string | null,
): CommentActivityItem[] {
  return [...comments]
    .sort(sortComments)
    .flatMap((comment): CommentActivityItem[] => {
      const latestMessage = getLatestMessage(comment);
      const latestAuthor = latestMessage?.authorName ?? comment.authorName;
      const mention = matchesMention(comment, currentUserName);
      const reply =
        !mention &&
        matchesCurrentUser(comment, currentUserName) &&
        comment.replyCount > 0 &&
        Boolean(
          currentUserName &&
            latestAuthor &&
            !samePerson(latestAuthor, currentUserName),
        );

      if (!mention && !reply) {
        return [];
      }

      const documentName = documentLabel(comment.documentId);
      const preview = cleanCommentPreview(latestMessage?.text ?? comment.preview);
      const authorName = latestAuthor || comment.authorName;
      const title = mention
        ? `${authorName} mentioned you`
        : `${authorName} replied in comments`;
      const followUp = reply
        ? getCommentFollowUpAction(comment.annotationId)
        : null;

      return [
        {
          id: `comment:${comment.annotationId}`,
          annotationId: comment.annotationId,
          authorName,
          title,
          body: preview,
          href: getCommentDiscussionHref(comment.documentId, comment.annotationId),
          followUpHref: followUp?.href,
          followUpLabel: followUp?.label,
          createdAt: latestMessage?.createdAt ?? comment.lastUpdated,
          documentLabel: documentName,
          activityType: mention ? "mention" : "reply",
        },
      ];
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function useCommentActivity(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [comments, setComments] = useState<AllCommentItem[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!enabled) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [commentsResponse, user] = await Promise.all([
          apiFetch<{ comments: AllCommentItem[] }>("/api/comments/all", {
            cache: "no-store",
          }),
          getCurrentBrowserUser(createClient()),
        ]);

        if (cancelled) {
          return;
        }

        setComments(commentsResponse.comments ?? []);
        setCurrentUserName(
          user?.user_metadata?.full_name ??
            user?.user_metadata?.name ??
            user?.email ??
            null,
        );
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load comment activity.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const items = useMemo(
    () => buildCommentActivityItems(comments, currentUserName),
    [comments, currentUserName],
  );

  return {
    items,
    isLoading,
    error,
  };
}
