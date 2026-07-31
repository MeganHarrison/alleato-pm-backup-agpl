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
    schedule_version: 1,
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

function serviceWithAuth() {
  const from = jest.fn();
  const rpc = jest.fn().mockResolvedValue({
    data: {
      mutation_kind: "task_update",
      cascade_outcome: "applied",
      task: task("A", "2026-08-07", "2026-08-10"),
      dependency: dependency("B", "A"),
      task_versions: { A: 2, B: 2 },
    },
    error: null,
  });
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from,
    rpc,
  };
  const service = new SchedulingService(client as never, {
    actorUserId: "user-1",
    mutationClient: client as never,
  });
  return { service, from, rpc };
}

describe("SchedulingService auto-scheduling integration", () => {
  describe("createDependency", () => {
    it("applies the computed cascade after the dependency insert succeeds", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service, "getTaskById").mockResolvedValue({ id: "A" } as never);
      jest.spyOn(service, "getDependencies").mockResolvedValue([]);
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-03", "2026-08-04")],
        dependencies: [],
        calendar: {
          working_weekdays: [1, 2, 3, 4, 5],
          non_working_dates: ["2026-08-10"],
        },
      });
      const result = await service.createDependency(projectId, { task_id: "B", predecessor_task_id: "A" });

      expect(result).toEqual(dependency("B", "A"));
      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_cascade_outcome: "applied",
          p_cascade_updates: [
            { task_id: "B", start_date: "2026-08-11", finish_date: "2026-08-12" },
          ],
        }),
      );
    });

    it("rejects the dependency and writes nothing when the cascade would violate a constraint", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service, "getTaskById").mockResolvedValue({ id: "A" } as never);
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

      expect(rpc).not.toHaveBeenCalled();
    });

    it("rejects the dependency before writing when its anchor lacks schedule dates", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service, "getTaskById").mockResolvedValue({ id: "A" } as never);
      jest.spyOn(service, "getDependencies").mockResolvedValue([]);
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "", "", { start_date: null, finish_date: null }),
          task("B", "2026-08-03", "2026-08-04"),
        ],
        dependencies: [],
      });

      await expect(
        service.createDependency(projectId, {
          task_id: "B",
          predecessor_task_id: "A",
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringMatching(/Complete valid dates and duration for every affected task/),
      });

      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe("updateDependency", () => {
    it("rejects the relationship edit before writing when analysis is unavailable", async () => {
      const { service, from } = serviceWithAuth();
      const existing = dependency("B", "A");
      jest.spyOn(service, "getTaskById").mockResolvedValue({ id: "B" } as never);
      jest.spyOn(service, "getDependencies").mockResolvedValue([existing]);
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "", "", { start_date: null, finish_date: null }),
          task("B", "2026-08-03", "2026-08-04"),
        ],
        dependencies: [existing],
      });

      await expect(
        service.updateDependency(projectId, "B", existing.id, {
          lag_days: 1,
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringMatching(/Complete valid dates and duration for every affected task/),
      });

      expect(from).not.toHaveBeenCalled();
    });
  });

  describe("updateTask", () => {
    it("persists a duration and schedules a fully undated task from its existing predecessor", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "2026-08-11", "2026-08-12"),
          task("B", "", "", {
            start_date: null,
            finish_date: null,
            duration_days: null,
          }),
        ],
        dependencies: [dependency("B", "A")],
        calendar: {
          working_weekdays: [1, 2, 3, 4, 5],
          non_working_dates: ["2026-08-13"],
        },
      });

      await service.updateTask(projectId, "B", { duration_days: 1 });

      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_mutation: expect.objectContaining({
            kind: "task_update",
            task_id: "B",
            changes: expect.objectContaining({ duration_days: 1 }),
          }),
          p_cascade_outcome: "applied",
          p_cascade_updates: [
            {
              task_id: "B",
              start_date: "2026-08-14",
              finish_date: "2026-08-14",
            },
          ],
        }),
      );
    });

    it("normalizes a milestone and previews its successor cascade through the same scheduler", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "2026-08-06", "2026-08-07"),
          task("B", "2026-08-10", "2026-08-11"),
        ],
        dependencies: [dependency("B", "A")],
      });

      await service.updateTask(projectId, "A", { is_milestone: true });

      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_mutation: expect.objectContaining({
            kind: "task_update",
            task_id: "A",
            changes: expect.objectContaining({
              is_milestone: true,
              duration_days: 0,
              finish_date: "2026-08-06",
            }),
          }),
          p_cascade_outcome: "applied",
          p_cascade_updates: [
            {
              task_id: "B",
              start_date: "2026-08-07",
              finish_date: "2026-08-10",
            },
          ],
        }),
      );
    });

    it("persists a duration before an undated root task receives logic", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("B", "", "", {
            start_date: null,
            finish_date: null,
            duration_days: null,
          }),
        ],
        dependencies: [],
      });

      await service.updateTask(projectId, "B", { duration_days: 3 });

      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_mutation: expect.objectContaining({
            kind: "task_update",
            task_id: "B",
            changes: expect.objectContaining({ duration_days: 3 }),
          }),
          p_cascade_outcome: "no_change",
          p_cascade_updates: [],
        }),
      );
    });

    it("cascades a date edit to successors after the task's own update is persisted", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07"), task("B", "2026-08-10", "2026-08-11")],
        dependencies: [dependency("B", "A")],
      });
      await service.updateTask(projectId, "A", { start_date: "2026-08-07", finish_date: "2026-08-10", duration_days: 2 });

      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_cascade_outcome: "applied",
          p_cascade_updates: [
            { task_id: "B", start_date: "2026-08-11", finish_date: "2026-08-12" },
          ],
        }),
      );
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

    it("rejects the edit before writing when the affected graph is circular", async () => {
      const { service, from } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "2026-08-06", "2026-08-07"),
          task("B", "2026-08-10", "2026-08-11"),
        ],
        dependencies: [dependency("B", "A"), dependency("A", "B")],
      });

      await expect(
        service.updateTask(projectId, "A", {
          start_date: "2026-08-07",
          finish_date: "2026-08-10",
          duration_days: 2,
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringMatching(/affected dependency chain is circular/),
      });

      expect(from).not.toHaveBeenCalled();
    });

    it("rejects the edit before writing when an affected task lacks schedulable dates", async () => {
      const { service, from } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [
          task("A", "2026-08-06", "2026-08-07"),
          task("B", "", "", {
            start_date: null,
            finish_date: null,
            duration_days: null,
          }),
        ],
        dependencies: [dependency("B", "A")],
      });

      await expect(
        service.updateTask(projectId, "A", {
          start_date: "2026-08-07",
          finish_date: "2026-08-10",
          duration_days: 2,
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringMatching(/Complete valid dates and duration for every affected task/),
      });

      expect(from).not.toHaveBeenCalled();
    });

    it("does not trigger the auto-scheduler for edits that touch no cascade-relevant field", async () => {
      const { service, rpc } = serviceWithAuth();
      const graphSpy = jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07")],
        dependencies: [],
      });

      await service.updateTask(projectId, "A", { status: "in_progress" });

      expect(graphSpy).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_cascade_outcome: "no_change",
          p_cascade_updates: [],
        }),
      );
    });

    it("uses an editor-captured task version for deterministic stale-write rejection", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07")],
        dependencies: [],
      });

      await service.updateTask(projectId, "A", {
        name: "Captured-version edit",
        expected_schedule_version: 41,
      });

      expect(rpc).toHaveBeenCalledWith(
        "apply_authoritative_schedule_cascade_mutation",
        expect.objectContaining({
          p_expected_task_versions: { A: 41 },
          p_mutation: {
            kind: "task_update",
            task_id: "A",
            changes: { name: "Captured-version edit" },
          },
        }),
      );
    });

    it.each([
      ["PT409", "schedule task version conflict"],
      ["PT409", "schedule dependency graph conflict"],
      ["PT409", "schedule sibling ordering conflict"],
      ["40001", "schedule task version conflict"],
    ])(
      "translates %s %s into an HTTP 409 guardrail",
      async (code, message) => {
        const { service, rpc } = serviceWithAuth();
        jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
          tasks: [task("A", "2026-08-06", "2026-08-07")],
          dependencies: [],
        });
        rpc.mockResolvedValueOnce({
          data: null,
          error: { code, message },
        });

        await expect(
          service.updateTask(projectId, "A", {
            name: "Stale edit",
            expected_schedule_version: 1,
          }),
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          status: 409,
          message: expect.stringMatching(new RegExp(message, "i")),
        });
      },
    );

    it.each([
      ["42501", "schedule management permission required", "AUTH_FORBIDDEN", 403],
      ["22023", "invalid task update mutation", "VALIDATION", 422],
    ])(
      "does not classify %s as an optimistic-concurrency conflict",
      async (code, message, expectedCode, expectedStatus) => {
        const { service, rpc } = serviceWithAuth();
        jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
          tasks: [task("A", "2026-08-06", "2026-08-07")],
          dependencies: [],
        });
        rpc.mockResolvedValueOnce({
          data: null,
          error: { code, message },
        });

        await expect(
          service.updateTask(projectId, "A", {
            name: "Rejected edit",
            expected_schedule_version: 1,
          }),
        ).rejects.toMatchObject({
          code: expectedCode,
          status: expectedStatus,
        });
      },
    );

    it("keeps an unknown database failure as an internal error", async () => {
      const { service, rpc } = serviceWithAuth();
      jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
        tasks: [task("A", "2026-08-06", "2026-08-07")],
        dependencies: [],
      });
      rpc.mockResolvedValueOnce({
        data: null,
        error: {
          code: "P0001",
          message: "unexpected database failure",
        },
      });

      await expect(
        service.updateTask(projectId, "A", {
          name: "Rejected edit",
          expected_schedule_version: 1,
        }),
      ).rejects.toThrow(
        "Authoritative schedule mutation failed: unexpected database failure",
      );
    });
  });
});
