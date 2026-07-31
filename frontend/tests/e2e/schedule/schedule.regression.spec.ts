import { expect, test, type Page } from "@playwright/test";

import {
  addProjectMember,
  assertDisposableScheduleProject,
  createDisposableScheduleProject,
  createScheduleTask,
  deleteDisposableScheduleProject,
  deleteDisposableScheduleTasksByProject,
  type DisposableScheduleProjectFixture,
  getUserIdByEmail,
  listScheduleTasksForProject,
} from "../../helpers/db";

let projectId = 0;
let scheduleUrl = "";
let projectFixture: DisposableScheduleProjectFixture | null = null;

async function openSchedule(page: Page) {
  const scheduleLoad = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/projects/${projectId}/scheduling/tasks`) &&
      response.request().method() === "GET" &&
      response.ok(),
    { timeout: 30_000 },
  );
  await page.goto(scheduleUrl, { waitUntil: "domcontentloaded" });
  await scheduleLoad;
  await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible();
}

async function reloadSchedule(page: Page) {
  const scheduleLoad = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/projects/${projectId}/scheduling/tasks`) &&
      response.request().method() === "GET" &&
      response.ok(),
    { timeout: 30_000 },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await scheduleLoad;
}

async function switchToGantt(page: Page) {
  await page.getByTestId("schedule-workspace-tab").click();
  await page.getByRole("button", { name: "Switch to Gantt view" }).click();
}

async function openTask(page: Page, name: string) {
  await switchToGantt(page);
  const taskButton = page.locator("button").filter({ hasText: name }).first();
  await expect(taskButton).toBeVisible();
  await taskButton.click();
  await expect(page.getByRole("dialog", { name: "Edit Task" })).toBeVisible();
}

