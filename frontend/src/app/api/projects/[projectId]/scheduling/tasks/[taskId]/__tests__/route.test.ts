process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const getTaskByIdMock = jest.fn();
const setDeadlineMock = jest.fn();
const removeDeadlineMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    getTaskById: getTaskByIdMock,
    setDeadline: setDeadlineMock,
    removeDeadline: removeDeadlineMock,
  })),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const context = { params: Promise.resolve({ projectId: "43", taskId: "task-1" }) };

function patchTask(body: object) {
  return PATCH(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), context);
}

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
        success: false,
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
        success: false,
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
        success: false,
        error_code: "INVALID_PAYLOAD",
        error_message: "remaining_duration_days must be a whole number of days.",
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
