import { test, expect } from "@playwright/test";
import {
  addProjectMember,
  countChangeOrdersForProject,
  createChangeOrder,
  createProject,
  deleteChangeOrdersByProject,
  getChangeOrder,
  getUserIdByEmail,
  listChangeOrdersForProject,
} from "../../helpers/db";
import { cleanupProjectArtifacts } from "../../helpers/cleanup";
import { pollFor } from "../../helpers/poll";

const testUserEmail =
  process.env.PLAYWRIGHT_TEST_USER_EMAIL ?? "test@example.com";

let projectId: number;

const makeChangeOrderNumber = (suffix: string) =>
  `CO-${Date.now()}-${suffix}`;

const makeTitle = (suffix: string) => `Change Order ${suffix}`;

test.describe("Change Orders", () => {
  test.beforeAll(async () => {
    const userId = await getUserIdByEmail(testUserEmail);
    projectId = await createProject(`E2E Change Orders ${Date.now()}`);
    await addProjectMember(projectId, userId, "admin");
  });

  test.afterAll(async () => {
    if (projectId) {
      await cleanupProjectArtifacts(projectId);
    }
  });

  test("Change Orders list loads for authed user (smoke)", async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);

    await page.goto(`/${projectId}/change-orders`);

    await expect(
      page.getByText("No change orders found.", { exact: true }),
    ).toBeVisible();
  });

  test("Empty state + list correctness after create", async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);

    await page.goto(`/${projectId}/change-orders`);
    await expect(
      page.getByText("No change orders found.", { exact: true }),
    ).toBeVisible();

    const submittedAt = new Date("2024-01-15T00:00:00Z").toISOString();
    const changeOrder = await createChangeOrder({
      project_id: projectId,
      co_number: makeChangeOrderNumber("LIST"),
      title: makeTitle("List"),
      description: "List page seeded change order",
      status: "pending",
      submitted_at: submittedAt,
    });

    await page.reload();

    const row = page.getByRole("row", {
      name: new RegExp(
        `${changeOrder.co_number}.*${changeOrder.title}.*${changeOrder.description}.*pending`,
        "i",
      ),
    });

    await expect(row).toBeVisible();
    await expect(row.getByText("Jan 15, 2024")).toBeVisible();
  });

  test("Required field validation on create form", async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);
    const initialCount = await countChangeOrdersForProject(projectId);

    await page.goto(`/${projectId}/change-orders/new`);
    await page.getByTestId("change-order-submit").click();

    await expect(
      page.getByText("Change order number is required", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Title is required", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Description is required", { exact: true }),
    ).toBeVisible();

    await pollFor(
      () => countChangeOrdersForProject(projectId),
      (count) => expect(count).toBe(initialCount),
    );
  });

  test("Happy path create persists change order", async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);

    const number = makeChangeOrderNumber("CREATE");
    const title = makeTitle("Create");
    const description = "Updated scope for slab thickness";

    await page.goto(`/${projectId}/change-orders/new`);
    await page.getByTestId("change-order-number").fill(number);
    await page.getByTestId("change-order-title").fill(title);
    await page.getByTestId("change-order-description").fill(description);
    await page.getByTestId("change-order-status").click();
    await page.getByRole("option", { name: "Draft" }).click();

    await page.getByTestId("change-order-submit").click();

    const createdId = await page
      .getByTestId("created-change-order-id")
      .textContent();

    expect(createdId).toBeTruthy();

    const changeOrder = await getChangeOrder(Number(createdId));

    expect(changeOrder.project_id).toBe(projectId);
    expect(changeOrder.co_number).toBe(number);
    expect(changeOrder.title).toBe(title);
    expect(changeOrder.description).toBe(description);
    expect(changeOrder.status).toBe("draft");
    expect(changeOrder.created_at).toBeTruthy();
  });

  test("Status transitions update audit fields", async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);

    const changeOrder = await createChangeOrder({
      project_id: projectId,
      co_number: makeChangeOrderNumber("STATUS"),
      title: makeTitle("Status"),
      description: "Initial draft for status flow",
      status: "draft",
    });

    await page.goto(`/${projectId}/change-orders`);

    await page.getByTestId(`row-actions-${changeOrder.id}`).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Pending" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    await pollFor(
      () => getChangeOrder(changeOrder.id),
      (updated) => {
        expect(updated.status).toBe("pending");
        expect(updated.submitted_at).toBeTruthy();
      },
    );

    await page.getByTestId(`row-actions-${changeOrder.id}`).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Approved" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    await pollFor(
      () => getChangeOrder(changeOrder.id),
      (updated) => {
        expect(updated.status).toBe("approved");
        expect(updated.approved_at).toBeTruthy();
      },
    );
  });

  test("Submitted date column populates when status is pending", async ({
    page,
  }) => {
    await deleteChangeOrdersByProject(projectId);

    const changeOrder = await createChangeOrder({
      project_id: projectId,
      co_number: makeChangeOrderNumber("SUBMITTED"),
      title: makeTitle("Submitted"),
      description: "Submitted date check",
      status: "draft",
    });

    await page.goto(`/${projectId}/change-orders`);

    await page.getByTestId(`row-actions-${changeOrder.id}`).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Pending" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    const row = page.getByRole("row", {
      name: new RegExp(changeOrder.co_number, "i"),
    });
    await expect(row.getByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/))
      .toBeVisible();

    await pollFor(
      () => getChangeOrder(changeOrder.id),
      (updated) => {
        expect(updated.submitted_at).toBeTruthy();
      },
    );
  });

  test("Actions menu edit persists updates", async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);

    const changeOrder = await createChangeOrder({
      project_id: projectId,
      co_number: makeChangeOrderNumber("EDIT"),
      title: makeTitle("Edit"),
      description: "Initial description",
      status: "draft",
    });

    await page.goto(`/${projectId}/change-orders`);

    await page.getByTestId(`row-actions-${changeOrder.id}`).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Description").fill("Revised scope description");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(
      page.getByRole("row", {
        name: /Revised scope description/i,
      }),
    ).toBeVisible();

    await pollFor(
      () => getChangeOrder(changeOrder.id),
      (updated) => {
        expect(updated.description).toBe("Revised scope description");
      },
    );
  });

  test("Delete removes change order from list and database", async ({
    page,
  }) => {
    await deleteChangeOrdersByProject(projectId);

    const changeOrder = await createChangeOrder({
      project_id: projectId,
      co_number: makeChangeOrderNumber("DELETE"),
      title: makeTitle("Delete"),
      description: "To be removed",
      status: "draft",
    });

    await page.goto(`/${projectId}/change-orders`);

    await page.getByTestId(`row-actions-${changeOrder.id}`).click();
    await page.getByTestId(`row-action-delete-${changeOrder.id}`).click();
    await page.getByTestId("confirm-delete-button").click();

    await expect(
      page.getByRole("row", { name: new RegExp(changeOrder.co_number, "i") }),
    ).not.toBeVisible();

    await pollFor(
      () => listChangeOrdersForProject(projectId),
      (rows) => {
        expect(rows.find((row) => row.id === changeOrder.id)).toBeUndefined();
      },
    );
  });

});
