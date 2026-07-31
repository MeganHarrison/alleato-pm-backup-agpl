"use client";

import { useState } from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useTaskFeedback } from "@/hooks/use-task-feedback";
import {
  TASK_FEEDBACK_REASON_LABELS,
  TASK_FEEDBACK_REASON_CATEGORIES,
  TASK_FEEDBACK_REMOVE_CATEGORIES,
  type TaskFeedbackReasonCategory,
  type TaskSnapshot,
} from "@/lib/ai/task-feedback-types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorDetail } from "@/lib/format-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { cn } from "@/lib/utils";

interface TaskFeedbackButtonsProps {
  projectId?: number | null;
  taskId?: string | null;
  taskSnapshot: TaskSnapshot;
  sessionId?: string | null;
  className?: string;
  /** Render smaller icon buttons for dense surfaces (e.g. board cards). */
  compact?: boolean;
  /**
   * Called after the user submits bad feedback with a category that indicates
   * the task should not exist (trivial, not_actionable, duplicate, too_vague).
   * Caller should delete the task — leaving it in the inbox after this kind of
   * feedback is exactly the clutter the loop is supposed to prevent.
   *
   * `onTrivial` kept as an alias for backwards compat with existing callsites.
   */
  onRemove?: (category: TaskFeedbackReasonCategory) => void;
  /** @deprecated use onRemove — kept for backwards compat */
  onTrivial?: () => void;
}

export function TaskFeedbackButtons({
  projectId,
  taskId,
  taskSnapshot,
  sessionId,
  className,
  compact = false,
  onRemove,
  onTrivial,
}: TaskFeedbackButtonsProps) {
  const buttonSizeClass = compact ? "h-5 w-5" : "h-6 w-6";
  const iconSizeClass = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const { signal, isSubmitting, submitFeedback } = useTaskFeedback({
    projectId,
    taskId,
    taskSnapshot,
    sessionId,
  });

  const [badReasonOpen, setBadReasonOpen] = useState(false);
  const [badReasonCategory, setBadReasonCategory] =
    useState<TaskFeedbackReasonCategory | null>(null);
  const [badReason, setBadReason] = useState("");
  const [goodReasonOpen, setGoodReasonOpen] = useState(false);
  const [goodReason, setGoodReason] = useState("");

  const handleFeedbackFailure = (
    error: unknown,
    submittedSignal: "good" | "bad",
  ) => {
    const description = getErrorDetail(error);
    reportNonCriticalFailure({
      area: "task-feedback",
      operation: "record-task-feedback",
      error,
      userVisibleFallback: "Task feedback could not be recorded.",
      metadata: {
        taskId,
        projectId,
        signal: submittedSignal,
      },
    });
    toast.error("Could not record task feedback", { description });
  };

  if (signal !== null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {signal === "good" ? "Marked as good example" : "Feedback recorded"}
      </span>
    );
  }

  const handleGoodConfirm = async () => {
    setGoodReasonOpen(false);
    try {
      await submitFeedback("good", goodReason.trim() || undefined);
      toast.success("Thanks — marked as a good example.");
    } catch (err) {
      handleFeedbackFailure(err, "good");
    }
    setGoodReason("");
  };

  const handleBadConfirm = async () => {
    if (!badReasonCategory) {
      toast.error("Choose what was wrong with this task");
      return;
    }

    setBadReasonOpen(false);
    const submittedCategory = badReasonCategory;
    const removesTask = TASK_FEEDBACK_REMOVE_CATEGORIES.includes(submittedCategory);
    try {
      await submitFeedback(
        "bad",
        badReason.trim() || undefined,
        submittedCategory,
      );
      if (removesTask) {
        // Prefer the explicit onRemove handler; fall back to legacy onTrivial.
        if (onRemove) {
          onRemove(submittedCategory);
        } else if (submittedCategory === "trivial" && onTrivial) {
          onTrivial();
        }
        toast.success("Feedback saved. Removing this task from your inbox.");
      } else {
        toast.success("Feedback saved. The AI will use this to do better.");
      }
    } catch (err) {
      handleFeedbackFailure(err, "bad");
    }
    setBadReasonCategory(null);
    setBadReason("");
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={goodReasonOpen} onOpenChange={setGoodReasonOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSizeClass, "hover:text-foreground")}
            disabled={isSubmitting}
            aria-label="Mark as good example"
          >
            {isSubmitting ? (
              <Loader2 className={cn(iconSizeClass, "animate-spin")} />
            ) : (
              <ThumbsUp className={iconSizeClass} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={16} className="w-72 p-3">
          <p className="mb-2 text-sm font-medium">
            What made this a good task? (optional)
          </p>
          <Textarea
            value={goodReason}
            onChange={(e) => setGoodReason(e.target.value)}
            placeholder="Add context for the next version... (optional)"
            className="mb-2 min-h-16 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setGoodReasonOpen(false);
                setGoodReason("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleGoodConfirm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={badReasonOpen} onOpenChange={setBadReasonOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(buttonSizeClass, "hover:text-destructive")}
            disabled={isSubmitting}
            aria-label="Mark as bad example"
          >
            <ThumbsDown className={iconSizeClass} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          collisionPadding={16}
          className="w-72 p-3"
        >
          <p className="mb-2 text-sm font-medium">
            What&apos;s wrong with this task?
          </p>
          <Select
            value={badReasonCategory ?? undefined}
            onValueChange={(value) =>
              setBadReasonCategory(value as TaskFeedbackReasonCategory)
            }
          >
            <SelectTrigger className="mb-2 h-8">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {TASK_FEEDBACK_REASON_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {TASK_FEEDBACK_REASON_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={badReason}
            onChange={(e) => setBadReason(e.target.value)}
            placeholder="Add detail for the next version... (optional)"
            className="mb-2 min-h-16 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBadReasonOpen(false);
                setBadReasonCategory(null);
                setBadReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBadConfirm}
              disabled={!badReasonCategory}
            >
              Submit
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
