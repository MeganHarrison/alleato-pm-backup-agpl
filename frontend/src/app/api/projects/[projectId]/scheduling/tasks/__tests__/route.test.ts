process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest, NextResponse } from "next/server";

import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { GET } from "../route";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: (value: unknown) => value instanceof Response,
}));

const listTasksMock = jest.fn();

jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    listTasks: listTasksMock,
    getTasksHierarchy: jest.fn(),
    getGanttData: jest.fn(),
    getSummary: jest.fn(),
  })),
}));

const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const schedulingServiceMock = SchedulingService as jest.MockedClass<
  typeof SchedulingService
>;
const context = { params: Promise.resolve({ projectId: "43" }) };

function getTasks(path = "") {
  return GET(
    new NextRequest(`http://localhost/api/projects/43/scheduling/tasks${path}`),
    context,
  );
}

describe("GET /api/projects/[projectId]/scheduling/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listTasksMock.mockResolvedValue({
      data: [{ id: "task-1", name: "Mobilize" }],
      pagination: {
        current_page: 1,
        per_page: 50,
        total_records: 1,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      },
    });
  });

  it("returns the canonical project-access denial before reading schedule data", async () => {
    verifyProjectAccessMock.mockResolvedValue(
      NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 },
      ),
    );

    const response = await getTasks();

    expect(response.status).toBe(403);
    expect(schedulingServiceMock).not.toHaveBeenCalled();
    expect(listTasksMock).not.toHaveBeenCalled();
  });

  it("reads through the authorized service client", async () => {
    const serviceClient = { from: jest.fn() };
    verifyProjectAccessMock.mockResolvedValue({
      membership: { projectId: 43 },
      serviceClient,
      userProfile: null,
    } as never);

    const response = await getTasks("?limit=100&order=desc");

    expect(response.status).toBe(200);
    expect(verifyProjectAccessMock).toHaveBeenCalledWith(43);
    expect(schedulingServiceMock).toHaveBeenCalledWith(serviceClient);
    expect(listTasksMock).toHaveBeenCalledWith("43", expect.objectContaining({
      limit: 100,
      order: "desc",
    }));
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "task-1", name: "Mobilize" }],
    });
  });

  it("rejects an invalid project id before authorization or data access", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/projects/not-a-project/scheduling/tasks"),
      { params: Promise.resolve({ projectId: "not-a-project" }) },
    );

    expect(response.status).toBe(400);
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
    expect(listTasksMock).not.toHaveBeenCalled();
  });
});
