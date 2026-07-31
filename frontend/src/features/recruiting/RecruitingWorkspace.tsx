"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Download,
  FileText,
  Mail,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Upload,
} from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  InfoAlert,
  KanbanCardShell,
  KanbanColumnShell,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusText,
  Textarea,
} from "@/components/ds";
import { useRecruitingWorkspace } from "@/hooks/use-recruiting";
import type {
  RecruitingDisposition,
  RecruitingStage,
} from "@/lib/recruiting/contracts";
import { downloadRecruitingWorkspace } from "@/lib/recruiting/workspace-export";
import {
  matchesWorkspaceCandidateSearch,
  RECRUITING_DISPOSITIONS,
  RECRUITING_WORKSPACE_STAGES,
  recruitingStageLabel,
} from "./workspace-model";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function RecruitingWorkspace() {
  const workspace = useRecruitingWorkspace();
  const state = workspace.snapshot;
  const [requisitionId, setRequisitionId] = useState(state.requisitions[0].id);
  const [query, setQuery] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [draftDisposition, setDraftDisposition] =
    useState<RecruitingDisposition>("hold");
  const [dispositionReason, setDispositionReason] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  const candidateById = useMemo(
    () =>
      new Map(state.candidates.map((candidate) => [candidate.id, candidate])),
    [state.candidates],
  );

  const visibleApplications = useMemo(
    () =>
      state.applications.filter((application) => {
        const candidate = candidateById.get(application.candidateId);
        return (
          application.requisitionId === requisitionId &&
          Boolean(
            candidate && matchesWorkspaceCandidateSearch(candidate, query),
          )
        );
      }),
    [candidateById, query, requisitionId, state.applications],
  );

  const selectedApplication =
    state.applications.find((item) => item.id === selectedApplicationId) ??
    null;
  const selectedCandidate = selectedApplication
    ? (candidateById.get(selectedApplication.candidateId) ?? null)
    : null;
  const selectedRequisition =
    state.requisitions.find((item) => item.id === requisitionId) ??
    state.requisitions[0]!;

  function handleMove(applicationId: string, nextStage: RecruitingStage) {
    workspace.moveApplication(applicationId, nextStage);
  }

  function openApplication(applicationId: string) {
    const application = state.applications.find(
      (item) => item.id === applicationId,
    );
    if (!application) return;
    setSelectedApplicationId(applicationId);
    setDraftDisposition(application.disposition);
    setDispositionReason(application.dispositionReason ?? "");
  }

  function handleDisposition() {
    if (!selectedApplication) return;
    workspace.setDisposition(
      selectedApplication.id,
      draftDisposition,
      dispositionReason,
    );
  }

  function handleAddSample() {
    const applicationId = workspace.addSampleApplicant(requisitionId);
    setIntakeOpen(false);
    if (applicationId) {
      setSelectedApplicationId(applicationId);
      setDraftDisposition("hold");
      setDispositionReason("");
    }
  }

  function handleReset() {
    if (workspace.resetWorkspace()) {
      setSelectedApplicationId(null);
      setQuery("");
      setResetOpen(false);
    }
  }

  function handleExport() {
    const json = workspace.exportWorkspace();
    if (!json) return;
    try {
      downloadRecruitingWorkspace(json);
      setExportError(null);
    } catch {
      setExportError(
        "The browser could not download the local workspace export. Check download permissions and try again.",
      );
    }
  }

  return (
    <>
      <PageShell
        variant="table"
        title="Applicant Tracker"
        description="Local review build. Validated synthetic changes persist in this browser; no real applicant data or external workflow is enabled."
        actions={
          <Button
            type="button"
            onClick={() => setIntakeOpen(true)}
            disabled={!workspace.ready}
          >
            <Upload aria-hidden="true" />
            Add sample resume
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={requisitionId} onValueChange={setRequisitionId}>
              <SelectTrigger
                className="w-full sm:w-80"
                aria-label="Choose requisition"
              >
                <BriefcaseBusiness aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.requisitions
                  .filter((requisition) => requisition.status === "open")
                  .map((requisition) => (
                    <SelectItem key={requisition.id} value={requisition.id}>
                      {requisition.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <ExpandableSearch
              value={query}
              onChange={setQuery}
              placeholder="Search candidates"
              ariaLabel="Search candidates"
              collapsible={false}
              className="w-full sm:max-w-sm"
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={!workspace.ready}
              className="self-start sm:ml-auto sm:self-auto"
            >
              <Download aria-hidden="true" />
              Export
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setResetOpen(true)}
              disabled={!workspace.ready}
              className="self-start sm:self-auto"
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
          </div>

          {workspace.error || exportError ? (
            <InfoAlert variant="error" role="alert">
              <div className="space-y-2">
                <p>{workspace.error ?? exportError}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    workspace.clearError();
                    setExportError(null);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </InfoAlert>
          ) : null}

          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            {workspace.ready
              ? `${workspace.notice} Revision ${state.revision}.`
              : "Loading the local Applicant Tracker workspace."}
          </p>

          <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div
              role="region"
              className="flex min-w-max items-stretch gap-3"
              aria-label={`${selectedRequisition.title} candidate pipeline`}
            >
              {RECRUITING_WORKSPACE_STAGES.map((stage) => {
                const stageApplications = visibleApplications.filter(
                  (application) => application.stage === stage.id,
                );

                return (
                  <KanbanColumnShell
                    key={stage.id}
                    title={stage.label}
                    count={stageApplications.length}
                    tone={
                      stage.id === "qualified"
                        ? "success"
                        : stage.id === "hired"
                          ? "success"
                          : stage.id === "interview"
                            ? "info"
                            : stage.id === "offer"
                              ? "primary"
                              : "neutral"
                    }
                    className="w-72 flex-none"
                  >
                    <div className="space-y-2">
                      {stageApplications.length === 0 ? (
                        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                          No candidates
                        </p>
                      ) : (
                        stageApplications.map((application) => {
                          const candidate = candidateById.get(
                            application.candidateId,
                          )!;
                          return (
                            <KanbanCardShell
                              key={application.id}
                              density="default"
                              aria-label={`${candidate.name}, ${stage.label}`}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => openApplication(application.id)}
                                className="h-auto w-full justify-start whitespace-normal p-0 text-left hover:bg-transparent"
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-foreground">
                                    {candidate.name}
                                  </span>
                                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                    {candidate.currentRole} -{" "}
                                    {candidate.currentCompany}
                                  </span>
                                </span>
                              </Button>

                              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                                <span className="min-w-0 truncate text-xs text-muted-foreground">
                                  {application.source}
                                </span>
                                <StatusText
                                  status={
                                    application.evidenceStatus ===
                                    "review_ready"
                                      ? "Review ready"
                                      : "Needs review"
                                  }
                                />
                              </div>

                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(application.receivedAt)}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Move ${candidate.name} to another stage`}
                                    >
                                      <MoreHorizontal aria-hidden="true" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {RECRUITING_WORKSPACE_STAGES.filter(
                                      (option) =>
                                        option.id !== application.stage,
                                    ).map((option) => (
                                      <DropdownMenuItem
                                        key={option.id}
                                        onSelect={() =>
                                          handleMove(application.id, option.id)
                                        }
                                      >
                                        Move to {option.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </KanbanCardShell>
                          );
                        })
                      )}
                    </div>
                  </KanbanColumnShell>
                );
              })}
            </div>
          </div>
        </div>
      </PageShell>

      <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add a synthetic resume</DialogTitle>
            <DialogDescription>
              This creates a validated browser-local candidate, application, and
              resume record for {selectedRequisition.title}. Real files remain
              disabled.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border">
            <div className="flex items-start gap-3 py-4">
              <FileText
                aria-hidden="true"
                className="mt-0.5 size-5 text-muted-foreground"
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Taylor Morgan - taylor-morgan-synthetic-resume.pdf
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Searchable sample - four pages - example.test identity only
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIntakeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddSample}
              disabled={!workspace.ready}
            >
              Add sample applicant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selectedApplication && selectedCandidate)}
        onOpenChange={(open) => {
          if (!open) setSelectedApplicationId(null);
        }}
      >
        {selectedApplication && selectedCandidate ? (
          <SheetContent side="right" className="gap-0 p-0 sm:max-w-xl">
            <SheetHeader className="px-6 py-5 pr-12">
              <SheetTitle>{selectedCandidate.name}</SheetTitle>
              <SheetDescription>
                {state.requisitions.find(
                  (item) => item.id === selectedApplication.requisitionId,
                )?.title ?? "Unassigned"}{" "}
                - {recruitingStageLabel(selectedApplication.stage)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6">
              <section className="space-y-3 py-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <a
                    href={`mailto:${selectedCandidate.email}`}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Mail aria-hidden="true" className="size-4" />
                    {selectedCandidate.email}
                  </a>
                  <a
                    href={`tel:${selectedCandidate.phone}`}
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Phone aria-hidden="true" className="size-4" />
                    {selectedCandidate.phone}
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedCandidate.currentRole} at{" "}
                  {selectedCandidate.currentCompany} -{" "}
                  {selectedCandidate.location}
                </p>
              </section>

              <section className="space-y-3 border-t border-border py-6">
                <SectionRuleHeading
                  as="h2"
                  label="Resume evidence"
                  className="mb-0 pb-0"
                  actions={
                    <StatusText
                      status={
                        selectedApplication.evidenceStatus === "review_ready"
                          ? "Review ready"
                          : "Needs review"
                      }
                    />
                  }
                />
                <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                  {selectedCandidate.resumeFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Resume silence is shown as not evidenced, never as proof that
                  a qualification is absent.
                </p>
                {selectedApplication.resumeDocument.reviewStatus ===
                "pending" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      workspace.markResumeReviewed(selectedApplication.id)
                    }
                  >
                    Mark synthetic resume reviewed
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Human review recorded in the local audit history.
                  </p>
                )}
              </section>

              <section className="space-y-3 border-t border-border py-6">
                <SectionRuleHeading
                  as="h2"
                  label="Human disposition"
                  className="mb-0 pb-0"
                />
                <Select
                  value={draftDisposition}
                  onValueChange={(value) =>
                    setDraftDisposition(value as RecruitingDisposition)
                  }
                >
                  <SelectTrigger aria-label="Human disposition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECRUITING_DISPOSITIONS.map((disposition) => (
                      <SelectItem key={disposition.id} value={disposition.id}>
                        {disposition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draftDisposition === "not_qualified" ||
                draftDisposition === "withdrawn" ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="applicant-disposition-reason"
                      className="text-sm font-medium text-foreground"
                    >
                      Disposition reason
                    </label>
                    <Textarea
                      id="applicant-disposition-reason"
                      value={dispositionReason}
                      onChange={(event) =>
                        setDispositionReason(event.target.value)
                      }
                      aria-describedby="applicant-disposition-reason-help"
                      aria-invalid={
                        dispositionReason.trim().length === 0
                          ? "true"
                          : undefined
                      }
                      placeholder="Record the human-reviewed reason"
                    />
                    <p
                      id="applicant-disposition-reason-help"
                      className="text-xs text-muted-foreground"
                    >
                      Required for not qualified and withdrawn dispositions.
                    </p>
                  </div>
                ) : null}
                <Button type="button" size="sm" onClick={handleDisposition}>
                  Save disposition
                </Button>
                <p className="text-xs text-muted-foreground">
                  No AI score, rank, recommendation, or automatic stage change
                  is used.
                </p>
              </section>

              <section className="space-y-3 border-t border-border py-6">
                <SectionRuleHeading
                  as="h2"
                  label="Applications"
                  className="mb-0 pb-0"
                />
                <div className="divide-y divide-border">
                  {state.applications
                    .filter((item) => item.candidateId === selectedCandidate.id)
                    .map((application) => {
                      const requisition = state.requisitions.find(
                        (item) => item.id === application.requisitionId,
                      );
                      return (
                        <div
                          key={application.id}
                          className="flex items-center justify-between gap-4 py-3 text-sm"
                        >
                          <span>{requisition?.title ?? "Unassigned"}</span>
                          <span className="text-muted-foreground">
                            {recruitingStageLabel(application.stage)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </section>

              <section className="space-y-3 border-t border-border py-6">
                <SectionRuleHeading
                  as="h2"
                  label="Timeline"
                  className="mb-0 pb-0"
                />
                <div className="divide-y divide-border">
                  {state.auditEvents
                    .filter(
                      (event) => event.applicationId === selectedApplication.id,
                    )
                    .map((event) => (
                      <div key={event.id} className="py-3">
                        <p className="text-sm text-foreground">
                          {event.detail}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.actorLabel} - {formatDate(event.occurredAt)}
                        </p>
                      </div>
                    ))}
                  {state.auditEvents.every(
                    (event) => event.applicationId !== selectedApplication.id,
                  ) ? (
                    <p className="py-3 text-sm text-muted-foreground">
                      No local changes have been recorded for this application.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </SheetContent>
        ) : null}
      </Sheet>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the local workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes locally saved changes and restores the original
              synthetic pipeline. Export first if you need to preserve the
              current audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Reset local workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
