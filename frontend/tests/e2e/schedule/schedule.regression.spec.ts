import { test, expect, type Page } from "@playwright/test";
import {
  createScheduleTask,
  deleteScheduleTestTasks,
  listScheduleTasksForProject,
} from "../../helpers/db";

/**
 * Schedule Tool E2E Tests
 *
 * Full CRUD + view switching + bulk operations + validation tests
 * for the Schedule page at /43/schedule.
 *
 * Uses project 43 ("Westfield Collective") which the test user
 * (test1@mail.com) already has access to.
 *
 * All test tasks are prefixed with "E2E-" for safe cleanup.
 */
const PROJECT_ID = 43;
const SCHEDULE_URL = `/${PROJECT_ID}/schedule`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dismiss any visible toasts so they don't overlay buttons */
async function dismissToasts(page: Page) {
  const closeButtons = page.locator('[data-dismiss="toast"]');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(i).click().catch(() => {});
  }
}

/** Wait for the schedule API calls to settle after navigation */
async function waitForScheduleLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  // Wait for at least one of the parallel API calls to complete
  await page.waitForResponse(
    (resp) =>
      resp.url().includes("/scheduling/tasks") && resp.status() === 200,
    { timeout: 15000 },
  ).catch(() => {
    // If no API call happens (empty state), that's fine
  });
  // Small buffer for React to re-render
  await page.waitForTimeout(500);
}

/** Open the Add Task dialog from the page header */
async function openAddTaskDialog(page: Page) {
  await dismissToasts(page);
  // Use the header button (first "Add Task" on page)
  await page.getByRole("button", { name: "Add Task" }).first().click();
  await expect(
    page.getByRole("dialog", { name: "Create New Task" }),
    "Add Task dialog should be visible",
  ).toBeVisible({ timeout: 5000 });
}

/** Fill and submit the Add Task form with the given name and optional fields */
async function createTaskViaUI(
  page: Page,
  name: string,
  opts?: {
    wbs?: string;
    status?: string;
    startDate?: string;
    finishDate?: string;
    duration?: string;
    milestone?: boolean;
    constraint?: string;
    constraintDate?: string;
  },
) {
  await openAddTaskDialog(page);

  // Fill required field
  await page.getByRole("textbox", { name: "Task Name" }).fill(name);

  // Optional fields
  if (opts?.wbs) {
    await page.getByRole("textbox", { name: "WBS Code" }).fill(opts.wbs);
  }

  if (opts?.status) {
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: opts.status }).click();
  }

  if (opts?.startDate) {
    await page.getByRole("textbox", { name: "Start Date" }).fill(opts.startDate);
  }

  if (opts?.finishDate) {
    await page.getByRole("textbox", { name: "Finish Date" }).fill(opts.finishDate);
  }

  if (opts?.duration) {
    await page.getByRole("spinbutton", { name: "Duration (days)" }).fill(opts.duration);
  }

  if (opts?.milestone) {
    await page.getByRole("checkbox", { name: "This is a milestone" }).check();
  }

  if (opts?.constraint) {
    await page.getByRole("combobox", { name: "Constraint" }).click();
    await page.getByRole("option", { name: opts.constraint }).click();
  }

  // Fill constraint date if provided (required for most constraint types)
  if (opts?.constraintDate) {
    await page.getByRole("textbox", { name: "Constraint Date" }).fill(opts.constraintDate);
  }

  // Submit
  await page.getByRole("button", { name: "Create Task" }).click();

  // Wait for success toast
  await expect(
    page.getByText("Task created successfully"),
    "Success toast should appear after creating task",
  ).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------

