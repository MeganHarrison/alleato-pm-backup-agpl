process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { POST } from "../route";

const createTaskMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    createTask: createTaskMock,
  })),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock =
  getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createServiceClientMock =
  createServiceClient as jest.MockedFunction<typeof createServiceClient>;

describe("POST /api/projects/[projectId]/scheduling/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "user-1",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    createServiceClientMock.mockReturnValue({} as never);
    createTaskMock.mockResolvedValue({ id: "task-1", name: "Install pipe" });
  });

  it("preserves the selected assignee and schedule mode at the service boundary", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/43/scheduling/tasks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Install pipe",
            start_date: "2026-08-17",
            finish_date: "2026-08-19",
            duration_days: 3,
            assignee_person_id: "11111111-1111-4111-8111-111111111111",
            schedule_mode: "manual",
          }),
        },
      ),
      { params: Promise.resolve({ projectId: "43" }) },
    );

    expect(response.status).toBe(201);
    expect(createTaskMock).toHaveBeenCalledWith(
      "43",
      expect.objectContaining({
        assignee_person_id: "11111111-1111-4111-8111-111111111111",
        schedule_mode: "manual",
      }),
    );
  });
});
