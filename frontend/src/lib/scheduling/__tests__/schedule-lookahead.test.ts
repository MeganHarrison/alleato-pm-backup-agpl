import { projectPublishedLookahead } from "../schedule-lookahead";

const publishedRevision = {
  id: "revision-1",
  project_id: 43,
  revision_number: 2,
  status: "published" as const,
  snapshot_context_provenance: "captured" as const,
};

const tasks = [
  {
    source_task_id: "task-foundation",
    name: "Place foundation",
    start_date: "2026-08-03",
    finish_date: "2026-08-07",
    forecast_start_date: "2026-08-04",
    forecast_finish_date: "2026-08-08",
    is_milestone: false,
    constraint_type: "finish_no_later_than",
    constraint_date: "2026-08-07",
  },
  {
    source_task_id: "task-roof",
    name: "Roof complete",
    start_date: "2026-09-20",
    finish_date: "2026-09-20",
    forecast_start_date: null,
    forecast_finish_date: null,
    is_milestone: true,
    constraint_type: null,
    constraint_date: null,
  },
];

describe("projectPublishedLookahead", () => {
  it("rejects any state that is not a published immutable revision", () => {
    expect(() => projectPublishedLookahead({ ...publishedRevision, status: "draft" }, tasks, [], {
      weeks: 2,
      startDate: "2026-08-03",
      submittalRiskByTaskId: {},
    })).toThrow("published schedule revision");
  });

  it("uses only the selected published snapshot window and preserves forecast, dependency, and constraint evidence", () => {
    const result = projectPublishedLookahead(publishedRevision, tasks, [
      { task_source_id: "task-foundation", predecessor_source_id: "task-permit", dependency_type: "finish_to_start", lag_days: 1 },
    ], {
      weeks: 2,
      startDate: "2026-08-03",
      submittalRiskByTaskId: {
        "task-foundation": { status: "at_risk", reason: "Concrete mix submittal is overdue." },
      },
    });

    expect(result).toMatchObject({
      revisionId: "revision-1",
      window: { startDate: "2026-08-03", endDate: "2026-08-16", weeks: 2 },
      activities: [
        expect.objectContaining({
          sourceTaskId: "task-foundation",
          forecastFinishDate: "2026-08-08",
          constraint: expect.objectContaining({ type: "finish_no_later_than", date: "2026-08-07" }),
          dependencies: [expect.objectContaining({ predecessorSourceId: "task-permit", lagDays: 1 })],
          submittalRisk: { status: "at_risk", reason: "Concrete mix submittal is overdue." },
        }),
      ],
    });
    expect(result.activities).toHaveLength(1);
  });
});
