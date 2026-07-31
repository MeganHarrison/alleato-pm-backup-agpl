import { NextRequest, NextResponse } from "next/server";
import { GET, PATCH, POST } from "../route";
import {
  createPlaneModule,
  getPlaneModule,
  listPlaneModules,
  PlaneModulesRepositoryError,
  updatePlaneModule,
} from "@/features/plane-modules-domain/plane-modules-repository";
import { requirePermission } from "@/lib/permissions-guard";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import type { PlaneModule } from "@/features/plane-modules-domain/plane-modules-contract";

jest.mock("@/features/plane-modules-domain/plane-modules-repository", () => {
  class MockRepositoryError extends Error {
    constructor(
      readonly kind: string,
      message: string,
      readonly code?: string,
    ) {
      super(message);
      this.name = "PlaneModulesRepositoryError";
    }
  }
  return {
    createPlaneModule: jest.fn(),
    getPlaneModule: jest.fn(),
    listPlaneModules: jest.fn(),
    updatePlaneModule: jest.fn(),
    PlaneModulesRepositoryError: MockRepositoryError,
  };
});
jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));
jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn((value) => value instanceof Response),
}));

const listMock = listPlaneModules as jest.MockedFunction<
  typeof listPlaneModules
>;
const createMock = createPlaneModule as jest.MockedFunction<
  typeof createPlaneModule
>;
const getMock = getPlaneModule as jest.MockedFunction<typeof getPlaneModule>;
const updateMock = updatePlaneModule as jest.MockedFunction<
  typeof updatePlaneModule
>;
const permissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const accessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;

const moduleRow: PlaneModule = {
  id: "5f87d5ef-f736-4446-81b8-f6ba396b1d5a",
  projectId: 31,
  name: "Foundation",
  description: "",
  status: "planned",
  leadPersonId: null,
  memberPersonIds: [],
  taskIds: [],
  startDate: null,
  targetDate: null,
  sortOrder: 65_535,
  archivedAt: null,
  createdBy: "219ad6e4-073f-4fdc-9911-75e73f00c839",
  updatedBy: "219ad6e4-073f-4fdc-9911-75e73f00c839",
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};

const access = {
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
} as Awaited<ReturnType<typeof verifyProjectAccess>>;

function request(method: string, url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const args = { params: Promise.resolve({}) };

beforeEach(() => {
  jest.clearAllMocks();
  accessMock.mockResolvedValue(access);
  permissionMock.mockResolvedValue({
    denied: false,
    userId: "219ad6e4-073f-4fdc-9911-75e73f00c839",
    personId: "8caa3de2-32e7-4438-bcdb-3e7144390f1a",
  });
});

describe("/api/plane-modules", () => {
  it("rejects an invalid project ID before access or database work", async () => {
    const response = await GET(
      request("GET", "http://localhost/api/plane-modules?projectId=nope"),
      args,
    );
    expect(response.status).toBe(400);
    expect(accessMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the canonical project access denial", async () => {
    accessMock.mockResolvedValue(
      NextResponse.json({ error: "No project access" }, { status: 403 }),
    );
    const response = await GET(
      request("GET", "http://localhost/api/plane-modules?projectId=31"),
      args,
    );
    expect(response.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("lists project-scoped modules", async () => {
    listMock.mockResolvedValue([moduleRow]);
    const response = await GET(
      request("GET", "http://localhost/api/plane-modules?projectId=31"),
      args,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [moduleRow] });
    expect(listMock).toHaveBeenCalledWith(31);
  });

  it("denies writes without schedule write permission", async () => {
    permissionMock.mockResolvedValue({
      denied: true,
      response: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      ),
    });
    const response = await POST(
      request("POST", "http://localhost/api/plane-modules", {
        projectId: 31,
        name: "Foundation",
      }),
      args,
    );
    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a module through the atomic repository boundary", async () => {
    createMock.mockResolvedValue(moduleRow);
    const response = await POST(
      request("POST", "http://localhost/api/plane-modules", {
        projectId: 31,
        name: "Foundation",
      }),
      args,
    );
    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 31,
        name: "Foundation",
        memberPersonIds: [],
      }),
      "219ad6e4-073f-4fdc-9911-75e73f00c839",
    );
  });

  it("returns 409 for a duplicate project module name", async () => {
    createMock.mockRejectedValue(
      new PlaneModulesRepositoryError(
        "conflict",
        "Module already exists",
        "23505",
      ),
    );
    const response = await POST(
      request("POST", "http://localhost/api/plane-modules", {
        projectId: 31,
        name: "Foundation",
      }),
      args,
    );
    expect(response.status).toBe(409);
  });

  it("does not update a module outside the requested project", async () => {
    getMock.mockResolvedValue(null);
    const response = await PATCH(
      request("PATCH", "http://localhost/api/plane-modules", {
        projectId: 31,
        moduleId: moduleRow.id,
        status: "in-progress",
      }),
      args,
    );
    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