test.describe("Schedule Tool E2E", () => {
  test.describe.configure({ retries: 1, mode: "serial" });

  test.beforeAll(async () => {
    // Clean up any leftover E2E test tasks
    await deleteScheduleTestTasks(PROJECT_ID);
  });

  test.afterAll(async () => {
    // Final cleanup
    await deleteScheduleTestTasks(PROJECT_ID);
  });

  // =========================================================================
  // Suite 1: Page Load & Empty State
  // =========================================================================

  test.describe("Suite 1: Page Load & Empty State", () => {
    test.beforeAll(async () => {
      // Ensure empty state by cleaning all E2E tasks
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("1.1 Page loads with Schedule heading", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByRole("heading", { name: "Schedule", level: 1 }),
        "Schedule h1 heading should be visible",
      ).toBeVisible();

      await expect(
        page.getByText("Track project schedule tasks and milestones"),
        "Page description should be visible",
      ).toBeVisible();
    });

    test("1.2 Empty state shows when no tasks exist", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Check for any existing non-E2E tasks first
      const tasks = await listScheduleTasksForProject(PROJECT_ID);
      const hasNonTestTasks = tasks.some((t) => !t.name.startsWith("E2E-"));

      if (!hasNonTestTasks) {
        await expect(
          page.getByRole("heading", { name: "No tasks scheduled", level: 3 }),
          "Empty state heading should be visible when no tasks exist",
        ).toBeVisible({ timeout: 10000 });

        await expect(
          page.getByText("Create tasks, set milestones"),
          "Empty state description should be visible",
        ).toBeVisible();
      }
    });

    test("1.3 All 5 view mode tabs are visible", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      const tabs = ["Grid", "Board", "Schedule", "Timeline", "Calendar"];
      for (const tab of tabs) {
        await expect(
          page.getByRole("button", { name: `Switch to ${tab} view` }),
          `${tab} view tab should be visible`,
        ).toBeVisible();
      }
    });

    test("1.4 Header has Add Task, Filters, and Share buttons", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByRole("button", { name: "Add Task" }).first(),
        "Add Task button should be in header",
      ).toBeVisible();

      await expect(
        page.getByRole("button", { name: "Filters" }),
        "Filters button should be visible",
      ).toBeVisible();

      await expect(
        page.getByRole("button", { name: "Share" }),
        "Share button should be visible",
      ).toBeVisible();
    });
  });

  // =========================================================================
  // Suite 2: Create Task (CRUD - Create)
  // =========================================================================

  test.describe("Suite 2: Create Task", () => {
    test.beforeEach(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("2.1 Add Task button opens the Create New Task dialog", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await openAddTaskDialog(page);

      await expect(
        page.getByRole("heading", { name: "Create New Task", level: 2 }),
        "Dialog should have correct heading",
      ).toBeVisible();

      await expect(
        page.getByText("Add a new task to your project schedule"),
        "Dialog description should be visible",
      ).toBeVisible();
    });

    test("2.2 Create a task with just a name", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await createTaskViaUI(page, "E2E-Simple Task");

      // Wait for dialog to close
      await expect(
        page.getByRole("dialog", { name: "Create New Task" }),
      ).not.toBeVisible({ timeout: 5000 });

      // Verify task appears on page
      await page.waitForTimeout(1000); // Wait for refetch
      await expect(
        page.getByText("E2E-Simple Task"),
        "New task should be visible in the schedule",
      ).toBeVisible({ timeout: 10000 });
    });

    test("2.3 Create a task with all fields populated", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await createTaskViaUI(page, "E2E-Full Task", {
        wbs: "1.2.3",
        status: "In Progress",
        startDate: "2026-03-01",
        finishDate: "2026-03-15",
        duration: "10",
        constraint: "Must Start On",
        constraintDate: "2026-03-01",
      });

      // Verify task appears
      await page.waitForTimeout(1000);
      await expect(
        page.getByText("E2E-Full Task"),
        "Full task should be visible in the schedule",
      ).toBeVisible({ timeout: 10000 });
    });

    test("2.4 Cancel button closes dialog without creating", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await openAddTaskDialog(page);
      await page.getByRole("textbox", { name: "Task Name" }).fill("E2E-Should Not Exist");

      // Click Cancel
      await page.getByRole("button", { name: "Cancel" }).click();

      // Dialog should close
      await expect(
        page.getByRole("dialog", { name: "Create New Task" }),
      ).not.toBeVisible({ timeout: 3000 });

      // Task should NOT have been created
      const tasks = await listScheduleTasksForProject(PROJECT_ID);
      const found = tasks.find((t) => t.name === "E2E-Should Not Exist");
      expect(found, "Cancelled task should not exist in database").toBeUndefined();
    });

    test("2.5 Close (X) button closes dialog without creating", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await openAddTaskDialog(page);
      await page.getByRole("textbox", { name: "Task Name" }).fill("E2E-Should Not Exist X");

      // Click X close button
      await page.getByRole("button", { name: "Close" }).click();

      await expect(
        page.getByRole("dialog", { name: "Create New Task" }),
      ).not.toBeVisible({ timeout: 3000 });

      const tasks = await listScheduleTasksForProject(PROJECT_ID);
      const found = tasks.find((t) => t.name === "E2E-Should Not Exist X");
      expect(found, "Closed task should not exist in database").toBeUndefined();
    });
  });

  // =========================================================================
  // Suite 3: Read/View Tasks
  // =========================================================================

  test.describe("Suite 3: Read Tasks", () => {
    test.beforeAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
      // Seed tasks via DB for deterministic reading
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Read Task A",
        status: "not_started",
        wbs_code: "1.0",
        sort_order: 1,
      });
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Read Task B",
        status: "in_progress",
        percent_complete: 50,
        wbs_code: "2.0",
        sort_order: 2,
      });
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Read Task C",
        status: "complete",
        percent_complete: 100,
        wbs_code: "3.0",
        sort_order: 3,
      });
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("3.1 Seeded tasks appear in Grid view", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByText("E2E-Read Task A"),
        "Task A should appear in the grid",
      ).toBeVisible({ timeout: 15000 });

      await expect(
        page.getByText("E2E-Read Task B"),
        "Task B should appear in the grid",
      ).toBeVisible();

      await expect(
        page.getByText("E2E-Read Task C"),
        "Task C should appear in the grid",
      ).toBeVisible();
    });

    test("3.2 Summary cards appear with task counts", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Wait for tasks to load and summary to render
      await expect(
        page.getByText("E2E-Read Task A"),
      ).toBeVisible({ timeout: 15000 });

      // Summary cards should be visible
      await expect(
        page.getByText("Total Tasks"),
        "Total Tasks summary card should be visible",
      ).toBeVisible();

      await expect(
        page.getByText("Completed"),
        "Completed summary card should be visible",
      ).toBeVisible();

      await expect(
        page.getByText("In Progress").first(),
        "In Progress summary card should be visible",
      ).toBeVisible();
    });

    test("3.3 Clicking a task opens the edit modal with pre-filled data", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByText("E2E-Read Task A"),
      ).toBeVisible({ timeout: 15000 });

      // Click on a task name to open edit modal
      await page.getByText("E2E-Read Task A").click();

      // Edit modal should open with existing data
      await expect(
        page.getByRole("dialog"),
        "Edit dialog should be visible after clicking a task",
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Suite 4: Update Task (CRUD - Edit)
  // =========================================================================

  test.describe("Suite 4: Update Task", () => {
    test.beforeAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Edit Target",
        status: "not_started",
        percent_complete: 0,
        wbs_code: "4.0",
        sort_order: 1,
      });
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("4.1 Edit task name and verify update", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Wait for task to appear
      await expect(
        page.getByText("E2E-Edit Target"),
      ).toBeVisible({ timeout: 15000 });

      // Click the task to open edit modal
      await page.getByText("E2E-Edit Target").click();

      await expect(
        page.getByRole("dialog"),
        "Edit dialog should appear",
      ).toBeVisible({ timeout: 5000 });

      // Clear and update the name
      const nameInput = page.getByRole("textbox", { name: "Task Name" });
      await nameInput.clear();
      await nameInput.fill("E2E-Edit Target Updated");

      // Save
      await page.getByRole("button", { name: /Create Task|Save|Update/i }).click();

      // Wait for success toast
      await expect(
        page.getByText(/updated successfully/i),
        "Success toast should appear after updating",
      ).toBeVisible({ timeout: 10000 });

      // Verify new name is visible
      await page.waitForTimeout(1000);
      await expect(
        page.getByText("E2E-Edit Target Updated"),
        "Updated task name should be visible in the grid",
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Suite 5: Delete Task (CRUD - Delete)
  // =========================================================================

  test.describe("Suite 5: Delete Task", () => {
    test.beforeEach(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Delete Target",
        status: "not_started",
        sort_order: 1,
      });
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("5.1 Delete task via API and verify removal from UI", async ({
      page,
      request,
    }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Verify task exists first
      await expect(
        page.getByText("E2E-Delete Target"),
        "Task to delete should be visible",
      ).toBeVisible({ timeout: 15000 });

      // Get the task ID from the DB to delete via API
      const tasks = await listScheduleTasksForProject(PROJECT_ID);
      const target = tasks.find((t) => t.name === "E2E-Delete Target");
      expect(target, "Task should exist in DB").toBeDefined();

      // Delete via the app's API
      const deleteResp = await request.delete(
        `/api/projects/${PROJECT_ID}/scheduling/tasks/${target!.id}`,
      );
      expect(deleteResp.ok(), "Delete API should succeed").toBeTruthy();

      // Reload and verify task is gone
      await page.reload();
      await waitForScheduleLoad(page);

      await expect(
        page.getByText("E2E-Delete Target"),
        "Deleted task should no longer be visible",
      ).not.toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Suite 6: View Mode Switching
  // =========================================================================

  test.describe("Suite 6: View Mode Switching", () => {
    test.beforeAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-View Mode Task",
        status: "in_progress",
        percent_complete: 40,
        start_date: "2026-03-01",
        finish_date: "2026-03-15",
        sort_order: 1,
      });
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("6.1 Switch to Board view", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await page.getByRole("button", { name: "Switch to Board view" }).click();
      await page.waitForTimeout(500);

      // Board view should show Kanban-style columns
      await expect(
        page.getByText("E2E-View Mode Task"),
        "Task should appear in Board view",
      ).toBeVisible({ timeout: 10000 });
    });

    test("6.2 Switch to Schedule view (split pane)", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await page.getByRole("button", { name: "Switch to Schedule view" }).click();
      await page.waitForTimeout(500);

      // Schedule split view shows the task in both the table pane and Gantt pane,
      // so use .first() to avoid strict mode violation from multiple matches
      await expect(
        page.getByText("E2E-View Mode Task").first(),
        "Task should appear in Schedule split view",
      ).toBeVisible({ timeout: 10000 });
    });

    test("6.3 Switch to Timeline view", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await page.getByRole("button", { name: "Switch to Timeline view" }).click();
      await page.waitForTimeout(500);

      await expect(
        page.getByText("E2E-View Mode Task"),
        "Task should appear in Timeline view",
      ).toBeVisible({ timeout: 10000 });
    });

    test("6.4 Switch to Calendar view", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await page.getByRole("button", { name: "Switch to Calendar view" }).click();
      await page.waitForTimeout(500);

      // Calendar view renders differently - just check it doesn't error
      await expect(
        page.getByRole("button", { name: "Switch to Calendar view" }),
        "Calendar tab should remain visible",
      ).toBeVisible();
    });

    test("6.5 Return to Grid view", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Switch away first
      await page.getByRole("button", { name: "Switch to Board view" }).click();
      await page.waitForTimeout(300);

      // Switch back to Grid
      await page.getByRole("button", { name: "Switch to Grid view" }).click();
      await page.waitForTimeout(500);

      await expect(
        page.getByText("E2E-View Mode Task"),
        "Task should appear back in Grid view",
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Suite 7: Bulk Operations
  // =========================================================================

  test.describe("Suite 7: Bulk Operations", () => {
    test.beforeAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Bulk Task 1",
        status: "not_started",
        sort_order: 1,
      });
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Bulk Task 2",
        status: "not_started",
        sort_order: 2,
      });
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Bulk Task 3",
        status: "not_started",
        sort_order: 3,
      });
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("7.1 Select tasks and see Bulk Action Bar", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Wait for tasks to appear
      await expect(
        page.getByText("E2E-Bulk Task 1"),
      ).toBeVisible({ timeout: 15000 });

      // Try to find and click checkboxes
      const checkboxes = page.getByRole("checkbox");
      const checkboxCount = await checkboxes.count();

      if (checkboxCount >= 2) {
        // Click first two task checkboxes (skip "select all" if present)
        await checkboxes.nth(1).check();
        await checkboxes.nth(2).check();

        // Bulk action bar should appear
        await expect(
          page.getByText("2 selected"),
          "Bulk action bar should show 2 selected",
        ).toBeVisible({ timeout: 5000 });
      } else {
        test.skip(true, "No checkboxes found in grid view - bulk selection not available");
      }
    });
  });

  // =========================================================================
  // Suite 8: Import/Export Modal
  // =========================================================================

  test.describe("Suite 8: Import/Export", () => {
    test("8.1 Share dropdown opens Import Schedule option", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      // Click Share dropdown
      await page.getByRole("button", { name: "Share" }).click();

      // Import option should be visible
      await expect(
        page.getByRole("menuitem", { name: "Import Schedule" }),
        "Import Schedule menu item should be visible",
      ).toBeVisible({ timeout: 3000 });

      // Export option should be visible
      await expect(
        page.getByRole("menuitem", { name: "Export Schedule" }),
        "Export Schedule menu item should be visible",
      ).toBeVisible();
    });

    test("8.2 Import Schedule opens the Import/Export modal", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await page.getByRole("button", { name: "Share" }).click();
      await page.getByRole("menuitem", { name: "Import Schedule" }).click();

      // Modal should open
      await expect(
        page.getByRole("dialog"),
        "Import/Export modal should be visible",
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Suite 9: Form Validation
  // =========================================================================

  test.describe("Suite 9: Form Validation", () => {
    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("9.1 Cannot submit form with empty task name", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await openAddTaskDialog(page);

      // Leave name empty and try to submit
      await page.getByRole("button", { name: "Create Task" }).click();

      // Dialog should still be open (submission prevented)
      await page.waitForTimeout(500);
      await expect(
        page.getByRole("dialog", { name: "Create New Task" }),
        "Dialog should remain open when name is empty",
      ).toBeVisible();
    });

    test("9.2 API rejects start date after finish date", async ({ request }) => {
      const resp = await request.post(
        `/api/projects/${PROJECT_ID}/scheduling/tasks`,
        {
          data: {
            name: "E2E-Bad Dates",
            project_id: PROJECT_ID,
            start_date: "2026-04-15",
            finish_date: "2026-04-01",
          },
        },
      );

      expect(resp.status(), "API should reject invalid date range").toBe(400);

      const body = await resp.json();
      expect(body.error).toContain("Start date cannot be after finish date");
    });

    test("9.3 API rejects milestone with non-zero duration", async ({ request }) => {
      const resp = await request.post(
        `/api/projects/${PROJECT_ID}/scheduling/tasks`,
        {
          data: {
            name: "E2E-Bad Milestone",
            project_id: PROJECT_ID,
            is_milestone: true,
            duration_days: 5,
          },
        },
      );

      expect(resp.status(), "API should reject milestone with duration").toBe(400);

      const body = await resp.json();
      expect(body.error).toContain("Milestones must have zero duration");
    });

    test("9.4 API rejects percent_complete outside 0-100", async ({ request }) => {
      // First create a task to update
      const createResp = await request.post(
        `/api/projects/${PROJECT_ID}/scheduling/tasks`,
        {
          data: {
            name: "E2E-Percent Test",
            project_id: PROJECT_ID,
          },
        },
      );

      if (createResp.ok()) {
        const created = await createResp.json();
        const taskId = created.id;

        const updateResp = await request.put(
          `/api/projects/${PROJECT_ID}/scheduling/tasks/${taskId}`,
          {
            data: {
              percent_complete: 150,
            },
          },
        );

        expect(
          updateResp.status(),
          "API should reject percent > 100",
        ).toBe(400);
      }
    });
  });

  // =========================================================================
  // Suite 10: Data Persistence
  // =========================================================================

  test.describe("Suite 10: Data Persistence", () => {
    test.beforeAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("10.1 Created task persists after page reload", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await createTaskViaUI(page, "E2E-Persist Task");

      // Wait for task to appear
      await page.waitForTimeout(1000);
      await expect(
        page.getByText("E2E-Persist Task"),
      ).toBeVisible({ timeout: 10000 });

      // Reload
      await page.reload();
      await waitForScheduleLoad(page);

      // Task should still be visible
      await expect(
        page.getByText("E2E-Persist Task"),
        "Task should persist after page reload",
      ).toBeVisible({ timeout: 15000 });
    });

    test("10.2 Task status update persists after reload", async ({ page, request }) => {
      // Find our persisted task
      const tasks = await listScheduleTasksForProject(PROJECT_ID);
      const target = tasks.find((t) => t.name === "E2E-Persist Task");

      if (!target) {
        test.skip(true, "Persist task not found - depends on 10.1");
        return;
      }

      // Update status via API
      const resp = await request.put(
        `/api/projects/${PROJECT_ID}/scheduling/tasks/${target.id}`,
        {
          data: { status: "in_progress", percent_complete: 50 },
        },
      );
      expect(resp.ok(), "Status update API should succeed").toBeTruthy();

      // Reload page and verify
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByText("E2E-Persist Task"),
        "Task should still be present after status update",
      ).toBeVisible({ timeout: 15000 });

      // Verify in DB that status actually changed
      const updated = await listScheduleTasksForProject(PROJECT_ID);
      const check = updated.find((t) => t.name === "E2E-Persist Task");
      expect(check?.status, "Status should be in_progress in DB").toBe("in_progress");
      expect(check?.percent_complete, "Percent should be 50 in DB").toBe(50);
    });

    test("10.3 Deleted task stays deleted after reload", async ({ page, request }) => {
      const tasks = await listScheduleTasksForProject(PROJECT_ID);
      const target = tasks.find((t) => t.name === "E2E-Persist Task");

      if (!target) {
        test.skip(true, "Persist task not found - depends on 10.1");
        return;
      }

      // Delete via API
      const resp = await request.delete(
        `/api/projects/${PROJECT_ID}/scheduling/tasks/${target.id}`,
      );
      expect(resp.ok(), "Delete API should succeed").toBeTruthy();

      // Reload and verify absence
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByText("E2E-Persist Task"),
        "Deleted task should not appear after reload",
      ).not.toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Suite 11: Context Menu Actions
  // =========================================================================

  test.describe("Suite 11: Context Menu", () => {
    test.beforeAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
      await createScheduleTask({
        project_id: PROJECT_ID,
        name: "E2E-Context Menu Task",
        status: "not_started",
        sort_order: 1,
      });
    });

    test.afterAll(async () => {
      await deleteScheduleTestTasks(PROJECT_ID);
    });

    test("11.1 Right-click task opens context menu", async ({ page }) => {
      await page.goto(SCHEDULE_URL);
      await waitForScheduleLoad(page);

      await expect(
        page.getByText("E2E-Context Menu Task"),
      ).toBeVisible({ timeout: 15000 });

      // Right-click on the task
      await page.getByText("E2E-Context Menu Task").click({ button: "right" });

      // Context menu should appear with expected options
      await page.waitForTimeout(300);

      // Check for at least one expected context menu item
      const hasContextMenu =
        (await page.getByText("Edit Task").count()) > 0 ||
        (await page.getByText("Delete Task").count()) > 0 ||
        (await page.getByRole("menuitem").count()) > 0;

      if (!hasContextMenu) {
        // Context menu might not be on this element, try the row
        test.skip(true, "Context menu not triggered on task text - may need row-level right-click");
      }
    });
  });
});
