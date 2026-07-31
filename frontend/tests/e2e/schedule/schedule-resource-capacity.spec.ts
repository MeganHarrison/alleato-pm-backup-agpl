import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "path";
import { createScheduleTask, deleteScheduleTask, getAdminClient } from "../../helpers/db";

const PROJECT_ID = 67;
const SCHEDULE_URL = `/${PROJECT_ID}/schedule`;
const TASK_START = "2026-07-27";
const TASK_FINISH = "2026-07-29";
const EVIDENCE_DIR = path.resolve(
  __dirname,
  "../../../../docs/ops/evidence/2026-07-22-schedule-resource-calendars-leveling",
);

interface Candidate {
  person_id: string;
  resource_id: string | null;
  display_name: string;
}

interface Roster {
  can_manage: boolean;
  candidates: Candidate[];
  resources: Array<{ id: string; person_id: string; display_name: string }>;
}

let taskId = "";
let revisionId = "";
let selectedPersonId = "";
let selectedResourceId = "";
let selectedDisplayName = "";

test.describe("Schedule project capacity and leveling preview", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "tests/.auth/user.json" });

  test.beforeAll(async () => {
    const admin = getAdminClient();
    const suffix = randomUUID();
    selectedPersonId = randomUUID();
    selectedDisplayName = `E2E P4B ${suffix.slice(0, 8)}`;
    const { error: personError } = await admin.from("people").insert({
      id: selectedPersonId,
      first_name: "E2E",
      last_name: `P4B ${suffix.slice(0, 8)}`,
      email: `e2e-p4b-${suffix}@example.invalid`,
      person_type: "user",
      status: "active",
    });
    if (personError) throw new Error(`Failed to create isolated Phase 4B person: ${personError.message}`);
    const { error: membershipError } = await admin.from("project_directory_memberships").insert({
      project_id: PROJECT_ID,
      person_id: selectedPersonId,
      role: "E2E resource",
      status: "active",
      user_type: "employee",
    });
    if (membershipError) throw new Error(`Failed to create isolated Phase 4B membership: ${membershipError.message}`);
    const task = await createScheduleTask({
      project_id: PROJECT_ID,
      name: "E2E-P4B Project Capacity Task",
      start_date: TASK_START,
      finish_date: TASK_FINISH,
      duration_days: 3,
      sort_order: 9911,
    });
    taskId = task.id as string;
  });

  test.afterAll(async () => {
    const admin = getAdminClient();
    const cleanupErrors: string[] = [];
    if (revisionId) {
      const { error } = await admin.from("schedule_revisions").delete().eq("id", revisionId);
      if (error) cleanupErrors.push(`revision: ${error.message}`);
    }
    if (taskId) {
      try {
        await deleteScheduleTask(taskId);
      } catch (error) {
        cleanupErrors.push(`task: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (selectedResourceId) {
      const { error } = await admin
        .from("schedule_resources")
        .delete()
        .eq("id", selectedResourceId)
        .eq("project_id", PROJECT_ID);
      if (error) cleanupErrors.push(`resource: ${error.message}`);
    }
    if (selectedPersonId) {
      const { error: membershipError } = await admin
        .from("project_directory_memberships")
        .delete()
        .eq("project_id", PROJECT_ID)
        .eq("person_id", selectedPersonId);
      if (membershipError) cleanupErrors.push(`membership: ${membershipError.message}`);
      const { error: personError } = await admin.from("people").delete().eq("id", selectedPersonId);
      if (personError) cleanupErrors.push(`person: ${personError.message}`);
    }
    if (cleanupErrors.length > 0) throw new Error(`Phase 4B E2E cleanup failed: ${cleanupErrors.join("; ")}`);
  });

  test("edits project-only capacity, previews leveling without writes, and snapshots capacity", async ({ page }) => {
    test.setTimeout(300_000);
    const rosterResponse = await page.request.get(`/api/projects/${PROJECT_ID}/scheduling/resources`);
    expect(rosterResponse.ok()).toBeTruthy();
    const initialRoster = await rosterResponse.json() as Roster;
    expect(initialRoster.can_manage).toBe(true);
    const selectedPerson = initialRoster.candidates.find((item) => item.person_id === selectedPersonId);
    expect(selectedPerson, "the isolated project person must be schedulable").toMatchObject({
      person_id: selectedPersonId,
      resource_id: null,
      display_name: selectedDisplayName,
    });

    const assignmentResponse = await page.request.put(
      `/api/projects/${PROJECT_ID}/scheduling/tasks/${taskId}/assignments`,
      { data: { assignments: [{ person_id: selectedPersonId, allocation_percent: 60 }] } },
    );
    expect(assignmentResponse.ok()).toBeTruthy();
    const updatedRosterResponse = await page.request.get(`/api/projects/${PROJECT_ID}/scheduling/resources`);
    const updatedRoster = await updatedRosterResponse.json() as Roster;
    selectedResourceId = updatedRoster.resources.find((resource) => resource.person_id === selectedPersonId)?.id ?? "";
    expect(selectedResourceId).not.toBe("");

    await page.goto(SCHEDULE_URL, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible();
    await expect(
      page.getByText("E2E-P4B Project Capacity Task").first(),
      "the canonical schedule must finish loading the isolated task before the resource panel opens",
    ).toBeVisible({ timeout: 120_000 });
    const projectResourceLoad = page.getByRole("button", { name: "Project resource load" });
    await expect(projectResourceLoad, "schedule data should settle after the temporary assignment").toBeVisible({ timeout: 60_000 });
    if (await projectResourceLoad.getAttribute("aria-expanded") !== "true") await projectResourceLoad.click();
    await expect(projectResourceLoad, "resource panel should remain expanded after schedule data settles")
      .toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
    const startField = page.getByLabel("Start", { exact: true });
    const finishField = page.getByLabel("Finish", { exact: true });
    await expect(startField).toBeVisible();
    await startField.fill("07/27/2026");
    await finishField.fill("07/29/2026");
    await expect(page.getByText("Loading project resource load...")).toBeHidden({ timeout: 60_000 });

    const resourceRow = page.getByRole("row").filter({ hasText: selectedDisplayName });
    await expect(resourceRow).toBeVisible();
    await resourceRow.getByRole("button", { name: "Edit project capacity" }).click();
    await expect(page.getByRole("dialog")).toContainText(`Edit project capacity: ${selectedDisplayName}`);
    await page.getByRole("checkbox", { name: "Monday" }).click();
    await page.getByLabel("Monday capacity percent").fill("50");
    await page.getByRole("button", { name: "Add exception" }).click();
    await page.getByRole("textbox", { name: "Exception 1 date", exact: true }).fill("07/28/2026");
    await page.getByRole("textbox", { name: "Exception 1 capacity", exact: true }).fill("0");
    await page.getByLabel("Reason (optional)").fill("E2E project exception");
    const saveCapacityResponse = page.waitForResponse((response) =>
      response.request().method() === "PUT"
      && response.url().includes("/scheduling/resources?view=capacity-profile")
      && response.url().includes(`resourceId=${selectedResourceId}`)
      && response.ok(),
    );
    await page.getByRole("button", { name: "Save project capacity" }).click();
    await saveCapacityResponse;
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(resourceRow.getByText("Capacity 50%"), "weekday capacity should drive load").toBeVisible();
    await expect(resourceRow.getByText("10% over capacity"), "assignment load should compare with configured capacity").toBeVisible();
    await expect(resourceRow.getByText("No capacity: E2E project exception"), "dated exception should win over weekday capacity").toBeVisible();

    const taskDatesBeforePreview = await getAdminClient()
      .from("schedule_tasks")
      .select("start_date,finish_date,forecast_start_date,forecast_finish_date,duration_days,percent_complete,status,constraint_type,constraint_date,is_milestone")
      .eq("id", taskId)
      .single();
    if (taskDatesBeforePreview.error) throw new Error(taskDatesBeforePreview.error.message);
    const previewResponse = page.waitForResponse((response) =>
      response.request().method() === "POST"
      && response.url().includes("/scheduling/resources?operation=leveling-preview")
      && response.ok(),
    );
    await page.getByRole("button", { name: "Preview leveling" }).click();
    await previewResponse;
    await expect(page.getByText(/Preview only\. No schedule dates were changed/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /apply/i })).toHaveCount(0);

    const taskDatesAfterPreview = await getAdminClient()
      .from("schedule_tasks")
      .select("start_date,finish_date,forecast_start_date,forecast_finish_date,duration_days,percent_complete,status,constraint_type,constraint_date,is_milestone")
      .eq("id", taskId)
      .single();
    if (taskDatesAfterPreview.error) throw new Error(taskDatesAfterPreview.error.message);
    expect(taskDatesAfterPreview.data).toEqual(taskDatesBeforePreview.data);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, "schedule-project-capacity-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(projectResourceLoad).toBeVisible();
    await expect(page.getByText(/Preview only\. No schedule dates were changed/i)).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "schedule-project-capacity-mobile.png"), fullPage: true });

    const revisionResponse = await page.request.post(
      `/api/projects/${PROJECT_ID}/scheduling/revisions`,
      { data: {} },
    );
    expect(revisionResponse.status()).toBe(201);
    const revisionBody = await revisionResponse.json() as {
      data: { id: string; resource_capacity_context_provenance: string } | Array<{
        id: string;
        resource_capacity_context_provenance: string;
      }>;
    };
    const revision = Array.isArray(revisionBody.data) ? revisionBody.data[0] : revisionBody.data;
    revisionId = revision.id;
    expect(revision.resource_capacity_context_provenance).toBe("captured");

    const admin = getAdminClient();
    const { data: capacitySnapshot, error: snapshotError } = await admin
      .from("schedule_revision_resource_capacity_snapshots")
      .select("profile_configured,weekday_overrides,dated_exceptions")
      .eq("revision_id", revisionId)
      .eq("resource_source_id", selectedResourceId)
      .single();
    if (snapshotError) throw new Error(snapshotError.message);
    expect(capacitySnapshot.profile_configured).toBe(true);
    expect(capacitySnapshot.weekday_overrides).toEqual([{ weekday: 1, capacity_percent: 50 }]);
    expect(capacitySnapshot.dated_exceptions).toEqual([{
      date: "2026-07-28",
      capacity_percent: 0,
      reason: "E2E project exception",
    }]);

    const { error: mutationError } = await admin
      .from("schedule_revision_resource_capacity_snapshots")
      .update({ profile_configured: false })
      .eq("revision_id", revisionId)
      .eq("resource_source_id", selectedResourceId);
    expect(mutationError?.code).toBe("42501");
  });
});
