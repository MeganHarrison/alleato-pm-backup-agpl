import type { TasksRow } from "@/features/tasks/task-utils";
import {
  buildHomeActivity,
  selectHomeTasks,
  taskHomeTitle,
} from "./plane-home-model";

function task(overrides: Partial<TasksRow>): TasksRow {
  return {
    id: overrides.id ?? "task",
    title: null,
    description: "Task",
    status: "open",
    priority: null,
    due_date: null,
    updated_at: null,
    created_at: null,
    ...overrides,
  } as TasksRow;
}

describe("Plane Home model", () => {
  it("shows only actionable tasks and sorts dated work first", () => {
    const result = selectHomeTasks([
      task({ id: "later", due_date: "2026-08-20", priority: "urgent" }),
      task({ id: "done", status: "done", due_date: "2026-07-01" }),
      task({ id: "undated", due_date: null, priority: "urgent" }),
      task({ id: "sooner", due_date: "2026-08-01", priority: "low" }),
    ]);

    expect(result.map((item) => item.id)).toEqual([
      "sooner",
      "later",
      "undated",
    ]);
  });

  it("builds a newest-first activity feed with canonical record links", () => {
    const result = buildHomeActivity(
      "31",
      [
        {
          id: 12,
          title: "Owner meeting",
          file_name: null,
          date: "2026-07-28",
          created_at: "2026-07-28T15:00:00Z",
          summary: "Reviewed closeout.",
          overview: null,
          description: null,
          notes: null,
        },
      ],
      [
        {
          id: "log-2",
          log_date: "2026-07-30",
          general_notes: "Steel delivery received.",
          status: "complete",
          weather_conditions: null,
        },
      ],
    );

    expect(result.map((item) => item.kind)).toEqual([
      "daily-log",
      "meeting",
    ]);
    expect(result[0].href).toBe("/31/daily-log/log-2/edit");
    expect(result[1].href).toBe("/31/meetings/12");
  });

  it("uses the task description when a title is not present", () => {
    expect(
      taskHomeTitle(
        task({ title: "  ", description: "  Issue door hardware  " }),
      ),
    ).toBe("Issue door hardware");
  });
});

