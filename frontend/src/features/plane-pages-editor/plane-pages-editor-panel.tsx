/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-31. See PLANE-NOTICE.md.
 */

"use client";

import * as React from "react";
import { Check, History, MessageSquare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { PlanePageComment, PlanePageVersion } from "./types";

export type PlanePageSidePanel = "comments" | "history";

interface PlanePagesEditorPanelProps {
  mode: PlanePageSidePanel;
  comments: PlanePageComment[];
  versions: PlanePageVersion[];
  isWorking: boolean;
  onModeChange: (mode: PlanePageSidePanel) => void;
  onClose: () => void;
  onComment: (body: string) => Promise<boolean>;
  onResolveComment: (commentId: string) => void;
  onRestoreVersion: (versionId: string) => void;
}

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function PlanePagesEditorPanel({
  mode,
  comments,
  versions,
  isWorking,
  onModeChange,
  onClose,
  onComment,
  onResolveComment,
  onRestoreVersion,
}: PlanePagesEditorPanelProps) {
  const [commentBody, setCommentBody] = React.useState("");

  return (
    <aside className="absolute inset-0 z-20 flex min-h-0 flex-col bg-background md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 md:border-l md:border-border">
      <div className="flex min-h-14 items-center gap-1 px-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            mode === "comments" && "bg-muted text-foreground",
          )}
          onClick={() => onModeChange("comments")}
        >
          <MessageSquare className="size-4" />
          Comments
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            mode === "history" && "bg-muted text-foreground",
          )}
          onClick={() => onModeChange("history")}
        >
          <History className="size-4" />
          History
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-md"
          aria-label="Close page panel"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {mode === "comments" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No comments yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {comments.map((comment) => (
                  <article key={comment.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {comment.authorName}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {comment.body}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatTimestamp(comment.createdAt)}
                        </p>
                      </div>
                      {comment.resolvedAt ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="size-3.5" />
                          Resolved
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isWorking}
                          onClick={() => onResolveComment(comment.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <form
            className="space-y-2 border-t border-border p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onComment(commentBody)) setCommentBody("");
            }}
          >
            <Textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Add a comment"
              aria-label="New comment"
              className="min-h-24"
              onKeyDown={async (event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  if (await onComment(commentBody)) setCommentBody("");
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={isWorking || !commentBody.trim()}
              >
                Comment
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Versions appear after the first save.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {versions.map((version) => (
                <article
                  key={version.id}
                  className="flex items-start justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {version.title || "Untitled"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTimestamp(version.createdAt)}
                      {version.createdBy ? ` by ${version.createdBy}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isWorking}
                    onClick={() => onRestoreVersion(version.id)}
                  >
                    Restore
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
