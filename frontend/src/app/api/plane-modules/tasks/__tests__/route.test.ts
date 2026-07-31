import { NextRequest, NextResponse } from "next/server";
import { PUT } from "../route";
import {
  getPlaneModule,
  replacePlaneModuleTasks,
} from "@/features/plane-modules-domain/plane-modules-repository";
import { requirePermission } from "@/lib/permissions-guard";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";

jest.mock("@/features/plane-modules-domain/plane-modules-repository", () => ({
  getPlaneModule: jest.fn(),
  replacePlaneModuleTasks: jest.fn(),
  PlaneModulesRepositoryError: class PlaneModulesRepositoryError extends Error {
    constructor(
      readonly kind: string,
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  },
}));
jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));
jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn((value) => value instanceof Response),
}));

const getMock = getPlaneModule as jest.MockedFunction<typeof getPlaneModule>;
const replaceMock = replacePlaneModuleTasks as jest.MockedFunction<
  typeof replacePlaneModuleTasks
>;
const permissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const accessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;

const moduleId = "5f87d5ef-f736-4446-81b8-f6ba396b1d5a";
const taskId = "04a4dcd3-9b51-45e4-aed2-42de4a714201";
const args = { params: Promise.resolve({}) };

beforeEach(() => {
  jest.clearAllMocks();
  permissionMock.mockResolvedValue({
    denied: false,
    userId: "219ad6e4-073f-4fdc-9911-75e73f00c839",
    personId: "8caa3de2-32e7-4438-bcdb-3e7144390f1a",
  });
  accessMock.mockResolvedValue({
    membership: {
      membershipId: "membership-1",
      personId: "8caa3de2-32e7-4438-bcdb-3e7144390f1a",
      authUserId: "219ad6e4-073f-4fdc-9911-75e73f00c839",
      projectId: 31,
      permissionTemplateId: "template-1",
      userType: "employee",
    },
    serviceClient: {},
    userProfile: null,
  } as Awaited<ReturnType<typeof verifyProjectAccess>>);
  getMock.mockResolvedValue({
    id: moduleId,
    projectId: 31,
  } as Awaited<ReturnType<typeof getPlaneModule>>);
});

function put(body: Record<string, unknown>) {
  return PUT(
    new NextRequest("http://localhost/api/plane-modules/tasks", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    args,
  );
}

describe("PUT /api/plane-modules/tasks", () => {
  it("rejects invalid task IDs before permission or database work", async () => {
    const response = await put({
      projectId: 31,
      moduleId,
      taskIds: ["not-a-uuid"],
    });
    expect(response.status).toBe(400);
    expect(permissionMock).not.toHaveBeenCalled();
  });

  it("returns the canonical write-permission denial", async () => {
    permissionMock.mockResolvedValue({
      denied: true,
      response: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      ),
    });
    const response = await put({ projectId: 31, moduleId, taskIds: [taskId] });
    expect(response.status).toBe(403);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("rejects a module outside the supplied project", async () => {
    getMock.mockResolvedValue(null);
    const response = await put({ projectId: 31, moduleId, taskIds: [taskId] });
    expect(response.status).toBe(404);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("replaces task membership through one bulk repository operation", async () => {
    replaceMock.mockResolvedValue([taskId]);
    const response = await put({
      projectId: 31,
      moduleId,
      taskIds: [taskId, taskId],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { taskIds: [taskId] },
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith({
      projectId: 31,
      moduleId,
      taskIds: [taskId, taskId],
      actorId: "219ad6e4-073f-4fdc-9911-75e73f00c839",
    });
  });
});
