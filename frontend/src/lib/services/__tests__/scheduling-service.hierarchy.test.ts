import { SchedulingService } from "../scheduling-service";
import type { ScheduleTask } from "@/types/scheduling";

const projectId = "67";

function task(index: number): ScheduleTask {
  return {
    id: `task-${String(index).padStart(4, "0")}`,
    project_id: Number(projectId),
    parent_task_id: null,
    name: `Task ${index}`,
    start_date: "2026-07-01",
    finish_date: "2026-07-02",
    duration_days: 2,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: index,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

describe("SchedulingService.getTasksHierarchy", () => {
  it("loads every task in deterministic pages beyond the Supabase row cap", async () => {
    const tasks = Array.from({ length: 501 }, (_, index) => task(index + 1));
    const ranges: Array<[number, number]> = [];
    const orders: string[] = [];

    const client = {
      from: jest.fn(() => {
        const query = {
          select: () => query,
          eq: () => query,
          order: (column: string) => {
            orders.push(column);
            return query;
          },
          range: (from: number, to: number) => {
            ranges.push([from, to]);
            return Promise.resolve({
              data: tasks.slice(from, to + 1),
              error: null,
            });
          },
        };
        return query;
      }),
    };

    const service = new SchedulingService(client as never);
    jest.spyOn(service, "getDependencies").mockResolvedValue([]);
    jest.spyOn(service, "getDeadlines").mockResolvedValue([]);

    const hierarchy = await service.getTasksHierarchy(projectId);

    expect(hierarchy).toHaveLength(501);
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(orders).toEqual(["sort_order", "id", "sort_order", "id"]);
    expect(hierarchy.at(-1)?.id).toBe("task-0501");
  });
});
