import {
  CreatePlaneModuleSchema,
  PLANE_MODULE_STATUSES,
  ReplacePlaneModuleTasksSchema,
  UpdatePlaneModuleSchema,
} from "../plane-modules-contract";
import {
  PLANE_MODULES_REVISION,
  PLANE_MODULES_SOURCE_OFFER_PATH,
  PLANE_MODULES_SOURCE_PATHS,
} from "../plane-modules-source";

describe("Plane Modules contract", () => {
  it("accepts the Plane status taxonomy and applies safe defaults", () => {
    const parsed = CreatePlaneModuleSchema.parse({
      projectId: 31,
      name: "Foundation",
    });

    expect(parsed.status).toBe("planned");
    expect(parsed.description).toBe("");
    expect(parsed.memberPersonIds).toEqual([]);
    expect(PLANE_MODULE_STATUSES).toHaveLength(6);
  });

  it("rejects a target date earlier than the start date", () => {
    expect(() =>
      CreatePlaneModuleSchema.parse({
        projectId: 31,
        name: "Foundation",
        startDate: "2026-08-10",
        targetDate: "2026-08-01",
      }),
    ).toThrow("Target date cannot be earlier than start date");
  });

  it("requires a real update field and validates bulk task IDs", () => {
    expect(
      UpdatePlaneModuleSchema.safeParse({
        projectId: 31,
        moduleId: "5f87d5ef-f736-4446-81b8-f6ba396b1d5a",
      }).success,
    ).toBe(false);
    expect(
      ReplacePlaneModuleTasksSchema.safeParse({
        projectId: 31,
        moduleId: "5f87d5ef-f736-4446-81b8-f6ba396b1d5a",
        taskIds: ["not-a-task-id"],
      }).success,
    ).toBe(false);
  });

  it("pins Plane provenance and the public source-offer path", () => {
    expect(PLANE_MODULES_REVISION).toMatch(/^[a-f0-9]{40}$/);
    expect(PLANE_MODULES_SOURCE_OFFER_PATH).toBe("/auth/source");
    expect(PLANE_MODULES_SOURCE_PATHS).toContain(
      "apps/api/plane/db/models/module.py",
    );
  });
});
