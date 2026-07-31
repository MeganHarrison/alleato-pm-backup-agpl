import {
  createScheduleDependency,
  removeScheduleDeadline,
  removeScheduleDependency,
  saveScheduleDeadline,
  updateScheduleDependency,
} from "../dependency-api";

describe("schedule dependency API client", () => {
  afterEach(() => jest.restoreAllMocks());

  it("creates a typed dependency through the project-scoped task endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: { id: "dependency-1" },
    }), { status: 201 }));

    await expect(createScheduleDependency("43", "framing", {
      predecessor_task_id: "foundation",
      dependency_type: "finish_to_start",
      lag_days: 2,
    })).resolves.toEqual({ id: "dependency-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/43/scheduling/tasks/framing/dependencies",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          predecessor_task_id: "foundation",
          dependency_type: "finish_to_start",
          lag_days: 2,
        }),
      }),
    );
  });

  it("surfaces the API's corrective error when removal is rejected", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "Dependency not found for this schedule task.",
    }), { status: 404 }));

    await expect(removeScheduleDependency("43", "framing", "missing")).rejects.toThrow(
      "Dependency not found for this schedule task.",
    );
  });

  it("saves a deadline through the project-scoped task endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: { id: "deadline-1", deadline_date: "2026-07-19" },
    }), { status: 200 }));

    await expect(saveScheduleDeadline("43", "framing", "2026-07-19")).resolves.toEqual({
      id: "deadline-1",
      deadline_date: "2026-07-19",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/43/scheduling/tasks/framing",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ intent: "deadline", deadline_date: "2026-07-19" }),
      }),
    );
  });

  it("removes a deadline through the project-scoped task endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await expect(removeScheduleDeadline("43", "framing")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/43/scheduling/tasks/framing",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ intent: "deadline", deadline_date: null }),
      }),
    );
  });

  it("updates a dependency in place through the project-scoped task endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: { id: "dependency-1", dependency_type: "start_to_start", lag_days: 3 },
    }), { status: 200 }));

    await expect(updateScheduleDependency("43", "framing", "dependency-1", {
      dependency_type: "start_to_start",
      lag_days: 3,
    })).resolves.toEqual({
      id: "dependency-1",
      dependency_type: "start_to_start",
      lag_days: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/43/scheduling/tasks/framing/dependencies?dependencyId=dependency-1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ dependency_type: "start_to_start", lag_days: 3 }),
      }),
    );
  });
});
