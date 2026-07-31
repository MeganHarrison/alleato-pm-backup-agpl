"use client";

/**
 * Generic feedback control for any AI-generated *response* surface — chat
 * messages, insight narratives, daily digests, executive briefs, etc.
 *
 * Mirrors the rich UX of `TaskFeedbackButtons` (thumbs + reason picker + toast)
 * but is generic across surfaces. Writes to `ai_feedback_events` and triggers
 * `agent_learnings` extraction via `/api/ai-assistant/feedback`.
 *
 * For task-specific feedback use `TaskFeedbackButtons` — it owns task auto-
 * removal logic and the task-specific reason categories.
 */

import { useState } from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

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
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { cn } from "@/lib/utils";
import {
  AI_RESPONSE_FEEDBACK_REASON_CATEGORIES,
  AI_RESPONSE_FEEDBACK_REASON_LABELS,
  type AiResponseFeedbackReasonCategory,
  type AiResponseFeedbackSubject,
} from "@/lib/ai/response-feedback-types";

export type AiResponseFeedbackSignal = "up" | "down";

interface AiResponseFeedbackProps {
  /** Describes the AI content being rated. */
  subject: AiResponseFeedbackSubject;
  /** Optional callback fired after feedback is successfully recorded. */
  onSubmitted?: (signal: AiResponseFeedbackSignal) => void;
  className?: string;
  /**
   * Visual size variant.
   * - "icon" (default): small icon-only buttons for inline use in message actions.
   * - "compact": labeled buttons for use in card footers.
   */
  size?: "icon" | "compact";
}

export function AiResponseFeedback({
  subject,
  onSubmitted,
  className,
  size = "icon",
}: AiResponseFeedbackProps) {
  const [signal, setSignal] = useState<AiResponseFeedbackSignal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [badReasonOpen, setBadReasonOpen] = useState(false);
  const [badReasonCategory, setBadReasonCategory] =
    useState<AiResponseFeedbackReasonCategory | null>(null);
  const [badReason, setBadReason] = useState("");

  const submit = async (
    submittedSignal: AiResponseFeedbackSignal,
    reasonCategory?: AiResponseFeedbackReasonCategory | null,
    reason?: string,
  ) => {
    if (isSubmitting || signal) return;
    setIsSubmitting(true);
    try {
      await apiFetch("/api/ai-assistant/feedback", {
        method: "POST",
        body: JSON.stringify({
          sessionId: subject.sessionId ?? null,
          messageId: subject.messageId ?? subject.subjectId ?? null,
          traceId: subject.traceId ?? null,
          feedback: submittedSignal,
          surface: subject.surface,
          subjectType: subject.subjectType,
          subjectId: subject.subjectId ?? null,
          projectId: subject.projectId ?? null,
          reasonCategory: reasonCategory ?? null,
          reason: reason ?? null,
          messageContent: subject.contentSnapshot.text.slice(0, 500),
          contentSnapshot: subject.contentSnapshot,
        }),
      });
      setSignal(submittedSignal);
      if (submittedSignal === "up") {
        toast.success("Thanks — marked as a good response.");
      } else {
        toast.success("Feedback saved. The AI will use this to do better.");
      }
      onSubmitted?.(submittedSignal);
    } catch (err) {
      reportNonCriticalFailure({
        area: "ai-response-feedback",
        operation: "record-feedback",
        error: err,
        userVisibleFallback: "Feedback could not be recorded.",
        metadata: {
          surface: subject.surface,
          subjectId: subject.subjectId,
          signal: submittedSignal,
        },
      });
      toast.error("Could not record feedback", {
        description: getErrorDetail(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (signal !== null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {signal === "up" ? "Marked as good" : "Feedback recorded"}
      </span>
    );
  }

  const iconClass = size === "compact" ? "h-4 w-4" : "h-3.5 w-3.5";
  const buttonClass = size === "compact" ? "h-7 gap-1.5 text-xs" : "h-6 w-6";

  const handleBadConfirm = async () => {
    if (!badReasonCategory) {
      toast.error("Choose what was wrong with this response");
      return;
    }
    setBadReasonOpen(false);
    const submittedCategory = badReasonCategory;
    await submit("down", submittedCategory, badReason.trim() || undefined);
    setBadReasonCategory(null);
    setBadReason("");
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size={size === "compact" ? "sm" : "icon"}
        className={cn(buttonClass, "hover:text-foreground")}
        disabled={isSubmitting}
        onClick={() => submit("up")}
        aria-label="Mark as good response"
      >
        {isSubmitting ? (
          <Loader2 className={cn(iconClass, "animate-spin")} />
        ) : (
          <ThumbsUp className={iconClass} />
        )}
        {size === "compact" && <span>Good</span>}
      </Button>

      <Popover open={badReasonOpen} onOpenChange={setBadReasonOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size={size === "compact" ? "sm" : "icon"}
            className={cn(buttonClass, "hover:text-destructive")}
            disabled={isSubmitting}
            aria-label="Mark as poor response"
          >
            <ThumbsDown className={iconClass} />
            {size === "compact" && <span>Poor</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={16} className="w-72 p-3">
          <p className="mb-2 text-sm font-medium">
            What&apos;s wrong with this response?
          </p>
          <Select
            value={badReasonCategory ?? undefined}
            onValueChange={(value) =>
              setBadReasonCategory(value as AiResponseFeedbackReasonCategory)
            }
          >
            <SelectTrigger className="mb-2 h-8">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {AI_RESPONSE_FEEDBACK_REASON_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {AI_RESPONSE_FEEDBACK_REASON_LABELS[category]}
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
