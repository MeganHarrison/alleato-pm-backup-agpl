"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TrainingFreshnessDecision } from "@/lib/training/types";

import { decideTrainingFreshness } from "./actions";

function DecisionButtons({
  recommendedAction,
}: {
  recommendedAction: TrainingFreshnessDecision;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="submit"
        name="decision"
        value="keep"
        size="sm"
        variant={recommendedAction === "keep" ? "default" : "outline"}
        disabled={pending}
      >
        {pending ? "Saving…" : "Keep resource"}
      </Button>
      <Button
        type="submit"
        name="decision"
        value="archive"
        size="sm"
        variant="destructive"
        disabled={pending}
      >
        Archive resource
      </Button>
    </div>
  );
}

export function FreshnessDecisionForm({
  checkId,
  recommendedAction,
}: {
  checkId: string;
  recommendedAction: TrainingFreshnessDecision;
}) {
  const notesId = `freshness-notes-${checkId}`;

  return (
    <form action={decideTrainingFreshness} className="w-full space-y-2 sm:w-96">
      <input type="hidden" name="checkId" value={checkId} />
      <Label htmlFor={notesId}>Review note</Label>
      <Textarea
        id={notesId}
        name="notes"
        required
        minLength={8}
        maxLength={1000}
        rows={2}
        placeholder="Explain why this evidence is correct or incorrect."
      />
      <DecisionButtons recommendedAction={recommendedAction} />
    </form>
  );
}
