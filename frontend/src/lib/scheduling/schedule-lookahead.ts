export type PublishedScheduleRevision = {
  id: string;
  project_id: number;
  revision_number: number;
  status: "draft" | "review" | "published" | "superseded";
  snapshot_context_provenance: "captured" | "reconstructed";
};

export type ScheduleLookaheadTaskSnapshot = {
  source_task_id: string;
  name: string;
  start_date: string | null;
  finish_date: string | null;
  forecast_start_date: string | null;
  forecast_finish_date: string | null;
  is_milestone: boolean;
  constraint_type: string | null;
  constraint_date: string | null;
};

export type ScheduleLookaheadDependencySnapshot = {
  task_source_id: string;
  predecessor_source_id: string;
  dependency_type: string;
  lag_days: number;
};

export type SubmittalRisk = { status: "clear" | "at_risk"; reason?: string };

type LookaheadOptions = {
  weeks: 2 | 3 | 6;
  startDate: string;
  submittalRiskByTaskId: Record<string, SubmittalRisk>;
};

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Lookahead start date must be a valid ISO date.");
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function intersectsWindow(start: string | null, finish: string | null, windowStart: string, windowEnd: string): boolean {
  const effectiveStart = start ?? finish;
  const effectiveFinish = finish ?? start;
  return Boolean(effectiveStart && effectiveFinish && effectiveStart <= windowEnd && effectiveFinish >= windowStart);
}

/** Projects a lookahead exclusively from an immutable published revision snapshot. */
export function projectPublishedLookahead(
  revision: PublishedScheduleRevision,
  tasks: ScheduleLookaheadTaskSnapshot[],
  dependencies: ScheduleLookaheadDependencySnapshot[],
  options: LookaheadOptions,
) {
  if (revision.status !== "published") {
    throw new Error("A published schedule revision is required to create a lookahead.");
  }

  const start = parseDate(options.startDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + options.weeks * 7 - 1);
  const endDate = isoDate(end);

  return {
    revisionId: revision.id,
    revisionNumber: revision.revision_number,
    snapshotProvenance: revision.snapshot_context_provenance,
    window: { startDate: options.startDate, endDate, weeks: options.weeks },
    activities: tasks
      .filter((task) => intersectsWindow(
        task.forecast_start_date ?? task.start_date,
        task.forecast_finish_date ?? task.finish_date,
        options.startDate,
        endDate,
      ))
      .map((task) => ({
        sourceTaskId: task.source_task_id,
        name: task.name,
        plannedStartDate: task.start_date,
        plannedFinishDate: task.finish_date,
        forecastStartDate: task.forecast_start_date,
        forecastFinishDate: task.forecast_finish_date,
        isMilestone: task.is_milestone,
        constraint: task.constraint_type && task.constraint_date
          ? { type: task.constraint_type, date: task.constraint_date }
          : null,
        dependencies: dependencies
          .filter((dependency) => dependency.task_source_id === task.source_task_id)
          .map((dependency) => ({
            predecessorSourceId: dependency.predecessor_source_id,
            type: dependency.dependency_type,
            lagDays: dependency.lag_days,
          })),
        submittalRisk: options.submittalRiskByTaskId[task.source_task_id] ?? { status: "clear" as const },
      })),
  };
}
