import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { addDays, format, startOfWeek } from "date-fns";

import {
  addProjectMember,
  assertDisposableScheduleProject,
  createDisposableScheduleProject,
  deleteDisposableScheduleProject,
  getAdminClient,
  getUserIdByEmail,
  type DisposableScheduleProjectFixture,
} from "../../helpers/db";

type TaskRecord = {
  id: string;
  name: string;
  parent_task_id: string | null;
  start_date: string | null;
  finish_date: string | null;
  duration_days: number | null;
  percent_complete: number;
  status: string;
  is_milestone: boolean;
  constraint_type: string | null;
  constraint_date: string | null;
  wbs_code: string | null;
  sort_order: number;
  assignee_person_id: string | null;
  schedule_version: number;
  schedule_mode?: string;
};

type DependencyRecord = {
  id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: string;
  lag_days: number;
};

let fixture: DisposableScheduleProjectFixture | null = null;
let projectId = 0;
let tasksUrl = "";
let scheduleUrl = "";
let actorUserId = "";
let actorPersonId = "";
let syntheticPersonId = "";
let syntheticPersonName = "";
let publishedRevisionId = "";
let activeBaselineId = "";

const createdTaskIds = new Set<string>();

async function responseError(response: APIResponse) {
  return `${response.status()} ${await response.text()}`;
}

async function createTask(
  request: APIRequestContext,
  input: Partial<TaskRecord> & { name: string },
) {
  const response = await request.post(tasksUrl, {
    data: {
      name: input.name,
      parent_task_id: input.parent_task_id ?? null,
      start_date: input.start_date ?? null,
      finish_date: input.finish_date ?? null,
      duration_days: input.duration_days ?? null,
      percent_complete: input.percent_complete ?? 0,
      status: input.status ?? "not_started",
      is_milestone: input.is_milestone ?? false,
      constraint_type: input.constraint_type ?? null,
      constraint_date: input.constraint_date ?? null,
      wbs_code: input.wbs_code ?? null,
      sort_order: input.sort_order,
      assignee_person_id: input.assignee_person_id ?? null,
      schedule_mode: input.schedule_mode,
    },
  });
  expect(response.status(), await responseError(response)).toBe(201);
  const task = (await response.json()) as TaskRecord;
  createdTaskIds.add(task.id);
  return task;
}

async function readTask(request: APIRequestContext, taskId: string) {
  const response = await request.get(`${tasksUrl}/${taskId}`);
  expect(response.ok(), await responseError(response)).toBeTruthy();
  return ((await response.json()) as { data: TaskRecord }).data;
}

async function createDependency(
  request: APIRequestContext,
  successorId: string,
  predecessorId: string,
  dependencyType: string,
  lagDays = 0,
) {
  const response = await request.post(
    `${tasksUrl}/${successorId}/dependencies`,
    {
      data: {
        predecessor_task_id: predecessorId,
        dependency_type: dependencyType,
        lag_days: lagDays,
      },
    },
  );
  expect(response.status(), await responseError(response)).toBe(201);
  return ((await response.json()) as { data: DependencyRecord }).data;
}

async function openSchedule(page: Page) {
  const load = page.waitForResponse(
    (response) =>
      response.url().includes(tasksUrl) &&
      response.request().method() === "GET" &&
      response.ok(),
    { timeout: 60_000 },
  );
  await page.goto(scheduleUrl, { waitUntil: "domcontentloaded" });
  await load;
  await expect(
    page.getByRole("heading", { name: "Schedule", level: 1 }),
  ).toBeVisible();
}

async function publishCurrentSchedule(request: APIRequestContext) {
  const revisionResponse = await request.post(
    `/api/projects/${projectId}/scheduling/revisions`,
    { data: {} },
  );
  expect(
    revisionResponse.status(),
    await responseError(revisionResponse),
  ).toBe(201);
  const body = (await revisionResponse.json()) as {
    data: { id: string } | Array<{ id: string }>;
  };
  const revision = Array.isArray(body.data) ? body.data[0] : body.data;

  for (const status of ["review", "published"]) {
    const transition = await request.post(
      `/api/projects/${projectId}/scheduling/actions`,
      {
        data: {
          entity_type: "revision",
          action: "transition",
          entity_id: revision.id,
          payload: { status },
        },
      },
    );
    expect(transition.ok(), await responseError(transition)).toBeTruthy();
  }
  publishedRevisionId = revision.id;
  return revision.id;
}

