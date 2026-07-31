import { DirectoryService } from "../directoryService";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase client
const createMockSupabase = () => {
  const mockSupabase = {
    from: jest.fn(),
    rpc: jest.fn(),
  } as unknown as SupabaseClient;

  return mockSupabase;
};

// Helper to create a chainable query mock
const createChainableMock = (resolvedValue: {
  data: unknown;
  error: unknown;
  count?: number;
}) => {
  const chainable: Record<string, jest.Mock> = {};
  const methods = [
    "select",
    "eq",
    "order",
    "range",
    "ilike",
    "or",
    "single",
    "in",
    "insert",
    "update",
    "delete",
    "upsert",
  ];

  methods.forEach((method) => {
    chainable[method] = jest.fn().mockImplementation(() => {
      // Return the chainable for most methods
      return {
        ...chainable,
        then: (resolve: (value: unknown) => void) => resolve(resolvedValue),
      };
    });
  });

  // Make the mock itself awaitable
  Object.assign(chainable, {
    then: (resolve: (value: unknown) => void) => resolve(resolvedValue),
  });

  return chainable;
};

describe("DirectoryService - User Management", () => {
  let service: DirectoryService;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new DirectoryService(mockSupabase);
  });

  describe("bulkAddUsers", () => {
    it("should successfully add multiple users", async () => {
      const users = [
        {
          first_name: "User",
          last_name: "One",
          email: "user1@example.com",
          permission_template_id: "template-1",
          person_type: "user" as const,
        },
        {
          first_name: "User",
          last_name: "Two",
          email: "user2@example.com",
          permission_template_id: "template-2",
          person_type: "user" as const,
        },
      ];

      // Mock createPerson to succeed for all users
      jest.spyOn(service, "createPerson").mockResolvedValue({
        id: "mock-id",
        first_name: "User",
        last_name: "One",
        email: "user1@example.com",
        person_type: "user",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never);

      const result = await service.bulkAddUsers("1", users);

      expect(result.created_count).toBe(2);
      expect(result.failed_count).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe("success");
      expect(service.createPerson).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures gracefully", async () => {
      const users = [
        {
          first_name: "User",
          last_name: "One",
          email: "user1@example.com",
          permission_template_id: "template-1",
          person_type: "user" as const,
        },
        {
          first_name: "User",
          last_name: "Two",
          email: "user2@example.com",
          permission_template_id: "template-2",
          person_type: "user" as const,
        },
      ];

      // Mock first call to succeed, second to fail
      jest
        .spyOn(service, "createPerson")
        .mockResolvedValueOnce({
          id: "mock-id",
          first_name: "User",
          last_name: "One",
          email: "user1@example.com",
          person_type: "user",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .mockRejectedValueOnce(new Error("Duplicate email"));

      const result = await service.bulkAddUsers("1", users);

      expect(result.created_count).toBe(1);
      expect(result.failed_count).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe("success");
      expect(result.results[1].status).toBe("error");
      expect(result.results[1].message).toBe("Duplicate email");
    });

    it("should return all failures when no users succeed", async () => {
      const users = [
        {
          first_name: "User",
          last_name: "One",
          email: "user1@example.com",
          permission_template_id: "template-1",
          person_type: "user" as const,
        },
      ];

      jest
        .spyOn(service, "createPerson")
        .mockRejectedValue(new Error("Permission template not found"));

      const result = await service.bulkAddUsers("1", users);

      expect(result.created_count).toBe(0);
      expect(result.failed_count).toBe(1);
      expect(result.results[0].status).toBe("error");
      expect(result.results[0].message).toBe("Permission template not found");
    });
  });

  describe("resendInvite", () => {
    it("should update invite status and generate new token", async () => {
      const mockUpdatedMembership = {
        invite_token: "invite_12345_abc123",
        invite_status: "invited",
        last_invited_at: new Date().toISOString(),
      };

      const chainable = createChainableMock({
        data: mockUpdatedMembership,
        error: null,
      });
      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "project_directory_memberships") {
          return {
            update: jest.fn().mockReturnValue(chainable),
          };
        }
        if (table === "permission_audit_log") {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.resendInvite("1", "person-1");

      expect(result).toHaveProperty("invite_token");
      expect(result.invite_status).toBe("invited");
    });

    it("should throw error if update fails", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Update failed" },
                }),
              }),
            }),
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await expect(
        service.resendInvite("1", "invalid-id"),
      ).rejects.toMatchObject({
        message: "Update failed",
      });
    });
  });

  describe("logActivity", () => {
    it("should insert activity log entry into permission_audit_log", async () => {
      let insertedData: unknown = null;
      let tableName: string | null = null;

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        tableName = table;
        return {
          insert: jest.fn().mockImplementation((data) => {
            insertedData = data;
            return Promise.resolve({ error: null });
          }),
        };
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.logActivity(
        "1",
        "person-1",
        "updated",
        "Updated job title",
        { permission_type: "write", module: "budget" },
        "admin-1",
      );

      // Source uses permission_audit_log, not user_activity_log
      expect(tableName).toBe("permission_audit_log");
      expect(insertedData).toMatchObject({
        project_id: 1,
        person_id: "person-1",
        action: "updated",
        changed_by: "admin-1",
      });
    });

    it("should throw when the activity log insert fails", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: { message: "Insert failed" },
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      // Source throws when error is returned — activity log errors propagate
      await expect(
        service.logActivity("1", "person-1", "updated", "Test", {}, "admin-1"),
      ).rejects.toMatchObject({ message: "Insert failed" });
    });
  });
});
