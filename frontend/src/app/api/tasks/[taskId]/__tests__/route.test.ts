import { NextRequest, NextResponse } from "next/server";

import { DELETE, PATCH } from "../route";
import {
  resolveTaskProjectAssociation,
  type TaskProjectAssociationRow,
} from "../../task-project-resolution";
import {
  createClient,
  getApiRouteUser,
} from "@/lib/supabase/server";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";

const mockServiceFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: {
    from: (...args: unknown[]) => mockServiceFrom(...args),
  },
}));

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: (result: unknown) => result instanceof NextResponse,
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const USER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "member@example.com",
};

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function makeAssociationBuilder(result: QueryResult<unknown>) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function makeMutationClient(
  patchResult: QueryResult<unknown> = {
    data: { id: TASK_ID, status: "done" },
    error: null,
  },
  deleteResult: QueryResult<unknown> = {
    data: { id: TASK_ID },
    error: null,
  },
) {
  const patchBuilder = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(patchResult),
  };
  patchBuilder.update.mockReturnValue(patchBuilder);
  patchBuilder.eq.mockReturnValue(patchBuilder);
  patchBuilder.select.mockReturnValue(patchBuilder);

  const deleteBuilder = {
    delete: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(deleteResult),
  };
  deleteBuilder.delete.mockReturnValue(deleteBuilder);
  deleteBuilder.eq.mockReturnValue(deleteBuilder);
  deleteBuilder.select.mockReturnValue(deleteBuilder);

  const client = {
    from: jest
      .fn()
      .mockReturnValueOnce(patchBuilder)
      .mockReturnValueOnce(deleteBuilder),
  };

  return { client, patchBuilder, deleteBuilder };
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest(`http://localhost/api/tasks/${TASK_ID}`, {
    method: "DELETE",
  });
}

function context(taskId = TASK_ID) {
  return { params: Promise.resolve({ taskId }) };
}

function association(
  overrides: Partial<TaskProjectAssociationRow> = {},
): TaskProjectAssociationRow {
  return {
    project_id: 31,
    project_ids: [31],
    document_metadata: { project_id: 31 },
    ...overrides,
  };
}

function projectAccess(
  projectId: number,
  mutation: ReturnType<typeof makeMutationClient>,
) {
  return {
    membership: {
      membershipId: "membership-1",
      personId: "person-1",
      authUserId: USER.id,
      projectId,
      permissionTemplateId: null,
      userType: "member",
    },
    serviceClient: mutation.client as never,
    userProfile: {
      is_admin: false,
      is_developer: false,
      full_name: "Project Member",
      role: null,
      onboarding_completed_at: null,
    },
  };
}

function allowProject(projectId = 31) {
  const mutation = makeMutationClient();
  verifyProjectAccessMock.mockResolvedValue(
    projectAccess(projectId, mutation) as never,
  );
  return mutation;
}

