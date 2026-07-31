import { resolveProjectAccessForPerson } from "@/lib/auth/project-access";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createQuery(result: QueryResult) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "limit"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return query;
}

function createAccessClient({
  activePerson = { id: "person-1" },
  membership = null,
  roleMembership = null,
  companyTemplate = null,
  errorTable,
}: {
  activePerson?: unknown;
  membership?: unknown;
  roleMembership?: unknown;
  companyTemplate?: unknown;
  errorTable?: string;
}) {
  return {
    from: jest.fn((table: string) =>
      createQuery({
        data:
          table === "people"
            ? activePerson
            : table === "project_directory_memberships"
              ? membership
              : table === "project_role_members"
                ? roleMembership
                : table === "person_company_templates"
                  ? companyTemplate
                  : null,
        error:
          table === errorTable ? { message: `${table} lookup failed` } : null,
      }),
    ),
  };
}

describe("resolveProjectAccessForPerson", () => {
  it("uses the embedded template alias when filtering company scope", async () => {
    const client = createAccessClient({
      companyTemplate: { template_id: "company-project-manager" },
    });

    await resolveProjectAccessForPerson(client as never, "person-1", 1144);

    const companyQueryIndex = client.from.mock.calls.findIndex(
      ([table]) => table === "person_company_templates",
    );
    const companyQuery = client.from.mock.results[companyQueryIndex]?.value;
    expect(companyQuery.eq).toHaveBeenCalledWith("template.scope", "company");
  });

  it("uses the direct project template before the company template", async () => {
    const client = createAccessClient({
      membership: {
        id: "membership-1",
        permission_template_id: "project-template",
        user_type: "employee",
      },
      companyTemplate: { template_id: "company-template" },
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 1144),
    ).resolves.toEqual({
      authorized: true,
      accessSource: "directory",
      membershipId: "membership-1",
      permissionTemplateId: "project-template",
      userType: "employee",
    });
  });

  it("authorizes a project-role member with the company template", async () => {
    const client = createAccessClient({
      roleMembership: { id: "role-membership-1" },
      companyTemplate: { template_id: "company-project-manager" },
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-kebba", 1144),
    ).resolves.toEqual({
      authorized: true,
      accessSource: "project-role",
      membershipId: "role:role-membership-1",
      permissionTemplateId: "company-project-manager",
      userType: null,
    });
  });

  it("authorizes a company-template holder on every project", async () => {
    const client = createAccessClient({
      companyTemplate: { template_id: "company-project-manager" },
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 9999),
    ).resolves.toEqual({
      authorized: true,
      accessSource: "company-template",
      membershipId: "company-template:person-1:9999",
      permissionTemplateId: "company-project-manager",
      userType: "employee",
    });
  });

  it("denies a user with no project or company access source", async () => {
    const client = createAccessClient({});

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 1144),
    ).resolves.toEqual({
      authorized: false,
      reason: "no-project-access",
    });
  });

  it("denies an inactive company-template holder before access lookup", async () => {
    const client = createAccessClient({
      activePerson: null,
      companyTemplate: { template_id: "company-project-manager" },
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 1144),
    ).resolves.toEqual({
      authorized: false,
      reason: "no-project-access",
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("denies an inactive project-role holder before access lookup", async () => {
    const client = createAccessClient({
      activePerson: null,
      roleMembership: { id: "role-membership-1" },
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 1144),
    ).resolves.toEqual({
      authorized: false,
      reason: "no-project-access",
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("fails closed when active-person lookup fails", async () => {
    const client = createAccessClient({
      roleMembership: { id: "role-membership-1" },
      errorTable: "people",
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 1144),
    ).resolves.toEqual({
      authorized: false,
      reason: "project-access-query-failed",
      error: "people lookup failed",
    });
  });

  it("fails closed and names the failed access lookup", async () => {
    const client = createAccessClient({
      roleMembership: { id: "role-membership-1" },
      errorTable: "person_company_templates",
    });

    await expect(
      resolveProjectAccessForPerson(client as never, "person-1", 1144),
    ).resolves.toEqual({
      authorized: false,
      reason: "project-access-query-failed",
      error: "person_company_templates lookup failed",
    });
  });
});

describe("Project Manager commitment migration", () => {
  it("updates every Project Manager template and enforces write at RLS", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "..",
        "supabase",
        "migrations",
        "20260730023000_project_manager_commitments_and_access.sql",
      ),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(migration).toContain("where lower(btrim(name)) = 'project manager'");
    expect(migration).toContain(`'["read","write"]'::jsonb`);
    expect(migration).toContain(
      "current_has_project_module_permission(project_id, 'commitments', 'write')",
    );
  });

  it("enforces Commitments permissions on every commitment SOV policy", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "..",
        "supabase",
        "migrations",
        "20260730024500_commitment_sov_module_permissions.sql",
      ),
      "utf8",
    ).replace(/\r\n/g, "\n");

    for (const policyName of [
      "schedule_of_values_select",
      "schedule_of_values_insert",
      "schedule_of_values_update",
      "schedule_of_values_delete",
    ]) {
      expect(migration).toContain(`create policy ${policyName}`);
    }
    expect(migration).toContain(
      "current_has_project_module_permission(\n        s.project_id,\n        'commitments',\n        'read'",
    );
    expect(migration).toContain(
      "current_has_project_module_permission(\n        po.project_id,\n        'commitments',\n        'write'",
    );
    expect(migration).toContain(
      "raise exception\n      'Commitment SOV migration left % invalid policies'",
    );
  });
});
