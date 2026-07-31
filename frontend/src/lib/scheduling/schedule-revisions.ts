export type ScheduleRevisionStatus = "draft" | "review" | "published" | "superseded";
export type ScheduleRevisionActorRole = "viewer" | "project_member" | "project_manager" | "app_admin";

export type ScheduleRevision = {
  id: string;
  project_id: number;
  revision_number: number;
  status: ScheduleRevisionStatus;
  published_at: string | null;
};

export type ScheduleRevisionTaskSnapshot = {
  source_task_id: string;
  name: string;
  start_date: string | null;
  finish_date: string | null;
  duration_days: number | null;
  percent_complete: number;
  status: string;
};

export type ScheduleRevisionComparison = {
  added: ScheduleRevisionTaskSnapshot[];
  removed: ScheduleRevisionTaskSnapshot[];
  changed: Array<ScheduleRevisionTaskSnapshot & { changed_fields: Array<keyof ScheduleRevisionTaskSnapshot> }>;
};

function canPublish(role: ScheduleRevisionActorRole): boolean {
  return role === "project_manager" || role === "app_admin";
}

/**
 * Mirrors the transition guard enforced by the publishing RPC. Client callers
 * use this only for early feedback; the database remains authoritative.
 */
export function assertScheduleRevisionTransition(
  from: ScheduleRevisionStatus,
  to: ScheduleRevisionStatus,
  role: ScheduleRevisionActorRole,
): void {
  if (from === to) throw new Error("Schedule revision is already in that state.");
  if (to === "review") {
    if (from !== "draft") throw new Error("Only a draft schedule revision can enter review.");
    if (!canPublish(role)) throw new Error("Only a project manager or app admin can request schedule revision review.");
    return;
  }
  if (to === "published") {
    if (from !== "review") throw new Error("Schedule revision must be in review before publication.");
    if (!canPublish(role)) throw new Error("Only a project manager or app admin can publish a schedule revision.");
    return;
  }
  if (to === "superseded") {
    if (from !== "published") throw new Error("Only a published schedule revision can be superseded.");
    if (!canPublish(role)) throw new Error("Only a project manager or app admin can supersede a schedule revision.");
    return;
  }
  throw new Error("Published and superseded schedule revisions cannot return to draft.");
}

/** Returns the one stakeholder-safe revision, not merely the newest record. */
export function selectCurrentPublishedScheduleRevision(
  revisions: ScheduleRevision[],
): ScheduleRevision | null {
  return revisions
    .filter((revision) => revision.status === "published" && revision.published_at !== null)
    .sort((left, right) => right.revision_number - left.revision_number)[0] ?? null;
}

export function compareScheduleRevisionSnapshots(
  baseline: ScheduleRevisionTaskSnapshot[],
  revision: ScheduleRevisionTaskSnapshot[],
): ScheduleRevisionComparison {
  const baselineBySourceTaskId = new Map(baseline.map((task) => [task.source_task_id, task]));
  const revisionBySourceTaskId = new Map(revision.map((task) => [task.source_task_id, task]));
  const comparisonFields: Array<keyof ScheduleRevisionTaskSnapshot> = [
    "name", "start_date", "finish_date", "duration_days", "percent_complete", "status",
  ];
  const changed = revision.flatMap((task) => {
    const prior = baselineBySourceTaskId.get(task.source_task_id);
    if (!prior) return [];
    const changed_fields = comparisonFields.filter((field) => prior[field] !== task[field]);
    return changed_fields.length ? [{ ...task, changed_fields }] : [];
  });

  return {
    added: revision.filter((task) => !baselineBySourceTaskId.has(task.source_task_id)),
    removed: baseline.filter((task) => !revisionBySourceTaskId.has(task.source_task_id)),
    changed,
  };
}
