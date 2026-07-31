import { createClient } from "@/lib/supabase/server";
import {
  assignPermissionTemplate,
  getPermissionLevel,
  hasPermission,
  loadUserPermissions,
  loadUserPermissionsWithClient,
} from "@/lib/permissions";
import {
  reduceGranularPermissionOverrides,
  type PermissionModule,
  type UserPermissions,
} from "@/lib/permissions-shared";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: jest.fn(),
  getIsAdmin: jest.fn(async () => false),
}));

const createClientMock = createClient as jest.Mock;

function createQuery(result: unknown) {
  const query: Record<string, jest.Mock | ((resolve: (value: unknown) => unknown) => Promise<unknown>)> = {};
  for (const method of ["select", "eq", "or", "update", "insert"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return query;
}

function createThenableQuery(result: unknown) {
  const query = createQuery(result);
  query.then = (resolve) => Promise.resolve(resolve(result));
  return query;
}

describe("assignPermissionTemplate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects company templates before updating a project membership", async () => {
    const updateQuery = createQuery({ data: null, error: null });
    const from = jest.fn((table: string) => {
      if (table === "permission_templates") {
        return createQuery({ data: { scope: "company" }, error: null });
      }
      if (table === "project_directory_memberships") {
        return updateQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
      from,
    });

    const result = await assignPermissionTemplate(67, "person-1", "company-template-1");

    expect(result).toEqual({
      success: false,
      error: "Project access requires a project permission template.",
    });
    expect(from).toHaveBeenCalledWith("permission_templates");
    expect(from).not.toHaveBeenCalledWith("project_directory_memberships");
  });

  it("updates the project membership when the template is project-scoped", async () => {
    const updateQuery = createQuery({ data: null, error: null });
    const insertQuery = createQuery({ data: null, error: null });
    const from = jest.fn((table: string) => {
      if (table === "permission_templates") {
        return createQuery({ data: { scope: "project" }, error: null });
      }
      if (table === "project_directory_memberships") {
        return updateQuery;
      }
      if (table === "permission_audit_log") {
        return insertQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: "admin-1" } } })),
      },
      from,
    });

    const result = await assignPermissionTemplate(67, "person-1", "project-template-1");

    expect(result).toEqual({ success: true });
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ permission_template_id: "project-template-1" }),
    );
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "assign_template",
        person_id: "person-1",
        project_id: 67,
        template_id: "project-template-1",
      }),
    );
  });
});

