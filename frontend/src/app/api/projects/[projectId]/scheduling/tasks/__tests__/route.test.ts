process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { GET, POST } from "../route";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const listTasksMock = jest.fn();
const createTaskMock = jest.fn();

jest.mock("@/lib/services/scheduling-service", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    listTasks: listTasksMock,
    createTask: createTaskMock,
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
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const context = { params: Promise.resolve({ projectId: "43" }) };

function getTasks(path = "") {
  return GET(
    new NextRequest(`http://localhost/api/projects/43/scheduling/tasks${path}`),
    context,
  );
}

function postTask(projectId = "43") {
  return POST(
    new NextRequest(
      `http://localhost/api/projects/${projectId}/scheduling/tasks`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Mobilize" }),
      },
    ),
    { params: Promise.resolve({ projectId }) },
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

describe("POST /api/projects/[projectId]/scheduling/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClientMock.mockResolvedValue({ from: jest.fn() } as never);
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    });
    createTaskMock.mockResolvedValue({ id: "task-created", name: "Mobilize" });
  });

  it("keeps project reads available while denying a member without schedule write access", async () => {
    const serviceClient = { from: jest.fn() };
    verifyProjectAccessMock.mockResolvedValue({
      membership: { projectId: 43 },
      serviceClient,
      userProfile: null,
    } as never);
    listTasksMock.mockResolvedValue({
      data: [{ id: "task-1", name: "Read only" }],
      pagination: {},
    });

    const readResponse = await getTasks();
    expect(readResponse.status).toBe(200);

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
    const writeResponse = await postTask();

    expect(writeResponse.status).toBe(403);
    expect(requirePermissionMock).toHaveBeenCalledWith(43, "schedule", "write");
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it("creates a task when schedule write permission is granted", async () => {
    const response = await postTask();

    expect(response.status).toBe(201);
    expect(requirePermissionMock).toHaveBeenCalledWith(43, "schedule", "write");
    expect(createTaskMock).toHaveBeenCalledWith(
      "43",
      expect.objectContaining({ project_id: 43, name: "Mobilize" }),
    );
  });

  it("returns cross-project denial before constructing a mutation service", async () => {
    requirePermissionMock.mockResolvedValue(
      {
        denied: true,
        response: NextResponse.json(
          { error: "No project membership found" },
          { status: 403 },
        ),
      },
    );

    const response = await postTask();

    expect(response.status).toBe(403);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it("returns unauthenticated denial before constructing a mutation service", async () => {
    requirePermissionMock.mockResolvedValue(
      {
        denied: true,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      },
    );

    const response = await postTask();

    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it.each(["0", "43.5", "43oops", "2147483648"])(
    "rejects invalid project id %s before permission or data access",
    async (projectId) => {
      const response = await postTask(projectId);

      expect(response.status).toBe(400);
      expect(requirePermissionMock).not.toHaveBeenCalled();
      expect(createClientMock).not.toHaveBeenCalled();
      expect(createTaskMock).not.toHaveBeenCalled();
    },
  );
});
