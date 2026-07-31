"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";

type ScopeValue = "personal" | "project" | "team" | "company";
type RiskLevel = "low" | "medium" | "high";

interface TeachAlleatoFormState {
  whatShouldAlleatoLearn: string;
  appliesToScope: ScopeValue | "";
  workflowCategory: string;
  exampleInput: string;
  exampleOutput: string;
  evidenceLink: string;
  suggestedReviewer: string;
  whyThisMatters: string;
  riskLevel: RiskLevel | "";
}

interface TeachAlleatoSubmitResponse {
  success?: boolean;
  reviewStatus?: string;
  status?: string;
  submissionId?: string;
  eventId?: string;
  promotionId?: string;
  promotionIds?: string[];
  promotion?: { id?: string; status?: string } | null;
  event?: { id?: string } | null;
}

type FieldErrors = Partial<Record<keyof TeachAlleatoFormState, string>>;

const INITIAL_FORM: TeachAlleatoFormState = {
  whatShouldAlleatoLearn: "",
  appliesToScope: "",
  workflowCategory: "",
  exampleInput: "",
  exampleOutput: "",
  evidenceLink: "",
  suggestedReviewer: "",
  whyThisMatters: "",
  riskLevel: "",
};

const SCOPE_OPTIONS: Array<{ value: ScopeValue; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "project", label: "Project" },
  { value: "team", label: "Team" },
  { value: "company", label: "Company" },
];

const CATEGORY_OPTIONS = [
  "Budget",
  "Change management",
  "Commitments",
  "Documents",
  "Drawings",
  "Field workflow",
  "Financial review",
  "Project intelligence",
  "Scheduling",
  "Submittals/RFIs",
  "Other",
];

const RISK_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function isValidEvidenceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateForm(form: TeachAlleatoFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.whatShouldAlleatoLearn.trim()) {
    errors.whatShouldAlleatoLearn = "Enter what Alleato should learn.";
  }
  if (!form.appliesToScope) {
    errors.appliesToScope = "Choose where this applies.";
  }
  if (!form.workflowCategory.trim()) {
    errors.workflowCategory = "Choose a workflow category.";
  }
  if (form.evidenceLink.trim() && !isValidEvidenceUrl(form.evidenceLink.trim())) {
    errors.evidenceLink = "Use a valid http or https link.";
  }
  if (!form.whyThisMatters.trim()) {
    errors.whyThisMatters = "Explain why this matters.";
  }
  if (!form.riskLevel) {
    errors.riskLevel = "Choose a risk level.";
  }

  return errors;
}

