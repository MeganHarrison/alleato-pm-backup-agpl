import {
  CreatePlaneStickyRequestSchema,
  isPlaneStickyMigrationMissing,
  ListPlaneStickiesQuerySchema,
  UpdatePlaneStickySchema,
} from "../plane-stickies-contract";

describe("Plane Stickies contracts", () => {
  it("requires a project id only for project scope", () => {
    expect(
      ListPlaneStickiesQuerySchema.safeParse({
        workspace_key: "alleato",
        scope: "project",
      }).success,
    ).toBe(false);
    expect(
      ListPlaneStickiesQuerySchema.safeParse({
        workspace_key: "alleato",
        scope: "workspace",
        project_id: "31",
      }).success,
    ).toBe(false);
    expect(
      ListPlaneStickiesQuerySchema.parse({
        workspace_key: "alleato",
        scope: "project",
        project_id: "31",
      }),
    ).toMatchObject({ project_id: 31, archived: false, limit: 100 });
  });

  it("defaults new workspace stickies to Plane's gray palette entry", () => {
    expect(
      CreatePlaneStickyRequestSchema.parse({ workspace_key: "alleato" }),
    ).toMatchObject({
      scope: "workspace",
      project_id: null,
      content: "",
      background_color: "gray",
      sort_order: 65_535,
    });
  });

  it("rejects unknown mutation fields and empty updates", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(UpdatePlaneStickySchema.safeParse({ id }).success).toBe(false);
    expect(
      UpdatePlaneStickySchema.safeParse({ id, content: "ok", owner_id: id })
        .success,
    ).toBe(false);
  });

  it("recognizes both PostgreSQL and PostgREST pending-migration errors", () => {
    expect(
      isPlaneStickyMigrationMissing({ code: "42P01", message: "missing" }),
    ).toBe(true);
    expect(
      isPlaneStickyMigrationMissing({
        code: "PGRST205",
        message: "not in the schema cache",
      }),
    ).toBe(true);
    expect(
      isPlaneStickyMigrationMissing({ code: "23505", message: "duplicate" }),
    ).toBe(false);
  });
});
