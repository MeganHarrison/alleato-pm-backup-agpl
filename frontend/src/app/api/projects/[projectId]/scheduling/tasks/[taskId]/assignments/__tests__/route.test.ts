process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
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
const context = {
  params: Promise.resolve({ projectId: "67", taskId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
};

describe("schedule task assignments API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ScheduleResourceService as jest.Mock).mockImplementation(() => ({ getTaskAssignments, replaceTaskAssignments }));
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
      body: JSON.stringify({ assignments: [assignment, assignment] }),
    }), context);
    expect(response.status).toBe(400);
    expect(replaceTaskAssignments).not.toHaveBeenCalled();
  });

  it.each([0, 101, 50.5])("rejects invalid allocation percentage %p", async (allocationPercent) => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments: [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: allocationPercent }] }),
    }), context);
    expect(response.status).toBe(400);
    expect(replaceTaskAssignments).not.toHaveBeenCalled();
  });

  it("replaces assignments with one validated service call", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    replaceTaskAssignments.mockResolvedValue([{ id: "assignment-1", allocation_percent: 75 }]);
    const assignments = [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 75 }];
    const response = await PUT(new NextRequest("http://localhost/api/projects/67/scheduling/tasks/task/assignments", {
      method: "PUT",
      body: JSON.stringify({ assignments }),
    }), context);
    expect(response.status).toBe(200);
    expect(replaceTaskAssignments).toHaveBeenCalledWith(67, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", assignments);
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
      body: JSON.stringify({ assignments: [] }),
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
      body: JSON.stringify({ assignments: [] }),
    }), context);
    expect(response.status).toBe(500);
  });
});
