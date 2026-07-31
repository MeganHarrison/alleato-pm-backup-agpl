"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";

export type CentralReviewCandidate = {
  id: string;
  signalType: string;
  status: "needs_review" | "candidate";
  title: string;
  summary: string | null;
  confidence: string;
  projectId: number | null;
  projectName: string | null;
};

export type CentralReviewProjectOption = {
  id: number;
  name: string;
};

type ReviewResponse = {
  ok: boolean;
  action: "accept" | "reject";
  candidate: { id: string; status: string; project_id: number | null };
  packetId: string;
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusLabel(candidate: CentralReviewCandidate): string {
  if (candidate.status !== "candidate") return "Needs review";
  return candidate.projectId
    ? "Accepted · promotes on the next hourly run"
    : "Accepted · company-wide, no project to promote into";
}

export function DailyDeepReadCentralReview({
  candidates,
  projectOptions,
}: {
  candidates: CentralReviewCandidate[];
  projectOptions: CentralReviewProjectOption[];
}) {
  const [visibleCandidates, setVisibleCandidates] = React.useState(candidates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [assignments, setAssignments] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    setVisibleCandidates(candidates);
  }, [candidates]);

  const reviewCandidate = React.useCallback(
    async (candidate: CentralReviewCandidate, action: "accept" | "reject") => {
      setBusyId(candidate.id);
      const assignedProjectId =
        candidate.projectId ?? assignments[candidate.id] ?? undefined;
      try {
        const response = await apiFetch<ReviewResponse>(
          `/api/executive/daily-deep-read-candidates/${candidate.id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action,
              ...(action === "accept" && assignedProjectId
                ? { projectId: assignedProjectId }
                : {}),
            }),
          },
        );
        setVisibleCandidates((current) => {
          if (action === "reject") {
            return current.filter((item) => item.id !== candidate.id);
          }
          return current.map((item) =>
            item.id === candidate.id
              ? {
                  ...item,
                  status: "candidate",
                  projectId: response.candidate.project_id,
                  projectName:
                    item.projectName ??
                    projectOptions.find(
                      (option) => option.id === response.candidate.project_id,
                    )?.name ??
                    null,
                }
              : item,
          );
        });
        toast.success(
          action === "accept" ? "Candidate accepted" : "Candidate dismissed",
        );
      } catch (reviewError) {
        toast.error("Candidate review failed", {
          description:
            reviewError instanceof Error ? reviewError.message : "Unexpected error",
        });
      } finally {
        setBusyId(null);
      }
    },
    [assignments, projectOptions],
  );

  const groups = React.useMemo(() => {
    const byProject = new Map<string, CentralReviewCandidate[]>();
    for (const candidate of visibleCandidates) {
      const key = candidate.projectName ?? "Unassigned";
      byProject.set(key, [...(byProject.get(key) ?? []), candidate]);
    }
    return [...byProject.entries()].sort(([a], [b]) => {
      if (a === "Unassigned") return -1;
      if (b === "Unassigned") return 1;
      return a.localeCompare(b);
    });
  }, [visibleCandidates]);

  if (visibleCandidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every candidate from the current Daily Deep Read packet has been reviewed.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map(([groupName, groupCandidates]) => (
        <section key={groupName} className="space-y-3">
          <SectionRuleHeading
            label={`${groupName} (${groupCandidates.length})`}
          />
          <div className="divide-y divide-border/60">
            {groupCandidates.map((candidate) => {
              const busy = busyId === candidate.id;
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
                          {statusLabel(candidate)}
                        </span>
                      </div>
                      {candidate.summary ? (
                        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                          {candidate.summary}
                        </p>
                      ) : null}
                    </div>
                    {candidate.status === "needs_review" ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {candidate.projectId === null ? (
                          <Select
                            value={
                              assignments[candidate.id]
                                ? String(assignments[candidate.id])
                                : undefined
                            }
                            onValueChange={(value) =>
                              setAssignments((current) => ({
                                ...current,
                                [candidate.id]: Number(value),
                              }))
                            }
                          >
                            <SelectTrigger size="sm" className="w-48">
                              <SelectValue placeholder="Assign project" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectOptions.map((option) => (
                                <SelectItem key={option.id} value={String(option.id)}>
                                  {option.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void reviewCandidate(candidate, "reject")}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void reviewCandidate(candidate, "accept")}
                        >
                          Accept
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
