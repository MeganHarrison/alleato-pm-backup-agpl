import { readFileSync } from "fs";
import { join } from "path";

const siteMapDir = join(process.cwd(), "src/app/(admin)/site-map");
const libDir = join(process.cwd(), "src/lib");

describe("site-map layout options", () => {
  it("keeps edit routes as a first-class layout option", () => {
    const clientSource = readFileSync(
      join(siteMapDir, "site-map-client.tsx"),
      "utf8",
    );
    const routeInventorySource = readFileSync(
      join(libDir, "route-inventory.ts"),
      "utf8",
    );

    expect(clientSource).toContain('| "Edit"');
    expect(clientSource).toMatch(/const LAYOUTS:[\s\S]*"Form",\n\s*"Edit",/);
    expect(routeInventorySource).toMatch(
      /routeLower\.endsWith\("\/edit"\)[\s\S]*return "Edit";/,
    );
    expect(clientSource).toContain('route.layout === "Edit"');
  });

  it("keeps layout tabs strict to the selected route layout", () => {
    const clientSource = readFileSync(
      join(siteMapDir, "site-map-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain('"detail-pages": "Detail Pages"');
    expect(clientSource).toContain('"edit-pages": "Edit Pages"');
    expect(clientSource).toContain('"deprecated-pages": "Deprecated"');
    expect(clientSource).toMatch(
      /const LAYOUTS:[\s\S]*"Content",\n\s*"Deprecated",\n\s*"Other",/,
    );
    expect(clientSource).toMatch(
      /tab === "table-pages"[\s\S]*route\.layout === "Table"/,
    );
    expect(clientSource).toMatch(
      /tab === "form-pages"[\s\S]*route\.layout === "Form"/,
    );
    expect(clientSource).toMatch(
      /tab === "detail-pages"[\s\S]*route\.layout === "Detail"/,
    );
    expect(clientSource).toMatch(
      /tab === "edit-pages"[\s\S]*route\.layout === "Edit"/,
    );
    expect(clientSource).toMatch(
      /tab === "deprecated-pages"[\s\S]*route\.layout === "Deprecated"/,
    );
    expect(clientSource).toContain('value === "deprecated-pages"');
    expect(clientSource).not.toContain(
      'tab === "form-pages") return isPageRoute && (route.type === "Workflow"',
    );
    expect(clientSource).not.toContain(
      'tab === "table-pages") return isPageRoute && (route.type === "Database / Table"',
    );
  });

  it("keeps access review as a first-class route review workflow", () => {
    const clientSource = readFileSync(
      join(siteMapDir, "site-map-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain('| "access-review"');
    expect(clientSource).toContain('"access-review": "Access Review"');
    expect(clientSource).toMatch(
      /tab === "access-review"[\s\S]*isPageRoute && routeNeedsAccessReview\(route\)/,
    );
    expect(clientSource).toContain("!route.accessIsExplicit");
    expect(clientSource).toContain(
      '{ id: "accessSource", label: "Policy Source", defaultVisible: true }',
    );
    expect(clientSource).toContain('id: "accessSource"');
    expect(clientSource).toContain(
      'currentTab === "admin-pages" || currentTab === "access-review"',
    );
  });

  it("pins the page column by default for wide route reviews", () => {
    const clientSource = readFileSync(
      join(siteMapDir, "site-map-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain('defaultPinnedLeftColumns: ["page"]');
  });

  it("shows which roles satisfy each page requirement", () => {
    const clientSource = readFileSync(
      join(siteMapDir, "site-map-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain(
      '{ id: "qualifyingRoles", label: "Roles That Qualify", defaultVisible: true }',
    );
    expect(clientSource).toContain("function getQualifyingRoleNames");
    expect(clientSource).toContain(
      'queryKey: ["permission-templates", "site-map-role-coverage"]',
    );
    expect(clientSource).toContain("Roles that qualify");
  });

  it("keeps explicit allowed roles separate from qualifying role diagnostics", () => {
    const clientSource = readFileSync(
      join(siteMapDir, "site-map-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain(
      '{ id: "allowedRoles", label: "Allowed Roles", defaultVisible: true }',
    );
    expect(clientSource).toContain("function RoleAccessSelect");
    expect(clientSource).toContain("/api/permissions/page-role-access");
    expect(clientSource).toContain("Allowed roles saved");
    expect(clientSource).toContain("Inherit required access");
    expect(clientSource).toContain('"explicit_allowlist"');
    expect(clientSource).not.toContain("/api/permissions/templates/");
  });
});
