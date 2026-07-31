import {
  assertScheduleRevisionTransition,
  compareScheduleRevisionSnapshots,
  selectCurrentPublishedScheduleRevision,
  type ScheduleRevision,
  type ScheduleRevisionTaskSnapshot,
} from "../schedule-revisions";

const baseline: ScheduleRevisionTaskSnapshot[] = [
  { source_task_id: "task-a", name: "Mobilize", start_date: "2026-08-01", finish_date: "2026-08-03", duration_days: 3, percent_complete: 0, status: "not_started" },
  { source_task_id: "task-b", name: "Install", start_date: "2026-08-04", finish_date: "2026-08-10", duration_days: 7, percent_complete: 0, status: "not_started" },
];

describe("schedule revision domain", () => {
  it("rejects an invalid draft-to-published bypass before any publish write", () => {
    expect(() => assertScheduleRevisionTransition("draft", "published", "project_member")).toThrow(
      "Schedule revision must be in review before publication.",
    );
  });

  it("rejects publication by a viewer", () => {
    expect(() => assertScheduleRevisionTransition("review", "published", "viewer")).toThrow(
      "Only a project manager or app admin can publish a schedule revision.",
    );
  });

  it("returns only the current published revision, never a newer draft or superseded revision", () => {
    const revisions: ScheduleRevision[] = [
      { id: "baseline", project_id: 43, revision_number: 1, status: "superseded", published_at: "2026-08-01T10:00:00.000Z" },
      { id: "published", project_id: 43, revision_number: 2, status: "published", published_at: "2026-08-02T10:00:00.000Z" },
      { id: "draft", project_id: 43, revision_number: 3, status: "draft", published_at: null },
    ];

    expect(selectCurrentPublishedScheduleRevision(revisions)?.id).toBe("published");
  });

  it("compares immutable revision snapshots without consulting mutable live tasks", () => {
    const comparison = compareScheduleRevisionSnapshots(baseline, [
      baseline[0],
      { ...baseline[1], finish_date: "2026-08-12", duration_days: 9 },
      { source_task_id: "task-c", name: "Commission", start_date: "2026-08-13", finish_date: "2026-08-14", duration_days: 2, percent_complete: 0, status: "not_started" },
    ]);

    expect(comparison.added.map((task) => task.source_task_id)).toEqual(["task-c"]);
    expect(comparison.changed).toEqual([
      expect.objectContaining({ source_task_id: "task-b", changed_fields: ["finish_date", "duration_days"] }),
    ]);
    expect(comparison.removed).toEqual([]);
  });
});