describe("task project association resolution", () => {
  it("uses direct project_id before legacy associations", () => {
    expect(
      resolveTaskProjectAssociation(
        association({
          project_id: 31,
          project_ids: [99],
          document_metadata: { project_id: 88 },
        }),
      ),
    ).toEqual({
      status: "resolved",
      projectId: 31,
      source: "project_id",
    });
  });

  it("falls back to a single legacy project_ids value", () => {
    expect(
      resolveTaskProjectAssociation(
        association({
          project_id: null,
          project_ids: [31],
          document_metadata: { project_id: 31 },
        }),
      ),
    ).toEqual({
      status: "resolved",
      projectId: 31,
      source: "project_ids",
    });
  });

  it("falls back to document metadata only without task-level ownership", () => {
    expect(
      resolveTaskProjectAssociation(
        association({
          project_id: null,
          project_ids: [],
          document_metadata: { project_id: 31 },
        }),
      ),
    ).toEqual({
      status: "resolved",
      projectId: 31,
      source: "document_metadata",
    });
  });

  it("rejects conflicting legacy and metadata associations", () => {
    expect(
      resolveTaskProjectAssociation(
        association({
          project_id: null,
          project_ids: [31],
          document_metadata: { project_id: 32 },
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        status: "ambiguous",
      }),
    );
  });

  it("rejects a task associated with multiple legacy projects", () => {
    expect(
      resolveTaskProjectAssociation(
        association({
          project_id: null,
          project_ids: [31, 32],
          document_metadata: null,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        status: "ambiguous",
      }),
    );
  });
});

describe("tasks detail mutation authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    getApiRouteUserMock.mockResolvedValue(USER as never);
    mockServiceFrom.mockReturnValue(
      makeAssociationBuilder({ data: association(), error: null }),
    );
  });

  it.each([
    ["direct project_id", association()],
    [
      "legacy project_ids",
      association({
        project_id: null,
        project_ids: [41],
        document_metadata: { project_id: 41 },
      }),
    ],
    [
      "document metadata",
      association({
        project_id: null,
        project_ids: [],
        document_metadata: { project_id: 51 },
      }),
    ],
  ])("authorizes PATCH through %s", async (_label, taskAssociation) => {
    mockServiceFrom.mockReturnValue(
      makeAssociationBuilder({ data: taskAssociation, error: null }),
    );
    const expectedProjectId =
      taskAssociation.project_id ??
      taskAssociation.project_ids?.[0] ??
      (taskAssociation.document_metadata as { project_id: number }).project_id;
    const mutation = allowProject(expectedProjectId);

    const response = await PATCH(patchRequest({ status: "done" }), context());

    expect(response.status).toBe(200);
    expect(verifyProjectAccessMock).toHaveBeenCalledWith(
      expectedProjectId,
      USER,
    );
    expect(mutation.patchBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" }),
    );
  });

  it("uses the same membership-wide authorization boundary for DELETE", async () => {
    const mutation = allowProject(31);
    mutation.client.from.mockReset().mockReturnValue(mutation.deleteBuilder);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(200);
    expect(verifyProjectAccessMock).toHaveBeenCalledWith(31, USER);
    expect(mutation.deleteBuilder.delete).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated PATCH before association lookup", async () => {
    getApiRouteUserMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ status: "done" }), context());

    expect(response.status).toBe(401);
    expect(mockServiceFrom).not.toHaveBeenCalled();
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
  });

  it("returns cross-project denial before PATCH mutation", async () => {
    const mutation = makeMutationClient();
    verifyProjectAccessMock.mockResolvedValue(
      NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 },
      ) as never,
    );

    const response = await PATCH(patchRequest({ status: "done" }), context());

    expect(response.status).toBe(403);
    expect(mutation.patchBuilder.update).not.toHaveBeenCalled();
  });

  it("returns the membership/read-only policy denial before DELETE mutation", async () => {
    const mutation = makeMutationClient();
    verifyProjectAccessMock.mockResolvedValue(
      NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      ) as never,
    );

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(403);
    expect(mutation.deleteBuilder.delete).not.toHaveBeenCalled();
  });

  it("rejects an ambiguous association before project authorization", async () => {
    mockServiceFrom.mockReturnValue(
      makeAssociationBuilder({
        data: association({
          project_id: null,
          project_ids: [31],
          document_metadata: { project_id: 32 },
        }),
        error: null,
      }),
    );

    const response = await PATCH(patchRequest({ status: "done" }), context());

    expect(response.status).toBe(409);
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
  });

  it("preserves task-not-found semantics before authorization", async () => {
    mockServiceFrom.mockReturnValue(
      makeAssociationBuilder({ data: null, error: null }),
    );

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(404);
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
  });

  it("requires access to a newly assigned project before PATCH mutation", async () => {
    const mutation = makeMutationClient();
    verifyProjectAccessMock
      .mockResolvedValueOnce(projectAccess(31, mutation) as never)
      .mockResolvedValueOnce(
        NextResponse.json(
          { error: "You do not have access to this project" },
          { status: 403 },
        ) as never,
      );

    const response = await PATCH(patchRequest({ project_id: 32 }), context());

    expect(response.status).toBe(403);
    expect(verifyProjectAccessMock).toHaveBeenNthCalledWith(1, 31, USER);
    expect(verifyProjectAccessMock).toHaveBeenNthCalledWith(2, 32, USER);
    expect(mutation.patchBuilder.update).not.toHaveBeenCalled();
  });

  it("rejects clearing project ownership before PATCH mutation", async () => {
    const mutation = allowProject(31);

    const response = await PATCH(
      patchRequest({ project_id: null }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mutation.patchBuilder.update).not.toHaveBeenCalled();
  });

  it.each([
    ["PATCH", (taskId: string) => PATCH(patchRequest({ status: "done" }), context(taskId))],
    ["DELETE", (taskId: string) => DELETE(deleteRequest(), context(taskId))],
  ])("rejects an invalid UUID before %s authorization", async (_method, call) => {
    const response = await call("task-1");

    expect(response.status).toBe(400);
    expect(getApiRouteUserMock).not.toHaveBeenCalled();
    expect(mockServiceFrom).not.toHaveBeenCalled();
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("preserves PATCH not-found semantics when the task disappears before update", async () => {
    const mutation = makeMutationClient({ data: null, error: null });
    verifyProjectAccessMock.mockResolvedValue({
      membership: {
        membershipId: "membership-1",
        personId: "person-1",
        authUserId: USER.id,
        projectId: 31,
        permissionTemplateId: null,
        userType: "member",
      },
      serviceClient: mutation.client as never,
      userProfile: null,
    });

    const response = await PATCH(patchRequest({ status: "done" }), context());

    expect(response.status).toBe(404);
  });
});