test.describe("Schedule current workspace regression", () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  test.use({ storageState: "tests/.auth/user.json" });

  test.beforeAll(async () => {
    projectFixture = await createDisposableScheduleProject("regression");
    projectId = projectFixture.id;
    await assertDisposableScheduleProject(projectFixture);
    const userId = await getUserIdByEmail(process.env.TEST_USER_1 ?? "test1@mail.com");
    await addProjectMember(projectId, userId);
    scheduleUrl = `/${projectId}/schedule`;
  });

  test.beforeEach(async () => {
    if (!projectFixture) throw new Error("Disposable scheduling project was not created.");
    await deleteDisposableScheduleTasksByProject(projectFixture);
  });

  test.afterAll(async () => {
    const fixture = projectFixture;
    if (!fixture) return;
    const cleanupErrors: unknown[] = [];
    for (const cleanup of [
      () => deleteDisposableScheduleTasksByProject(fixture),
      () => deleteDisposableScheduleProject(fixture),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        `Failed to fully clean disposable scheduling regression project ${projectId}.`,
      );
    }
  });

  test("loads the current scheduling workspace and its five views", async ({ page }) => {
    await openSchedule(page);

    await expect(page.getByTestId("schedule-workspace-tab")).toBeVisible();
    await expect(page.getByRole("button", {
      name: "Resources, costs, leveling, revisions & reports",
    })).toBeVisible();

    for (const view of ["Gantt", "Table", "Board", "Timeline", "Calendar"]) {
      await expect(page.getByRole("button", { name: `Switch to ${view} view` })).toBeVisible();
    }

    await expect(page.getByRole("button", { name: "Add Task" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Import Schedule" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Calendar", exact: true }).first()).toBeVisible();
  });

  test("creates a duration-only task and preserves its unscheduled state", async ({ page }) => {
    await openSchedule(page);
    await page.getByRole("button", { name: "Add Task" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create New Task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task Name").fill("E2E duration-only task");
    await dialog.getByLabel("Duration (days)").fill("3");
    await dialog.getByRole("button", { name: "Create Task" }).click();
    await expect(page.getByText("Task created successfully")).toBeVisible();

    const tasks = await listScheduleTasksForProject(projectId);
    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "E2E duration-only task",
        duration_days: 3,
        start_date: null,
        finish_date: null,
      }),
    ]));
  });

  test("rejects an empty task name without creating a row", async ({ page }) => {
    await openSchedule(page);
    await page.getByRole("button", { name: "Add Task" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create New Task" });
    await dialog.getByRole("button", { name: "Create Task" }).click();

    await expect(dialog.getByText("Task name is required")).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await listScheduleTasksForProject(projectId)).length)
      .toBe(0);
  });

  test("keeps a UI-created task visible after reload", async ({ page }) => {
    await openSchedule(page);
    await page.getByRole("button", { name: "Add Task" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create New Task" });
    await dialog.getByLabel("Task Name").fill("E2E reload-persistence task");
    await dialog.getByLabel("Duration (days)").fill("2");
    await dialog.getByRole("button", { name: "Create Task" }).click();
    await expect(page.getByText("Task created successfully")).toBeVisible();

    await reloadSchedule(page);
    await expect(page.getByText("E2E reload-persistence task").first()).toBeVisible();
    const tasks = await listScheduleTasksForProject(projectId);
    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "E2E reload-persistence task" }),
    ]));
  });

  test("keeps a deleted task absent after reload", async ({ page }) => {
    const taskToDelete = await createScheduleTask({
      project_id: projectId,
      name: "E2E delete-persistence task",
      start_date: "2026-08-03",
      finish_date: "2026-08-03",
      duration_days: 1,
      sort_order: 1,
    });

    await openSchedule(page);
    await expect(page.getByText("E2E delete-persistence task").first()).toBeVisible();
    const response = await page.request.delete(
      `/api/projects/${projectId}/scheduling/tasks/${taskToDelete.id}`,
    );
    expect(response.ok(), await response.text()).toBeTruthy();

    await reloadSchedule(page);
    await expect(page.getByText("E2E delete-persistence task")).toHaveCount(0);
    const tasks = await listScheduleTasksForProject(projectId);
    expect(tasks.map((task) => task.id)).not.toContain(taskToDelete.id);
  });

  test("opens the canonical task modal and persists an edit", async ({ page }) => {
    await createScheduleTask({
      project_id: projectId,
      name: "E2E edit target",
      start_date: "2026-08-03",
      finish_date: "2026-08-05",
      duration_days: 3,
      sort_order: 1,
    });

    await openSchedule(page);
    await openTask(page, "E2E edit target");
    const dialog = page.getByRole("dialog", { name: "Edit Task" });
    await dialog.getByLabel("Task Name").fill("E2E edited task");
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Task updated successfully")).toBeVisible();

    const tasks = await listScheduleTasksForProject(projectId);
    expect(tasks.map((task) => task.name)).toContain("E2E edited task");
  });

  test("renders one authoritative task in every schedule view", async ({ page }) => {
    await createScheduleTask({
      project_id: projectId,
      name: "E2E five-view task",
      start_date: "2026-07-29",
      finish_date: "2026-07-31",
      duration_days: 3,
      sort_order: 1,
    });

    await openSchedule(page);
    await page.getByRole("button", { name: "Switch to Gantt view" }).click();
    await expect(page.getByText("E2E five-view task").first()).toBeVisible();

    await page.getByRole("button", { name: "Switch to Table view" }).click();
    await expect(page.getByText("E2E five-view task").first()).toBeVisible();

    await page.getByRole("button", { name: "Switch to Board view" }).click();
    await expect(page.getByText("E2E five-view task").first()).toBeVisible();

    await page.getByRole("button", { name: "Switch to Timeline view" }).click();
    await expect(page.getByTitle("E2E five-view task")).toBeVisible();

    await page.getByRole("button", { name: "Switch to Calendar view" }).click();
    await expect(page.getByText("E2E five-view task").first()).toBeVisible();
  });

  test("opens schedule import from the normal header action", async ({ page }) => {
    await openSchedule(page);
    await page.getByRole("link", { name: "Import Schedule" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${projectId}/schedule/import$`));
    await expect(page.getByRole("heading", { name: "Schedule Import" })).toBeVisible();
  });

});
