"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InfoAlert, Label, Textarea } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";

export type ReviewDecision = "approved" | "rejected" | "changes_requested";

const APPROVAL_CONFIRMATION_NOTE =
  "Candidate exactly matches the authoritative source.";

const decisionOptions: Array<{
  value: ReviewDecision;
  title: string;
  description: string;
  selectedClassName: string;
  radioClassName: string;
}> = [
  {
    value: "approved",
    title: "Approved",
    description: "Candidate exactly matches the source",
    selectedClassName:
      "border-success-border bg-success-surface ring-1 ring-success-border",
    radioClassName: "accent-success",
  },
  {
    value: "changes_requested",
    title: "Needs changes",
    description: "Minor discrepancies to fix",
    selectedClassName:
      "border-warning-border bg-warning-surface ring-1 ring-warning-border",
    radioClassName: "accent-warning",
  },
  {
    value: "rejected",
    title: "Rejected",
    description: "Does not match the source",
    selectedClassName:
      "border-destructive-border bg-destructive-surface ring-1 ring-destructive-border",
    radioClassName: "accent-destructive",
  },
];

export function FmdsVisualReviewForm({
  sourceType,
  sourceId,
  evidencePath,
  candidateIds,
  canApprove,
  approvalBlockedReason,
  initialDecision = null,
  initialNotes = "",
}: {
  sourceType: "table" | "figure";
  sourceId: string;
  evidencePath: string | null;
  candidateIds: string[];
  canApprove: boolean;
  approvalBlockedReason?: string;
  initialDecision?: ReviewDecision | null;
  initialNotes?: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<ReviewDecision | null>(
    initialDecision,
  );
  const [notes, setNotes] = useState(
    initialDecision === "approved"
      ? APPROVAL_CONFIRMATION_NOTE
      : initialNotes,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!decision) {
      setMessage("Select a review decision before saving.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(`/api/fmds/${sourceType}s/${sourceId}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          notes,
          evidencePaths: evidencePath ? [evidencePath] : [],
          candidateIds,
        }),
      });
      setMessage("Review saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save review.",
      );
    } finally {
      setSaving(false);
    }
  }

  const noun = sourceType === "table" ? "table" : "figure";
  const reviewNotesRequired =
    decision === "changes_requested" || decision === "rejected";
  const saveBlockedReason = !evidencePath
    ? "Review is blocked until source evidence is available."
    : !decision
      ? "Select a decision to save."
      : decision === "approved" && !canApprove
        ? (approvalBlockedReason ??
          `Approved is unavailable because this ${noun} has no candidate to compare with the source.`)
        : reviewNotesRequired && notes.trim().length < 10
          ? "Add at least 10 characters of review notes."
          : null;

  function selectDecision(value: ReviewDecision) {
    setDecision(value);
    setMessage(null);
    if (value === "approved") {
      setNotes(APPROVAL_CONFIRMATION_NOTE);
      return;
    }
    setNotes((current) =>
      current === APPROVAL_CONFIRMATION_NOTE ? "" : current,
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <fieldset className="min-w-0 space-y-3">
          <legend className="sr-only">Review decision</legend>
          {decisionOptions.map((option) => {
            const isSelected = decision === option.value;
            const isDisabled = option.value === "approved" && !canApprove;

            return (
              <label
                key={option.value}
                className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                  isSelected
                    ? option.selectedClassName
                    : "border-border bg-card hover:bg-muted/50"
                } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name={`fmds-${noun}-review-decision`}
                  value={option.value}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => selectDecision(option.value)}
                  className={`mt-0.5 size-4 shrink-0 focus-visible:outline-none ${option.radioClassName}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}

          {!canApprove ? (
            <InfoAlert variant="warning" role="alert">
              {approvalBlockedReason ??
                `Approved is unavailable because this ${noun} has no candidate to compare with the source.`}
            </InfoAlert>
          ) : null}
        </fieldset>

        {decision !== "approved" ? (
          <div className="min-w-0">
            {reviewNotesRequired ? (
              <div className="space-y-2">
                <Label htmlFor={`fmds-${noun}-review-notes`}>
                  Review notes <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  State exactly what is missing, incorrect, or requires
                  follow-up.
                </p>
                <Textarea
                  id={`fmds-${noun}-review-notes`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Describe the discrepancy in at least 10 characters."
                  rows={7}
                  required
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="action"
          onClick={submit}
          disabled={saving || Boolean(saveBlockedReason)}
        >
          {saving ? "Saving…" : "Save review"}
        </Button>
        {saveBlockedReason ? (
          <p className="text-sm text-muted-foreground" role="status">
            {saveBlockedReason}
          </p>
        ) : null}
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
