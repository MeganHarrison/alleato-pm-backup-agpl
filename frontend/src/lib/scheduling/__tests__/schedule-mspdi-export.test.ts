import type { DependencyType, ScheduleTask } from "@/types/scheduling";
import { exportScheduleToMspdiXml } from "../schedule-mspdi-export";

function task(id: string, overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id,
    project_id: 43,
    parent_task_id: null,
    name: id,
    start_date: "2026-08-03",
    finish_date: "2026-08-04",
    duration_days: 2,
    percent_complete: 25,
    status: "in_progress",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 1,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
    schedule_mode: "auto",
    ...overrides,
  };
}

function dependency(
  taskId: string,
  predecessorTaskId: string,
  dependencyType: DependencyType,
  lagDays = 0,
) {
  return {
    id: `${predecessorTaskId}-${taskId}-${dependencyType}`,
    task_id: taskId,
    predecessor_task_id: predecessorTaskId,
    dependency_type: dependencyType,
    lag_days: lagDays,
    created_at: "2026-07-28T00:00:00.000Z",
  };
}

const generatedAt = new Date("2026-07-29T12:34:56.000Z");

describe("Microsoft Project XML export", () => {
  it("emits a deterministic MSPDI project and escapes user text", () => {
    const result = exportScheduleToMspdiXml({
      projectId: "43",
      projectName: 'North & South <Tower> "A"',
      generatedAt,
      tasks: [task("task-1", { name: "Frame & enclose" })],
    });

    expect(result.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
    expect(result.xml).toContain(
      '<Project xmlns="http://schemas.microsoft.com/project">',
    );
    expect(result.xml).toContain("<SaveVersion>12</SaveVersion>");
    expect(result.xml).toContain("<CurrencyCode>USD</CurrencyCode>");
    expect(result.xml).toContain(
      "<Title>North &amp; South &lt;Tower&gt; &quot;A&quot;</Title>",
    );
    expect(result.xml).toContain("<Name>Frame &amp; enclose</Name>");
    expect(result.xml).toContain("<StartDate>2026-08-03T08:00:00</StartDate>");
    expect(result.xml).toContain("<Duration>PT16H0M0S</Duration>");
    expect(result.xml).toContain("<DurationFormat>7</DurationFormat>");
    expect(result.warnings).toEqual([
      expect.stringMatching(/standard Monday-Friday, 8-hour calendar/),
    ]);
  });

  it("orders hierarchy deterministically and emits outline metadata", () => {
    const result = exportScheduleToMspdiXml({
      projectId: "43",
      generatedAt,
      tasks: [
        task("child-b", { parent_task_id: "summary", sort_order: 2 }),
        task("root-b", { sort_order: 2 }),
        task("summary", { sort_order: 1, wbs_code: "A" }),
        task("child-a", { parent_task_id: "summary", sort_order: 1 }),
      ],
    });

    expect(result.xml.indexOf("<Name>summary</Name>")).toBeLessThan(
      result.xml.indexOf("<Name>child-a</Name>"),
    );
    expect(result.xml.indexOf("<Name>child-a</Name>")).toBeLessThan(
      result.xml.indexOf("<Name>child-b</Name>"),
    );
    expect(result.xml).toContain(
      "<Name>summary</Name><WBS>A</WBS><OutlineNumber>1</OutlineNumber><OutlineLevel>1</OutlineLevel>",
    );
    expect(result.xml).toContain(
      "<Name>child-a</Name><WBS>1.1</WBS><OutlineNumber>1.1</OutlineNumber><OutlineLevel>2</OutlineLevel>",
    );
    expect(result.xml).toContain("<Summary>1</Summary>");
  });

  it.each([
    ["finish_to_finish", 0],
    ["finish_to_start", 1],
    ["start_to_finish", 2],
    ["start_to_start", 3],
  ] satisfies Array<[DependencyType, number]>)(
    "maps %s dependencies and signed working-day lag",
    (dependencyType, projectType) => {
      const result = exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [
          task("predecessor", { sort_order: 1 }),
          task("successor", {
            sort_order: 2,
            dependencies: [
              dependency("successor", "predecessor", dependencyType, -1.5),
            ],
          }),
        ],
      });

      expect(result.xml).toContain("<PredecessorUID>1</PredecessorUID>");
      expect(result.xml).toContain(`<Type>${projectType}</Type>`);
      expect(result.xml).toContain("<LinkLag>-7200</LinkLag>");
      expect(result.xml).toContain("<LagFormat>7</LagFormat>");
    },
  );

  it("preserves progress, actuals, remaining duration, deadline, work, milestone, and constraints", () => {
    const result = exportScheduleToMspdiXml({
      projectId: "43",
      generatedAt,
      tasks: [
        task("milestone", {
          is_milestone: true,
          duration_days: 5,
          percent_complete: 100,
          actual_start_date: "2026-08-03",
          actual_finish_date: "2026-08-03",
          remaining_duration_days: 1.5,
          constraint_type: "finish_no_later_than",
          constraint_date: "2026-08-05",
          deadline: {
            id: "deadline",
            task_id: "milestone",
            deadline_date: "2026-08-06",
            created_at: "2026-07-28T00:00:00.000Z",
          },
          work_minutes: 90,
        }),
      ],
    });

    expect(result.xml).toContain("<Duration>PT0H0M0S</Duration>");
    expect(result.xml).toContain("<Work>PT1H30M0S</Work>");
    expect(result.xml).toContain("<Milestone>1</Milestone>");
    expect(result.xml).toContain("<PercentComplete>100</PercentComplete>");
    expect(result.xml).not.toContain("<PercentWorkComplete>");
    expect(result.xml).toContain("<ActualStart>2026-08-03T08:00:00</ActualStart>");
    expect(result.xml).toContain("<ActualFinish>2026-08-03T17:00:00</ActualFinish>");
    expect(result.xml).toContain("<RemainingDuration>PT12H0M0S</RemainingDuration>");
    expect(result.xml).toContain("<ConstraintType>7</ConstraintType>");
    expect(result.xml).toContain("<ConstraintDate>2026-08-05T17:00:00</ConstraintDate>");
    expect(result.xml).toContain("<Deadline>2026-08-06T17:00:00</Deadline>");
  });

  it("omits broken relationships and reports every lossy conversion", () => {
    const result = exportScheduleToMspdiXml({
      projectId: "43",
      generatedAt,
      tasks: [
        task("task-1", {
          parent_task_id: "missing-parent",
          schedule_mode: "manual",
          constraint_type: "must_start_on",
          constraint_date: null,
          segments: [{
            id: "segment",
            task_id: "task-1",
            segment_index: 0,
            starts_at: "2026-08-03T08:00:00Z",
            ends_at: "2026-08-03T12:00:00Z",
            planned_minutes: 240,
            lock_reason: null,
          }],
          dependencies: [
            dependency("task-1", "missing-predecessor", "finish_to_start"),
          ],
        }),
      ],
    });

    expect(result.xml).not.toContain("<PredecessorLink>");
    expect(result.warnings).toHaveLength(6);
    expect(result.warnings.join("\n")).toMatch(/standard Monday-Friday/);
    expect(result.warnings.join("\n")).toMatch(/missing parent/);
    expect(result.warnings.join("\n")).toMatch(/manually scheduled/);
    expect(result.warnings.join("\n")).toMatch(/constraint was omitted/);
    expect(result.warnings.join("\n")).toMatch(/leveling segment/);
    expect(result.warnings.join("\n")).toMatch(/missing predecessor/);
  });

  it("fails loudly for duplicate IDs and cyclic hierarchy", () => {
    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [task("duplicate"), task("duplicate")],
      }),
    ).toThrow("duplicate schedule task id");

    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [
          task("a", { parent_task_id: "b" }),
          task("b", { parent_task_id: "a" }),
        ],
      }),
    ).toThrow("cyclic task hierarchy");
  });

  it("fails loudly for empty schedules, invalid calendar dates, and schema limits", () => {
    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [],
      }),
    ).toThrow("without tasks");

    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [task("invalid-date", { start_date: "2026-02-31" })],
      }),
    ).toThrow("not a valid ISO date");

    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        projectName: "x".repeat(256),
        generatedAt,
        tasks: [task("task")],
      }),
    ).toThrow("Project name exceeds");
  });

  it("does not invent unknown duration or work progress", () => {
    const result = exportScheduleToMspdiXml({
      projectId: "43",
      generatedAt,
      tasks: [task("unknown-duration", { duration_days: null })],
    });

    expect(result.xml).not.toContain("<Duration>");
    expect(result.xml).not.toContain("<PercentWorkComplete>");
    expect(result.warnings).toEqual([
      expect.stringMatching(/standard Monday-Friday, 8-hour calendar/),
      'Task "unknown-duration" has no duration; Project will infer it from the exported dates.',
    ]);
  });

  it("rejects remaining-duration and outline values outside schema limits", () => {
    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [
          task("invalid-remaining", { remaining_duration_days: -1 }),
        ],
      }),
    ).toThrow("Remaining duration for invalid-remaining must be a non-negative number");

    const deepTasks = Array.from({ length: 257 }, (_, index) =>
      task(`task-${index}`, {
        parent_task_id: index === 0 ? null : `task-${index - 1}`,
        sort_order: index + 1,
      }),
    );
    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: deepTasks,
      }),
    ).toThrow("Outline number");
  });

  it("rejects XML 1.0-forbidden characters with field context", () => {
    expect(() =>
      exportScheduleToMspdiXml({
        projectId: "43",
        generatedAt,
        tasks: [task("control-character", { name: "Framing\u0001Task" })],
      }),
    ).toThrow("Task name for control-character contains a character");
  });
});
