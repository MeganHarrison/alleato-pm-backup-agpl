process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { DELETE, POST } from "../route";

const updateTask = jest.fn();
const deleteTask = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    updateTask,
    deleteTask,
    getTaskById: jest.fn(),
  })),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const SchedulingServiceMock = SchedulingService as jest.MockedClass<
  typeof SchedulingService
>;
const context = { params: Promise.resolve({ projectId: "67" }) };

function request(method: "POST" | "DELETE", body: unknown) {
  return new NextRequest(
    "http://localhost/api/projects/67/scheduling/tasks/bulk",
    {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("bulk schedule task mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "actor-user-1",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({ client: "authenticated" } as never);
    createServiceClientMock.mockReturnValue({ client: "service-role" } as never);
    updateTask.mockResolvedValue({ id: "task-1" });
    deleteTask.mockResolvedValue(true);
  });

  it("uses the service-role mutation boundary with the authenticated actor for bulk updates", async () => {
    const response = await POST(
      request("POST", {
        task_ids: ["task-1"],
        updates: { percent_complete: 50 },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(SchedulingServiceMock).toHaveBeenCalledWith(
      { client: "authenticated" },
      {
        actorUserId: "actor-user-1",
        mutationClient: { client: "service-role" },
      },
    );
    expect(updateTask).toHaveBeenCalledWith("67", "task-1", {
      percent_complete: 50,
    });
    await expect(response.json()).resolves.toMatchObject({
      updated: 1,
      failed: 0,
    });
  });

  it("uses the service-role mutation boundary with the authenticated actor for bulk deletes", async () => {
    const response = await DELETE(
      request("DELETE", { task_ids: ["task-1"] }),
      context,
    );

    expect(response.status).toBe(200);
    expect(SchedulingServiceMock).toHaveBeenCalledWith(
      { client: "authenticated" },
      {
        actorUserId: "actor-user-1",
        mutationClient: { client: "service-role" },
      },
    );
    expect(deleteTask).toHaveBeenCalledWith("67", "task-1");
    await expect(response.json()).resolves.toMatchObject({
      deleted: 1,
      failed: 0,
    });
  });
});
