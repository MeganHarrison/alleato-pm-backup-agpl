import { DirectoryPreferencesService } from "../directoryPreferencesService";
import type { DirectoryFilters } from "@/components/directory/DirectoryFilters";

function createMockSupabase(initialPrefs: Record<string, unknown> = {}) {
  const record = {
    id: "pref-1",
    user_id: "user-1",
    project_id: 1,
    preferences: initialPrefs,
  };

  const updateMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });

  return {
    from: jest.fn((table: string) => {
      if (table !== "user_project_preferences") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: record, error: null }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: record, error: null }),
          }),
        }),
        update: updateMock,
      };
    }),
  };
}

describe("DirectoryPreferencesService", () => {
  it("saves a new filter", async () => {
    const mockSupabase = createMockSupabase({
      directory: { savedFilters: [] },
    });
    const service = new DirectoryPreferencesService(
      mockSupabase as any,
    );

    const filters: DirectoryFilters = {
      type: "user",
      status: "active",
      groupBy: "company",
    };

    const saved = await service.saveFilter("user-1", "1", {
      name: "Project Admins",
      filters,
      search: "Admin",
    });

    expect(saved.name).toBe("Project Admins");
    expect(saved.filters).toEqual(filters);
    expect(saved.search).toBe("Admin");
  });
});
