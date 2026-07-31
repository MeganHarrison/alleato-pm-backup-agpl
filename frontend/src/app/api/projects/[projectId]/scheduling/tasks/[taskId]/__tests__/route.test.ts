process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";
import { DELETE, GET, PATCH, PUT } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const getTaskByIdMock = jest.fn();
const updateTaskMock = jest.fn();
const deleteTaskMock = jest.fn();
const setDeadlineMock = jest.fn();
const removeDeadlineMock = jest.fn();

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    getTaskById: getTaskByIdMock,
    updateTask: updateTaskMock,
    deleteTask: deleteTaskMock,
    setDeadline: setDeadlineMock,
    removeDeadline: removeDeadlineMock,
  })),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const context = { params: Promise.resolve({ projectId: "43", taskId: "task-1" }) };
const mutationTaskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function patchTask(body: object) {
  return PATCH(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), context);
}

function getTask(projectId = "43") {
  return GET(
    new NextRequest(
      `http://localhost/api/projects/${projectId}/scheduling/tasks/task-1`,
    ),
    { params: Promise.resolve({ projectId, taskId: "task-1" }) },
  );
}

function putTask(projectId = "43", taskId = mutationTaskId) {
  return PUT(
    new NextRequest(
      `http://localhost/api/projects/${projectId}/scheduling/tasks/${taskId}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated task" }),
      },
    ),
    { params: Promise.resolve({ projectId, taskId }) },
  );
}

function deleteTask(projectId = "43", taskId = mutationTaskId) {
  return DELETE(
    new NextRequest(
      `http://localhost/api/projects/${projectId}/scheduling/tasks/${taskId}`,
      { method: "DELETE" },
    ),
    { params: Promise.resolve({ projectId, taskId }) },
  );
}