describe("loadUserPermissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows active employee app admins from user_profiles when the JWT admin claim is stale", async () => {
    const from = jest.fn((table: string) => {
      if (table === "user_profiles") {
        return createQuery({ data: { is_admin: true }, error: null });
      }
      if (table === "users_auth") {
        return createQuery({ data: { person_id: "person-admin" }, error: null });
      }
      if (table === "people") {
        return createQuery({
          data: { person_type: "employee", status: "active" },
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    createClientMock.mockResolvedValue({
      from,
    });

    const result = await loadUserPermissions(761, "admin-auth-user");

    expect(result).toEqual(
      expect.objectContaining({
        userId: "admin-auth-user",
        personId: "person-admin",
        projectId: 761,
        isAdmin: true,
      }),
    );
    expect(result?.overrides.budget).toBe("none");
    expect(from).not.toHaveBeenCalledWith("project_directory_memberships");
    expect(from).not.toHaveBeenCalledWith("user_module_permissions");
  });

  it("fails closed for an app admin without an active service-linked person", async () => {
    const from = jest.fn((table: string) => {
      if (table === "user_profiles") {
        return createQuery({ data: { is_admin: true }, error: null });
      }
      if (table === "users_auth") {
        return createQuery({ data: null, error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadUserPermissionsWithClient(
      { from } as unknown as Parameters<
        typeof loadUserPermissionsWithClient
      >[0],
      761,
      "unlinked-admin",
    );

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalledWith("project_directory_memberships");
  });

  it("fails closed when an explicit module override query errors", async () => {
    const from = jest.fn((table: string) => {
      if (table === "user_profiles") {
        return createQuery({ data: { is_admin: false }, error: null });
      }
      if (table === "users_auth") {
        return createQuery({ data: { person_id: "person-1" }, error: null });
      }
      if (table === "people") {
        return createQuery({
          data: { person_type: "user", status: "active" },
          error: null,
        });
      }
      if (table === "project_directory_memberships") {
        return createQuery({
          data: {
            permission_template_id: "template-1",
            permission_template: {
              id: "template-1",
              name: "Project Manager",
              rules_json: { contracts: ["read", "write"] },
              granular_flags: [],
            },
          },
          error: null,
        });
      }
      if (table === "user_module_permissions") {
        return createThenableQuery({
          data: null,
          error: { message: "permission override lookup failed" },
        });
      }
      if (table === "user_granular_permission_overrides") {
        return createThenableQuery({ data: [], error: null });
      }
      if (table === "person_company_templates") {
        return createQuery({ data: null, error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadUserPermissionsWithClient(
      { from } as unknown as Parameters<
        typeof loadUserPermissionsWithClient
      >[0],
      67,
      "auth-user-1",
    );

    expect(result).toBeNull();
  });

  it("denies permissions for an inactive person even with an auth mapping", async () => {
    const from = jest.fn((table: string) => {
      if (table === "user_profiles") {
        return createQuery({ data: { is_admin: false }, error: null });
      }
      if (table === "users_auth") {
        return createQuery({ data: { person_id: "person-inactive" }, error: null });
      }
      if (table === "people") {
        return createQuery({
          data: { person_type: "user", status: "inactive" },
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadUserPermissionsWithClient(
      { from } as unknown as Parameters<
        typeof loadUserPermissionsWithClient
      >[0],
      67,
      "inactive-auth-user",
    );

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalledWith("project_directory_memberships");
  });

  it("fails closed when the linked person row is missing", async () => {
    const from = jest.fn((table: string) => {
      if (table === "user_profiles") {
        return createQuery({ data: { is_admin: false }, error: null });
      }
      if (table === "users_auth") {
        return createQuery({ data: { person_id: "missing-person" }, error: null });
      }
      if (table === "people") {
        return createQuery({ data: null, error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await loadUserPermissionsWithClient(
      { from } as unknown as Parameters<
        typeof loadUserPermissionsWithClient
      >[0],
      67,
      "auth-with-missing-person",
    );

    expect(result).toBeNull();
  });
});

describe("explicit module overrides", () => {
  it("treats a persisted none override as a hard deny instead of falling back to the template", () => {
    const modules: PermissionModule[] = [
      "directory",
      "budget",
      "contracts",
      "commitments",
      "estimates",
      "documents",
      "schedule",
      "submittals",
      "rfis",
      "change_orders",
      "change_events",
      "emails",
      "crm",
    ];
    const permissions: UserPermissions = {
      userId: "auth-user",
      personId: "person-user",
      projectId: 43,
      template: {
        id: "template-1",
        name: "Project Manager",
        rules: { contracts: ["read", "write"] } as NonNullable<
          UserPermissions["template"]
        >["rules"],
        granularFlags: [],
      },
      overrides: Object.fromEntries(
        modules.map((module) => [module, "none"]),
      ) as UserPermissions["overrides"],
      explicitOverrideModules: ["contracts"],
      isAdmin: false,
    };

    expect(hasPermission(permissions, "contracts", "read")).toBe(false);
    expect(hasPermission(permissions, "contracts", "write")).toBe(false);
    expect(getPermissionLevel(permissions, "contracts")).toBe("none");
  });
});

describe("granular permission overrides", () => {
  it.each([
    [
      { flag: "create_budget_modifications", effect: "allow" },
      { flag: "create_budget_modifications", effect: "deny" },
    ],
    [
      { flag: "create_budget_modifications", effect: "deny" },
      { flag: "create_budget_modifications", effect: "allow" },
    ],
  ])("makes deny win independent of database row order", (...rows) => {
    expect(reduceGranularPermissionOverrides(rows)).toEqual({
      create_budget_modifications: "deny",
    });
  });
});
