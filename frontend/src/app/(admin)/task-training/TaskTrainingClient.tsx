"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ds/section-header";
import { EmptyState } from "@/components/ds/empty-state";
import { apiFetch } from "@/lib/api-client";
import {
  getTaskFeedbackReasonLabel,
  summarizeTaskFeedbackReasonCategories,
} from "@/lib/ai/task-feedback-types";
import type { Database } from "@/types/database.types";

type AiTaskFeedbackRow = Database["public"]["Tables"]["ai_task_feedback"]["Row"];

interface TaskSnapshot {
  name: string;
  assignee?: string | null;
  priority: string;
}

interface TaskTrainingClientProps {
  goodFeedback: AiTaskFeedbackRow[];
  badFeedback: AiTaskFeedbackRow[];
}

function getTaskSnapshot(row: AiTaskFeedbackRow): TaskSnapshot {
  const snap = row.task_snapshot as Record<string, unknown>;
  return {
    name: typeof snap?.name === "string" ? snap.name : "Unnamed task",
    assignee: typeof snap?.assignee === "string" ? snap.assignee : null,
    priority: typeof snap?.priority === "string" ? snap.priority : "normal",
  };
}

function getReasonCategoryLabel(category: string | null): string | null {
  return getTaskFeedbackReasonLabel(category);
}

function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
}

export function TaskTrainingClient({ goodFeedback, badFeedback }: TaskTrainingClientProps) {
  const [promotedState, setPromotedState] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(goodFeedback.map((row) => [row.id, row.promoted ?? false]))
  );
  const [promoting, setPromoting] = useState<Record<string, boolean>>({});
  const reasonSummaries = summarizeTaskFeedbackReasonCategories(
    badFeedback.map((row) => row.reason_category),
  );
  const learningCoverageCount = badFeedback.filter(
    (row) => row.learning_id,
  ).length;
  const learningCoverage =
    badFeedback.length > 0
      ? Math.round((learningCoverageCount / badFeedback.length) * 100)
      : 0;

  async function togglePromoted(id: string) {
    const current = promotedState[id] ?? false;
    setPromoting((prev) => ({ ...prev, [id]: true }));
    setPromotedState((prev) => ({ ...prev, [id]: !current }));

    try {
      await apiFetch("/api/ai-assistant/task-feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, promoted: !current }),
      });
    } catch (err) {
      setPromotedState((prev) => ({ ...prev, [id]: current }));
      toast.error("Failed to update promotion status");
    } finally {
      setPromoting((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <Tabs defaultValue="good" className="space-y-6">
      <TabsList>
        <TabsTrigger value="good" className="flex items-center gap-1.5">
          <ThumbsUp className="h-3.5 w-3.5" />
          Good Examples
          {goodFeedback.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {goodFeedback.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="bad" className="flex items-center gap-1.5">
          <ThumbsDown className="h-3.5 w-3.5" />
          Bad Examples
          {badFeedback.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {badFeedback.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------------------ */}
      {/* Good Examples tab                                                   */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="good" className="space-y-4">
        <div className="space-y-1">
          <SectionHeader title="Good Task Examples" count={goodFeedback.length} />
          <p className="text-sm text-muted-foreground">
            Promote examples to inject them as few-shot context when the AI creates new tasks.
          </p>
        </div>

        {goodFeedback.length === 0 ? (
          <EmptyState
            icon={<ThumbsUp className="h-8 w-8" />}
            title="No good examples yet"
            description="When users mark AI-generated tasks as good, they will appear here for promotion."
          />
        ) : (
          <div className="space-y-2">
            {goodFeedback.map((row) => {
              const snap = getTaskSnapshot(row);
              const isPromoted = promotedState[row.id] ?? false;
              const isLoading = promoting[row.id] ?? false;

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className="truncate text-sm font-medium text-foreground"
                      title={snap.name}
                    >
                      {snap.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{snap.priority} priority</span>
                      {snap.assignee && <span>{snap.assignee}</span>}
                      <span>{timeAgo(row.created_at)}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isPromoted ? "default" : "outline"}
                    disabled={isLoading}
                    onClick={() => togglePromoted(row.id)}
                    className="ml-4 shrink-0 gap-1.5"
                  >
                    {isPromoted && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {isPromoted ? "Promoted" : "Promote"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      {/* Bad Examples tab                                                    */}
      {/* ------------------------------------------------------------------ */}
      <TabsContent value="bad" className="space-y-4">
        <div className="space-y-1">
          <SectionHeader title="Bad Task Feedback" count={badFeedback.length} />
          <p className="text-sm text-muted-foreground">
            Negative signals from users. Learnings are automatically extracted and added to the AI guardrails.
          </p>
        </div>

        {badFeedback.length === 0 ? (
          <EmptyState
            icon={<ThumbsDown className="h-8 w-8" />}
            title="No bad examples yet"
            description="When users mark AI-generated tasks as unhelpful, they will appear here."
          />
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Feedback reasons
                </h3>
                <span className="text-xs text-muted-foreground">
                  {learningCoverage}% converted to learnings
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {reasonSummaries.map((summary) => (
                  <div
                    key={summary.category}
                    className="rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground">
                        {summary.label}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {summary.count}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {summary.percentage}% of bad feedback
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-2">
              {badFeedback.map((row) => {
                const snap = getTaskSnapshot(row);
                const hasLearning = !!row.learning_id;
                const reasonCategoryLabel = getReasonCategoryLabel(
                  row.reason_category,
                );

                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p
                        className="truncate text-sm font-medium text-foreground"
                        title={snap.name}
                      >
                        {snap.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {reasonCategoryLabel && (
                          <span>{reasonCategoryLabel}</span>
                        )}
                        {row.reason && (
                          <span className="italic">&ldquo;{row.reason}&rdquo;</span>
                        )}
                        <span>{timeAgo(row.created_at)}</span>
                      </div>
                    </div>

                    <div className="ml-4 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {hasLearning ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          <span className="text-primary">Learning extracted</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          <span>No learning yet</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
