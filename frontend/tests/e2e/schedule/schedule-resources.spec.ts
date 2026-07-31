import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  addProjectMember,
  assertDisposableScheduleProject,
  createDisposableScheduleProject,
  createScheduleTask,
  deleteDisposableScheduleProject,
  deleteScheduleTask,
  type DisposableScheduleProjectFixture,
  getAdminClient,
  getUserIdByEmail,
} from "../../helpers/db";

let PROJECT_ID = 0;
let SCHEDULE_URL = "";
let projectFixture: DisposableScheduleProjectFixture | null = null;
const TASK_START = "2026-07-27";
const TASK_FINISH = "2026-07-29";

interface ResourceCandidate {
  person_id: string;
  resource_id: string | null;
  display_name: string;
}

interface ResourceRoster {
  can_manage: boolean;
  candidates: ResourceCandidate[];
  resources: Array<{ id: string; person_id: string }>;
}

interface AssignmentExpectation {
  id: string;
  person_id: string;
  cost_version: number;
}

async function responseError(response: APIResponse) {
  return `${response.status()} ${await response.text()}`;
}

async function currentAssignmentExpectations(
  page: Page,
  taskId: string,
): Promise<AssignmentExpectation[]> {
  const response = await page.request.get(
    `/api/projects/${PROJECT_ID}/scheduling/tasks/${taskId}/assignments`,
  );
  expect(response.ok(), await responseError(response)).toBeTruthy();
  const body = await response.json() as { data: AssignmentExpectation[] };
  return body.data.map(({ id, person_id, cost_version }) => ({
    id,
    person_id,
    cost_version,
  }));
}

let firstTaskId = "";
let secondTaskId = "";
let capturedRevisionId = "";
let selectedPersonIds: string[] = [];
let createdPersonIds: string[] = [];
let preexistingResourceIds = new Set<string>();

