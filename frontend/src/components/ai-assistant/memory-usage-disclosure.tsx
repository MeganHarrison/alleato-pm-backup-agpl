"use client";

import { useState } from "react";
import Link from "next/link";
import { DatabaseIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";

export interface MemoryUsage {
  totalUsed: number;
  preferencesUsed?: number;
  relevantUsed?: number;
  teamUsed?: number;
  recentConversationsUsed?: number;
  retrieved?: {
    preferences: number;
    relevant: number;
    team: number;
  };
  memories?: Array<{
    id: string;
    type: string;
    content: string;
    projectId?: number | null;
    visibility?: string;
    similarity?: number;
    rankingScore?: number;
    rankingReason?: string;
  }>;
}

interface MemoryUsageDisclosureProps {
  usage: MemoryUsage;
  messageId: string;
  sessionId?: string;
}

interface AssistantMemoryTraceProps {
  usage?: MemoryUsage;
  messageId: string;
  sessionId?: string;
}

export function AssistantMemoryTrace({
  usage,
  messageId,
  sessionId,
}: AssistantMemoryTraceProps) {
  if (!usage) return null;

  return (
    <MemoryUsageDisclosure
      usage={usage}
      messageId={messageId}
      sessionId={sessionId}
    />
  );
}

function MemoryUsageDisclosure({
  usage,
  messageId,
  sessionId,
}: MemoryUsageDisclosureProps) {
  const [flaggingMemoryId, setFlaggingMemoryId] = useState<string | null>(null);
  const [flaggedMemoryIds, setFlaggedMemoryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const memories = usage.memories ?? [];

  const handleMarkWrong = async (memoryId: string) => {
    if (flaggingMemoryId || flaggedMemoryIds.has(memoryId)) return;
    setFlaggingMemoryId(memoryId);
    try {
      await apiFetch(`/api/ai-assistant/memories/${memoryId}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          reason:
            "This memory looked wrong or unhelpful in an assistant answer.",
          reasonCategory: "wrong",
          source: {
            surface: "assistant_answer_memory_trace",
            route:
              typeof window === "undefined"
                ? "/ai-assistant"
                : window.location.pathname,
            messageId,
            sessionId,
          },
        }),
      });
      setFlaggedMemoryIds((current) => {
        const next = new Set(current);
        next.add(memoryId);
        return next;
      });
      toast.success("Memory sent for review");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Memory feedback could not be sent. Refresh and try again.",
      );
    } finally {
      setFlaggingMemoryId(null);
    }
  };

  return (
    <details className="group mt-3 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-2 transition-colors hover:text-foreground">
        <DatabaseIcon className="h-3.5 w-3.5 shrink-0" />
        <span>
          Used {usage.totalUsed} memories
          {usage.recentConversationsUsed
            ? ` + ${usage.recentConversationsUsed} recent conversations`
            : ""}
        </span>
      </summary>
      {memories.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border/60 pl-3">
          {memories.slice(0, 3).map((memory) => (
            <div
              key={memory.id}
              className="flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-2 text-xs text-foreground/90">
                  {memory.content}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="capitalize">{memory.type.replaceAll("_", " ")}</span>
                  {memory.projectId ? <span>Project #{memory.projectId}</span> : null}
                  {memory.visibility === "team" ? <span>Team memory</span> : null}
                  {memory.rankingReason ? (
                    <span className="line-clamp-1">{memory.rankingReason}</span>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => handleMarkWrong(memory.id)}
                disabled={
                  flaggingMemoryId !== null || flaggedMemoryIds.has(memory.id)
                }
              >
                {flaggedMemoryIds.has(memory.id) ? "Queued" : "Wrong"}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-5">
        <Link
          href="/settings/memory"
          className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          Review memory
        </Link>
      </div>
    </details>
  );
}
