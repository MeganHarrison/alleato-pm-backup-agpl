import { NextRequest } from "next/server";
import { DELETE, GET, PUT } from "../route";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({
    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })),
    },
  })),
}));

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn((projectId) => ({
    serviceClient: require("@/lib/supabase/service").createServiceClient(),
    user: { id: 'test-user-id', email: 'test@example.com' }
  })),
  isAuthError: jest.fn((result) => result && result.status >= 400),
}));

const createServiceClientMock = createServiceClient as jest.Mock;

describe("Directory permissions route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("returns permission collection and applies search filtering", async () => {
      const memberships = [
        {
          id: "m-1",
          person_id: "person-1",
          person: {
            id: "person-1",
            first_name: "Alice",
            last_name: "Baker",
            email: "alice@example.com",
            company: { name: "Acme" },
          },
          permission_template: {
            id: "tpl-owner",
            name: "Owner",
            rules_json: { directory: ["admin"] },
          },
        },
        {
          id: "m-2",
          person_id: "person-2",
          person: {
            id: "person-2",
            first_name: "Bob",
            last_name: "Smith",
            email: "bob@example.com",
          },
          permission_template: {
            id: "tpl-viewer",
            name: "Viewer",
            rules_json: { directory: ["read"] },
          },
        },
      ];

      const perms = [
        { person_id: "person-2", permission_level: "standard" },
      ];

      const membershipQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ data: memberships, error: null }),
        ),
      };

      const permsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ data: perms, error: null }),
        ),
      };

      const supabase = {
        from: jest.fn((table: string) =>
          table === "project_directory_memberships" ? membershipQuery : permsQuery,
        ),
      };

      createServiceClientMock.mockReturnValue(supabase);

      const request = new NextRequest(
        "http://localhost/api/projects/42/directory/permissions?search=smith",
      );

      const response = await GET(request, {
        params: Promise.resolve({ projectId: "42" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      const [result] = json.data;
      expect(result.person_id).toBe("person-2");
      expect(result.permission_level).toBe("standard");
      expect(result.has_explicit_permission).toBe(true);
      expect(result.permission_template_id).toBe("tpl-viewer");
      expect(result.template_name).toBe("Viewer");
    });

    it("returns permission_template_id so the members UI can match by ID, not by name", async () => {
      // Regression: previously the dropdown matched templates by template_name,
      // which silently broke when two templates shared a name or one was renamed.
      // The API must always expose the template's UUID alongside its name.
      const memberships = [
        {
          id: "m-1",
          person_id: "person-1",
          person: {
            id: "person-1",
            first_name: "Alice",
            last_name: "Baker",
            email: "alice@example.com",
            company: { name: "Acme" },
          },
          permission_template: {
            id: "tpl-owner",
            name: "Owner",
            rules_json: { directory: ["admin"] },
          },
        },
      ];

      const membershipQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ data: memberships, error: null }),
        ),
      };
      const permsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ data: [], error: null }),
        ),
      };
      const supabase = {
        from: jest.fn((table: string) =>
          table === "project_directory_memberships" ? membershipQuery : permsQuery,
        ),
      };
      createServiceClientMock.mockReturnValue(supabase);

      const response = await GET(
        new NextRequest("http://localhost/api/projects/42/directory/permissions"),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      const json = await response.json();
      expect(json.data[0]).toMatchObject({
        person_id: "person-1",
        permission_template_id: "tpl-owner",
        template_name: "Owner",
      });
    });

    it("returns null permission_template_id when the member has no template", async () => {
      const memberships = [
        {
          id: "m-3",
          person_id: "person-3",
          person: {
            id: "person-3",
            first_name: "Carol",
            last_name: "Doe",
            email: "carol@example.com",
          },
          permission_template: null,
        },
      ];

      const membershipQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ data: memberships, error: null }),
        ),
      };
      const permsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ data: [], error: null }),
        ),
      };
      const supabase = {
        from: jest.fn((table: string) =>
          table === "project_directory_memberships" ? membershipQuery : permsQuery,
        ),
      };
      createServiceClientMock.mockReturnValue(supabase);

      const response = await GET(
        new NextRequest("http://localhost/api/projects/42/directory/permissions"),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      const json = await response.json();
      expect(json.data[0].permission_template_id).toBeNull();
      expect(json.data[0].template_name).toBeNull();
    });
  });

  describe("PUT", () => {
    const buildRequest = (payload: Record<string, unknown>) =>
      new NextRequest("http://localhost/api/projects/42/directory/permissions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

    it("rejects missing person_id", async () => {
      const response = await PUT(buildRequest({ permission_level: "admin" }), {
        params: Promise.resolve({ projectId: "42" }),
      });

      expect(response.status).toBe(400);
    });

    it("rejects invalid permission levels", async () => {
      const response = await PUT(
        buildRequest({ person_id: "person-1", permission_level: "ultimate" }),
        {
          params: Promise.resolve({ projectId: "42" }),
        },
      );

      expect(response.status).toBe(400);
    });

    it("upserts permission records when data is valid", async () => {
      const upsertChain = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { project_id: 42, person_id: "person-1", permission_level: "admin" },
          error: null,
        }),
      };
      const supabase = {
        from: jest.fn().mockReturnValue(upsertChain),
      };
      createServiceClientMock.mockReturnValue(supabase);

      const payload = {
        person_id: "person-1",
        permission_level: "admin",
      };

      const response = await PUT(buildRequest(payload), {
        params: Promise.resolve({ projectId: "42" }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: expect.objectContaining(payload),
      });
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        {
          project_id: 42,
          person_id: "person-1",
          permission_level: "admin",
        },
        { onConflict: "project_id,person_id" },
      );
    });
  });

  describe("DELETE", () => {
    it("requires person_id query param", async () => {
      const response = await DELETE(
        new NextRequest("http://localhost/api/projects/42/directory/permissions"),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      expect(response.status).toBe(400);
    });

    it("deletes override records when person_id provided", async () => {
      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve({ error: null }),
        ),
      };

      const supabase = {
        from: jest.fn().mockReturnValue(deleteChain),
      };
      createServiceClientMock.mockReturnValue(supabase);

      const response = await DELETE(
        new NextRequest(
          "http://localhost/api/projects/42/directory/permissions?person_id=person-1",
        ),
        { params: Promise.resolve({ projectId: "42" }) },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(deleteChain.eq).toHaveBeenCalledWith("person_id", "person-1");
    });
  });
});
