import {
  provisionProjectCreatorAccess,
  resolveProjectCreatorAccess,
  type ProjectCreatorAccessClient,
} from "@/lib/projects/project-creator-access";

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data, error })),
    insert: jest.fn(async () => ({ data: null, error })),
  };
  return query;
}

describe("project creator access", () => {
  it("resolves the linked person and canonical Project Admin template", async () => {
    const authLink = queryResult({ person_id: "person-1" });
    const template = queryResult({ id: "template-1" });
    const serviceClient: ProjectCreatorAccessClient = {
      from: jest.fn((table: string) => {
        if (table === "users_auth") return authLink;
        if (table === "permission_templates") return template;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await expect(
      resolveProjectCreatorAccess({
        serviceClient,
        authUserId: "auth-1",
        where: "test",
      }),
    ).resolves.toEqual({
      personId: "person-1",
      permissionTemplateId: "template-1",
    });

    expect(template.eq).toHaveBeenCalledWith("is_system", true);
    expect(template.eq).toHaveBeenCalledWith("name", "Project Admin");
  });

  it("fails loudly before project creation when the directory link is missing", async () => {
    const authLink = queryResult(null);
    const serviceClient: ProjectCreatorAccessClient = {
      from: jest.fn(() => authLink),
    };

    await expect(
      resolveProjectCreatorAccess({
        serviceClient,
        authUserId: "auth-1",
        where: "test",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Project creator is not linked to a directory person.",
    });
  });

  it("creates the active Project Admin membership used by project route guards", async () => {
    const memberships = queryResult(null);
    const serviceClient: ProjectCreatorAccessClient = {
      from: jest.fn(() => memberships),
    };

    await expect(
      provisionProjectCreatorAccess({
        serviceClient,
        projectId: 42,
        access: {
          personId: "person-1",
          permissionTemplateId: "template-1",
        },
      }),
    ).resolves.toBeNull();

    expect(memberships.insert).toHaveBeenCalledWith({
      person_id: "person-1",
      project_id: 42,
      user_type: "employee",
      status: "active",
      role: "Project Admin",
      permission_template_id: "template-1",
    });
  });
});