describe("schedule task read and write authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "user-1",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({ from: jest.fn() } as never);
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    });
    getTaskByIdMock.mockResolvedValue({ id: "task-1", name: "Read only" });
    updateTaskMock.mockResolvedValue({ id: "task-1", name: "Updated task" });
    deleteTaskMock.mockResolvedValue(true);
  });

  it("retains the authenticated GET behavior without requiring write permission", async () => {
    const response = await getTask();

    expect(response.status).toBe(200);
    expect(getTaskByIdMock).toHaveBeenCalledWith("43", "task-1");
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("denies PUT and DELETE when a member lacks schedule write access", async () => {
    requirePermissionMock.mockResolvedValue(
      {
        denied: true,
        response: NextResponse.json(
          {
            error: "Insufficient permissions: requires write access to schedule",
          },
          { status: 403 },
        ),
      },
    );

    const putResponse = await putTask();
    const deleteResponse = await deleteTask();

    expect(putResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(requirePermissionMock).toHaveBeenNthCalledWith(
      1,
      43,
      "schedule",
      "write",
    );
    expect(requirePermissionMock).toHaveBeenNthCalledWith(
      2,
      43,
      "schedule",
      "write",
    );
    expect(updateTaskMock).not.toHaveBeenCalled();
    expect(deleteTaskMock).not.toHaveBeenCalled();
  });

  it("updates and deletes when schedule write permission is granted", async () => {
    const putResponse = await putTask();
    const deleteResponse = await deleteTask();

    expect(putResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(updateTaskMock).toHaveBeenCalledWith(
      "43",
      mutationTaskId,
      expect.objectContaining({ name: "Updated task" }),
    );
    expect(deleteTaskMock).toHaveBeenCalledWith("43", mutationTaskId);
  });

  it("returns cross-project denial before PUT persistence", async () => {
    requirePermissionMock.mockResolvedValue(
      {
        denied: true,
        response: NextResponse.json(
          { error: "No project membership found" },
          { status: 403 },
        ),
      },
    );

    const response = await putTask();

    expect(response.status).toBe(403);
    expect(updateTaskMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated denial before DELETE persistence", async () => {
    requirePermissionMock.mockResolvedValue(
      {
        denied: true,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      },
    );

    const response = await deleteTask();

    expect(response.status).toBe(401);
    expect(deleteTaskMock).not.toHaveBeenCalled();
  });

  it.each(["0", "43.5", "43oops", "2147483648"])(
    "rejects invalid project id %s before PUT authorization",
    async (projectId) => {
      const response = await putTask(projectId);

      expect(response.status).toBe(400);
      expect(requirePermissionMock).not.toHaveBeenCalled();
      expect(updateTaskMock).not.toHaveBeenCalled();
    },
  );

  it.each(["task-1", "not-a-uuid"])(
    "rejects malformed task id %s before PUT authorization",
    async (taskId) => {
      const response = await putTask("43", taskId);

      expect(response.status).toBe(400);
      expect(requirePermissionMock).not.toHaveBeenCalled();
      expect(createClientMock).not.toHaveBeenCalled();
      expect(updateTaskMock).not.toHaveBeenCalled();
    },
  );

  it.each(["0", "43.5", "43oops", "2147483648"])(
    "rejects invalid project id %s before DELETE authorization",
    async (projectId) => {
      const response = await deleteTask(projectId);

      expect(response.status).toBe(400);
      expect(requirePermissionMock).not.toHaveBeenCalled();
      expect(deleteTaskMock).not.toHaveBeenCalled();
    },
  );

  it.each(["task-1", "not-a-uuid"])(
    "rejects malformed task id %s before DELETE authorization",
    async (taskId) => {
      const response = await deleteTask("43", taskId);

      expect(response.status).toBe(400);
      expect(requirePermissionMock).not.toHaveBeenCalled();
      expect(createClientMock).not.toHaveBeenCalled();
      expect(deleteTaskMock).not.toHaveBeenCalled();
    },
  );
});

describe("PATCH /api/projects/[projectId]/scheduling/tasks/[taskId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({ auth: { getUser: jest.fn() } } as never);
    getTaskByIdMock.mockResolvedValue({ id: "task-1" });
  });

  describe("intent: deadline", () => {
    it("rejects an invalid deadline before it can reach persistence", async () => {
      const response = await patchTask({ intent: "deadline", deadline_date: "not-a-date" });
      await expect(response.json()).resolves.toMatchObject({
        error_code: "INVALID_PAYLOAD",
        error_message: "Deadline must be a valid date.",
      });
      expect(response.status).toBe(400);
      expect(setDeadlineMock).not.toHaveBeenCalled();
    });

    it("fails loudly when the task is outside the requested project", async () => {
      getTaskByIdMock.mockResolvedValue(null);
      const response = await patchTask({ intent: "deadline", deadline_date: "2026-07-31" });
      await expect(response.json()).resolves.toMatchObject({
        error_code: "NOT_FOUND",
        error_message: "Task not found.",
      });
      expect(response.status).toBe(404);
    });

    it("sets the deadline when a valid date is provided", async () => {
      setDeadlineMock.mockResolvedValue({ task_id: "task-1", deadline_date: "2026-07-31" });
      const response = await patchTask({ intent: "deadline", deadline_date: "2026-07-31" });
      expect(response.status).toBe(200);
      expect(setDeadlineMock).toHaveBeenCalledWith("43", { task_id: "task-1", deadline_date: "2026-07-31" });
    });

    it("removes the deadline when deadline_date is null", async () => {
      const response = await patchTask({ intent: "deadline", deadline_date: null });
      expect(response.status).toBe(200);
      expect(removeDeadlineMock).toHaveBeenCalledWith("43", "task-1");
    });
  });

  describe("intent: field_update", () => {
    function request(body: object) {
      return patchTask({ intent: "field_update", ...body });
    }

    it("rejects unauthenticated field changes before invoking the RPC", async () => {
      getApiRouteUserMock.mockResolvedValue(null);
      const rpc = jest.fn();
      createClientMock.mockResolvedValue({ rpc } as never);

      const response = await request({ forecast_finish_date: "2026-08-14", delay_reason: "Weather" });

      expect(response.status).toBe(401);
      expect(rpc).not.toHaveBeenCalled();
    });

    it("rejects a fractional duration before invoking the atomic RPC", async () => {
      const rpc = jest.fn();
      createClientMock.mockResolvedValue({ rpc } as never);

      const response = await request({ remaining_duration_days: 1.5, delay_reason: "Weather" });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error_code: "INVALID_PAYLOAD",
        error_message:
          "remaining_duration_days must be a whole number of days.",
      });
      expect(rpc).not.toHaveBeenCalled();
    });

    it("sends the complete field update to the atomic RPC and returns its impact", async () => {
      const impact = { prior_values: { forecast_finish_date: null }, new_values: { forecast_finish_date: "2026-08-14" }, downstream_impact: [{ task_id: "task-2" }] };
      const client = { rpc: jest.fn(function (this: unknown) { expect(this).toBe(client); return Promise.resolve({ data: impact, error: null }); }) };
      createClientMock.mockResolvedValue(client as never);

      const response = await request({ forecast_finish_date: "2026-08-14", remaining_duration_days: 8, delay_reason: "Weather", note: "Rain delay", attachment_urls: ["https://example.com/log.pdf"] });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ data: impact });
      expect(client.rpc).toHaveBeenCalledWith("apply_schedule_field_update", expect.objectContaining({ p_project_id: 43, p_task_id: "task-1", p_forecast_finish_date: "2026-08-14", p_remaining_duration_days: 8, p_delay_reason: "Weather" }));
    });

    it("returns an authorization error from a cross-project RPC failure", async () => {
      createClientMock.mockResolvedValue({ rpc: jest.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } }) } as never);
      const response = await request({ actual_start_date: "2026-08-01" });
      expect(response.status).toBe(403);
    });
  });

  it("rejects an unrecognized intent", async () => {
    const response = await patchTask({ intent: "rename" });
    expect(response.status).toBe(400);
  });
});
