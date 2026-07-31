"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button, ErrorState, SectionHeader } from "@/components/ds";
import {
  SourceReferenceButton,
  type SourceReferenceRecord,
} from "@/components/ai-intelligence/source-reference-button";
import { apiFetch } from "@/lib/api-client";

export type DailyDeepReadReviewCandidate = {
  id: string;
  signalType: string;
  status: "needs_review" | "candidate";
  title: string;
  summary: string | null;
  nextAction: string | null;
  confidence: string;
  sources: Array<{
    label: string;
    record: SourceReferenceRecord;
  }>;
};

type ReviewResponse = {
  ok: boolean;
  action: "accept" | "reject";
  candidate: { id: string; status: string };
  packetId: string;
};

type PromoteResponse = {
  ok: boolean;
  kind: "task" | "insight_card";
  createdRecordId: string;
};

type BatchPromoteResponse = {
  ok: boolean;
  promoted: Array<{ candidateId: string }>;
  failed: Array<{ candidateId: string; message: string }>;
};

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeCandidateText(candidate: DailyDeepReadReviewCandidate): string {
  return `${candidate.title}\n${candidate.summary ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reviewQuestion(signalType: string): string {
  switch (signalType) {
    case "project_update":
      return "Accept if this is an accurate project status update you want preserved in project intelligence.";
    case "task":
      return "Accept only if this contains a real follow-up someone should own. Reject if it is just status without a clear action.";
    case "risk":
      return "Accept if this is a real exposure to monitor. Reject if it is stale, speculative, or already resolved.";
    case "decision":
      return "Accept only if there is an actual decision needed or made. Reject if it is just a normal project update.";
    case "process_issue":
      return "Accept only if this exposes a repeatable workflow problem. Reject if it is just project-specific status.";
    default:
      return "Accept if this is accurate and useful enough to keep; reject if it is wrong, duplicate, stale, or not actionable.";
  }
}

function promotionOutcome(signalType: string): string {
  if (signalType === "task") {
    return "Promoting creates a project task.";
  }
  return "Promoting writes this into project intelligence.";
}

export function DailyDeepReadCandidateReview({
  candidates,
  error,
  projectId,
}: {
  candidates: DailyDeepReadReviewCandidate[];
  error: string | null;
  projectId: number;
}) {
  const [visibleCandidates, setVisibleCandidates] = React.useState(candidates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const acceptedCount = visibleCandidates.filter(
    (candidate) => candidate.status === "candidate",
  ).length;
  const duplicateCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const candidate of visibleCandidates) {
      const key = normalizeCandidateText(candidate);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [visibleCandidates]);

  React.useEffect(() => {
    setVisibleCandidates(candidates);
  }, [candidates]);

  const reviewCandidate = React.useCallback(
    async (candidateId: string, action: "accept" | "reject") => {
      setBusyId(candidateId);
      try {
        await apiFetch<ReviewResponse>(
          `/api/projects/${projectId}/intelligence/daily-deep-read-candidates/${candidateId}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );
        setVisibleCandidates((current) => {
          if (action === "reject") {
            return current.filter((candidate) => candidate.id !== candidateId);
          }
          return current.map((candidate) =>
            candidate.id === candidateId
              ? { ...candidate, status: "candidate" }
              : candidate,
          );
        });
        toast.success(
          action === "accept"
            ? "Daily Deep Read candidate ready to promote"
            : "Daily Deep Read candidate rejected",
        );
      } catch (reviewError) {
        toast.error("Candidate review failed", {
          description:
            reviewError instanceof Error
              ? reviewError.message
              : "Unexpected error",
        });
      } finally {
        setBusyId(null);
      }
    },
    [projectId],
  );

  const promoteCandidate = React.useCallback(
    async (candidateId: string) => {
      setBusyId(candidateId);
      try {
        const response = await apiFetch<PromoteResponse>(
          `/api/projects/${projectId}/intelligence/daily-deep-read-candidates/${candidateId}/promote`,
          { method: "POST" },
        );
        setVisibleCandidates((current) =>
          current.filter((candidate) => candidate.id !== candidateId),
        );
        toast.success(
          response.kind === "task"
            ? "Promoted to project task"
            : "Promoted to project intelligence",
        );
      } catch (promotionError) {
        toast.error("Candidate promotion failed", {
          description:
            promotionError instanceof Error
              ? promotionError.message
              : "Unexpected error",
        });
      } finally {
        setBusyId(null);
      }
    },
    [projectId],
  );

  const promoteAcceptedCandidates = React.useCallback(async () => {
    setBusyId("batch");
    try {
      const response = await apiFetch<BatchPromoteResponse>(
        `/api/projects/${projectId}/intelligence/daily-deep-read-candidates/promote`,
        { method: "POST" },
      );
      const promotedIds = new Set(
        response.promoted.map((candidate) => candidate.candidateId),
      );
      setVisibleCandidates((current) =>
        current.filter((candidate) => !promotedIds.has(candidate.id)),
      );

      if (response.failed.length > 0) {
        toast.error("Some Daily Deep Read candidates did not promote", {
          description: response.failed
            .map((failure) => failure.message)
            .filter(Boolean)
            .slice(0, 2)
            .join(" "),
        });
        return;
      }

      toast.success(
        response.promoted.length === 1
          ? "Promoted 1 accepted Daily Deep Read candidate"
          : `Promoted ${response.promoted.length} accepted Daily Deep Read candidates`,
      );
    } catch (promotionError) {
      toast.error("Batch promotion failed", {
        description:
          promotionError instanceof Error
            ? promotionError.message
            : "Unexpected error",
      });
    } finally {
      setBusyId(null);
    }
  }, [projectId]);

  if (visibleCandidates.length === 0 && !error) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="Daily Deep Read candidates" />
        {acceptedCount > 0 ? (
          <Button
            size="sm"
            disabled={busyId === "batch"}
            onClick={() => void promoteAcceptedCandidates()}
          >
            Promote accepted
          </Button>
        ) : null}
      </div>
      <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
        First decide whether the statement is true, useful, and typed correctly.
        Accepting marks it as ready; promoting is the step that writes it into
        project intelligence or creates a task. Reject duplicates, wrong labels,
        stale items, and vague status that should not become a record.
      </p>
      {error ? (
        <ErrorState
          title="Daily Deep Read candidate queue could not load"
          error={error}
          className="items-start justify-start gap-2 py-2 text-left"
        />
      ) : null}
      {visibleCandidates.length > 0 ? (
        <div className="divide-y divide-border/60">
          {visibleCandidates.map((candidate) => {
            const busy = busyId === candidate.id;
            const duplicateCount =
              duplicateCounts.get(normalizeCandidateText(candidate)) ?? 0;
            return (
              <article
                key={candidate.id}
                className="space-y-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {candidate.title}
                      </p>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {formatLabel(candidate.signalType)} ·{" "}
                        {formatLabel(candidate.confidence)} ·{" "}
                        {candidate.status === "candidate"
                          ? "Ready to promote"
                          : "Needs review"}
                      </span>
                    </div>
                    {candidate.summary ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {candidate.summary}
                      </p>
                    ) : null}
                    <p className="text-xs leading-5 text-foreground">
                      {reviewQuestion(candidate.signalType)}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {promotionOutcome(candidate.signalType)}
                    </p>
                    {duplicateCount > 1 ? (
                      <p className="text-xs leading-5 text-warning">
                        Possible duplicate: the same statement appears in{" "}
                        {duplicateCount} candidate types. Keep the best type and
                        dismiss the repeated ones.
                      </p>
                    ) : null}
                    {candidate.nextAction ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Next: {candidate.nextAction}
                      </p>
                    ) : null}
                  </div>
                  {candidate.status === "candidate" ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void promoteCandidate(candidate.id)}
                      >
                        Promote now
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void reviewCandidate(candidate.id, "reject")}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void reviewCandidate(candidate.id, "accept")}
                      >
                        Accept as accurate
                      </Button>
                    </div>
                  )}
                </div>
                {candidate.sources.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    {candidate.sources.map((source) => (
                      <SourceReferenceButton
                        key={source.record.id}
                        projectId={projectId}
                        source={source.record}
                        buttonLabel={source.label}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
