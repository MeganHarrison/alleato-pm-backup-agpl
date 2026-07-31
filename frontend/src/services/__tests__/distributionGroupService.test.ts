import { DistributionGroupService } from "../distributionGroupService";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase client
const createMockSupabase = () => {
  const mockSupabase = {
    from: jest.fn(),
    rpc: jest.fn(),
  } as unknown as SupabaseClient;

  return mockSupabase;
};

describe("DistributionGroupService", () => {
  let service: DistributionGroupService;
  let mockSupabase: SupabaseClient;

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

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new DistributionGroupService(mockSupabase);
  });

  describe("getGroups", () => {
    it("should return list of groups without members", async () => {
      const mockGroups = [
        { id: "group-1", name: "Group 1", project_id: 1, status: "active" },
        { id: "group-2", name: "Group 2", project_id: 1, status: "active" },
      ];

      const chainable = createChainableMock({ data: mockGroups, error: null });
      const mockFrom = jest.fn().mockReturnValue(chainable);

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getGroups("1", false, "active");

      expect(result).toHaveLength(2);
      expect(result[0].member_count).toBe(0);
    });

    it("should return groups with members when includeMembers is true", async () => {
      const mockGroups = [
        { id: "group-1", name: "Group 1", project_id: 1, status: "active" },
      ];

      const mockMembers = [
        { person: { id: "person-1", first_name: "John", last_name: "Doe" } },
        { person: { id: "person-2", first_name: "Jane", last_name: "Smith" } },
      ];

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "distribution_groups") {
          return createChainableMock({ data: mockGroups, error: null });
        }
        if (table === "distribution_group_members") {
          return createChainableMock({ data: mockMembers, error: null });
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getGroups("1", true, "active");

      expect(result[0].member_count).toBe(2);
      expect(result[0].members).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const chainable = createChainableMock({ data: [], error: null });
      const mockFrom = jest.fn().mockReturnValue(chainable);

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.getGroups("1", false, "all");

      expect(mockFrom).toHaveBeenCalledWith("distribution_groups");
    });
  });

  describe("getGroup", () => {
    it("should return single group with members", async () => {
      const mockGroup = {
        id: "group-1",
        name: "Test Group",
        project_id: 1,
        status: "active",
        description: "Test description",
      };

      const mockMembers = [
        { person: { id: "person-1", first_name: "John", last_name: "Doe" } },
      ];

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "distribution_groups") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockGroup,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "distribution_group_members") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockMembers,
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getGroup("group-1", true);

      expect(result.id).toBe("group-1");
      expect(result.name).toBe("Test Group");
      expect(result.member_count).toBe(1);
    });

    it("should return group without members when includeMembers is false", async () => {
      const mockGroup = {
        id: "group-1",
        name: "Test Group",
        project_id: 1,
      };

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockGroup,
              error: null,
            }),
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getGroup("group-1", false);

      expect(result.member_count).toBe(0);
      expect(result.members).toBeUndefined();
    });
  });

  describe("createGroup", () => {
    it("should create group without members", async () => {
      const mockCreatedGroup = {
        id: "new-group-1",
        name: "New Group",
        project_id: 1,
        status: "active",
      };

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "distribution_groups") {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedGroup,
                  error: null,
                }),
              }),
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedGroup,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "distribution_group_members") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.createGroup("1", {
        name: "New Group",
      });

      expect(result.id).toBe("new-group-1");
      expect(result.name).toBe("New Group");
    });

    it("should create group with initial members", async () => {
      const mockCreatedGroup = {
        id: "new-group-1",
        name: "New Group",
        project_id: 1,
      };

      let membersInserted = false;

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "distribution_groups") {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedGroup,
                  error: null,
                }),
              }),
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedGroup,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "distribution_group_members") {
          return {
            insert: jest.fn().mockImplementation(() => {
              membersInserted = true;
              return { error: null };
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { person: { id: "person-1" } },
                  { person: { id: "person-2" } },
                ],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.createGroup("1", {
        name: "New Group",
        member_ids: ["person-1", "person-2"],
      });

      expect(membersInserted).toBe(true);
    });
  });

  describe("updateGroup", () => {
    it("should update group fields", async () => {
      let updatedData: Record<string, unknown> = {};

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "distribution_groups") {
          return {
            update: jest.fn().mockImplementation((data) => {
              updatedData = data;
              return {
                eq: jest.fn().mockResolvedValue({ error: null }),
              };
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: "group-1", ...updatedData },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "distribution_group_members") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.updateGroup("group-1", {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(updatedData.name).toBe("Updated Name");
      expect(updatedData.description).toBe("Updated description");
    });

    it("should update group status", async () => {
      let updatedData: Record<string, unknown> = {};

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        if (table === "distribution_groups") {
          return {
            update: jest.fn().mockImplementation((data) => {
              updatedData = data;
              return {
                eq: jest.fn().mockResolvedValue({ error: null }),
              };
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: "group-1", status: "inactive" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "distribution_group_members") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.updateGroup("group-1", { status: "inactive" });

      expect(updatedData.status).toBe("inactive");
    });
  });

  describe("deleteGroup", () => {
    it("should delete group", async () => {
      let deleteGroupId: string | null = null;

      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((field: string, value: string) => {
            if (field === "id") {
              deleteGroupId = value;
            }
            return Promise.resolve({ error: null });
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.deleteGroup("group-1");

      expect(deleteGroupId).toBe("group-1");
    });

    it("should throw error if deletion fails", async () => {
      const mockDeleteError = { message: "Delete failed", code: "ERR" };

      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: mockDeleteError,
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await expect(service.deleteGroup("group-1")).rejects.toEqual(
        mockDeleteError,
      );
    });
  });

  describe("addMembers", () => {
    it("should add members to group", async () => {
      let insertedData: unknown[] = [];

      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockImplementation((data) => {
          insertedData = data;
          return { error: null };
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.addMembers("group-1", ["person-1", "person-2"]);

      expect(insertedData).toHaveLength(2);
      expect(insertedData).toContainEqual({
        group_id: "group-1",
        person_id: "person-1",
      });
    });

    it("should do nothing when personIds is empty", async () => {
      const upsertCalled = jest.fn();

      const mockFrom = jest.fn().mockReturnValue({
        upsert: upsertCalled,
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.addMembers("group-1", []);

      expect(upsertCalled).not.toHaveBeenCalled();
    });
  });

  describe("removeMembers", () => {
    it("should remove members from group", async () => {
      let deletedIds: string[] = [];

      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockImplementation((field: string, ids: string[]) => {
              if (field === "person_id") {
                deletedIds = ids;
              }
              return { error: null };
            }),
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.removeMembers("group-1", ["person-1", "person-2"]);

      expect(deletedIds).toEqual(["person-1", "person-2"]);
    });

    it("should do nothing when personIds is empty", async () => {
      const deleteCalled = jest.fn();

      const mockFrom = jest.fn().mockReturnValue({
        delete: deleteCalled,
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      await service.removeMembers("group-1", []);

      expect(deleteCalled).not.toHaveBeenCalled();
    });
  });

  describe("updateMembers", () => {
    it("should remove then add members", async () => {
      const operations: string[] = [];

      jest.spyOn(service, "removeMembers").mockImplementation(async () => {
        operations.push("remove");
      });

      jest.spyOn(service, "addMembers").mockImplementation(async () => {
        operations.push("add");
      });

      await service.updateMembers("group-1", {
        remove: ["person-1"],
        add: ["person-2", "person-3"],
      });

      expect(operations).toEqual(["remove", "add"]);
      expect(service.removeMembers).toHaveBeenCalledWith("group-1", [
        "person-1",
      ]);
      expect(service.addMembers).toHaveBeenCalledWith("group-1", [
        "person-2",
        "person-3",
      ]);
    });

    it("should only add if no removes specified", async () => {
      jest.spyOn(service, "removeMembers").mockImplementation(async () => {});
      jest.spyOn(service, "addMembers").mockImplementation(async () => {});

      await service.updateMembers("group-1", {
        add: ["person-1"],
      });

      expect(service.removeMembers).not.toHaveBeenCalled();
      expect(service.addMembers).toHaveBeenCalled();
    });
  });

  describe("getGroupMembers", () => {
    it("should return list of members", async () => {
      const mockMembers = [
        { person: { id: "person-1", first_name: "John", last_name: "Doe" } },
        { person: { id: "person-2", first_name: "Jane", last_name: "Smith" } },
      ];

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockMembers,
            error: null,
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getGroupMembers("group-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("person-1");
    });

    it("should filter out null persons", async () => {
      const mockMembers = [
        { person: { id: "person-1" } },
        { person: null },
        { person: { id: "person-2" } },
      ];

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockMembers,
            error: null,
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getGroupMembers("group-1");

      expect(result).toHaveLength(2);
    });
  });

  describe("getPersonGroups", () => {
    it("should return groups for a person", async () => {
      const mockGroups = [
        { id: "group-1", name: "Group 1" },
        { id: "group-2", name: "Group 2" },
      ];

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockGroups,
                error: null,
              }),
            }),
          }),
        }),
      });

      (mockSupabase.from as typeof mockFrom) = mockFrom;

      const result = await service.getPersonGroups("1", "person-1");

      expect(result).toHaveLength(2);
    });
  });

  describe("cloneGroup", () => {
    it("should clone group with members", async () => {
      const originalGroup = {
        id: "group-1",
        name: "Original",
        description: "Original description",
        project_id: 1,
        members: [{ id: "person-1" }, { id: "person-2" }],
      };

      jest.spyOn(service, "getGroup").mockResolvedValue(originalGroup as never);

      const createGroupSpy = jest
        .spyOn(service, "createGroup")
        .mockResolvedValue({
          id: "new-group",
          name: "Cloned Group",
          project_id: 1,
          member_count: 2,
        } as never);

      await service.cloneGroup("group-1", "Cloned Group", true);

      expect(createGroupSpy).toHaveBeenCalledWith("1", {
        name: "Cloned Group",
        description: "Original description",
        member_ids: ["person-1", "person-2"],
      });
    });

    it("should clone group without members", async () => {
      const originalGroup = {
        id: "group-1",
        name: "Original",
        description: "Test",
        project_id: 1,
      };

      jest.spyOn(service, "getGroup").mockResolvedValue(originalGroup as never);

      const createGroupSpy = jest
        .spyOn(service, "createGroup")
        .mockResolvedValue({
          id: "new-group",
          name: "Cloned",
          project_id: 1,
        } as never);

      await service.cloneGroup("group-1", "Cloned", false);

      expect(createGroupSpy).toHaveBeenCalledWith("1", {
        name: "Cloned",
        description: "Test",
        member_ids: undefined,
      });
    });
  });
});
