process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

import { NextRequest, NextResponse } from "next/server";

import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";
import { GET, POST } from "../route";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

jest.mock("@/features/tasks/task-utils", () => ({
  mapTaskRow: (row: { id?: string }) => ({
    id: row.id ?? "task-1",
    project_name: null,
    meeting_title: null,
    source_title: null,
    source_type: null,
    source_date: null,
    source_url: null,
    source_web_url: null,
    fireflies_link: null,
    meeting_link: null,
    source_context: null,
  }),
}));

const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const serviceDbFromMock = serviceDb.from as jest.MockedFunction<
  typeof serviceDb.from
>;

const memberUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "member@example.com",
};

function readBuilder(result: { data: Array<Record<string, unknown>>; error: null }) {
  let rows = result.data;
  const builder = {
    select: jest.fn(),
    contains: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.contains.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockImplementation((column: string, value: unknown) => {
    if (column === "project_id" && value === null) {
      rows = rows.filter((row) => row.project_id == null);
    }
    return builder;
  });
  builder.or.mockReturnValue(builder);
  builder.order.mockImplementation(async () => ({ ...result, data: rows }));
  return builder;
}

function projectReadClient(
  viaDocumentRows: Array<Record<string, unknown>> = [],
) {
  const builders = [
    readBuilder({ data: [{ id: "task-1" }], error: null }),
    readBuilder({ data: [], error: null }),
    readBuilder({ data: viaDocumentRows, error: null }),
  ];
  const pendingBuilders = [...builders];
  const from = jest.fn((table: string) => {
    if (table === "people") {
      const peopleBuilder = {
        select: jest.fn(),
        ilike: jest.fn(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      peopleBuilder.select.mockReturnValue(peopleBuilder);
      peopleBuilder.ilike.mockReturnValue(peopleBuilder);
      return peopleBuilder;
    }
    if (table !== "tasks") throw new Error(`Unexpected table: ${table}`);
    const builder = pendingBuilders.shift();
    if (!builder) throw new Error("Unexpected extra tasks query");
    return builder;
  });
  return { from, builders };
}

function projectWriteClient() {
  const single = jest.fn().mockResolvedValue({
    data: { id: "task-created", project_id: 31 },
    error: null,
  });
  const select = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select }));
  const from = jest.fn((table: string) => {
    if (table !== "tasks") throw new Error(`Unexpected table: ${table}`);
    return { insert };
  });
  return { from, insert, select, single };
}

function accessResult(
  serviceClient: object,
  isAdmin = false,
) {
  return {
    membership: {
      membershipId: "membership-1",
      personId: "22222222-2222-4222-8222-222222222222",
      authUserId: memberUser.id,
      projectId: 31,
      permissionTemplateId: null,
      userType: isAdmin ? "admin" : "member",
    },
    serviceClient,
    userProfile: {
      is_admin: isAdmin,
      is_developer: false,
      full_name: isAdmin ? "Admin User" : "Project Member",
      role: null,
      onboarding_completed_at: null,
    },
  };
}

function getProjectTasks() {
  return GET(
    new NextRequest(
      "http://localhost/api/tasks?project_id=31&scope=all",
    ),
    {},
  );
}

function postProjectTask(projectId: unknown = 31) {
  return POST(
    new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Confirm mobilization",
        project_id: projectId,
      }),
    }),
    {},
  );
}

