import { SchedulingService } from "../scheduling-service";

const projectId = "43";
const taskId = "task-in-project";

function serviceWithAuth() {
  return new SchedulingService({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: jest.fn(),
  } as never);
}

describe("SchedulingService project ownership boundary", () => {
  it("rejects deletion before mutating when the task is not in the requested project", async () => {
    const service = serviceWithAuth();
    jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
      tasks: [],
      dependencies: [],
    });

    await expect(service.deleteDependency(projectId, taskId, "foreign-dependency")).rejects.toThrow(
      "Task not found for this project.",
    );
  });

  it("rejects deadline writes before mutating when the task is not in the requested project", async () => {
    const service = serviceWithAuth();
    jest.spyOn(service, "getTaskById").mockResolvedValue(null);

    await expect(service.setDeadline(projectId, { task_id: taskId, deadline_date: "2026-07-31" })).rejects.toThrow(
      "Task not found for this project.",
    );
  });

  it("rejects deadline deletion before mutating when the task is not in the requested project", async () => {
    const service = serviceWithAuth();
    jest.spyOn(service, "getTaskById").mockResolvedValue(null);

    await expect(service.removeDeadline(projectId, taskId)).rejects.toThrow("Task not found for this project.");
  });

  it("rejects a predecessor from another project", async () => {
    const service = serviceWithAuth();
    jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
      tasks: [{ id: taskId }],
      dependencies: [],
    });

    await expect(service.createDependency(projectId, {
      task_id: taskId,
      predecessor_task_id: "foreign-task",
    })).rejects.toThrow("Both the task and predecessor must belong to this project.");
  });

  it("rejects a predecessor that closes a circular dependency chain", async () => {
    const service = serviceWithAuth();
    jest.spyOn(service as never, "fetchScheduleGraph").mockResolvedValue({
      tasks: [{ id: taskId }, { id: "valid-task" }],
      dependencies: [
        {
          id: "existing",
          task_id: "valid-task",
          predecessor_task_id: taskId,
          dependency_type: "finish_to_start",
          lag_days: 0,
          created_at: "2026-07-29T00:00:00.000Z",
        },
      ],
    });

    await expect(service.createDependency(projectId, {
      task_id: taskId,
      predecessor_task_id: "valid-task",
    })).rejects.toThrow("Cannot create dependency: this predecessor would create a circular dependency chain.");
  });
});
