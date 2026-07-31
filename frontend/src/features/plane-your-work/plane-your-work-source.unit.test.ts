import {
  PLANE_YOUR_WORK_SOURCE_FILES,
  PLANE_YOUR_WORK_SOURCE_REVISION,
} from "./plane-your-work-source";

describe("Plane Your Work source contract", () => {
  it("pins the reviewed Plane profile-list templates", () => {
    expect(PLANE_YOUR_WORK_SOURCE_REVISION).toBe(
      "39856932cd6b9bd17eab0920506d628190b47af2",
    );
    expect(PLANE_YOUR_WORK_SOURCE_FILES).toEqual([
      "apps/web/core/components/issues/issue-layouts/list/roots/profile-issues-root.tsx",
      "apps/web/core/components/issues/issue-layouts/list/base-list-root.tsx",
      "apps/web/core/components/issues/issue-layouts/list/default.tsx",
      "apps/web/core/components/issues/issue-layouts/list/block.tsx",
      "apps/web/core/components/issues/issue-layouts/empty-states/profile-view.tsx",
    ]);
  });
});