describe("/api/tasks project authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue(memberUser);
  });

  describe("GET", () => {
    it("allows an ordinary authorized project member to read all project tasks", async () => {
      const serviceClient = projectReadClient();
      verifyProjectAccessMock.mockResolvedValue(
        accessResult(serviceClient) as never,
      );

      const response = await getProjectTasks();

      expect(response.status).toBe(200);
      expect(verifyProjectAccessMock).toHaveBeenCalledWith(31, memberUser);
      expect(
        serviceClient.from.mock.calls.filter(([table]) => table === "tasks"),
      ).toHaveLength(3);
      expect(serviceClient.builders[0].contains).toHaveBeenCalledWith(
        "project_ids",
        [31],
      );
      expect(serviceClient.builders[1].eq).toHaveBeenCalledWith(
        "project_id",
        31,
      );
      expect(serviceClient.builders[2].is).toHaveBeenCalledWith(
        "project_id",
        null,
      );
      expect(serviceClient.builders[2].eq).toHaveBeenCalledWith(
        "document_metadata.project_id",
        31,
      );
      expect(serviceClient.builders[2].or).toHaveBeenCalledWith(
        "project_ids.is.null,project_ids.eq.{}",
      );
      expect(createServiceClientMock).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        data: [{ id: "task-1" }],
        projectId: 31,
        scope: "all",
      });
    });

    it("returns cross-project denial before any task query", async () => {
      verifyProjectAccessMock.mockResolvedValue(
        NextResponse.json(
          { error: "You do not have access to this project" },
          { status: 403 },
        ),
      );

      const response = await getProjectTasks();

      expect(response.status).toBe(403);
      expect(createServiceClientMock).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({
        error: "You do not have access to this project",
      });
    });

    it("allows an authorized admin through the same project guard", async () => {
      const serviceClient = projectReadClient();
      verifyProjectAccessMock.mockResolvedValue(
        accessResult(serviceClient, true) as never,
      );

      const response = await getProjectTasks();

      expect(response.status).toBe(200);
      expect(verifyProjectAccessMock).toHaveBeenCalledWith(31, memberUser);
      expect(
        serviceClient.from.mock.calls.filter(([table]) => table === "tasks"),
      ).toHaveLength(3);
    });

    it("excludes a conflicting explicit project association from the document fallback", async () => {
      const serviceClient = projectReadClient([
        { id: "legacy-fallback", project_id: null },
        { id: "conflicting-project", project_id: 99 },
      ]);
      verifyProjectAccessMock.mockResolvedValue(
        accessResult(serviceClient) as never,
      );

      const response = await getProjectTasks();

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          { id: "task-1" },
          { id: "legacy-fallback" },
        ],
      });
      expect(serviceClient.builders[2].is).toHaveBeenCalledWith(
        "project_id",
        null,
      );
    });

    it("returns unauthenticated denial before project authorization", async () => {
      getApiRouteUserMock.mockResolvedValue(null);

      const response = await getProjectTasks();

      expect(response.status).toBe(401);
      expect(verifyProjectAccessMock).not.toHaveBeenCalled();
      expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it.each(["0", "31.5", "31oops", "2147483648"])(
      "rejects invalid project id %s instead of falling back to global tasks",
      async (projectId) => {
      const response = await GET(
        new NextRequest(
          `http://localhost/api/tasks?project_id=${projectId}&scope=all`,
        ),
        {},
      );

      expect(response.status).toBe(400);
      expect(getApiRouteUserMock).not.toHaveBeenCalled();
      expect(verifyProjectAccessMock).not.toHaveBeenCalled();
      expect(createServiceClientMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("POST", () => {
    it("allows an ordinary authorized project member to create a task", async () => {
      const serviceClient = projectWriteClient();
      verifyProjectAccessMock.mockResolvedValue(
        accessResult(serviceClient) as never,
      );

      const response = await postProjectTask();

      expect(response.status).toBe(201);
      expect(verifyProjectAccessMock).toHaveBeenCalledWith(31, memberUser);
      expect(serviceClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 31,
          project_ids: [31],
          assigned_by: memberUser.id,
        }),
      );
      expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it("returns cross-project denial before any task insert", async () => {
      verifyProjectAccessMock.mockResolvedValue(
        NextResponse.json(
          { error: "You do not have access to this project" },
          { status: 403 },
        ),
      );

      const response = await postProjectTask();

      expect(response.status).toBe(403);
      expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it("allows an authorized admin through the same project guard", async () => {
      const serviceClient = projectWriteClient();
      verifyProjectAccessMock.mockResolvedValue(
        accessResult(serviceClient, true) as never,
      );

      const response = await postProjectTask();

      expect(response.status).toBe(201);
      expect(serviceClient.insert).toHaveBeenCalledTimes(1);
    });

    it("returns unauthenticated denial before project authorization", async () => {
      getApiRouteUserMock.mockResolvedValue(null);

      const response = await postProjectTask();

      expect(response.status).toBe(401);
      expect(verifyProjectAccessMock).not.toHaveBeenCalled();
      expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it.each([
      0,
      31.5,
      "31",
      "31oops",
      true,
      [],
      2_147_483_648,
    ])("rejects non-canonical project id %p before authorization", async (projectId) => {
      const response = await postProjectTask(projectId);

      expect(response.status).toBe(400);
      expect(verifyProjectAccessMock).not.toHaveBeenCalled();
      expect(createServiceClientMock).not.toHaveBeenCalled();
    });
  });
});

function makeGetRequest(scope = "mine") {
  return new NextRequest(`http://localhost/api/tasks?scope=${scope}`);
}

function mockAuthenticatedTaskRead({ email = "test1@mail.com", isAdmin = false } = {}) {
  const profileMaybeSingle = jest.fn().mockResolvedValue({
    data: { is_admin: isAdmin, full_name: "Test User" },
    error: null,
  });
  const personMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const taskQuery = {
    select: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    then: (resolve: (value: { data: []; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  taskQuery.select.mockReturnValue(taskQuery);
  taskQuery.or.mockReturnValue(taskQuery);
  taskQuery.order.mockReturnValue(taskQuery);
  taskQuery.limit.mockReturnValue(taskQuery);

  serviceDbFromMock.mockImplementation(((table: string) => {
    if (table === "user_profiles") {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }),
        }),
      };
    }
    if (table === "people") {
      return {
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({ maybeSingle: personMaybeSingle }),
        }),
      };
    }
    if (table === "tasks") return taskQuery;
    throw new Error(`Unexpected serviceDb table: ${table}`);
  }) as typeof serviceDb.from);
  getApiRouteUserMock.mockResolvedValue({ id: "auth-user-1", email });

  return taskQuery;
}

describe("tasks GET list authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the service data owner and applies the authenticated assignee filter", async () => {
    const taskQuery = mockAuthenticatedTaskRead();

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [], scope: "mine" });
    expect(serviceDbFromMock).toHaveBeenCalledWith("tasks");
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(taskQuery.or).toHaveBeenLastCalledWith(
      expect.stringContaining("assignee_email.ilike.test1@mail.com"),
    );
  });

  it("fails closed rather than querying every task when the session has no email", async () => {
    mockAuthenticatedTaskRead({ email: "" });

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error_code: "AUTH_EXPIRED" }),
    );
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("keeps the all-tasks scope admin-only", async () => {
    mockAuthenticatedTaskRead({ isAdmin: false });

    const response = await GET(makeGetRequest("all"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error_code: "FORBIDDEN" }),
    );
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });
});
