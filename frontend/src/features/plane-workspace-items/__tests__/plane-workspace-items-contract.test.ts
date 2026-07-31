import {
  ListPlaneWorkspaceItemsQuerySchema,
  UpdatePlaneWorkspaceItemSchema,
  UpsertPlaneWorkspaceItemSchema,
  requiresPlaneWorkspaceProject,
} from "../plane-workspace-items-contract";

describe("Plane workspace item contracts", () => {
  it("bounds list queries and defaults the limit", () => {
    expect(
      ListPlaneWorkspaceItemsQuerySchema.parse({
        workspace_key: "alleato",
        project_id: "31",
        item_kind: "recent",
      }),
    ).toEqual({
      workspace_key: "alleato",
      project_id: 31,
      item_kind: "recent",
      limit: 50,
    });
    expect(() =>
      ListPlaneWorkspaceItemsQuerySchema.parse({
        workspace_key: "alleato",
        limit: "101",
      }),
    ).toThrow();
  });

  it("accepts only application-relative hrefs", () => {
    expect(() =>
      UpsertPlaneWorkspaceItemSchema.parse({
        workspace_key: "alleato",
        item_kind: "favorite",
        entity_type: "workspace_route",
        entity_identifier: "home",
        name: "Home",
        href: "https://attacker.example",
      }),
    ).toThrow("href must be a normalized application-relative path");

    for (const href of [
      "/\\evil.example/path",
      "/safe\\..\\evil",
      "/safe\u0000path",
    ]) {
      expect(() =>
        UpsertPlaneWorkspaceItemSchema.parse({
          workspace_key: "alleato",
          item_kind: "favorite",
          entity_type: "workspace_route",
          entity_identifier: "home",
          name: "Home",
          href,
        }),
      ).toThrow("href must be a normalized application-relative path");
    }
  });

  it("does not accept identity or scope reassignment in updates", () => {
    expect(() =>
      UpdatePlaneWorkspaceItemSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        project_id: 99,
      }),
    ).toThrow();
    expect(() =>
      UpdatePlaneWorkspaceItemSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
        last_accessed_at: "2026-07-31T12:00:00.000Z",
      }),
    ).toThrow();
    expect(() =>
      UpdatePlaneWorkspaceItemSchema.parse({
        id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow("At least one workspace item field");
  });

  it("identifies every initial Plane project-scoped entity", () => {
    for (const entityType of [
      "project",
      "work_item",
      "cycle",
      "module",
      "view",
      "page",
      "intake",
      "submittal",
      "rfi",
      "change_event",
      "commitment",
      "prime_contract",
    ]) {
      expect(requiresPlaneWorkspaceProject(entityType)).toBe(true);
    }
    expect(requiresPlaneWorkspaceProject("workspace_route")).toBe(false);
  });
});
