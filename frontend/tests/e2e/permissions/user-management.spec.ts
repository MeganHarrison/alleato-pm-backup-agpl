import { expect, test } from "@playwright/test";

const projectManagerTemplate = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Project Manager",
  description: "Project-scoped PM role",
  scope: "project",
  is_system: true,
  rules_json: {
    directory: ["read", "write"],
    budget: ["read", "write", "admin"],
    contracts: ["read", "write", "admin"],
    documents: ["read", "write"],
    schedule: ["read", "write", "admin"],
    submittals: ["read", "write", "admin"],
    rfis: ["read", "write", "admin"],
    change_orders: ["read", "write", "admin"],
  },
  granular_flags: [
    "approve_change_orders",
    "approve_invoices",
    "create_change_events",
  ],
};

const seniorProjectManagerTemplate = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Senior Project Manager",
  description: "All-project senior PM role",
  scope: "company",
  is_system: true,
  rules_json: projectManagerTemplate.rules_json,
  granular_flags: [
    "approve_change_orders",
    "approve_invoices",
    "create_change_events",
    "manage_project_directory",
  ],
};

const users = [
  {
    personId: "33333333-3333-4333-8333-333333333333",
    authUserId: "44444444-4444-4444-8444-444444444444",
    firstName: "Brandon",
    lastName: "Morgan",
    email: "brandon@example.com",
    profilePhotoUrl: null,
    isAdmin: true,
    companyTemplateId: null,
    companyTemplateName: null,
    memberships: [],
    granularOverrides: [],
  },
];

async function mockPermissionsApis(
  page: import("@playwright/test").Page,
  options: { startWithMissingAuthLink?: boolean } = {},
) {
  let invitePayload: unknown = null;
  let templateUpdatePayload: unknown = null;
  let authLinksRepaired = !options.startWithMissingAuthLink;
  let reconcileCount = 0;

  await page.route("**/api/permissions/users", async (route) => {
    if (route.request().method() === "POST") {
      invitePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            personId: "55555555-5555-4555-8555-555555555555",
            authUserId: "66666666-6666-4666-8666-666666666666",
            accessScope: (invitePayload as { access_scope?: string }).access_scope,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: authLinksRepaired ? users : [],
        diagnostics: {
          missingAuthLinks: authLinksRepaired
            ? []
            : [
                {
                  authUserId: users[0].authUserId,
                  email: users[0].email,
                  fullName: `${users[0].firstName} ${users[0].lastName}`,
                  isAdmin: users[0].isAdmin,
                  issues: ["missing_person_auth_link", "missing_users_auth_link"],
                },
              ],
        },
      }),
    });
  });

  await page.route("**/api/permissions/users/reconcile-links", async (route) => {
    reconcileCount += 1;
    authLinksRepaired = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          repaired: [{ email: users[0].email }],
          unresolved: [],
        },
      }),
    });
  });

  await page.route("**/api/permissions/templates**", async (route) => {
    if (route.request().method() === "PUT") {
      templateUpdatePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    const url = new URL(route.request().url());
    const scope = url.searchParams.get("scope");
    const data =
      scope === "project"
        ? [projectManagerTemplate]
        : scope === "company"
          ? [seniorProjectManagerTemplate]
          : [seniorProjectManagerTemplate, projectManagerTemplate];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });

  await page.route("**/api/projects?limit=500", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: 760, name: "Goodwill Tampa", "job number": "24-010" },
          { id: 983, name: "Alleato Office", "job number": "24-011" },
        ],
      }),
    });
  });

  return {
    getInvitePayload: () => invitePayload,
    getTemplateUpdatePayload: () => templateUpdatePayload,
    getReconcileCount: () => reconcileCount,
  };
}

test.describe("User Management permissions", () => {
  test("submits Add User with selected-project access without sending a real invite", async ({ page }) => {
    const api = await mockPermissionsApis(page);

    await page.goto("/permissions");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

    await page.getByRole("button", { name: "Add User" }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("First name").fill("Riley");
    await dialog.getByLabel("Last name").fill("Stone");
    await dialog.getByLabel("Email").fill("riley.stone@example.com");
    await dialog.getByLabel("Title").fill("Project Manager");

    await expect(dialog.getByText("Select visible")).toHaveCount(0);
    await dialog.getByText("Select projects...").click();
    await page.getByPlaceholder("Search options...").fill("Goodwill");
    await expect(page.getByText("Goodwill Tampa")).toBeVisible();
    await page.getByRole("option", { name: /Goodwill Tampa/ }).click();
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: "Send Invite" }).click();

    await expect(dialog).toBeHidden();
    expect(api.getInvitePayload()).toEqual({
      first_name: "Riley",
      last_name: "Stone",
      email: "riley.stone@example.com",
      job_title: "Project Manager",
      access_scope: "selected_projects",
      template_id: projectManagerTemplate.id,
      project_ids: [760],
    });
  });

  test("submits Add User with Senior Project Manager all-project access", async ({ page }) => {
    const api = await mockPermissionsApis(page);

    await page.goto("/permissions");
    await page.getByRole("button", { name: "Add User" }).click();
    const dialog = page.getByRole("dialog", { name: "Add user" });

    await dialog.getByLabel("First name").fill("Morgan");
    await dialog.getByLabel("Last name").fill("Parker");
    await dialog.getByLabel("Email").fill("morgan.parker@example.com");
    await dialog.getByText("All projects").click();
    await expect(dialog.getByRole("combobox", { name: "Role" })).toContainText("Senior Project Manager");
    await expect(dialog.getByText(/every current and future project/i)).toBeVisible();

    await dialog.getByRole("button", { name: "Send Invite" }).click();

    await expect(dialog).toBeHidden();
    expect(api.getInvitePayload()).toEqual({
      first_name: "Morgan",
      last_name: "Parker",
      email: "morgan.parker@example.com",
      access_scope: "all_projects",
      template_id: seniorProjectManagerTemplate.id,
      project_ids: [],
    });
  });

  test("updates project template permissions from the split matrix", async ({ page }) => {
    const api = await mockPermissionsApis(page);

    await page.goto("/permissions?tab=project-templates");
    await expect(page.getByRole("button", { name: "Project Templates" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Directory Write" })).toBeChecked();

    await page.getByRole("checkbox", { name: "Directory Admin" }).click();

    await expect
      .poll(() => api.getTemplateUpdatePayload())
      .toMatchObject({
        name: "Project Manager",
        scope: "project",
        rules_json: {
          directory: ["read", "write", "admin"],
        },
      });
  });

  test("repairs missing auth links before rendering users", async ({ page }) => {
    const api = await mockPermissionsApis(page, { startWithMissingAuthLink: true });

    await page.goto("/permissions");

    await expect.poll(() => api.getReconcileCount()).toBe(1);
    await expect(page.getByRole("row", { name: /Brandon Morgan/ })).toBeVisible();
    await expect(page.getByText("user auth link")).toHaveCount(0);
  });
});
