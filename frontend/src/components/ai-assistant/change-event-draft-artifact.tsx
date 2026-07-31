"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CHANGE_REQUEST_SCOPE_OPTIONS,
  CHANGE_REQUEST_TYPE_OPTIONS,
} from "@/lib/ai/workflow-registry";
import type {
  ChangeEventWorkflowDraft,
  ChangeEventWorkflowDraftEdits,
} from "@/lib/ai/change-event-workflow";

type EditableDraft = {
  title: string;
  narrative: string;
  cause: string;
  scope: string;
  costImpact: string;
  scheduleImpact: string;
};

export type ChangeEventDraftProjectOption = {
  id: number;
  name: string;
  meta?: string;
};

type ChangeEventDraftArtifactProps = {
  draft: ChangeEventWorkflowDraft;
  projectOptions: ChangeEventDraftProjectOption[];
  projectsLoading?: boolean;
  onSubmit: (message: string) => void;
  onSaveDraft: (edits: ChangeEventWorkflowDraftEdits) => Promise<void>;
};

function toEditableDraft(draft: ChangeEventWorkflowDraft): EditableDraft {
  return {
    title: draft.title ?? "",
    narrative: draft.narrative ?? "",
    cause: draft.cause ?? "",
    scope: draft.scope ?? "",
    costImpact: draft.costImpact ?? "",
    scheduleImpact: draft.scheduleImpact ?? "",
  };
}

function buildDraftPayload(
  draft: ChangeEventWorkflowDraft,
  editable: EditableDraft,
) {
  return {
    projectId: draft.projectId,
    projectName: draft.projectName,
    title: editable.title || null,
    narrative: editable.narrative || null,
    type: editable.cause || null,
    scope: editable.scope || null,
    costImpact: editable.costImpact || null,
    scheduleImpact: editable.scheduleImpact || null,
    ownerNotified: draft.ownerNotified,
    supportingDocs: draft.supportingDocs,
    relatedRecordHints: draft.relatedRecordHints,
  };
}

function fieldsChanged(a: EditableDraft, b: EditableDraft): boolean {
  return Object.keys(a).some((key) => {
    const field = key as keyof EditableDraft;
    return a[field] !== b[field];
  });
}

