import { buildScheduleRiskSummary } from "../schedule-risk-summary";

describe("schedule risk summary", () => {
  it("reports unavailable rather than inferring no risk without a published revision", () => {
    expect(buildScheduleRiskSummary({ projectId: 43, revision: null, tasks: [], submittalRisks: [] })).toEqual({
      state: "unavailable",
      reason: "No published schedule revision is available for this summary.",
    });
  });

  it("emits only source-linked material risks", () => {
    expect(buildScheduleRiskSummary({
      projectId: 43,
      revision: { id: "revision-2", revisionNumber: 2 },
      tasks: [{ sourceTaskId: "task-1", name: "Place foundation", forecastFinishDate: "2026-08-08", constraint: { type: "finish_no_later_than", date: "2026-08-07" } }],
      submittalRisks: [{ sourceTaskId: "task-1", submittalId: "submittal-1", reason: "Concrete mix submittal is rejected." }],
    })).toEqual({
      state: "ready",
      revisionId: "revision-2",
      revisionNumber: 2,
      risks: [
        expect.objectContaining({
          kind: "constraint",
          source: { href: "/43/schedule?task_id=task-1", label: "Place foundation" },
        }),
        expect.objectContaining({
          kind: "submittal",
          source: { href: "/43/submittals/submittal-1", label: "View submittal" },
        }),
      ],
    });
  });
});
