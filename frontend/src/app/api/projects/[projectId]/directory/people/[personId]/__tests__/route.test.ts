import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const directoryServiceMock = {
  getPerson: jest.fn(),
  updatePerson: jest.fn(),
  deactivatePerson: jest.fn(),
};

const permissionServiceMock = {
  hasPermission: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

const createClientMock = createClient as jest.Mock;

jest.mock("@/services/directoryService", () => ({
  DirectoryService: jest.fn().mockImplementation(() => directoryServiceMock),
}));

jest.mock("@/services/permissionService", () => ({
  PermissionService: jest.fn().mockImplementation(() => permissionServiceMock),
}));

describe("Directory person detail route", () => {
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

  const params = { params: Promise.resolve({ projectId: "42", personId: "person-1" }) };

  describe("GET", () => {
    it("returns the requested person when read permission is granted", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);
      const person = { id: "person-1", first_name: "Test" };
      directoryServiceMock.getPerson.mockResolvedValue(person);

      const response = await GET(
        new NextRequest("http://localhost/api/..."),
        params,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(person);
      expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith(
        "user-1",
        "42",
        "directory",
        "read",
      );
      expect(directoryServiceMock.getPerson).toHaveBeenCalledWith(
        "42",
        "person-1",
      );
    });

    it("rejects unauthorized access", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await GET(
        new NextRequest("http://localhost/api/..."),
        params,
      );

      expect(response.status).toBe(401);
    });

    it("returns forbidden when read permission is denied", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(false);

      const response = await GET(
        new NextRequest("http://localhost/api/..."),
        params,
      );

      expect(response.status).toBe(403);
      expect(directoryServiceMock.getPerson).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    const payload = { job_title: "Lead" };
    const buildRequest = () =>
      new NextRequest("http://localhost/api/...", {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      });

    it("updates a person when write permission exists", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);
      const updatedPerson = { id: "person-1", ...payload };
      directoryServiceMock.updatePerson.mockResolvedValue(updatedPerson);

      const response = await PATCH(buildRequest(), params);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(updatedPerson);
      expect(directoryServiceMock.updatePerson).toHaveBeenCalledWith(
        "42",
        "person-1",
        payload,
      );
    });

    it("rejects when no write permission", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(false);

      const response = await PATCH(buildRequest(), params);

      expect(response.status).toBe(403);
      expect(directoryServiceMock.updatePerson).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("soft deletes the person with write permission", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);
      const response = await DELETE(
        new NextRequest("http://localhost/api/...", { method: "DELETE" }),
        params,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(directoryServiceMock.deactivatePerson).toHaveBeenCalledWith(
        "42",
        "person-1",
      );
    });

    it("rejects unauthorized deletes", async () => {
      supabaseMock.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const response = await DELETE(
        new NextRequest("http://localhost/api/...", { method: "DELETE" }),
        params,
      );

      expect(response.status).toBe(401);
      expect(directoryServiceMock.deactivatePerson).not.toHaveBeenCalled();
    });

    it("returns forbidden when write permission is missing", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(false);

      const response = await DELETE(
        new NextRequest("http://localhost/api/...", { method: "DELETE" }),
        params,
      );

      expect(response.status).toBe(403);
      expect(directoryServiceMock.deactivatePerson).not.toHaveBeenCalled();
    });
  });
});
