"use client";

import * as React from "react";

import { Send } from "lucide-react";

import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  feature: string;
  content: string;
  author_name: string;
  author_email: string | null;
  mentions: string[];
  parent_id: string | null;
  resolved: boolean;
  created_at: string;
}

interface Props {
  feature: string | null;
  currentUserName?: string;
  currentUserEmail?: string;
}

const AGENT_MENTIONS = ["@Codex", "@ClaudeCode"];
const MENTION_RE = /(@[\w-]+)/g;

function renderContent(content: string) {
  // Split on @mentions, keeping the delimiter
  const parts = content.split(MENTION_RE);
  return parts.map((part, i) => {
    // Use a stable key: offset position within the string
    const key = `part-${i}-${part.slice(0, 8)}`;
    if (/^@[\w-]+$/.test(part)) {
      const isAgent = AGENT_MENTIONS.includes(part);
      return (
        <span
          key={key}
          className={cn(
            "rounded px-1 py-0.5 text-[11px] font-semibold",
            isAgent ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
          )}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function CommentsTab({ feature, currentUserName = "You", currentUserEmail }: Props) {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(() => {
    if (!feature) return;
    fetch(`/api/dev-panel/comments/${feature}`)
      .then((r) => r.json())
      .then((d: { comments: Comment[] }) => {
        setComments(d.comments ?? []);
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      })
      .catch(() => {});
  }, [feature]);

  React.useEffect(() => {
    setLoading(true);
    load();
    setLoading(false);
  }, [load]);

  // Poll every 15s for new comments
  React.useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !feature || sending) return;
    setSending(true);
    try {
      await fetch(`/api/dev-panel/comments/${feature}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: draft.trim(),
          author_name: currentUserName,
          author_email: currentUserEmail,
        }),
      });
      setDraft("");
      load();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const insertMention = (mention: string) => {
    setDraft((d) => (d ? `${d} ${mention} ` : `${mention} `));
  };

  if (!feature) return <Empty>Open a feature page to start a thread.</Empty>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}

        {!loading && comments.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground py-8">
            <p className="text-sm">No comments yet.</p>
            <p className="text-xs">Start the thread below. Use @Codex or @ClaudeCode to tag an AI agent.</p>
          </div>
        )}

        {comments.map((c) => {
          const isAgent = c.author_name === "Codex" || c.author_name === "ClaudeCode";
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-lg p-3 text-xs leading-relaxed",
                isAgent ? "bg-primary/5 border border-primary/10" : "bg-muted",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("font-semibold text-[11px]", isAgent ? "text-primary" : "text-foreground")}>
                  {c.author_name}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-foreground/90 whitespace-pre-wrap">{renderContent(c.content)}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/60 p-3">
        {/* Quick-tag buttons */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] text-muted-foreground">Tag:</span>
          {AGENT_MENTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => insertMention(m)}
              className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment… (⌘↵ to send)"
            rows={2}
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send comment"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
