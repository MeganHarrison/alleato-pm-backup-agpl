"use client";

import * as React from "react";

import { Send } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Props {
  feature: string | null;
}

export function ChatTab({ feature }: Props) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);
    setError(null);
    scrollToBottom();

    try {
      const data = await apiFetch<{ answer?: string }>("/api/procore-docs/ask", {
        method: "POST",
        body: JSON.stringify({
          query: text,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer ?? "No response received.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void send();
    }
  };

  const contextHint = feature
    ? `Asking about: ${feature.replace(/-/g, " ")}`
    : "Ask anything about Procore";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <span className="text-lg font-bold text-primary">A</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Alleato RAG Assistant</p>
              <p className="text-xs text-muted-foreground mt-0.5">{contextHint}</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 text-left max-w-xs">
              {[
                feature && `How does Procore handle ${feature.replace(/-/g, " ")}?`,
                "What fields are required in this form?",
                "What's the workflow for approving a change order?",
              ].filter(Boolean).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setDraft(q!)}
                  className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-2",
              m.role === "user" ? "flex-row-reverse" : "flex-row",
            )}
          >
            {/* Avatar */}
            <div className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              m.role === "assistant" ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground",
            )}>
              {m.role === "assistant" ? "A" : "M"}
            </div>

            {/* Bubble */}
            <div className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-[11px] leading-relaxed",
              m.role === "assistant" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
            )}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">A</div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/60 p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${feature?.replace(/-/g, " ") ?? "Procore"}… (⌘↵ to send)`}
            rows={2}
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!draft.trim() || loading}
            aria-label="Send"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