test.describe("Schedule resources and assignments", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "tests/.auth/user.json" });

  test.beforeAll(async () => {
    projectFixture = await createDisposableScheduleProject("resources");
    PROJECT_ID = projectFixture.id;
    await assertDisposableScheduleProject(projectFixture);
    const userId = await getUserIdByEmail(process.env.TEST_USER_1 ?? "test1@mail.com");
    await addProjectMember(PROJECT_ID, userId);
    SCHEDULE_URL = `/${PROJECT_ID}/schedule`;

    const admin = getAdminClient();
    createdPersonIds = [randomUUID(), randomUUID()];
    const suffix = randomUUID().slice(0, 8);
    const { error: peopleError } = await admin.from("people").insert(
      createdPersonIds.map((id, index) => ({
        id,
        first_name: "E2E",
        last_name: `P4A ${suffix}-${index + 1}`,
        email: `e2e-p4a-${suffix}-${index + 1}@example.invalid`,
        person_type: "user",
        status: "active",
      })),
    );
    if (peopleError) throw new Error(`Failed to create isolated Phase 4A people: ${peopleError.message}`);

    const { error: membershipError } = await admin.from("project_directory_memberships").insert(
      createdPersonIds.map((personId) => ({
        project_id: PROJECT_ID,
        person_id: personId,
        role: "E2E resource",
        status: "active",
        user_type: "employee",
      })),
    );
    if (membershipError) throw new Error(`Failed to create isolated Phase 4A memberships: ${membershipError.message}`);

    const first = await createScheduleTask({
      project_id: PROJECT_ID,
      name: "E2E-P4A Resource Task A",
      start_date: TASK_START,
      finish_date: TASK_FINISH,
      duration_days: 3,
      sort_order: 9901,
    });
    const second = await createScheduleTask({
      project_id: PROJECT_ID,
      name: "E2E-P4A Resource Task B",
      start_date: TASK_START,
      finish_date: TASK_FINISH,
      duration_days: 3,
      sort_order: 9902,
    });
    firstTaskId = first.id as string;
    secondTaskId = second.id as string;
  });

  test.afterAll(async () => {
    const admin = getAdminClient();
    const cleanupErrors: string[] = [];
    if (capturedRevisionId) {
      const { error } = await admin
        .from("schedule_revisions")
        .delete()
        .eq("id", capturedRevisionId);
      if (error) cleanupErrors.push(`revision: ${error.message}`);
    }
    for (const taskId of [firstTaskId, secondTaskId].filter(Boolean)) {
      try {
        await deleteScheduleTask(taskId);
      } catch (error) {
        cleanupErrors.push(
          `task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (selectedPersonIds.length > 0) {
      const { data: resources, error: resourceLookupError } = await admin
        .from("schedule_resources")
        .select("id")
        .eq("project_id", PROJECT_ID)
        .in("person_id", selectedPersonIds);
      if (resourceLookupError) {
        cleanupErrors.push(`resource lookup: ${resourceLookupError.message}`);
      } else {
        const resourceIdsToDelete = (resources ?? [])
          .map((resource) => resource.id)
          .filter((id) => !preexistingResourceIds.has(id));
        if (resourceIdsToDelete.length > 0) {
          const { error } = await admin
            .from("schedule_resources")
            .delete()
            .in("id", resourceIdsToDelete);
          if (error) cleanupErrors.push(`resources: ${error.message}`);
        }
      }
    }
    if (projectFixture) {
      try {
        await deleteDisposableScheduleProject(projectFixture);
      } catch (error) {
        cleanupErrors.push(
          `project ${PROJECT_ID}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (createdPersonIds.length > 0) {
      const { error } = await admin.from("people").delete().in("id", createdPersonIds);
      if (error) cleanupErrors.push(`people: ${error.message}`);
    }
    if (cleanupErrors.length > 0) {
      throw new Error(`E2E cleanup failed: ${cleanupErrors.join("; ")}`);
    }
  });

  test("assigns two people, shows overlap without moving dates, and snapshots the facts", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    await page.goto(SCHEDULE_URL);
    await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible();

    const rosterResponse = await page.request.get(
      `/api/projects/${PROJECT_ID}/scheduling/resources`,
    );
    expect(rosterResponse.ok()).toBeTruthy();
    const initialRoster = await rosterResponse.json() as ResourceRoster;
    expect(initialRoster.can_manage).toBe(true);
    const candidates = initialRoster.candidates.filter((candidate) =>
      createdPersonIds.includes(candidate.person_id),
    );
    expect(candidates).toHaveLength(2);
    selectedPersonIds = candidates.map((candidate) => candidate.person_id);
    preexistingResourceIds = new Set(initialRoster.resources.map((item) => item.id));

    const firstReplace = await page.request.put(
      `/api/projects/${PROJECT_ID}/scheduling/tasks/${firstTaskId}/assignments`,
      {
        data: {
          assignments: [
            { person_id: candidates[0].person_id, allocation_percent: 75 },
            { person_id: candidates[1].person_id, allocation_percent: 25 },
          ],
          expected_assignments: [],
        },
      },
    );
    expect(firstReplace.ok(), await responseError(firstReplace)).toBeTruthy();

    const secondReplace = await page.request.put(
      `/api/projects/${PROJECT_ID}/scheduling/tasks/${secondTaskId}/assignments`,
      {
        data: {
          assignments: [
            { person_id: candidates[0].person_id, allocation_percent: 75 },
          ],
          expected_assignments: [],
        },
      },
    );
    expect(secondReplace.ok(), await responseError(secondReplace)).toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible();
    await expect(page.getByText("E2E-P4A Resource Task A").first()).toBeVisible();

    await page.getByRole("button", {
      name: "Resources, costs, leveling, revisions & reports",
    }).click();
    const projectResourceLoad = page.getByRole("button", { name: "Project resource load" });
    await expect(projectResourceLoad).toBeVisible();
    if (await projectResourceLoad.getAttribute("aria-expanded") !== "true") {
      await projectResourceLoad.click();
    }
    await expect(projectResourceLoad).toHaveAttribute("aria-expanded", "true");
    await page.getByLabel("Start", { exact: true }).fill("07/27/2026");
    await page.getByLabel("Finish", { exact: true }).fill("07/29/2026");
    await expect(page.getByText("50% over capacity").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("schedule-resource-load-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath("schedule-resource-load-mobile.png"),
    });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.getByTestId("schedule-workspace-tab").click();
    await page.getByRole("button", { name: "Switch to Gantt view" }).click();
    const taskLink = page
      .locator("button")
      .filter({ hasText: "E2E-P4A Resource Task A" })
      .first();
    await expect(taskLink).toBeVisible({ timeout: 30_000 });
    await taskLink.click();
    const assignmentRegion = page.getByRole("region", { name: "Resource assignments" });
    await expect(assignmentRegion).toBeVisible();
    await expect(page.getByText(candidates[0].display_name).first()).toBeVisible();
    await expect(page.getByLabel(`Allocation for ${candidates[0].display_name}`)).toHaveValue("75.00");
    await expect(page.getByLabel(`Allocation for ${candidates[1].display_name}`)).toHaveValue("25.00");
    await assignmentRegion.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("schedule-task-assignments-desktop.png"),
    });

    await page.getByLabel(`Allocation for ${candidates[0].display_name}`).fill("70");
    const assignmentSave = page.waitForResponse((response) =>
      response.request().method() === "PUT"
      && response.url().includes(`/scheduling/tasks/${firstTaskId}/assignments`)
      && response.ok(),
    );
    await page.getByRole("button", { name: "Save assignments" }).click();
    await assignmentSave;
    await expect(page.getByLabel(`Allocation for ${candidates[0].display_name}`)).toHaveValue("70.00");

    const admin = getAdminClient();
    const { data: taskRows, error: taskError } = await admin
      .from("schedule_tasks")
      .select("id,start_date,finish_date,forecast_start_date,forecast_finish_date")
      .in("id", [firstTaskId, secondTaskId]);
    if (taskError) throw new Error(`Failed to verify task dates: ${taskError.message}`);
    expect(taskRows).toHaveLength(2);
    for (const task of taskRows ?? []) {
      expect(task.start_date).toBe(TASK_START);
      expect(task.finish_date).toBe(TASK_FINISH);
      expect(task.forecast_start_date).toBeNull();
      expect(task.forecast_finish_date).toBeNull();
    }

    const revisionResponse = await page.request.post(
      `/api/projects/${PROJECT_ID}/scheduling/revisions`,
      { data: {} },
    );
    expect(revisionResponse.status()).toBe(201);
    const revisionBody = await revisionResponse.json() as {
      data: { id: string; resource_context_provenance: string } | Array<{
        id: string;
        resource_context_provenance: string;
      }>;
    };
    const revision = Array.isArray(revisionBody.data)
      ? revisionBody.data[0]
      : revisionBody.data;
    capturedRevisionId = revision.id;
    expect(revision.resource_context_provenance).toBe("captured");

    const [{ count: resourceSnapshotCount, error: resourceSnapshotError }, {
      count: assignmentSnapshotCount,
      error: assignmentSnapshotError,
    }] = await Promise.all([
      admin
        .from("schedule_revision_resource_snapshots")
        .select("source_resource_id", { count: "exact", head: true })
        .eq("revision_id", capturedRevisionId),
      admin
        .from("schedule_revision_assignment_snapshots")
        .select("source_assignment_id", { count: "exact", head: true })
        .eq("revision_id", capturedRevisionId)
        .in("task_source_id", [firstTaskId, secondTaskId]),
    ]);
    if (resourceSnapshotError) throw new Error(resourceSnapshotError.message);
    if (assignmentSnapshotError) throw new Error(assignmentSnapshotError.message);
    expect(resourceSnapshotCount).toBeGreaterThanOrEqual(2);
    expect(assignmentSnapshotCount).toBe(3);

    const [{ error: resourceMutationError }, { error: assignmentMutationError }] = await Promise.all([
      admin
        .from("schedule_revision_resource_snapshots")
        .update({ display_name: "E2E mutation must fail" })
        .eq("revision_id", capturedRevisionId),
      admin
        .from("schedule_revision_assignment_snapshots")
        .update({ allocation_percent: 99 })
        .eq("revision_id", capturedRevisionId),
    ]);
    expect(resourceMutationError?.code).toBe("42501");
    expect(assignmentMutationError?.code).toBe("42501");

    const firstExpectedAssignments = await currentAssignmentExpectations(page, firstTaskId);
    const secondExpectedAssignments = await currentAssignmentExpectations(page, secondTaskId);
    const clearFirst = await page.request.put(
      `/api/projects/${PROJECT_ID}/scheduling/tasks/${firstTaskId}/assignments`,
      { data: { assignments: [], expected_assignments: firstExpectedAssignments } },
    );
    const clearSecond = await page.request.put(
      `/api/projects/${PROJECT_ID}/scheduling/tasks/${secondTaskId}/assignments`,
      { data: { assignments: [], expected_assignments: secondExpectedAssignments } },
    );
    expect(clearFirst.ok(), await responseError(clearFirst)).toBeTruthy();
    expect(clearSecond.ok(), await responseError(clearSecond)).toBeTruthy();
  });
});