function fieldId(name: keyof TeachAlleatoFormState) {
  return `teach-alleato-${name}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function TeachAlleatoIntake() {
  const [form, setForm] = React.useState<TeachAlleatoFormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] =
    React.useState<TeachAlleatoSubmitResponse | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function updateField<K extends keyof TeachAlleatoFormState>(
    field: K,
    value: TeachAlleatoFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setApiError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedStatus(null);
    setApiError(null);

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        whatShouldAlleatoLearn: form.whatShouldAlleatoLearn.trim(),
        appliesTo: form.appliesToScope,
        workflowCategory: form.workflowCategory.trim(),
        exampleInput: form.exampleInput.trim() || null,
        exampleOutput: form.exampleOutput.trim() || null,
        sourceEvidenceLink: form.evidenceLink.trim() || null,
        suggestedReviewer: form.suggestedReviewer.trim() || null,
        whyThisMatters: form.whyThisMatters.trim(),
        perceivedRiskLevel: form.riskLevel,
        route: "/ai/teach",
      };

      const response = await apiFetch<TeachAlleatoSubmitResponse>(
        "/api/ai-assistant/teach",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setSubmittedStatus(response);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Teach Alleato submission failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const reviewStatus =
    submittedStatus?.reviewStatus ??
    submittedStatus?.status ??
    submittedStatus?.promotion?.status ??
    (submittedStatus ? "Submitted for review" : null);
  const reviewReference =
    submittedStatus?.submissionId ??
    submittedStatus?.promotionId ??
    submittedStatus?.promotionIds?.join(", ") ??
    submittedStatus?.promotion?.id ??
    submittedStatus?.eventId ??
    submittedStatus?.event?.id ??
    null;

  return (
    <form className="space-y-8" onSubmit={handleSubmit} noValidate>
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={fieldId("whatShouldAlleatoLearn")}>
            What should Alleato learn?
          </Label>
          <Textarea
            id={fieldId("whatShouldAlleatoLearn")}
            value={form.whatShouldAlleatoLearn}
            onChange={(event) =>
              updateField("whatShouldAlleatoLearn", event.target.value)
            }
            aria-invalid={Boolean(errors.whatShouldAlleatoLearn)}
            className="min-h-28 resize-y"
          />
          <FieldError message={errors.whatShouldAlleatoLearn} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={fieldId("appliesToScope")}>
              Applies to scope
            </Label>
            <Select
              value={form.appliesToScope}
              onValueChange={(value) =>
                updateField("appliesToScope", value as ScopeValue)
              }
            >
              <SelectTrigger
                id={fieldId("appliesToScope")}
                aria-invalid={Boolean(errors.appliesToScope)}
              >
                <SelectValue placeholder="Choose scope" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.appliesToScope} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("workflowCategory")}>
              Workflow category
            </Label>
            <Select
              value={form.workflowCategory}
              onValueChange={(value) =>
                updateField("workflowCategory", value)
              }
            >
              <SelectTrigger
                id={fieldId("workflowCategory")}
                aria-invalid={Boolean(errors.workflowCategory)}
              >
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.workflowCategory} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("riskLevel")}>
              Perceived risk level
            </Label>
            <Select
              value={form.riskLevel}
              onValueChange={(value) =>
                updateField("riskLevel", value as RiskLevel)
              }
            >
              <SelectTrigger
                id={fieldId("riskLevel")}
                aria-invalid={Boolean(errors.riskLevel)}
              >
                <SelectValue placeholder="Choose risk" />
              </SelectTrigger>
              <SelectContent>
                {RISK_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.riskLevel} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={fieldId("exampleInput")}>Example input</Label>
            <Textarea
              id={fieldId("exampleInput")}
              value={form.exampleInput}
              onChange={(event) =>
                updateField("exampleInput", event.target.value)
              }
              aria-invalid={Boolean(errors.exampleInput)}
              className="min-h-28 resize-y"
            />
            <FieldError message={errors.exampleInput} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fieldId("exampleOutput")}>Example output</Label>
            <Textarea
              id={fieldId("exampleOutput")}
              value={form.exampleOutput}
              onChange={(event) =>
                updateField("exampleOutput", event.target.value)
              }
              aria-invalid={Boolean(errors.exampleOutput)}
              className="min-h-28 resize-y"
            />
            <FieldError message={errors.exampleOutput} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("evidenceLink")}>
            Source/evidence link
          </Label>
          <Input
            id={fieldId("evidenceLink")}
            type="url"
            value={form.evidenceLink}
            onChange={(event) =>
              updateField("evidenceLink", event.target.value)
            }
            aria-invalid={Boolean(errors.evidenceLink)}
          />
          <FieldError message={errors.evidenceLink} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={fieldId("suggestedReviewer")}>
            Suggested reviewer
          </Label>
          <Input
            id={fieldId("suggestedReviewer")}
            value={form.suggestedReviewer}
            onChange={(event) =>
              updateField("suggestedReviewer", event.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("whyThisMatters")}>Why this matters</Label>
          <Textarea
            id={fieldId("whyThisMatters")}
            value={form.whyThisMatters}
            onChange={(event) =>
              updateField("whyThisMatters", event.target.value)
            }
            aria-invalid={Boolean(errors.whyThisMatters)}
            className="min-h-24 resize-y"
          />
          <FieldError message={errors.whyThisMatters} />
        </div>
      </section>

      {apiError ? (
        <div
          className="border-l-2 border-destructive pl-3 text-sm text-destructive"
          role="alert"
        >
          {apiError}
        </div>
      ) : null}

      {reviewStatus ? (
        <div className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{reviewStatus}</p>
          {reviewReference ? <p>Reference: {reviewReference}</p> : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