export function ChangeEventDraftArtifact({
  draft,
  projectOptions,
  projectsLoading = false,
  onSubmit,
  onSaveDraft,
}: ChangeEventDraftArtifactProps) {
  const [editable, setEditable] = useState(() => toEditableDraft(draft));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const baseline = useMemo(() => toEditableDraft(draft), [draft]);
  const hasChanges = fieldsChanged(editable, baseline);
  const resolvedProjectOptions = useMemo(() => {
    if (!draft.projectId) return projectOptions;
    if (projectOptions.some((project) => project.id === draft.projectId)) {
      return projectOptions;
    }
    return [
      {
        id: draft.projectId,
        name: draft.projectName ?? `Project #${draft.projectId}`,
      },
      ...projectOptions,
    ];
  }, [draft.projectId, draft.projectName, projectOptions]);
  const missingFields = draft.checklist
    .filter((item) => item.status !== "complete")
    .map((item) => item.label)
    .filter((label) => label !== "Review and create")
    .slice(0, 3);
  const previewBlockers = [
    ...missingFields,
    ...draft.missingRisks.slice(0, Math.max(0, 3 - missingFields.length)),
  ];
  const remainingBlockerCount =
    draft.checklist.filter((item) => item.status !== "complete").length -
      missingFields.length +
    Math.max(0, draft.missingRisks.length - (3 - missingFields.length));
  const payload = buildDraftPayload(draft, editable);

  useEffect(() => {
    setEditable(toEditableDraft(draft));
    setSaveError(null);
  }, [draft]);

  const updateField =
    (field: keyof EditableDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setEditable((current) => ({ ...current, [field]: event.target.value }));
    };

  const updateSelectField =
    (field: "cause" | "scope") =>
    (value: string) => {
      setEditable((current) => ({ ...current, [field]: value }));
    };

  const handleProjectChange = async (value: string) => {
    const selectedProjectId =
      value === "__unset__" ? null : Number.parseInt(value, 10);
    const selectedProject =
      selectedProjectId === null
        ? null
        : resolvedProjectOptions.find((project) => project.id === selectedProjectId) ?? null;

    if (selectedProjectId !== null && !selectedProject) {
      setSaveError("That project could not be selected. Refresh and try again.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraft({
        projectId: selectedProjectId,
        projectName: selectedProject?.name ?? null,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The project could not be saved. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncDraft = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraft({
        title: editable.title,
        narrative: editable.narrative,
        cause: editable.cause
          ? (editable.cause as ChangeEventWorkflowDraft["cause"])
          : null,
        scope: editable.scope
          ? (editable.scope as ChangeEventWorkflowDraft["scope"])
          : "TBD",
        costImpact: editable.costImpact,
        scheduleImpact: editable.scheduleImpact,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The draft could not be saved. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReviewCreate = () => {
    onSubmit(
      [
        "Prepare the final createChangeEvent preview from this live intake draft.",
        "Do not create the record yet. Call createChangeEvent with confirmed=false, then wait for my confirmation.",
        "",
        JSON.stringify(payload, null, 2),
      ].join("\n"),
    );
  };

  return (
    <aside className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              role="heading"
              aria-level={2}
              className="truncate text-sm font-semibold text-foreground"
            >
              Change Event Draft
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {draft.projectName ??
                (draft.projectId ? `Project #${draft.projectId}` : "Project not selected")}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {draft.readyForPreview ? "Ready" : "Drafting"}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Project
              </label>
              <Select
                value={draft.projectId ? String(draft.projectId) : "__unset__"}
                onValueChange={handleProjectChange}
                disabled={projectsLoading || isSaving}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">Project not selected</SelectItem>
                  {resolvedProjectOptions.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.meta ? `${project.name} - ${project.meta}` : project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input
                value={editable.title}
                onChange={updateField("title")}
                placeholder="Draft title"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                What happened
              </label>
              <Textarea
                value={editable.narrative}
                onChange={updateField("narrative")}
                placeholder="Describe what changed"
                className="mt-1 min-h-28 resize-y"
              />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Type
              </label>
              <Select
                value={editable.cause || "__unset__"}
                onValueChange={(value) => {
                  updateSelectField("cause")(value === "__unset__" ? "" : value);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">Not selected</SelectItem>
                  {CHANGE_REQUEST_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Scope
              </label>
              <Select
                value={editable.scope || "TBD"}
                onValueChange={updateSelectField("scope")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_REQUEST_SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Cost
              </label>
              <Input
                value={editable.costImpact}
                onChange={updateField("costImpact")}
                placeholder="TBD"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Schedule
              </label>
              <Input
                value={editable.scheduleImpact}
                onChange={updateField("scheduleImpact")}
                placeholder="TBD"
                className="mt-1"
              />
            </div>
          </section>

          {draft.relatedEvidence.length > 0 ? (
            <section className="space-y-2">
              <div
                role="heading"
                aria-level={3}
                className="text-xs font-medium text-muted-foreground"
              >
                Related records
              </div>
              <div className="divide-y divide-border/60">
                {draft.relatedEvidence.slice(0, 4).map((item) => (
                  <div key={item.id} className="py-2">
                    <div className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {item.sourceLabel}
                      {item.date ? `, ${item.date.slice(0, 10)}` : ""}
                      {item.snippet ? `: ${item.snippet}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {previewBlockers.length > 0 ? (
            <section className="space-y-2">
              <div
                role="heading"
                aria-level={3}
                className="text-xs font-medium text-muted-foreground"
              >
                Before preview
              </div>
              <ul className="space-y-1 text-sm leading-6 text-foreground">
                {previewBlockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {remainingBlockerCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {remainingBlockerCount} more item
                  {remainingBlockerCount === 1 ? "" : "s"} will be checked before
                  create.
                </p>
              ) : null}
            </section>
          ) : null}

          {draft.recommendedImpacts.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground">
                AI notes
              </summary>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-foreground">
                {draft.recommendedImpacts.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <div className="space-y-3">
          {!draft.readyForPreview ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {draft.nextQuestion}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!draft.readyForPreview}
              onClick={handleReviewCreate}
            >
              Review create
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasChanges || isSaving}
              onClick={handleSyncDraft}
            >
              {isSaving ? "Saving" : "Update draft"}
            </Button>
          </div>
          {saveError ? (
            <p className="text-xs leading-5 text-destructive">{saveError}</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
