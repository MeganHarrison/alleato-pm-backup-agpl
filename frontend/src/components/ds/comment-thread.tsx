"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface Comment {
  id: string;
  author: string;
  initials: string;
  body: string;
  timestamp: string;
  isCurrentUser?: boolean;
}

interface CommentThreadProps {
  comments: Comment[];
  onSubmit?: (body: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  currentUserInitials?: string;
}

export function CommentThread({
  comments,
  onSubmit,
  placeholder = "Add a comment...",
  className,
  currentUserInitials = "ME",
}: CommentThreadProps) {
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(body.trim());
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {comments.length > 0 && (
        <ul className="divide-y divide-border/60">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      )}

      {onSubmit && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Avatar initials={currentUserInitials} />
          <div className="min-w-0 flex-1 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="resize-none border-border/70 text-sm shadow-none"
            />
            {body.trim() && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBody("")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
                  {submitting ? "Saving..." : "Comment"}
                </Button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <Avatar initials={comment.initials} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{comment.author}</span>
          <time className="text-xs text-muted-foreground">{comment.timestamp}</time>
        </div>
        <p className="mt-1 text-sm text-foreground/90 leading-relaxed">{comment.body}</p>
      </div>
    </li>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
      {initials}
    </div>
  );
}
