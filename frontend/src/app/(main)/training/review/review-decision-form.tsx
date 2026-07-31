"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TRAINING_REVIEW_REASON_OPTIONS,
  type TrainingReviewDecision,
} from "@/lib/training/types";

import {
  decideTrainingResource,
  type TrainingReviewActionState,
} from "./actions";

const initialState: TrainingReviewActionState = { status: "idle" };

function DecisionButton({ decision }: { decision: TrainingReviewDecision }) {
  const { pending } = useFormStatus();
  const label = decision === "publish" ? "Publish" : "Archive";

  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      size="sm"
      variant={decision === "publish" ? "default" : "outline"}
      disabled={pending}
    >
      {pending ? `${label}…` : label}
    </Button>
  );
}

function RatingField({
  id,
  name,
  label,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select name={name} value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map((rating) => (
            <SelectItem key={rating} value={String(rating)}>
              {rating} / 5
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReviewDecisionForm({ resourceId }: { resourceId: string }) {
  const [state, action] = useActionState(decideTrainingResource, initialState);
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(
    () => new Set(),
  );
  const [notes, setNotes] = useState("");
  const [ratings, setRatings] = useState({
    relevance: "3",
    depth: "3",
    quality: "3",
  });
  const notesId = `training-resource-feedback-${resourceId}`;
  const errorId = `training-resource-feedback-error-${resourceId}`;

  function setReason(reason: string, checked: boolean) {
    setSelectedReasons((current) => {
      const next = new Set(current);
      if (checked) next.add(reason);
      else next.delete(reason);
      return next;
    });
  }

  return (
    <form
      action={action}
      className="grid w-full gap-3 sm:max-w-xl"
      aria-describedby={state.status === "error" ? errorId : undefined}
    >
      <input type="hidden" name="resourceId" value={resourceId} />

      <p className="text-xs text-muted-foreground">
        Select the strengths or concerns that support the decision. These
        signals improve future searches and ranking.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["publish", "archive"] as const).map((decision) => (
          <fieldset key={decision} className="space-y-2">
            <legend className="text-xs font-medium">
              {decision === "publish" ? "Publish strengths" : "Archive concerns"}
            </legend>
            {TRAINING_REVIEW_REASON_OPTIONS[decision].map(([value, label]) => {
              const checkboxId = `${resourceId}-${value}`;
              return (
                <div key={value} className="flex items-start gap-2">
                  <Checkbox
                    id={checkboxId}
                    name="reasonCodes"
                    value={value}
                    checked={selectedReasons.has(value)}
                    onCheckedChange={(checked) =>
                      setReason(value, checked === true)
                    }
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="text-xs font-normal leading-4"
                  >
                    {label}
                  </Label>
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <RatingField
          id={`${resourceId}-relevance`}
          name="relevance"
          label="Relevance"
          value={ratings.relevance}
          onChange={(relevance) =>
            setRatings((current) => ({ ...current, relevance }))
          }
        />
        <RatingField
          id={`${resourceId}-depth`}
          name="depth"
          label="Depth"
          value={ratings.depth}
          onChange={(depth) => setRatings((current) => ({ ...current, depth }))}
        />
        <RatingField
          id={`${resourceId}-quality`}
          name="quality"
          label="Quality"
          value={ratings.quality}
          onChange={(quality) =>
            setRatings((current) => ({ ...current, quality }))
          }
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={notesId}>Review feedback</Label>
        <Textarea
          id={notesId}
          name="notes"
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Required when archiving: explain what is wrong with this resource."
        />
      </div>

      {state.status === "error" ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <DecisionButton decision="archive" />
        <DecisionButton decision="publish" />
      </div>
    </form>
  );
}
