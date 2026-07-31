import {
  PLANE_CHANGE_EVENTS_SOURCE_FILES,
  PLANE_CHANGE_EVENTS_SOURCE_REVISION,
} from "./plane-change-events-source";

describe("Plane Change Events source contract", () => {
  it("pins the reviewed Plane revision and exact template owners", () => {
    expect(PLANE_CHANGE_EVENTS_SOURCE_REVISION).toBe(
      "39856932cd6b9bd17eab0920506d628190b47af2",
    );
    expect(PLANE_CHANGE_EVENTS_SOURCE_FILES).toEqual([
      "apps/web/core/components/issues/header.tsx",
      "apps/web/core/components/issues/issue-layouts/roots/project-layout-root.tsx",
      "apps/web/core/components/issues/issue-layouts/list/base-list-root.tsx",
      "apps/web/core/components/issues/issue-layouts/list/default.tsx",
      "apps/web/core/components/issues/issue-layouts/list/block.tsx",
      "apps/web/core/components/issues/issue-layouts/empty-states/project-issues.tsx",
    ]);
  });
});
