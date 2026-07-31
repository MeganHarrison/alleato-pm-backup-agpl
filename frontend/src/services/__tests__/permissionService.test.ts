import { PermissionService } from "../permissionService";
import type { SupabaseClient } from "@supabase/supabase-js";

const createSelectChain = (response: unknown) => {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  return chain;
};

const createAwaitableQuery = (response: unknown) => {
  const query: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((resolve) => resolve(response)),
  };
  return query;
};

describe("PermissionService", () => {
  let service: PermissionService;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(),
    } as unknown as SupabaseClient;
    service = new PermissionService(mockSupabase);
  });

  describe("getUserPermissions", () => {
    it("returns empty rules when no membership exists", async () => {
      const query = createSelectChain({ data: null, error: new Error("not found") });
      (mockSupabase.from as jest.Mock).mockReturnValue(query);

      const result = await service.getUserPermissions("user-1", "1");

      expect(result.userId).toBe("user-1");
      expect(result.projectId).toBe("1");
      expect(result.rules).toEqual({});
    });

    it("caches successful lookups", async () => {
      const membership = {
        permission_template: {
          id: "template-1",
          name: "Project Owner",
          rules_json: {
            directory: ["read", "write"],
          },
        },
        person: {
          users_auth: [{ auth_user_id: "auth-user-1" }],
        },
      };
      const query = createSelectChain({ data: membership, error: null });
      const fromMock = jest.fn().mockReturnValue(query);
      (mockSupabase.from as jest.Mock) = fromMock;

      await service.getUserPermissions("auth-user-1", "10");
      await service.getUserPermissions("auth-user-1", "10");

      expect(fromMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("permission checks", () => {
    it("evaluates admin/write/read correctly", async () => {
      const permissions = {
        userId: "auth-user-1",
        projectId: "10",
        rules: {
          directory: ["read", "write"],
          contracts: ["admin"],
        },
      };

      jest.spyOn(service, "getUserPermissions").mockResolvedValue(permissions as any);

      await expect(
        service.hasPermission("auth-user-1", "10", "directory", "write"),
      ).resolves.toBe(true);
      await expect(
        service.hasPermission("auth-user-1", "10", "directory", "read"),
      ).resolves.toBe(true);
      await expect(
        service.hasPermission("auth-user-1", "10", "directory", "admin"),
      ).resolves.toBe(false);
      await expect(
        service.hasPermission("auth-user-1", "10", "contracts", "read"),
      ).resolves.toBe(true);

      await expect(
        service.requirePermission("auth-user-1", "10", "contracts", "admin"),
      ).resolves.not.toThrow();
      await expect(
        service.requirePermission("auth-user-1", "10", "directory", "admin"),
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  describe("permission templates", () => {
    it("loads templates with optional scope filtering", async () => {
      const templates = [
        {
          id: "template-1",
          name: "Template",
          description: "desc",
          rules_json: {},
          scope: "company",
          is_system: false,
        },
      ];
      const query = createAwaitableQuery({
        data: templates,
        error: null,
      });
      (mockSupabase.from as jest.Mock).mockReturnValue(query);

      const result = await service.getPermissionTemplates("company");

      expect(query.eq).toHaveBeenCalledWith("scope", "company");
      expect(result).toEqual(templates);
    });
  });
});
