export type ScheduleRiskSummaryInput = {
  projectId: number;
  revision: { id: string; revisionNumber: number } | null;
  tasks: Array<{
    sourceTaskId: string;
    name: string;
    forecastFinishDate: string | null;
    constraint: { type: string; date: string } | null;
  }>;
  submittalRisks: Array<{ sourceTaskId: string; submittalId: string; reason: string }>;
};

export type ScheduleRiskSummary =
  | { state: "unavailable"; reason: string }
  | {
      state: "ready";
      revisionId: string;
      revisionNumber: number;
      risks: Array<{
        id: string;
        kind: "constraint" | "submittal";
        summary: string;
        source: { href: string; label: string };
      }>;
    };

/**
 * Builds a read-only summary from immutable published-revision evidence only.
 * A missing revision is deliberately unavailable, never treated as no risk.
 */
export function buildScheduleRiskSummary(input: ScheduleRiskSummaryInput): ScheduleRiskSummary {
  if (!input.revision) {
    return {
      state: "unavailable",
      reason: "No published schedule revision is available for this summary.",
    };
  }

  const risks: Extract<ScheduleRiskSummary, { state: "ready" }>["risks"] = [];
  for (const task of input.tasks) {
    if (
      task.constraint?.type === "finish_no_later_than" &&
      task.forecastFinishDate &&
      task.forecastFinishDate > task.constraint.date
    ) {
      risks.push({
        id: `constraint:${task.sourceTaskId}`,
        kind: "constraint",
        summary: `${task.name} forecasts finish ${task.forecastFinishDate}, after its no-later-than date of ${task.constraint.date}.`,
        source: { href: `/${input.projectId}/schedule?task_id=${encodeURIComponent(task.sourceTaskId)}`, label: task.name },
      });
    }
  }

  for (const risk of input.submittalRisks) {
    risks.push({
      id: `submittal:${risk.submittalId}`,
      kind: "submittal",
      summary: risk.reason,
      source: { href: `/${input.projectId}/submittals/${risk.submittalId}`, label: "View submittal" },
    });
  }

  return {
    state: "ready",
    revisionId: input.revision.id,
    revisionNumber: input.revision.revisionNumber,
    risks,
  };
}
