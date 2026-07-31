import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const directoryServiceMock = {
  getPeople: jest.fn(),
  createPerson: jest.fn(),
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

describe("Directory people route", () => {
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

  describe("GET", () => {
    it("builds filters from query params and returns service data", async () => {
      const expectedResult = { data: [], meta: { total: 0 } };
      directoryServiceMock.getPeople.mockResolvedValue(expectedResult);

      const request = new NextRequest(
        "http://localhost/api/projects/42/directory/people?search=john&type=user&status=active&company_id=company-1&permission_template_id=template-1&group_by=company&sort=last_name,first_name&page=2&per_page=25",
      );

      const response = await GET(request, { params: Promise.resolve({ projectId: "42" }) });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(expectedResult);

      expect(directoryServiceMock.getPeople).toHaveBeenCalledWith(
        "42",
        expect.objectContaining({
          search: "john",
          type: "user",
          status: "active",
          companyId: "company-1",
          permissionTemplateId: "template-1",
          groupBy: "company",
          sortBy: ["last_name", "first_name"],
          page: 2,
          perPage: 25,
        }),
      );
    });

    it("returns 500 when the service throws", async () => {
      directoryServiceMock.getPeople.mockRejectedValue(new Error("boom"));

      const request = new NextRequest(
        "http://localhost/api/projects/42/directory/people",
      );

      const response = await GET(request, { params: Promise.resolve({ projectId: "42" }) });

      expect(response.status).toBe(500);
      expect(await response.json()).toHaveProperty("error_code");
    });
  });

  describe("POST", () => {
    const makeRequest = (body: Record<string, unknown>) =>
      new NextRequest("http://localhost/api/projects/42/directory/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    it("returns unauthorized when no user present", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await POST(
        makeRequest({ first_name: "A", last_name: "B", person_type: "user" }),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      expect(response.status).toBe(401);
      expect(permissionServiceMock.hasPermission).not.toHaveBeenCalled();
    });

    it("returns forbidden when permission is denied", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(false);

      const response = await POST(
        makeRequest({ first_name: "A", last_name: "B", person_type: "user" }),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      expect(response.status).toBe(403);
      expect(directoryServiceMock.createPerson).not.toHaveBeenCalled();
    });

    it("validates payload", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);

      const response = await POST(
        makeRequest({ first_name: "A", person_type: "user" }),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      expect(response.status).toBe(400);
    });

    it("creates a person when permitted", async () => {
      permissionServiceMock.hasPermission.mockResolvedValue(true);
      const payload = {
        first_name: "A",
        last_name: "B",
        person_type: "user",
      };
      const createdPerson = { id: "p-1", ...payload };
      directoryServiceMock.createPerson.mockResolvedValue(createdPerson);

      const response = await POST(makeRequest(payload), {
        params: Promise.resolve({ projectId: "42" }),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(createdPerson);
      expect(directoryServiceMock.createPerson).toHaveBeenCalledWith(
        "42",
        payload,
      );
    });
  });
});
