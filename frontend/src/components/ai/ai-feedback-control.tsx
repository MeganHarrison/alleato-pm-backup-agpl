"use client";

import * as React from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PopoverAnchor,
  Popover,
  PopoverContent,
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

/** A reason chip the user can pick when marking AI output as unhelpful. */
export interface AiFeedbackReason {
  id: string;
  label: string;
}

/** Generic reasons that fit narrative AI surfaces (briefs, reports, summaries). */
export const DEFAULT_AI_FEEDBACK_REASONS: AiFeedbackReason[] = [
  { id: "inaccurate", label: "Inaccurate" },
  { id: "missing_context", label: "Missing context" },
  { id: "not_relevant", label: "Not relevant" },
  { id: "too_vague", label: "Too vague" },
  { id: "wrong_emphasis", label: "Wrong emphasis" },
];

type Submitted = "up" | "down" | null;
type PendingFeedback = "up" | "down" | null;

/**
 * Thumbs up / down control for any AI-generated surface. Posts to the shared
 * `/api/ai-assistant/feedback` endpoint, which records an `ai_feedback_events`
 * row and, on a categorized thumbs-down, an `agent_learnings` row scoped to
 * `surface` — picked up by that surface's generator via `getSurfaceScopedLearnings`.
 *
 * Thumbs-down opens a reason picker, because a reason category is what activates
 * the learning (uncategorized negatives stay candidates and are not injected).
 */
export function AiFeedbackControl({
  surface,
  subjectType,
  subjectId = null,
  projectId = null,
  contentText,
  contentSnapshot,
  reasons = DEFAULT_AI_FEEDBACK_REASONS,
  positiveReasons,
  collectReasonFor = "down",
  reasonInputMode = "quick-pick",
  reasonPrompt = "What was off?",
  freeTextLabel = "Additional context",
  freeTextPlaceholder = "Optional note",
  submitLabel = "Submit feedback",
  className,
}: {
  surface: string;
  subjectType: string;
  subjectId?: string | null;
  projectId?: number | null;
  /** The AI text being rated — used to extract keywords for the learning. */
  contentText?: string;
  contentSnapshot?: Record<string, unknown>;
  reasons?: AiFeedbackReason[];
  positiveReasons?: AiFeedbackReason[];
  collectReasonFor?: "down" | "both";
  reasonInputMode?: "quick-pick" | "form";
  reasonPrompt?: string;
  freeTextLabel?: string;
  freeTextPlaceholder?: string;
  submitLabel?: string;
  className?: string;
}) {
  const [submitted, setSubmitted] = React.useState<Submitted>(null);
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const [pendingFeedback, setPendingFeedback] =
    React.useState<PendingFeedback>(null);
  const [selectedReasonId, setSelectedReasonId] = React.useState<string>("");
  const [freeText, setFreeText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const activeReasons = React.useMemo(
    () => (pendingFeedback === "up" ? positiveReasons ?? [] : reasons),
    [pendingFeedback, positiveReasons, reasons],
  );
  const selectedReason =
    activeReasons.find((reason) => reason.id === selectedReasonId) ?? null;
  const shouldOpenFormForUp =
    collectReasonFor === "both" && (positiveReasons?.length ?? 0) > 0;
  const usesFormMode = reasonInputMode === "form";

  async function send(
    feedback: "up" | "down",
    reasonCategory?: string,
    reason?: string,
  ) {
    setSaving(true);
    try {
      await apiFetch("/api/ai-assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback,
          surface,
          subjectType,
          subjectId,
          projectId,
          reasonCategory: reasonCategory ?? null,
          reason: reason ?? null,
          messageContent: contentText?.slice(0, 2000) ?? null,
          contentSnapshot: contentSnapshot ?? null,
        }),
      });
      setSubmitted(feedback);
      setReasonOpen(false);
      setPendingFeedback(null);
      setSelectedReasonId("");
      setFreeText("");
      toast.success(
        feedback === "up"
          ? "Thanks — logged as helpful."
          : "Thanks — the AI will adjust next time.",
      );
    } catch (error) {
      toast.error("Couldn't record feedback.", {
        description:
          error instanceof Error ? error.message : "Unknown feedback error.",
      });
    } finally {
      setSaving(false);
    }
  }

  function openReasonForm(feedback: "up" | "down") {
    setPendingFeedback(feedback);
    setSelectedReasonId("");
    setFreeText("");
    setReasonOpen(true);
  }

  function handlePositiveClick() {
    if (shouldOpenFormForUp) {
      openReasonForm("up");
      return;
    }
    void send("up");
  }

  function handleNegativeClick() {
    if (!usesFormMode) {
      setPendingFeedback("down");
      setReasonOpen(true);
      return;
    }
    openReasonForm("down");
  }

  function handleSubmit() {
    if (!pendingFeedback || saving) return;
    void send(
      pendingFeedback,
      selectedReason?.id ?? undefined,
      freeText.trim() || selectedReason?.label || undefined,
    );
  }

  return (
    <Popover open={reasonOpen} onOpenChange={setReasonOpen}>
      <PopoverAnchor asChild>
        <div className={cn("flex items-center gap-0.5", className)}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={saving}
            aria-label="Helpful"
            title="Helpful"
            className={cn(
              "size-5 text-muted-foreground hover:bg-transparent hover:text-foreground",
              submitted === "up" && "text-primary",
            )}
            onClick={handlePositiveClick}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={saving}
            aria-label="Not helpful"
            title="Not helpful"
            className={cn(
              "size-5 text-muted-foreground hover:bg-transparent hover:text-foreground",
              submitted === "down" && "text-destructive",
            )}
            onClick={handleNegativeClick}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverAnchor>

      {usesFormMode ? (
        <PopoverContent className="w-72 space-y-3 p-3" align="end">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {pendingFeedback === "up" ? "Helpful feedback" : "Not helpful"}
            </p>
            <p className="text-xs text-muted-foreground">{reasonPrompt}</p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor={`${surface}-${subjectType}-${subjectId ?? "feedback"}-reason`}
              className="text-[11px] font-medium text-muted-foreground"
            >
              Reason
            </Label>
            <Select
              value={selectedReasonId}
              onValueChange={setSelectedReasonId}
              disabled={saving}
            >
              <SelectTrigger
                id={`${surface}-${subjectType}-${subjectId ?? "feedback"}-reason`}
                className="h-8 text-xs"
              >
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {activeReasons.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">
              {freeTextLabel}
            </Label>
            <Textarea
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder={freeTextPlaceholder}
              className="min-h-24 resize-none text-xs"
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setReasonOpen(false);
                setPendingFeedback(null);
                setSelectedReasonId("");
                setFreeText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !selectedReasonId}
              onClick={handleSubmit}
            >
              {submitLabel}
            </Button>
          </div>
        </PopoverContent>
      ) : (
        <PopoverContent className="w-52 p-2" align="end">
          <p className="px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">
            {reasonPrompt}
          </p>
          <div className="flex flex-col gap-0.5">
            {reasons.map((reason) => (
              <Button
                key={reason.id}
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => void send("down", reason.id, reason.label)}
                className="h-auto w-full justify-start px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {reason.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
