process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { DELETE, GET, POST, PUT } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  ScheduleResourceService,
  ScheduleResourceServiceError,
} from "@/lib/services/schedule-resource-service";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
jest.mock("@/lib/services/schedule-resource-service", () => {
  const actual = jest.requireActual("@/lib/services/schedule-resource-service");
  return { ...actual, ScheduleResourceService: jest.fn() };
});

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const getTaskAssignments = jest.fn();
const replaceTaskAssignments = jest.fn();
const upsertCostAssignment = jest.fn();
const deleteCostAssignment = jest.fn();
const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const assignmentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const context = {
  params: Promise.resolve({ projectId: "67", taskId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
};

describe("schedule task assignments API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    (ScheduleResourceService as jest.Mock).mockImplementation(() => ({
      getTaskAssignments,
      replaceTaskAssignments,
      upsertCostAssignment,
      deleteCostAssignment,
    }));
  });

  it("requires authentication before loading assignments", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const response = await GET(
      new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments"),
      context,
    );
    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getTaskAssignments).not.toHaveBeenCalled();
  });

  it("returns only the requested task assignments", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    getTaskAssignments.mockResolvedValue([{ id: "assignment-1" }]);
    const response = await GET(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments"), context);
    expect(response.status).toBe(200);
    expect(getTaskAssignments).toHaveBeenCalledWith(67, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("rejects duplicate people before invoking the replacement RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    const assignment = { person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 50 };
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments: [assignment, assignment], expected_assignments: [] }),
    }), context);
    expect(response.status).toBe(400);
    expect(replaceTaskAssignments).not.toHaveBeenCalled();
  });

  it.each([0, 101, 50.5])("rejects invalid allocation percentage %p", async (allocationPercent) => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({
        assignments: [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: allocationPercent }],
        expected_assignments: [],
      }),
    }), context);
    expect(response.status).toBe(400);
    expect(replaceTaskAssignments).not.toHaveBeenCalled();
  });

  it("replaces assignments with one validated service call", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    replaceTaskAssignments.mockResolvedValue([{ id: "assignment-1", allocation_percent: 75 }]);
    const assignments = [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 75 }];
    const expectedAssignments = [{
      id: assignmentId,
      person_id: "11111111-1111-4111-8111-111111111111",
      cost_version: 2,
    }];
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments, expected_assignments: expectedAssignments }),
    }), context);
    expect(response.status).toBe(200);
    expect(replaceTaskAssignments).toHaveBeenCalledWith(
      67,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      assignments,
      expectedAssignments,
    );
  });

  it("maps an unauthorized replacement RPC to a forbidden response", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    replaceTaskAssignments.mockRejectedValue(new ScheduleResourceServiceError(
      "Schedule-manager access is required.",
      "rpc",
      { code: "42501", message: "Schedule-manager access is required." },
    ));
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments: [], expected_assignments: [] }),
    }), context);
    expect(response.status).toBe(403);
  });

  it("maps an unexpected replacement RPC failure to a database error", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    replaceTaskAssignments.mockRejectedValue(new ScheduleResourceServiceError(
      "Database unavailable.",
      "rpc",
      { code: "55000", message: "Database unavailable." },
    ));
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments: [], expected_assignments: [] }),
    }), context);
    expect(response.status).toBe(500);
  });

  it("maps a stale people-assignment snapshot to a conflict response", async () => {
    replaceTaskAssignments.mockRejectedValue(new ScheduleResourceServiceError(
      "Schedule person assignments changed since they were loaded.",
      "rpc",
      {
        code: "PT409",
        message: "Schedule person assignments changed since they were loaded.",
      },
    ));
    const response = await PUT(new NextRequest(
      "http://localhost/api/projects/67/scheduling/tasks/task/assignments",
      {
        method: "PUT",
        body: JSON.stringify({ assignments: [], expected_assignments: [] }),
      },
    ), context);
    expect(response.status).toBe(409);
  });

  it("creates one assignment with explicit planned and actual facts", async () => {
    const body = {
      resource_id: resourceId,
      allocation_percent: 80,
      planned_units: 12,
      actual_units: 5,
      actual_rate: 100,
      actual_cost: null,
      expected_cost_version: null,
    };
    upsertCostAssignment.mockResolvedValue({ id: assignmentId, cost_version: 1 });
    const response = await POST(new NextRequest(
      "http://localhost/api/projects/67/scheduling/tasks/task/assignments",
      { method: "POST", body: JSON.stringify(body) },
    ), context);
    expect(response.status).toBe(201);
    expect(upsertCostAssignment).toHaveBeenCalledWith(67, {
      task_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ...body,
    });
  });

  it("rejects negative cost facts before calling the service", async () => {
    const response = await POST(new NextRequest(
      "http://localhost/api/projects/67/scheduling/tasks/task/assignments",
      {
        method: "POST",
        body: JSON.stringify({
          resource_id: resourceId,
          allocation_percent: 80,
          planned_units: -1,
          actual_units: null,
          actual_rate: null,
          actual_cost: null,
        }),
      },
    ), context);
    expect(response.status).toBe(400);
    expect(upsertCostAssignment).not.toHaveBeenCalled();
  });

  it("updates an assignment only with its current cost version", async () => {
    const body = {
      resource_id: resourceId,
      allocation_percent: 75,
      planned_units: 14,
      actual_units: 6,
      actual_rate: 105,
      actual_cost: null,
      expected_cost_version: 3,
    };
    upsertCostAssignment.mockResolvedValue({ id: assignmentId, cost_version: 4 });
    const response = await POST(new NextRequest(
      "http://localhost/api/projects/67/scheduling/tasks/task/assignments",
      { method: "POST", body: JSON.stringify(body) },
    ), context);
    expect(response.status).toBe(200);
    expect(upsertCostAssignment).toHaveBeenCalledWith(67, {
      task_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ...body,
    });
  });

  it("deletes an assignment only with its current cost version", async () => {
    const response = await DELETE(new NextRequest(
      "http://localhost/api/projects/67/scheduling/tasks/task/assignments",
      {
        method: "DELETE",
        body: JSON.stringify({
          assignment_id: assignmentId,
          expected_cost_version: 3,
        }),
      },
    ), context);
    expect(response.status).toBe(200);
    expect(deleteCostAssignment).toHaveBeenCalledWith(67, assignmentId, 3);
  });
});
