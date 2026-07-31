import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const distributionGroupServiceMock = {
  getGroups: jest.fn(),
  createGroup: jest.fn(),
};

const permissionServiceMock = {
  hasPermission: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue(null),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

const createClientMock = createClient as jest.Mock;

jest.mock("@/services/distributionGroupService", () => ({
  DistributionGroupService: jest
    .fn()
    .mockImplementation(() => distributionGroupServiceMock),
}));

jest.mock("@/services/permissionService", () => ({
  PermissionService: jest.fn().mockImplementation(() => permissionServiceMock),
}));

describe("Directory groups route", () => {
  let supabaseMock: { auth: { getUser: jest.Mock } };

  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    createClientMock.mockResolvedValue(supabaseMock);
  });

  const params = { params: Promise.resolve({ projectId: "42" }) };

  describe("GET", () => {
    it("returns groups with filters applied", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);
      const groups = [{ id: "g-1", name: "Team A" }];
      distributionGroupServiceMock.getGroups.mockResolvedValue(groups);

      const request = new NextRequest(
        "http://localhost/api/projects/42/directory/groups?include_members=true&status=inactive",
      );

      const response = await GET(request, params);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(groups);
      expect(distributionGroupServiceMock.getGroups).toHaveBeenCalledWith(
        "42",
        true,
        "inactive",
      );
    });

    it("returns unauthorized when no user", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await GET(
        new NextRequest("http://localhost/api/projects/42/directory/groups"),
        params,
      );

      expect(response.status).toBe(401);
    });

    it("returns forbidden without read permission", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(false);

      const response = await GET(
        new NextRequest("http://localhost/api/projects/42/directory/groups"),
        params,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("POST", () => {
    const buildRequest = (payload: Record<string, unknown>) =>
      new NextRequest("http://localhost/api/projects/42/directory/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

    it("returns unauthorized when no user exists", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await POST(buildRequest({ name: "Team" }), params);

      expect(response.status).toBe(401);
      expect(distributionGroupServiceMock.createGroup).not.toHaveBeenCalled();
    });

    it("returns forbidden when admin permission is missing", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(false);

      const response = await POST(buildRequest({ name: "Team" }), params);

      expect(response.status).toBe(403);
    });

    it("validates payload", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);

      const response = await POST(buildRequest({}), params);

      expect(response.status).toBe(400);
    });

    it("creates a group when admin permission exists", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);
      const createdGroup = { id: "g-1", name: "Team" };
      distributionGroupServiceMock.createGroup.mockResolvedValue(createdGroup);

      const response = await POST(buildRequest({ name: "Team" }), params);

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(createdGroup);
      expect(distributionGroupServiceMock.createGroup).toHaveBeenCalledWith(
        "42",
        { name: "Team" },
      );
    });
  });
});
