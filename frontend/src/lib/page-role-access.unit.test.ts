import {
  canonicalizeProjectPath,
  formatAllowedRoleNames,
  type PageRoleAccessPolicy,
} from "./page-role-access";
import type { PermissionTemplate } from "./permissions-shared";

const templates: PermissionTemplate[] = [
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Superintendent",
    rules_json: {},
    granular_flags: [],
    is_system: true,
    scope: "project",
  },
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Project Manager",
    rules_json: {},
    granular_flags: [],
    is_system: true,
    scope: "project",
  },
];

describe("page role access helpers", () => {
  it("canonicalizes concrete project paths to inventory route patterns", () => {
    expect(canonicalizeProjectPath("/25125/budget")).toBe(
      "/[projectId]/budget",
    );
    expect(canonicalizeProjectPath("/25125/drawings/")).toBe(
      "/[projectId]/drawings",
    );
    expect(canonicalizeProjectPath("/site-map")).toBeNull();
  });

  it("labels inherited policies distinctly from explicit allowed roles", () => {
    const inherited: PageRoleAccessPolicy = {
      route: "/[projectId]/budget",
      mode: "inherit_requirement",
      allowedPermissionTemplateIds: [],
      notes: null,
      updatedAt: null,
      updatedBy: null,
    };

    expect(formatAllowedRoleNames(inherited, templates)).toBe("Inherited");
  });

  it("formats explicit allowed role names without reading module rules", () => {
    const explicit: PageRoleAccessPolicy = {
      route: "/[projectId]/budget",
      mode: "explicit_allowlist",
      allowedPermissionTemplateIds: [
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000001",
      ],
      notes: null,
      updatedAt: null,
      updatedBy: null,
    };

    expect(formatAllowedRoleNames(explicit, templates)).toBe(
      "Project Manager, Superintendent",
    );
  });
});
