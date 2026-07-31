import { SchedulingService } from "../scheduling-service";
import type { ScheduleDependency, ScheduleTask } from "@/types/scheduling";

const projectId = "43";

function task(id: string, start: string, finish: string, overrides: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id,
    project_id: 43,
    parent_task_id: null,
    name: id,
    start_date: start,
    finish_date: finish,
    duration_days: 2,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: null,
    wbs_code: null,
    sort_order: 0,
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    schedule_mode: "auto",
    ...overrides,
  };
}

function dependency(taskId: string, predecessorTaskId: string): ScheduleDependency {
  return {
    id: `${predecessorTaskId}-${taskId}`,
    task_id: taskId,
    predecessor_task_id: predecessorTaskId,
    dependency_type: "finish_to_start",
    lag_days: 0,
    created_at: "2026-07-21T00:00:00.000Z",
  };
}

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface QueryStub extends Record<string, jest.Mock> {
  then: (onFulfilled: (result: QueryResult) => unknown) => Promise<unknown>;
}

/** Chainable stub matching the subset of the Supabase query builder this service calls. */
function queryStub(result: QueryResult): QueryStub {
  const stub: QueryStub = {
    then: (onFulfilled) => Promise.resolve(result).then(onFulfilled),
  };
  // Both the terminal `.single()` call and a bare awaited chain must resolve.
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "range"]) {
    stub[method] = jest.fn(() => stub);
  }
  stub.single = jest.fn().mockResolvedValue(result);
  return stub;
}

function serviceWithAuth() {
  const from = jest.fn();
  const service = new SchedulingService({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from,
  } as never);
  return { service, from };
}

describe("SchedulingService auto-scheduling integration", () => {
  describe("createDependency", () => {
    it("applies the computed cascade after the dependency insert succeeds", async () => {
      const { service, from } = serviceWithAuth();
      jest.spyOn(service, "getTaskById").mockResolvedValue({ id: "A" } as never);
      jest.spyOn(service as never, "wouldCreateDependencyCycle").mockResolvedValue(false);
      jest.spyOn(service, "getDependencies").mockResolvedValue([]);
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-03", "2026-08-04")],
        dependencies: [],
      });
      const applySpy = jest.spyOn(service as never, "applyAutoScheduleUpdates").mockResolvedValue(undefined);

      from.mockReturnValue(queryStub({ data: dependency("B", "A"), error: null }));

      const result = await service.createDependency(projectId, { task_id: "B", predecessor_task_id: "A" });

      expect(result).toEqual(dependency("B", "A"));
      expect(applySpy).toHaveBeenCalledWith(projectId, [
        { task_id: "B", start_date: "2026-08-10", finish_date: "2026-08-11" },
      ]);
    });

    it("rejects the dependency and writes nothing when the cascade would violate a constraint", async () => {
      const { service, from } = serviceWithAuth();
      jest.spyOn(service, "getTaskById").mockResolvedValue({ id: "A" } as never);
      jest.spyOn(service as never, "wouldCreateDependencyCycle").mockResolvedValue(false);
      jest.spyOn(service, "getDependencies").mockResolvedValue([]);
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "2026-08-06", "2026-08-07"),
          task("B", "2026-08-03", "2026-08-04", { constraint_type: "must_start_on", constraint_date: "2026-08-03" }),
        ],
        dependencies: [],
      });

      await expect(
        service.createDependency(projectId, { task_id: "B", predecessor_task_id: "A" }),
      ).rejects.toThrow(/conflicts with its must start on constraint/);

      expect(from).not.toHaveBeenCalled();
    });
  });

  describe("updateTask", () => {
    it("cascades a date edit to successors after the task's own update is persisted", async () => {
      const { service, from } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
        dependencies: [dependency("B", "A")],
      });
      const applySpy = jest.spyOn(service as never, "applyAutoScheduleUpdates").mockResolvedValue(undefined);
      from.mockReturnValue(queryStub({ data: task("A", "2026-08-07", "2026-08-10"), error: null }));

      await service.updateTask(projectId, "A", { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 });

      expect(applySpy).toHaveBeenCalledWith(projectId, [
        { task_id: "B", start_date: "2026-08-11", finish_date: "2026-08-12" },
      ]);
    });

    it("blocks the edit and writes nothing when a successor's constraint would be violated", async () => {
      const { service, from } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "2026-08-06", "2026-08-07"),
          task("B", "2026-08-10", "2026-08-11", { constraint_type: "must_finish_on", constraint_date: "2026-08-11" }),
        ],
        dependencies: [dependency("B", "A")],
      });

      await expect(
        service.updateTask(projectId, "A", { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 }),
      ).rejects.toThrow(/conflicts with its must finish on constraint/);

      expect(from).not.toHaveBeenCalled();
    });

    it("does not trigger the auto-scheduler for edits that touch no cascade-relevant field", async () => {
      const { service, from } = serviceWithAuth();
      const graphSpy = jest.spyOn(service as never, "fetchScheduleGraph");
      from.mockReturnValue(queryStub({ data: task("A", "2026-08-06", "2026-08-07"), error: null }));

      await service.updateTask(projectId, "A", { status: "in_progress" });

      expect(graphSpy).not.toHaveBeenCalled();
    });
  });
});
