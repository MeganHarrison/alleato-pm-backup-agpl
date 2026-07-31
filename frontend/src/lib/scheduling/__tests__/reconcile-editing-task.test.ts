import { reconcileEditingTask } from "../reconcile-editing-task";
import type { ScheduleTask, ScheduleTaskWithHierarchy } from "@/types/scheduling";

const task = (id: string, dependencies: ScheduleTask["dependencies"] = []): ScheduleTask => ({
  id,
  project_id: 43,
  parent_task_id: null,
  name: id,
  start_date: null,
  finish_date: null,
  duration_days: null,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  constraint_type: null,
  constraint_date: null,
  wbs_code: null,
  sort_order: 0,
  created_at: "2026-07-20T00:00:00.000Z",
  updated_at: "2026-07-20T00:00:00.000Z",
  dependencies,
});

describe("reconcileEditingTask", () => {
  it("replaces the open task snapshot with refreshed nested relationship data", () => {
    const staleTask = task("successor");
    const refreshedTasks: ScheduleTaskWithHierarchy[] = [
      {
        ...task("parent"),
        children: [
          task("successor", [{
            id: "dependency-1",
            task_id: "successor",
            predecessor_task_id: "predecessor",
            dependency_type: "start_to_start",
            lag_days: 0,
            created_at: "2026-07-20T00:00:00.000Z",
          }]),
        ],
      },
    ];

    expect(reconcileEditingTask(staleTask, refreshedTasks)).toMatchObject({
      id: "successor",
      dependencies: [{ id: "dependency-1", dependency_type: "start_to_start" }],
    });
  });

  it("keeps the current snapshot when a refetch no longer contains its task", () => {
    const staleTask = task("successor");

    expect(reconcileEditingTask(staleTask, [task("other")])).toBe(staleTask);
  });
});
