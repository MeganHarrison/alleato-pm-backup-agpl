process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { PATCH, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const createDependencyMock = jest.fn();
const updateDependencyMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    createDependency: createDependencyMock,
    updateDependency: updateDependencyMock,
  })),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function request(body: unknown) {
  return new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/dependencies", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/projects/[projectId]/scheduling/tasks/[taskId]/dependencies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({
      auth: { getUser: jest.fn() },
    } as never);
    createDependencyMock.mockResolvedValue({ id: "dependency-1" });
    updateDependencyMock.mockResolvedValue({ id: "dependency-1" });
  });

  it("rejects a self-referential predecessor with a corrective client error", async () => {
    const response = await POST(request({ predecessor_task_id: "task-1" }), {
      params: Promise.resolve({ projectId: "43", taskId: "task-1" }),
    });

    await expect(response.json()).resolves.toEqual({
      error: "A task cannot depend on itself. Select another predecessor.",
    });
    expect(response.status).toBe(400);
  });

  it("rejects a dependency update without a target or changed values", async () => {
    const response = await PATCH(request({}), {
      params: Promise.resolve({ projectId: "43", taskId: "task-1" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "A dependency ID is required." });
    expect(response.status).toBe(400);
  });

  it("returns an actionable client error when the predecessor belongs to another project", async () => {
    createDependencyMock.mockRejectedValue(new Error("Both the task and predecessor must belong to this project."));
    const response = await POST(request({ predecessor_task_id: "foreign-task" }), {
      params: Promise.resolve({ projectId: "43", taskId: "task-1" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "Both the task and predecessor must belong to this project." });
    expect(response.status).toBe(400);
  });

  it("returns an actionable client error when an update would create a cycle", async () => {
    updateDependencyMock.mockRejectedValue(new Error("Cannot update dependency: this predecessor would create a circular dependency chain."));
    const response = await PATCH(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/dependencies?dependencyId=dependency-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ predecessor_task_id: "task-2" }),
    }), { params: Promise.resolve({ projectId: "43", taskId: "task-1" }) });

    await expect(response.json()).resolves.toEqual({ error: "Cannot update dependency: this predecessor would create a circular dependency chain." });
    expect(response.status).toBe(400);
  });

  it("accepts a bounded negative lag as lead time", async () => {
    const response = await POST(request({
      predecessor_task_id: "task-2",
      dependency_type: "finish_to_start",
      lag_days: -2,
    }), {
      params: Promise.resolve({ projectId: "43", taskId: "task-1" }),
    });

    expect(response.status).toBe(201);
    expect(createDependencyMock).toHaveBeenCalledWith("43", expect.objectContaining({ lag_days: -2 }));
  });

  it("accepts a bounded negative lead when updating a dependency", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/dependencies?dependencyId=dependency-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lag_days: -3 }),
    }), { params: Promise.resolve({ projectId: "43", taskId: "task-1" }) });

    expect(response.status).toBe(200);
    expect(updateDependencyMock).toHaveBeenCalledWith("43", "task-1", "dependency-1", { lag_days: -3 });
  });

  it("rejects lead or lag outside the supported one-year bound", async () => {
    const response = await POST(request({ predecessor_task_id: "task-2", lag_days: -366 }), {
      params: Promise.resolve({ projectId: "43", taskId: "task-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error_code: "VALIDATION",
      error_message: "Lead or lag must be a whole number from -365 to 365 working days.",
      where_it_failed: "projects/[projectId]/scheduling/tasks/[taskId]/dependencies#POST",
    });
    expect(createDependencyMock).not.toHaveBeenCalled();
  });
});
