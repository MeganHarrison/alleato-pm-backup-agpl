"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";

import { EmptyState, ExpandingSearch } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  TeamsConversationThread,
  type ParsedTeamsMessage,
} from "@/features/documents/teams-conversation-thread";
import type { LiveConversationSummary } from "@/app/api/teams-live/route";
import type { LiveChatMessage } from "@/app/api/teams-live/[chatId]/route";

/** ISO (UTC) from Graph → local "YYYY-MM-DD HH:MM:SS" (the thread renderer slices this). */
function toLocalStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function displayTitle(conversation: LiveConversationSummary): string {
  return conversation.title || "Teams conversation";
}

// Matches the /emails list date format ("Jun 23 4:25 PM").
function formatWhen(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeLabel = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} ${timeLabel}`;
}

function ConversationRow({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: LiveConversationSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "h-auto w-full flex-col items-stretch gap-0 rounded-none border-b border-border/40 px-3 py-2 text-left hover:bg-muted/40",
        isSelected && "border-l-2 border-l-primary bg-muted/60",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-semibold leading-4 text-foreground">
          {displayTitle(conversation)}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatWhen(conversation.lastActivity)}
        </span>
      </span>
      {conversation.preview ? (
        <span className="mt-0.5 line-clamp-1 whitespace-normal text-[11px] font-normal leading-4 text-muted-foreground">
          {conversation.preview}
        </span>
      ) : null}
    </Button>
  );
}

function ReadingPane({
  conversation,
  messages,
  isLoading,
}: {
  conversation: LiveConversationSummary | null;
  messages: ParsedTeamsMessage[];
  isLoading: boolean;
}) {
  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="Select a conversation"
          description="Choose a Teams conversation from the list to read it."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-6 pb-1 pt-5">
        <p className="text-base font-semibold text-foreground">{displayTitle(conversation)}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <p className="pt-4 text-sm text-muted-foreground">Loading conversation…</p>
        ) : (
          <TeamsConversationThread messages={messages} />
        )}
      </div>
    </div>
  );
}

export function TeamsInboxClient() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Conversation list — live from Microsoft Graph (every chat across mailboxes).
  const { data, isLoading, isError } = useQuery({
    queryKey: ["teams-live"],
    queryFn: async () =>
      apiFetch<{ conversations: LiveConversationSummary[] }>("/api/teams-live"),
    staleTime: 60_000,
  });

  const allConversations = React.useMemo(() => data?.conversations ?? [], [data]);

  const conversations = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return allConversations;
    return allConversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.participants.join(" ").toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q),
    );
  }, [allConversations, debouncedSearch]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Thread for the selected chat — fetched lazily, live from Graph.
  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ["teams-live", selectedId],
    queryFn: async () =>
      apiFetch<{ messages: LiveChatMessage[] }>(`/api/teams-live/${encodeURIComponent(selectedId!)}`),
    enabled: !!selectedId,
    staleTime: 60_000,
  });

  const messages = React.useMemo<ParsedTeamsMessage[]>(
    () =>
      (threadData?.messages ?? []).map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: toLocalStamp(m.timestamp),
      })),
    [threadData],
  );

  React.useEffect(() => {
    if (conversations.length > 0 && (!selectedId || !conversations.find((c) => c.id === selectedId))) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = conversations.findIndex((c) => c.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (idx < conversations.length - 1) setSelectedId(conversations[idx + 1].id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (idx > 0) setSelectedId(conversations[idx - 1].id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [conversations, selectedId]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="flex w-96 shrink-0 flex-col overflow-hidden border-r border-border/50">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 pb-3 pt-4">
          <p className="text-lg font-semibold text-foreground">Teams Messages</p>
          <ExpandingSearch value={search} onChange={setSearch} placeholder="Search conversations…" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading live from Microsoft Teams…</p>
          ) : isError ? (
            <p className="px-4 py-6 text-sm text-destructive">Could not reach Microsoft Teams.</p>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No conversations found.</p>
          ) : (
            conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                isSelected={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ReadingPane conversation={selected} messages={messages} isLoading={threadLoading && !!selectedId} />
      </div>
    </div>
  );
}
