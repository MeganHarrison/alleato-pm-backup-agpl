"use client";

import { useCallback, useEffect, useState } from "react";
import { Github } from "lucide-react";
import { Badge, EmptyState, ErrorState } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";

import type { GitHubComment } from "../types";
import { relativeTime } from "../helpers";
import { renderSimpleMarkdown } from "./markdown";

export function GitHubActivitySection({ issueNumber }: { issueNumber: number }) {
  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const data = await apiFetch<{ comments?: GitHubComment[] }>(
        `/api/admin/feedback/github-comments?issueNumber=${issueNumber}`,
      );
      setComments(data.comments ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [issueNumber]);

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setError(null);
    fetchComments();

    const interval = setInterval(fetchComments, 30_000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const isBotComment = (comment: GitHubComment) =>
    comment.user.type === "Bot" ||
    comment.user.login.endsWith("[bot]") ||
    comment.user.login === "github-actions";

  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}

      {error && <ErrorState error={error} />}

      {!loading && !error && comments.length === 0 && (
        <EmptyState
          icon={<Github />}
          title="No GitHub comments yet"
          description="Comments will appear here once the issue has activity."
        />
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2">
            <img
              src={comment.user.avatar_url}
              alt={comment.user.login}
              className="h-7 w-7 shrink-0 rounded-full mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {comment.user.login}
                </span>
                {isBotComment(comment) && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 py-0 text-xs font-medium text-status-info border-status-info/30 dark:border-status-info/50"
                  >
                    Claude Code
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {relativeTime(comment.created_at)}
                </span>
              </div>
              <div className="mt-0.5 text-foreground">
                {renderSimpleMarkdown(comment.body)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