test.describe("Scheduling production acceptance matrix", () => {
  test.use({ storageState: "tests/.auth/user.json" });
  test.describe.configure({ retries: 0 });

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    fixture = await createDisposableScheduleProject("production-matrix");
    projectId = fixture.id;
    await assertDisposableScheduleProject(fixture);
    tasksUrl = `/api/projects/${projectId}/scheduling/tasks`;
    scheduleUrl = `/${projectId}/schedule`;

    actorUserId = await getUserIdByEmail(
      process.env.TEST_USER_1 ?? "test1@mail.com",
    );
    await addProjectMember(projectId, actorUserId, "admin");

    const admin = getAdminClient();
    const { data: actorLink, error: actorError } = await admin
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", actorUserId)
      .single();
    if (actorError || !actorLink?.person_id) {
      throw new Error(
        `Unable to resolve the production audit actor: ${actorError?.message ?? "not found"}`,
      );
    }
    actorPersonId = actorLink.person_id;

    const suffix = randomUUID().slice(0, 8);
    syntheticPersonId = randomUUID();
    syntheticPersonName = `E2E Matrix Resource ${suffix}`;
    const { error: personError } = await admin.from("people").insert({
      id: syntheticPersonId,
      first_name: "E2E Matrix",
      last_name: `Resource ${suffix}`,
      email: `e2e-schedule-matrix-${suffix}@example.invalid`,
      person_type: "user",
      status: "active",
    });
    if (personError) throw new Error(personError.message);
    const { error: membershipError } = await admin
      .from("project_directory_memberships")
      .insert({
        project_id: projectId,
        person_id: syntheticPersonId,
        role: "E2E resource",
        status: "active",
        user_type: "employee",
      });
    if (membershipError) throw new Error(membershipError.message);

    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const today = format(now, "yyyy-MM-dd");
    const thisWeek = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
    const futureStart = format(addDays(currentWeekStart, 14), "yyyy-MM-dd");
    const futureFinish = format(addDays(currentWeekStart, 15), "yyyy-MM-dd");

    await createTask(request, {
      name: "Matrix Today Task",
      start_date: today,
      finish_date: today,
      duration_days: 1,
      status: "in_progress",
      sort_order: 1,
    });
    await createTask(request, {
      name: "Matrix This Week Milestone",
      start_date: thisWeek,
      finish_date: thisWeek,
      duration_days: 0,
      is_milestone: true,
      sort_order: 2,
    });
    await createTask(request, {
      name: "Matrix Future Complete Task",
      start_date: futureStart,
      finish_date: futureFinish,
      duration_days: 2,
      status: "complete",
      percent_complete: 100,
      sort_order: 3,
    });
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    const cleanupErrors: string[] = [];
    const admin = getAdminClient();

    if (fixture) {
      try {
        await deleteDisposableScheduleProject(fixture);
      } catch (error) {
        cleanupErrors.push(
          `project: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (syntheticPersonId) {
      const { error } = await admin
        .from("people")
        .delete()
        .eq("id", syntheticPersonId);
      if (error) cleanupErrors.push(`person: ${error.message}`);
    }
    if (cleanupErrors.length > 0) {
      throw new Error(`Production matrix cleanup failed: ${cleanupErrors.join("; ")}`);
    }
  });

  test("A07 search, status, type, Today, and This Week filters", async ({
    page,
  }, testInfo) => {
    await openSchedule(page);
    let search = page.getByPlaceholder("Search tasks...");
    if (await search.count() === 0) {
      await page.getByRole("button", { name: "Search table" }).click();
      search = page.getByLabel("Search table");
    }
    await search.fill("Future Complete");
    await expect(page.getByText("Matrix Future Complete Task").first()).toBeVisible();
    await expect(page.getByText("Matrix Today Task")).toHaveCount(0);
    await search.clear();

    await page.getByRole("button", { name: "Filters and view settings" }).click();
    let settings = page
      .getByText("View settings", { exact: true })
      .locator("xpath=../..");
    await settings.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Complete", exact: true }).click();
    await expect(page.getByText("Matrix Future Complete Task").first()).toBeVisible();
    await expect(page.getByText("Matrix Today Task")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    if (
      !(await page
        .getByText("View settings", { exact: true })
        .isVisible()
        .catch(() => false))
    ) {
      await page
        .getByRole("button", { name: "Filters and view settings" })
        .click();
    }
    settings = page
      .getByText("View settings", { exact: true })
      .locator("xpath=../..");
    await settings.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Milestones" }).click();
    await expect(page.getByText("Matrix This Week Milestone").first()).toBeVisible();
    await expect(page.getByText("Matrix Future Complete Task")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("Matrix Today Task").first()).toBeVisible();
    await expect(page.getByText("Matrix Future Complete Task")).toHaveCount(0);
    await page.getByRole("button", { name: "This Week", exact: true }).click();
    await expect(page.getByText("Matrix This Week Milestone").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("A07-filter-matrix.png"),
      fullPage: true,
    });
  });

  test("A08 quick-add with Enter inserts a durable root task", async ({
    page,
  }) => {
    await openSchedule(page);
    const quickAdd = page.getByPlaceholder("Add task and press Enter").first();
    await quickAdd.fill("Matrix Quick Add");
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith(tasksUrl) &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await quickAdd.press("Enter");
    await created;
    await expect(page.getByText("Matrix Quick Add").first()).toBeVisible();

    const { data, error } = await getAdminClient()
      .from("schedule_tasks")
      .select("id,name,parent_task_id,sort_order")
      .eq("project_id", projectId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    const inserted = data.find((task) => task.name === "Matrix Quick Add");
    expect(inserted).toMatchObject({ parent_task_id: null });
    createdTaskIds.add(inserted!.id);
    const order = data.map((task) => task.sort_order);
    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  test("A09 full task persists dates, duration, WBS, status, and assignee", async ({
    page,
  }, testInfo) => {
    await openSchedule(page);
    await page.getByRole("button", { name: "Add Task" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create New Task" });
    await dialog.getByLabel("Task Name").fill("Matrix Full Task");
    await dialog.getByLabel("WBS Code").fill("9.1.2");
    await dialog.getByLabel("Start Date").fill("2026-08-17");
    await dialog.getByLabel("Finish Date").fill("2026-08-19");
    await dialog.getByLabel("Duration (days)").fill("3");
    await dialog.getByLabel("Status").click();
    await page.getByRole("option", { name: "In Progress" }).click();
    await dialog.getByLabel("Assigned to").click();
    await page.getByRole("option", { name: syntheticPersonName }).click();
    await dialog.getByRole("button", { name: "Create Task" }).click();
    await expect(page.getByText("Task created successfully")).toBeVisible();

    const { data, error } = await getAdminClient()
      .from("schedule_tasks")
      .select(
        "id,name,start_date,finish_date,duration_days,wbs_code,status,assignee_person_id",
      )
      .eq("project_id", projectId)
      .eq("name", "Matrix Full Task")
      .single();
    if (error) throw new Error(error.message);
    createdTaskIds.add(data.id);
    expect(data).toMatchObject({
      start_date: "2026-08-17",
      finish_date: "2026-08-19",
      duration_days: 3,
      wbs_code: "9.1.2",
      status: "in_progress",
      assignee_person_id: syntheticPersonId,
    });
    await page.screenshot({
      path: testInfo.outputPath("A09-full-task.png"),
      fullPage: true,
    });
  });

  test("A14 milestone conversion cascades its successor", async ({ request }) => {
    const predecessor = await createTask(request, {
      name: "Matrix Milestone Source",
      start_date: "2026-08-03",
      finish_date: "2026-08-05",
      duration_days: 3,
      sort_order: 20,
    });
    const successor = await createTask(request, {
      name: "Matrix Milestone Successor",
      start_date: "2026-08-06",
      finish_date: "2026-08-07",
      duration_days: 2,
      sort_order: 21,
    });
    await createDependency(request, successor.id, predecessor.id, "finish_to_start");

    const update = await request.put(`${tasksUrl}/${predecessor.id}`, {
      data: {
        is_milestone: true,
        duration_days: 0,
        finish_date: "2026-08-03",
      },
    });
    expect(update.ok(), await responseError(update)).toBeTruthy();
    expect(await readTask(request, predecessor.id)).toMatchObject({
      is_milestone: true,
      duration_days: 0,
      start_date: "2026-08-03",
      finish_date: "2026-08-03",
    });
    expect(await readTask(request, successor.id)).toMatchObject({
      start_date: "2026-08-04",
    });
  });

  test("A15 constraint conflicts reject atomically and preserve task data", async ({
    request,
  }) => {
    const predecessor = await createTask(request, {
      name: "Matrix Constraint Source",
      start_date: "2026-08-10",
      finish_date: "2026-08-12",
      duration_days: 3,
      sort_order: 30,
    });
    const constrained = await createTask(request, {
      name: "Matrix Constrained Task",
      start_date: "2026-08-06",
      finish_date: "2026-08-07",
      duration_days: 2,
      constraint_type: "must_start_on",
      constraint_date: "2026-08-06",
      sort_order: 31,
    });
    const before = await readTask(request, constrained.id);
    const response = await request.post(
      `${tasksUrl}/${constrained.id}/dependencies`,
      {
        data: {
          predecessor_task_id: predecessor.id,
          dependency_type: "finish_to_start",
          lag_days: 0,
        },
      },
    );
    expect
      .soft(
        [400, 409],
        `constraint conflict returned ${response.status()}: ${await response.text()}`,
      )
      .toContain(response.status());
    expect(await readTask(request, constrained.id)).toEqual(before);
    const { count, error } = await getAdminClient()
      .from("schedule_dependencies")
      .select("id", { count: "exact", head: true })
      .eq("task_id", constrained.id);
    if (error) throw new Error(error.message);
    expect(count).toBe(0);
  });

  test("A18 bulk update and bulk delete return exact counts", async ({
    request,
  }) => {
    const first = await createTask(request, {
      name: "Matrix Bulk One",
      start_date: "2026-08-20",
      finish_date: "2026-08-20",
      duration_days: 1,
      sort_order: 40,
    });
    const second = await createTask(request, {
      name: "Matrix Bulk Two",
      start_date: "2026-08-21",
      finish_date: "2026-08-21",
      duration_days: 1,
      sort_order: 41,
    });
    const update = await request.post(`${tasksUrl}/bulk`, {
      data: {
        task_ids: [first.id, second.id],
        updates: { status: "in_progress", percent_complete: 50 },
      },
    });
    expect(update.ok(), await responseError(update)).toBeTruthy();
    expect(await update.json()).toMatchObject({ updated: 2, failed: 0 });
    expect(await readTask(request, first.id)).toMatchObject({
      status: "in_progress",
      percent_complete: 50,
    });

    const remove = await request.delete(`${tasksUrl}/bulk`, {
      data: { task_ids: [first.id, second.id] },
    });
    expect(remove.ok(), await responseError(remove)).toBeTruthy();
    expect(await remove.json()).toMatchObject({ deleted: 2, failed: 0 });
    createdTaskIds.delete(first.id);
    createdTaskIds.delete(second.id);
  });

  test("A19 delete repairs ordering and removes orphaned facts", async ({
    request,
  }) => {
    const first = await createTask(request, {
      name: "Matrix Delete First",
      start_date: "2026-08-24",
      finish_date: "2026-08-24",
      duration_days: 1,
      sort_order: 50,
    });
    const middle = await createTask(request, {
      name: "Matrix Delete Middle",
      start_date: "2026-08-25",
      finish_date: "2026-08-25",
      duration_days: 1,
      sort_order: 51,
    });
    const last = await createTask(request, {
      name: "Matrix Delete Last",
      start_date: "2026-08-26",
      finish_date: "2026-08-26",
      duration_days: 1,
      sort_order: 52,
    });
    await createDependency(request, last.id, middle.id, "finish_to_start");
    const remove = await request.delete(`${tasksUrl}/${middle.id}`);
    expect(remove.ok(), await responseError(remove)).toBeTruthy();
    createdTaskIds.delete(middle.id);

    const admin = getAdminClient();
    const { count: predecessorOrphans, error: predecessorError } = await admin
      .from("schedule_dependencies")
      .select("id", { count: "exact", head: true })
      .eq("predecessor_task_id", middle.id);
    const { count: successorOrphans, error: successorError } = await admin
      .from("schedule_dependencies")
      .select("id", { count: "exact", head: true })
      .eq("task_id", middle.id);
    if (predecessorError) throw new Error(predecessorError.message);
    if (successorError) throw new Error(successorError.message);
    expect(predecessorOrphans).toBe(0);
    expect(successorOrphans).toBe(0);
    const { data: remaining, error: remainingError } = await admin
      .from("schedule_tasks")
      .select("id,sort_order")
      .eq("project_id", projectId)
      .in("id", [first.id, last.id])
      .order("sort_order");
    if (remainingError) throw new Error(remainingError.message);
    expect(remaining.map((task) => task.id)).toEqual([first.id, last.id]);
    expect(remaining[0].sort_order).toBeLessThan(remaining[1].sort_order);
  });

  for (const [id, relationship] of [
    ["B03", "finish_to_finish"],
    ["B04", "start_to_finish"],
  ] as const) {
    test(`${id} ${relationship} dependency persists and schedules`, async ({
      request,
    }) => {
      const predecessor = await createTask(request, {
        name: `Matrix ${id} Source`,
        start_date: "2026-09-01",
        finish_date: "2026-09-03",
        duration_days: 3,
        sort_order: id === "B03" ? 60 : 62,
      });
      const successor = await createTask(request, {
        name: `Matrix ${id} Successor`,
        start_date: "2026-08-20",
        finish_date: "2026-08-21",
        duration_days: 2,
        sort_order: id === "B03" ? 61 : 63,
      });
      const dependency = await createDependency(
        request,
        successor.id,
        predecessor.id,
        relationship,
      );
      expect(dependency).toMatchObject({
        predecessor_task_id: predecessor.id,
        dependency_type: relationship,
      });
      const { data: storedDependency, error: storedDependencyError } =
        await getAdminClient()
          .from("schedule_dependencies")
          .select("task_id")
          .eq("id", dependency.id)
          .single();
      if (storedDependencyError) throw new Error(storedDependencyError.message);
      expect(storedDependency.task_id).toBe(successor.id);
      const scheduled = await readTask(request, successor.id);
      expect(scheduled.finish_date).not.toBe("2026-08-21");
    });
  }

  test("B09 predecessor edit cascades through multiple successors", async ({
    request,
  }) => {
    const first = await createTask(request, {
      name: "Matrix Cascade A",
      start_date: "2026-09-07",
      finish_date: "2026-09-08",
      duration_days: 2,
      sort_order: 70,
    });
    const second = await createTask(request, {
      name: "Matrix Cascade B",
      start_date: "2026-09-09",
      finish_date: "2026-09-10",
      duration_days: 2,
      sort_order: 71,
    });
    const third = await createTask(request, {
      name: "Matrix Cascade C",
      start_date: "2026-09-11",
      finish_date: "2026-09-14",
      duration_days: 2,
      sort_order: 72,
    });
    await createDependency(request, second.id, first.id, "finish_to_start");
    await createDependency(request, third.id, second.id, "finish_to_start");
    const thirdBefore = await readTask(request, third.id);
    const update = await request.put(`${tasksUrl}/${first.id}`, {
      data: {
        start_date: "2026-09-14",
        finish_date: "2026-09-15",
        duration_days: 2,
      },
    });
    expect(update.ok(), await responseError(update)).toBeTruthy();
    expect((await readTask(request, second.id)).start_date).toBe("2026-09-16");
    expect((await readTask(request, third.id)).start_date).not.toBe(
      thirdBefore.start_date,
    );
  });

  test("B10 manual, actual-dated, and segmented tasks stay fixed", async ({
    request,
  }) => {
    const admin = getAdminClient();
    const source = await createTask(request, {
      name: "Matrix Protected Source",
      start_date: "2026-09-21",
      finish_date: "2026-09-22",
      duration_days: 2,
      sort_order: 80,
    });
    const protectedRows = [
      {
        name: "Matrix Manual Protected",
        schedule_mode: "manual",
        sort_order: 81,
      },
      {
        name: "Matrix Actual Protected",
        schedule_mode: "auto",
        actual_start_date: "2026-09-23",
        sort_order: 82,
      },
      {
        name: "Matrix Segmented Protected",
        schedule_mode: "auto",
        sort_order: 83,
      },
    ].map((row) => ({
      project_id: projectId,
      start_date: "2026-09-23",
      finish_date: "2026-09-24",
      duration_days: 2,
      status: "not_started",
      percent_complete: 0,
      is_milestone: false,
      ...row,
    }));
    const { data: protectedTasks, error: protectedError } = await admin
      .from("schedule_tasks")
      .insert(protectedRows)
      .select("*");
    if (protectedError) throw new Error(protectedError.message);
    for (const task of protectedTasks) createdTaskIds.add(task.id);
    const segmented = protectedTasks.find(
      (task) => task.name === "Matrix Segmented Protected",
    )!;
    const segmentResponse = await request.put(
      `${tasksUrl}/${segmented.id}/segments`,
      {
        data: {
          expected_task_version: segmented.schedule_version,
          segments: [
            {
              segment_index: 0,
              starts_at: "2026-09-23T13:00:00.000Z",
              ends_at: "2026-09-23T17:00:00.000Z",
              planned_minutes: 240,
              lock_reason: null,
            },
          ],
        },
      },
    );
    expect(segmentResponse.ok(), await responseError(segmentResponse)).toBeTruthy();
    for (const task of protectedTasks) {
      await createDependency(request, task.id, source.id, "finish_to_start");
    }
    const before = new Map<string, { start_date: string | null; finish_date: string | null }>();
    for (const task of protectedTasks) {
      const current = await readTask(request, task.id);
      before.set(task.id, {
        start_date: current.start_date,
        finish_date: current.finish_date,
      });
    }
    const update = await request.put(`${tasksUrl}/${source.id}`, {
      data: {
        start_date: "2026-10-05",
        finish_date: "2026-10-06",
        duration_days: 2,
      },
    });
    expect(update.ok(), await responseError(update)).toBeTruthy();
    for (const task of protectedTasks) {
      const readback = await readTask(request, task.id);
      expect({
        start_date: readback.start_date,
        finish_date: readback.finish_date,
      }).toEqual(before.get(task.id));
    }
  });

  test("B13 critical-path overlay exposes critical markers", async ({
    page,
  }, testInfo) => {
    await openSchedule(page);
    const toggle = page.getByRole("button", { name: "Critical Path" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Critical", { exact: true }).first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("B13-critical-path.png"),
      fullPage: true,
    });
  });

  test("C01-C03 project weekdays and dated exceptions persist exactly", async ({
    request,
  }) => {
    const calendarUrl = `/api/projects/${projectId}/scheduling/calendar`;
    const save = await request.put(calendarUrl, {
      data: {
        working_weekdays: [1, 2, 3, 4, 5, 6],
        exceptions: [
          {
            date: "2026-12-25",
            is_working: false,
            reason: "Matrix non-working exception",
          },
          {
            date: "2026-12-26",
            is_working: true,
            reason: "Matrix working override",
          },
        ],
      },
    });
    expect(save.ok(), await responseError(save)).toBeTruthy();
    const saved = await save.json();
    expect(saved).toMatchObject({
      working_weekdays: [1, 2, 3, 4, 5, 6],
      non_working_dates: ["2026-12-25"],
      working_date_overrides: ["2026-12-26"],
    });

    const edit = await request.put(calendarUrl, {
      data: {
        working_weekdays: [1, 2, 3, 4, 5],
        exceptions: [
          {
            date: "2026-12-25",
            is_working: false,
            reason: "Matrix edited exception",
          },
        ],
      },
    });
    expect(edit.ok(), await responseError(edit)).toBeTruthy();
    const readback = await request.get(calendarUrl);
    expect(readback.ok(), await responseError(readback)).toBeTruthy();
    expect(await readback.json()).toMatchObject({
      working_weekdays: [1, 2, 3, 4, 5],
      exceptions: [
        {
          date: "2026-12-25",
          is_working: false,
          reason: "Matrix edited exception",
        },
      ],
      working_date_overrides: [],
    });
  });

  test("C05 deadline add, edit, and remove persists", async ({ request }) => {
    const task = await createTask(request, {
      name: "Matrix Deadline Task",
      start_date: "2026-10-12",
      finish_date: "2026-10-13",
      duration_days: 2,
      sort_order: 90,
    });
    const url = `${tasksUrl}/${task.id}`;
    for (const deadline of ["2026-10-14", "2026-10-15"]) {
      const save = await request.patch(url, {
        data: { intent: "deadline", deadline_date: deadline },
      });
      expect(save.ok(), await responseError(save)).toBeTruthy();
      const { data: readback, error } = await getAdminClient()
        .from("schedule_deadlines")
        .select("deadline_date")
        .eq("task_id", task.id)
        .single();
      if (error) throw new Error(error.message);
      expect(readback.deadline_date).toBe(deadline);
    }
    const remove = await request.patch(url, {
      data: { intent: "deadline", deadline_date: null },
    });
    expect(remove.ok(), await responseError(remove)).toBeTruthy();
    const { count, error } = await getAdminClient()
      .from("schedule_deadlines")
      .select("id", { count: "exact", head: true })
      .eq("task_id", task.id);
    if (error) throw new Error(error.message);
    expect(count).toBe(0);
  });

  test("C06 progress and status update persist together", async ({ request }) => {
    const task = await createTask(request, {
      name: "Matrix Progress Task",
      start_date: "2026-10-19",
      finish_date: "2026-10-20",
      duration_days: 2,
      sort_order: 91,
    });
    const update = await request.put(`${tasksUrl}/${task.id}`, {
      data: { status: "in_progress", percent_complete: 65 },
    });
    expect(update.ok(), await responseError(update)).toBeTruthy();
    expect(await readTask(request, task.id)).toMatchObject({
      status: "in_progress",
      percent_complete: 65,
    });
  });

  test("C07 field update records reason, note, attachment, and forecast", async ({
    request,
  }) => {
    const task = await createTask(request, {
      name: "Matrix Field Update Task",
      start_date: "2026-10-26",
      finish_date: "2026-10-27",
      duration_days: 2,
      sort_order: 92,
    });
    const update = await request.patch(`${tasksUrl}/${task.id}`, {
      data: {
        intent: "field_update",
        forecast_finish_date: "2026-10-29",
        remaining_duration_days: 3,
        delay_reason: "Matrix weather delay",
        note: "Matrix field note",
        attachment_urls: ["https://example.invalid/matrix-evidence.pdf"],
      },
    });
    expect(update.ok(), await responseError(update)).toBeTruthy();
    expect(await readTask(request, task.id)).toMatchObject({
      forecast_finish_date: "2026-10-29",
      remaining_duration_days: 3,
    });
    const { data: log, error } = await getAdminClient()
      .from("schedule_task_field_updates")
      .select("delay_reason,note,attachment_urls")
      .eq("project_id", projectId)
      .eq("task_id", task.id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .single();
    if (error) throw new Error(error.message);
    expect(log).toMatchObject({
      delay_reason: "Matrix weather delay",
      note: "Matrix field note",
      attachment_urls: ["https://example.invalid/matrix-evidence.pdf"],
    });
  });

  test("C08 linked submittal risk links, reports, and removes", async ({
    request,
  }) => {
    const task = await createTask(request, {
      name: "Matrix Submittal Risk Task",
      start_date: "2026-11-09",
      finish_date: "2026-11-10",
      duration_days: 2,
      sort_order: 93,
    });
    const submittalId = randomUUID();
    const admin = getAdminClient();
    const { error: submittalError } = await admin.from("submittals").insert({
      id: submittalId,
      project_id: projectId,
      submittal_number: "E2E-MATRIX-001",
      title: "Matrix rejected submittal",
      submitted_by: actorPersonId,
      status: "rejected",
      required_approval_date: "2026-11-06",
    });
    if (submittalError) throw new Error(submittalError.message);
    try {
      const url = `${tasksUrl}/${task.id}/submittals`;
      const link = await request.post(url, {
        data: { submittal_id: submittalId },
      });
      expect(link.status(), await responseError(link)).toBe(201);
      const readback = await request.get(url);
      expect(readback.ok(), await responseError(readback)).toBeTruthy();
      expect(await readback.json()).toMatchObject({
        data: [
          {
            id: submittalId,
            number: "E2E-MATRIX-001",
            title: "Matrix rejected submittal",
          },
        ],
        risk: {
          status: "at_risk",
          blocking_submittal_id: submittalId,
        },
      });
      const unlink = await request.delete(
        `${url}?submittalId=${submittalId}`,
      );
      expect(unlink.status()).toBe(204);
      const empty = await request.get(url);
      expect((await empty.json()).data).toEqual([]);
    } finally {
      const { error } = await admin
        .from("submittals")
        .delete()
        .eq("id", submittalId)
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);
    }
  });

  test("D07 15-minute splits add, edit, remove, and persist", async ({
    request,
  }) => {
    const task = await createTask(request, {
      name: "Matrix Split Task",
      start_date: "2026-11-02",
      finish_date: "2026-11-02",
      duration_days: 1,
      sort_order: 100,
    });
    const url = `${tasksUrl}/${task.id}/segments`;
    const first = await request.put(url, {
      data: {
        expected_task_version: task.schedule_version,
        segments: [
          {
            segment_index: 0,
            starts_at: "2026-11-02T13:00:00.000Z",
            ends_at: "2026-11-02T15:15:00.000Z",
            planned_minutes: 135,
            lock_reason: null,
          },
        ],
      },
    });
    expect(first.ok(), await responseError(first)).toBeTruthy();
    const afterFirst = await readTask(request, task.id);
    const edit = await request.put(url, {
      data: {
        expected_task_version: afterFirst.schedule_version,
        segments: [
          {
            segment_index: 0,
            starts_at: "2026-11-02T13:15:00.000Z",
            ends_at: "2026-11-02T16:00:00.000Z",
            planned_minutes: 165,
            lock_reason: null,
          },
        ],
      },
    });
    expect(edit.ok(), await responseError(edit)).toBeTruthy();
    const persisted = await request.get(url);
    expect(persisted.ok(), await responseError(persisted)).toBeTruthy();
    const persistedState = (await persisted.json()).data as {
      state: { segments: Array<{
        segment_index: number;
        starts_at: string;
        ends_at: string;
        planned_minutes: number;
      }> };
    };
    const persistedSegments = persistedState.state.segments;
    expect(persistedSegments).toHaveLength(1);
    expect(persistedSegments[0]).toMatchObject({
      segment_index: 0,
      planned_minutes: 165,
    });
    expect(new Date(persistedSegments[0].starts_at).toISOString()).toBe(
      "2026-11-02T13:15:00.000Z",
    );
    expect(new Date(persistedSegments[0].ends_at).toISOString()).toBe(
      "2026-11-02T16:00:00.000Z",
    );
    const current = await readTask(request, task.id);
    const remove = await request.put(url, {
      data: { expected_task_version: current.schedule_version, segments: [] },
    });
    expect(remove.ok(), await responseError(remove)).toBeTruthy();
    const empty = await request.get(url);
    expect((await empty.json()).data.state.segments).toEqual([]);
  });

  test("D09-D10 leveling preview and enterprise capacity are scoped", async ({
    request,
  }) => {
    const capacityTask = await createTask(request, {
      name: "Matrix Enterprise Capacity Task",
      start_date: "2026-11-03",
      finish_date: "2026-11-03",
      duration_days: 1,
      sort_order: 105,
    });
    const overlappingTask = await createTask(request, {
      name: "Matrix Enterprise Capacity Conflict",
      start_date: "2026-11-03",
      finish_date: "2026-11-03",
      duration_days: 1,
      sort_order: 106,
    });
    const assignment = await request.put(
      `${tasksUrl}/${capacityTask.id}/assignments`,
      {
        data: {
          assignments: [
            { person_id: syntheticPersonId, allocation_percent: 100 },
          ],
          expected_assignments: [],
        },
      },
    );
    expect(assignment.ok(), await responseError(assignment)).toBeTruthy();
    const overlappingAssignment = await request.put(
      `${tasksUrl}/${overlappingTask.id}/assignments`,
      {
        data: {
          assignments: [
            { person_id: syntheticPersonId, allocation_percent: 100 },
          ],
          expected_assignments: [],
        },
      },
    );
    expect(
      overlappingAssignment.ok(),
      await responseError(overlappingAssignment),
    ).toBeTruthy();
    const { error: splitEligibilityError } = await getAdminClient()
      .from("schedule_tasks")
      .update({ allow_leveling_split: true })
      .in("id", [capacityTask.id, overlappingTask.id]);
    if (splitEligibilityError) throw new Error(splitEligibilityError.message);
    const capacity = await request.get(
      `/api/projects/${projectId}/scheduling/enterprise-capacity?person_ids=${syntheticPersonId}&start=2026-11-02T00%3A00%3A00.000Z&finish=2026-11-09T00%3A00%3A00.000Z`,
    );
    expect(capacity.ok(), await responseError(capacity)).toBeTruthy();
    const capacityBody = await capacity.json();
    expect(JSON.stringify(capacityBody)).not.toContain("example.invalid");
    expect(JSON.stringify(capacityBody)).not.toContain(fixture?.creationRunId);

    const preview = await request.post(
      `/api/projects/${projectId}/scheduling/resource-leveling-runs`,
      {
        data: {
          range_start: "2026-11-02T00:00:00.000Z",
          range_finish: "2026-11-30T00:00:00.000Z",
        },
      },
    );
    expect(preview.status(), await responseError(preview)).toBe(201);
    const previewBody = await preview.json();
    expect(previewBody.data).toHaveProperty("preview");
    expect(previewBody.data).toHaveProperty("run");
    expect(
      previewBody.data.preview.proposals.length,
      JSON.stringify(previewBody.data.preview),
    ).toBeGreaterThan(0);
    expect(previewBody.data.run?.run?.id).toEqual(expect.any(String));

    const apply = await request.post(
      `/api/projects/${projectId}/scheduling/actions`,
      {
        data: {
          entity_type: "resource_leveling_run",
          action: "apply",
          entity_id: previewBody.data.run.run.id,
          payload: { reason: "Matrix apply verification" },
        },
      },
    );
    expect(apply.ok(), await responseError(apply)).toBeTruthy();
    const appliedBody = await apply.json();
    expect(appliedBody.data.event).toMatchObject({ event_type: "applied" });

    const list = await request.get(
      `/api/projects/${projectId}/scheduling/resource-leveling-runs`,
    );
    expect(list.ok(), await responseError(list)).toBeTruthy();
    const appliedHistory = (await list.json()).data;
    expect(appliedHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            id: appliedBody.data.event.id,
            event_type: "applied",
          }),
          can_undo: true,
        }),
      ]),
    );

    const undo = await request.post(
      `/api/projects/${projectId}/scheduling/actions`,
      {
        data: {
          entity_type: "resource_leveling_event",
          action: "undo",
          entity_id: appliedBody.data.event.id,
          payload: { reason: "Matrix undo verification" },
        },
      },
    );
    expect(undo.ok(), await responseError(undo)).toBeTruthy();
    const undoneBody = await undo.json();
    expect(undoneBody.data.event).toMatchObject({
      event_type: "undone",
      related_event_id: appliedBody.data.event.id,
    });

    const immutableHistory = await request.get(
      `/api/projects/${projectId}/scheduling/resource-leveling-runs`,
    );
    expect(
      immutableHistory.ok(),
      await responseError(immutableHistory),
    ).toBeTruthy();
    const immutableEvents = (await immutableHistory.json()).data.map(
      (item: { event: { id: string; event_type: string } }) => item.event,
    );
    expect(immutableEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: appliedBody.data.event.id,
          event_type: "applied",
        }),
        expect.objectContaining({
          id: undoneBody.data.event.id,
          event_type: "undone",
        }),
      ]),
    );
  });

  test("E09 resource deletion remains behind explicit confirmation", async ({
    page,
  }, testInfo) => {
    const displayName = `Matrix deletion guard ${randomUUID().slice(0, 8)}`;
    const response = await page.request.post(
      `/api/projects/${projectId}/scheduling/resources?operation=cost-resource`,
      {
        data: {
          id: null,
          resource_kind: "equipment",
          display_name: displayName,
          standard_rate: 800,
          cost_per_use: 125,
          rate_unit: "day",
          expected_cost_version: null,
        },
      },
    );
    expect(response.status(), await responseError(response)).toBe(201);
    const resource = (await response.json()).data as {
      id: string;
      cost_version: number;
    };

    await page.goto(`${scheduleUrl}?workspace=planning`, {
      waitUntil: "domcontentloaded",
    });
    const costPanel = page.getByRole("region", {
      name: "Cost and earned value",
    });
    await expect(costPanel.getByText(displayName)).toBeVisible({
      timeout: 60_000,
    });
    await costPanel
      .getByRole("button", { name: `Delete ${displayName}` })
      .click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toContainText(`Delete ${displayName}?`);
    await expect(confirmation).toContainText("cannot be undone");
    await expect(confirmation.getByRole("button", { name: "Delete" })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("E09-resource-delete-confirmation.png"),
      fullPage: true,
    });
    await confirmation.getByRole("button", { name: "Cancel" }).click();

    const remove = await page.request.delete(
      `/api/projects/${projectId}/scheduling/resources`,
      {
        data: {
          resource_id: resource.id,
          expected_cost_version: resource.cost_version,
        },
      },
    );
    expect(remove.ok(), await responseError(remove)).toBeTruthy();
  });

  test("F03-F07 named baseline, tracking overlay, and published reports", async ({
    page,
    request,
  }, testInfo) => {
    publishedRevisionId = await publishCurrentSchedule(request);
    const baseline = await request.post(
      `/api/projects/${projectId}/scheduling/baselines`,
      {
        data: {
          name: "Matrix Approved Baseline",
          revision_id: publishedRevisionId,
          activate: true,
        },
      },
    );
    expect(baseline.status(), await responseError(baseline)).toBe(201);
    const baselineBody = await baseline.json();
    const baselineData = Array.isArray(baselineBody.data)
      ? baselineBody.data[0]
      : baselineBody.data;
    activeBaselineId = baselineData.id;

    const comparison = await request.get(
      `/api/projects/${projectId}/scheduling/baselines/${activeBaselineId}/comparison`,
    );
    expect(comparison.ok(), await responseError(comparison)).toBeTruthy();
    expect((await comparison.json()).data.tasks.length).toBeGreaterThan(0);

    await openSchedule(page);
    const baselineToggle = page.getByRole("button", {
      name: "Baseline",
      exact: true,
    });
    await expect(baselineToggle).toBeEnabled();
    await baselineToggle.click();
    await expect(baselineToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-testid^="gantt-baseline-"]').first()).toBeVisible();

    await page.goto(`${scheduleUrl}?workspace=planning`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Construction lookahead").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Schedule risks").first()).toBeVisible();
    await expect(page.getByText("Company assigned activities").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("F03-F07-planning-and-baseline.png"),
      fullPage: true,
    });
  });

  test("F09-F11 exports disclose loss and create CSV, JSON, XML, XLSX, and PDF", async ({
    page,
  }) => {
    await openSchedule(page);
    await page.getByRole("button", { name: "Export" }).click();
    const exportDialog = page.getByRole("dialog");
    await expect(exportDialog).toContainText("Flat, intentionally lossy snapshot");
    for (const label of ["CSV", "JSON", "MS Project XML"]) {
      await exportDialog.getByRole("button", { name: label, exact: true }).click();
      const download = page.waitForEvent("download");
      await exportDialog.getByRole("button", { name: /Export \d+ Tasks/ }).click();
      const file = await download;
      expect(await file.suggestedFilename()).toMatch(
        label === "CSV"
          ? /\.csv$/
          : label === "JSON"
            ? /\.json$/
            : /\.xml$/,
      );
    }
    await exportDialog.getByRole("button", { name: "Cancel" }).click();

    await page.goto(`${scheduleUrl}?workspace=planning`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Construction lookahead").first()).toBeVisible({
      timeout: 60_000,
    });
    for (const label of ["Export XLSX", "Export PDF"]) {
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: label }).click();
      const file = await download;
      expect(await file.suggestedFilename()).toMatch(
        label.endsWith("XLSX") ? /\.xlsx$/ : /\.pdf$/,
      );
    }
  });

  test("F12 malformed import rejects atomically with no schedule writes", async ({
    request,
  }) => {
    const before = await getAdminClient()
      .from("schedule_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    if (before.error) throw new Error(before.error.message);
    const malformed = await request.post(`${tasksUrl}/import`, {
      data: {
        replaceExisting: true,
        tasks: [
          {
            external_id: "matrix-import-1",
            parent_external_id: null,
            predecessors: [
              {
                predecessor_external_id: "missing",
                dependency_type: "finish_to_start",
                lag_days: 0,
              },
            ],
            name: "Matrix malformed import",
            wbs_code: "1",
            start_date: "2026-12-01",
            finish_date: "2026-12-01",
            duration_days: 1,
            percent_complete: 0,
            status: "not_started",
            is_milestone: false,
            sort_order: 1,
          },
        ],
      },
    });
    expect(malformed.status()).toBe(400);
    const after = await getAdminClient()
      .from("schedule_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    if (after.error) throw new Error(after.error.message);
    expect(after.count).toBe(before.count);
  });

  test("G03 viewer can read but cannot perform schedule-admin transitions", async ({
    request,
  }) => {
    const admin = getAdminClient();
    const suffix = randomUUID();
    const email = `e2e-schedule-viewer-${suffix}@example.invalid`;
    const password = `E2E!${randomUUID()}aA1`;
    const personId = randomUUID();
    let authUserId = "";
    let revisionId = "";
    let viewerContext: Awaited<ReturnType<typeof playwrightRequest.newContext>> | null =
      null;
    try {
      const { data: authData, error: authError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (authError || !authData.user) {
        throw new Error(authError?.message ?? "Unable to create viewer identity.");
      }
      authUserId = authData.user.id;
      const { error: personError } = await admin.from("people").insert({
        id: personId,
        auth_user_id: authUserId,
        first_name: "E2E",
        last_name: `Schedule Viewer ${suffix.slice(0, 8)}`,
        email,
        person_type: "user",
        status: "active",
      });
      if (personError) throw new Error(personError.message);
      const { error: linkError } = await admin.from("users_auth").insert({
        auth_user_id: authUserId,
        person_id: personId,
      });
      if (linkError) throw new Error(linkError.message);
      const { error: membershipError } = await admin
        .from("project_directory_memberships")
        .insert({
          project_id: projectId,
          person_id: personId,
          role: "viewer",
          status: "active",
          user_type: "employee",
        });
      if (membershipError) throw new Error(membershipError.message);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const viewer = createSupabaseClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signIn, error: signInError } =
        await viewer.auth.signInWithPassword({ email, password });
      if (signInError || !signIn.session) {
        throw new Error(signInError?.message ?? "Viewer sign-in failed.");
      }
      const sessionJson = JSON.stringify({
        access_token: signIn.session.access_token,
        token_type: signIn.session.token_type,
        expires_in: signIn.session.expires_in,
        expires_at: signIn.session.expires_at,
        refresh_token: signIn.session.refresh_token,
        user: signIn.session.user,
        weak_password: null,
      });
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      viewerContext = await playwrightRequest.newContext({
        baseURL: "https://projects.alleatogroup.com",
        storageState: {
          cookies: [
            {
              name: `sb-${projectRef}-auth-token`,
              value: `base64-${Buffer.from(sessionJson).toString("base64")}`,
              domain: "projects.alleatogroup.com",
              path: "/",
              expires: Math.floor(Date.now() / 1000) + 3600,
              httpOnly: false,
              secure: true,
              sameSite: "Lax",
            },
          ],
          origins: [],
        },
      });

      const read = await viewerContext.get(tasksUrl);
      expect(read.ok(), await responseError(read)).toBeTruthy();

      const snapshot = await request.post(
        `/api/projects/${projectId}/scheduling/revisions`,
        { data: {} },
      );
      expect(snapshot.status(), await responseError(snapshot)).toBe(201);
      const body = (await snapshot.json()) as {
        data: { id: string } | Array<{ id: string }>;
      };
      revisionId = (Array.isArray(body.data) ? body.data[0] : body.data).id;
      const denied = await viewerContext.post(
        `/api/projects/${projectId}/scheduling/actions`,
        {
          data: {
            entity_type: "revision",
            action: "transition",
            entity_id: revisionId,
            payload: { status: "review" },
          },
        },
      );
      expect(denied.status()).toBe(403);
      const { data: unchanged, error: unchangedError } = await admin
        .from("schedule_revisions")
        .select("status")
        .eq("id", revisionId)
        .single();
      if (unchangedError) throw new Error(unchangedError.message);
      expect(unchanged.status).toBe("draft");
    } finally {
      await viewerContext?.dispose();
      if (revisionId) {
        await admin.from("schedule_revisions").delete().eq("id", revisionId);
      }
      await admin
        .from("project_directory_memberships")
        .delete()
        .eq("project_id", projectId)
        .eq("person_id", personId);
      await admin.from("users_auth").delete().eq("person_id", personId);
      await admin.from("people").delete().eq("id", personId);
      if (authUserId) await admin.auth.admin.deleteUser(authUserId);
    }
  });

  test("G05 loading, empty, error, and retry states are explicit", async ({
    page,
  }) => {
    const emptyFixture = await createDisposableScheduleProject("state-matrix");
    try {
      await addProjectMember(emptyFixture.id, actorUserId, "admin");
      const emptyUrl = `/${emptyFixture.id}/schedule`;
      const routePattern = `**/api/projects/${emptyFixture.id}/scheduling/tasks**`;
      let mode: "delay" | "error" | "pass" = "delay";
      await page.route(routePattern, async (route) => {
        if (mode === "delay") {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          await route.continue();
          return;
        }
        if (mode === "error") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Matrix unavailable" }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto(emptyUrl, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".animate-pulse").first()).toBeVisible({
        timeout: 2_000,
      });
      await expect
        .soft(
          page.getByText(/Loading schedule/i).first(),
          "the loading skeleton needs an accessible explanation",
        )
        .toBeVisible({ timeout: 500 });
      await expect(page.getByText("No tasks scheduled")).toBeVisible({
        timeout: 30_000,
      });

      mode = "error";
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Unable to Load Schedule/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Try again" }),
      ).toBeVisible();
      mode = "pass";
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByText("No tasks scheduled")).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await page.unrouteAll({ behavior: "wait" });
      await deleteDisposableScheduleProject(emptyFixture);
    }
  });
});
