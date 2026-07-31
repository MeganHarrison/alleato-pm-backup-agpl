import { randomUUID } from "node:crypto";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import {
  addProjectMember,
  createProject,
  deleteProject,
  deleteProjectMembers,
  getAdminClient,
} from "../../helpers/db";

const FOREIGN_PROJECT_ID = 68;

type TaskRecord = {
  id: string;
  name: string;
  sort_order: number;
  start_date: string | null;
  finish_date: string | null;
  schedule_version?: number;
};

type DependencyRecord = {
  id: string;
  task_id: string;
  predecessor_task_id: string;
};

type CostResourceRecord = {
  id: string;
  person_id: string | null;
  resource_kind: "person" | "equipment" | "material";
  display_name: string;
  cost_version: number;
};

type CostAssignmentRecord = {
  id: string;
  task_id: string;
  resource_id: string;
  actual_cost: number | null;
  cost_version: number;
};

async function responseError(response: APIResponse) {
  return `${response.status()} ${await response.text()}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function aggregateErrorMessage(
  prefix: string,
  journeyError: unknown,
  cleanupErrors: Error[],
) {
  const details = [
    journeyError ? `journey: ${errorMessage(journeyError)}` : null,
    ...cleanupErrors.map((error) => `cleanup: ${error.message}`),
  ].filter(Boolean);
  return `${prefix}\n${details.join("\n")}`;
}

function assignmentExpectations(
  assignments: Array<{ id: string; person_id: string; cost_version: number }>,
) {
  return assignments.map(({ id, person_id, cost_version }) => ({
    id,
    person_id,
    cost_version,
  }));
}

test.describe("Authoritative scheduling release journey", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "tests/.auth/user.json" });

  test("keeps tasks, dependencies, ordering, resource costs, and auth boundaries transactional", async ({
    page,
    baseURL,
  }) => {
    test.skip(
      test.info().project.name === "debug",
      "This production-data journey runs once in the chromium project.",
    );
    test.setTimeout(300_000);
    const admin = getAdminClient();
    const suffix = randomUUID().slice(0, 8);
    let projectId: number | null = null;
    let tasksUrl = "";
    let resourcesUrl = "";
    const taskIds: string[] = [];
    const resourceIds: string[] = [];
    const assignments: Array<{ taskId: string; id: string; costVersion: number }> = [];
    let expectedPersonAssignments: Array<{
      id: string;
      person_id: string;
      cost_version: number;
    }> = [];
    const cleanupErrors: Error[] = [];

    const cleanupAttempt = async (
      label: string,
      operation: () => Promise<void>,
    ) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(
          new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`),
        );
      }
    };

    const createTask = async (
      name: string,
      startDate: string | null,
      finishDate: string | null,
      afterTaskId: string | null,
      parentTaskId: string | null = null,
    ) => {
      const response = await page.request.post(tasksUrl, {
        data: {
          name,
          parent_task_id: parentTaskId,
          start_date: startDate,
          finish_date: finishDate,
          duration_days: startDate && finishDate ? 2 : null,
          after_task_id: afterTaskId,
        },
      });
      expect(response.status(), await responseError(response)).toBe(201);
      const task = await response.json() as TaskRecord;
      taskIds.push(task.id);
      return task;
    };

    const readTask = async (taskId: string) => {
      const response = await page.request.get(`${tasksUrl}/${taskId}`);
      expect(response.ok(), await responseError(response)).toBeTruthy();
      return (await response.json() as { data: TaskRecord }).data;
    };

    const readGantt = async () => {
      const response = await page.request.get(`${tasksUrl}?view=gantt`);
      expect(response.ok(), await responseError(response)).toBeTruthy();
      return (await response.json() as {
        data: Array<
          TaskRecord & {
            duration_days: number | null;
            dependencies: Array<{
              predecessor_id: string;
              type: string;
              lag_days: number;
            }>;
          }
        >;
      }).data;
    };

    let journeyError: unknown;
    try {
      const profileResponse = await page.request.get("/api/users/me/profile");
      expect(profileResponse.ok(), await responseError(profileResponse)).toBeTruthy();
      const profile = (await profileResponse.json() as {
        profile: { id: string };
      }).profile;
      projectId = await createProject(`E2E authoritative schedule ${suffix}`);
      await addProjectMember(projectId, profile.id, "admin");
      tasksUrl = `/api/projects/${projectId}/scheduling/tasks`;
      resourcesUrl = `/api/projects/${projectId}/scheduling/resources`;

      const anchor = await createTask(
        `E2E authoritative anchor ${suffix}`,
        "2026-08-10",
        "2026-08-11",
        null,
      );
      const successor = await createTask(
        `E2E authoritative successor ${suffix}`,
        "2026-08-05",
        "2026-08-06",
        anchor.id,
      );
      const alternate = await createTask(
        `E2E authoritative alternate ${suffix}`,
        "2026-08-03",
        "2026-08-04",
        successor.id,
      );
      const unscheduled = await createTask(
        `E2E authoritative unscheduled ${suffix}`,
        null,
        null,
        alternate.id,
      );

      const gantt = await readGantt();
      expect(gantt.find((task) => task.id === unscheduled.id)).toMatchObject({
        start_date: null,
        finish_date: null,
        duration_days: null,
      });

      const dependencyResponse = await page.request.post(
        `${tasksUrl}/${successor.id}/dependencies`,
        {
          data: {
            predecessor_task_id: anchor.id,
            dependency_type: "finish_to_start",
            lag_days: 0,
          },
        },
      );
      expect(dependencyResponse.status(), await responseError(dependencyResponse)).toBe(201);
      const dependency = (await dependencyResponse.json() as { data: DependencyRecord }).data;
      expect(await readTask(successor.id)).toMatchObject({
        start_date: "2026-08-12",
        finish_date: "2026-08-13",
      });

      const beforeCycle = await readGantt();
      const cycleResponse = await page.request.post(
        `${tasksUrl}/${anchor.id}/dependencies`,
        {
          data: {
            predecessor_task_id: successor.id,
            dependency_type: "finish_to_start",
            lag_days: 0,
          },
        },
      );
      expect(cycleResponse.status()).toBe(400);
      const afterCycle = await readGantt();
      expect(afterCycle.find((task) => task.id === anchor.id)).toEqual(
        beforeCycle.find((task) => task.id === anchor.id),
      );
      expect(afterCycle.find((task) => task.id === successor.id)).toEqual(
        beforeCycle.find((task) => task.id === successor.id),
      );

      const reassignResponse = await page.request.patch(
        `${tasksUrl}/${successor.id}/dependencies?dependencyId=${dependency.id}`,
        {
          data: {
            predecessor_task_id: alternate.id,
            dependency_type: "start_to_start",
            lag_days: 1,
          },
        },
      );
      expect(reassignResponse.ok(), await responseError(reassignResponse)).toBeTruthy();
      expect((await reassignResponse.json() as { data: DependencyRecord }).data)
        .toMatchObject({ predecessor_task_id: alternate.id });
      expect(await readTask(successor.id)).toMatchObject({
        start_date: "2026-08-04",
        finish_date: "2026-08-05",
      });

      const editAlternateResponse = await page.request.put(`${tasksUrl}/${alternate.id}`, {
        data: {
          start_date: "2026-08-06",
          finish_date: "2026-08-07",
          duration_days: 2,
        },
      });
      expect(
        editAlternateResponse.ok(),
        await responseError(editAlternateResponse),
      ).toBeTruthy();
      expect(await readTask(successor.id)).toMatchObject({
        start_date: "2026-08-07",
        finish_date: "2026-08-10",
      });

      const dependencyStateBeforeConflict = (
        await readGantt()
      ).find((task) => task.id === successor.id);
      const rootOrderBeforeConflictResponse = await page.request.get(
        `${tasksUrl}?parent_task_id=null&limit=1000`,
      );
      const rootOrderBeforeConflict = (
        await rootOrderBeforeConflictResponse.json() as { data: TaskRecord[] }
      ).data.map((task) => ({
        id: task.id,
        sort_order: task.sort_order,
      }));
      const staleAnchorVersion = (await readTask(anchor.id)).schedule_version;
      expect(staleAnchorVersion).toBeDefined();
      const conflictWinnerName = `E2E conflict winner ${suffix}`;
      const currentWriteResponse = await page.request.put(
        `${tasksUrl}/${anchor.id}`,
        {
          data: {
            name: conflictWinnerName,
            expected_schedule_version: staleAnchorVersion,
          },
        },
      );
      expect(
        currentWriteResponse.ok(),
        await responseError(currentWriteResponse),
      ).toBeTruthy();
      const staleWriteResponse = await page.request.put(
        `${tasksUrl}/${anchor.id}`,
        {
          data: {
            name: `E2E stale writer ${suffix}`,
            expected_schedule_version: staleAnchorVersion,
          },
        },
      );
      expect(
        staleWriteResponse.status(),
        await responseError(staleWriteResponse),
      ).toBe(409);
      expect((await readTask(anchor.id)).name).toBe(conflictWinnerName);
      const dependencyStateAfterConflict = (
        await readGantt()
      ).find((task) => task.id === successor.id);
      expect(dependencyStateAfterConflict).toEqual(dependencyStateBeforeConflict);
      const rootOrderAfterConflictResponse = await page.request.get(
        `${tasksUrl}?parent_task_id=null&limit=1000`,
      );
      expect(
        (await rootOrderAfterConflictResponse.json() as { data: TaskRecord[] }).data
          .map((task) => ({ id: task.id, sort_order: task.sort_order })),
      ).toEqual(rootOrderBeforeConflict);

      const controllingDependencyResponse = await page.request.post(
        `${tasksUrl}/${successor.id}/dependencies`,
        {
          data: {
            predecessor_task_id: anchor.id,
            dependency_type: "finish_to_start",
            lag_days: 0,
          },
        },
      );
      expect(
        controllingDependencyResponse.status(),
        await responseError(controllingDependencyResponse),
      ).toBe(201);
      const controllingDependency = (
        await controllingDependencyResponse.json() as { data: DependencyRecord }
      ).data;
      expect(await readTask(successor.id)).toMatchObject({
        start_date: "2026-08-12",
        finish_date: "2026-08-13",
      });

      const deleteControllingDependencyResponse = await page.request.delete(
        `${tasksUrl}/${successor.id}/dependencies?dependencyId=${controllingDependency.id}`,
      );
      expect(
        deleteControllingDependencyResponse.ok(),
        await responseError(deleteControllingDependencyResponse),
      ).toBeTruthy();
      expect(await readTask(successor.id)).toMatchObject({
        start_date: "2026-08-07",
        finish_date: "2026-08-10",
      });

      const deleteDependencyResponse = await page.request.delete(
        `${tasksUrl}/${successor.id}/dependencies?dependencyId=${dependency.id}`,
      );
      expect(
        deleteDependencyResponse.ok(),
        await responseError(deleteDependencyResponse),
      ).toBeTruthy();

      const reorderResponse = await page.request.put(`${tasksUrl}/${alternate.id}`, {
        data: { target_index: 0 },
      });
      expect(reorderResponse.ok(), await responseError(reorderResponse)).toBeTruthy();
      const orderedResponse = await page.request.get(
        `${tasksUrl}?parent_task_id=null&limit=1000`,
      );
      expect(orderedResponse.ok(), await responseError(orderedResponse)).toBeTruthy();
      const orderedTasks = (await orderedResponse.json() as { data: TaskRecord[] }).data
        .filter((task) => taskIds.includes(task.id))
        .sort((left, right) => left.sort_order - right.sort_order);
      expect(orderedTasks[0]?.id).toBe(alternate.id);

      const anchorChild = await createTask(
        `E2E anchor child ${suffix}`,
        "2026-08-10",
        "2026-08-11",
        null,
        anchor.id,
      );
      await createTask(
        `E2E alternate child ${suffix}`,
        "2026-08-06",
        "2026-08-07",
        null,
        alternate.id,
      );
      const crossParentMoveResponse = await page.request.put(
        `${tasksUrl}/${anchorChild.id}`,
        {
          data: {
            parent_task_id: alternate.id,
            target_index: 0,
          },
        },
      );
      expect(
        crossParentMoveResponse.ok(),
        await responseError(crossParentMoveResponse),
      ).toBeTruthy();
      const alternateChildrenResponse = await page.request.get(
        `${tasksUrl}?parent_task_id=${alternate.id}&limit=1000`,
      );
      expect(
        alternateChildrenResponse.ok(),
        await responseError(alternateChildrenResponse),
      ).toBeTruthy();
      expect(
        (await alternateChildrenResponse.json() as { data: TaskRecord[] }).data
          .sort((left, right) => left.sort_order - right.sort_order)[0]?.id,
      ).toBe(anchorChild.id);

      const foreignProjectResponse = await page.request.put(
        `/api/projects/${FOREIGN_PROJECT_ID}/scheduling/tasks/${anchor.id}`,
        { data: { name: "Cross-project mutation must fail" } },
      );
      expect([403, 404]).toContain(foreignProjectResponse.status());
      const anchorReadback = await page.request.get(`${tasksUrl}/${anchor.id}`);
      expect(anchorReadback.ok(), await responseError(anchorReadback)).toBeTruthy();
      expect((await anchorReadback.json() as { data: TaskRecord }).data.name)
        .toBe(conflictWinnerName);

      const createCostResource = async (
        kind: "equipment" | "material",
        displayName: string,
        standardRate: number,
        costPerUse: number | null,
      ) => {
        const response = await page.request.post(`${resourcesUrl}?operation=cost-resource`, {
          data: {
            id: null,
            resource_kind: kind,
            display_name: displayName,
            standard_rate: standardRate,
            cost_per_use: costPerUse,
            rate_unit: kind === "equipment" ? "day" : "unit",
            expected_cost_version: null,
          },
        });
        expect(response.status(), await responseError(response)).toBe(201);
        const resource = (await response.json() as { data: CostResourceRecord }).data;
        resourceIds.push(resource.id);
        return resource;
      };

      const equipment = await createCostResource(
        "equipment",
        `E2E crane ${suffix}`,
        900,
        250,
      );
      const material = await createCostResource(
        "material",
        `E2E steel ${suffix}`,
        125,
        null,
      );

      const rosterResponse = await page.request.get(resourcesUrl);
      expect(rosterResponse.ok(), await responseError(rosterResponse)).toBeTruthy();
      const roster = await rosterResponse.json() as {
        candidates: Array<{
          person_id: string;
          resource_id: string | null;
          display_name: string;
        }>;
      };
      const person = roster.candidates[0];
      expect(
        person,
        "The isolated project must expose its authenticated member as a resource candidate.",
      ).toBeDefined();
      if (!person) throw new Error("No project person resource candidate is available.");
      const personId = person.person_id;
      const personAssignmentResponse = await page.request.put(
        `${tasksUrl}/${anchor.id}/assignments`,
        {
          data: {
            assignments: [{ person_id: personId, allocation_percent: 50 }],
            expected_assignments: [],
          },
        },
      );
      expect(
        personAssignmentResponse.ok(),
        await responseError(personAssignmentResponse),
      ).toBeTruthy();
      expectedPersonAssignments = assignmentExpectations((await personAssignmentResponse.json() as {
        data: Array<{ id: string; person_id: string; cost_version: number }>;
      }).data);

      const costModelResponse = await page.request.get(`${resourcesUrl}?view=cost`);
      expect(costModelResponse.ok(), await responseError(costModelResponse)).toBeTruthy();
      const initialCostModel = await costModelResponse.json() as {
        resources: CostResourceRecord[];
      };
      const personResource = initialCostModel.resources.find(
        (resource) => resource.person_id === personId,
      );
      expect(personResource).toBeDefined();
      if (!personResource) throw new Error("Person assignment did not create its project cost resource.");
      expect(initialCostModel.resources).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: equipment.id, resource_kind: "equipment" }),
        expect.objectContaining({ id: material.id, resource_kind: "material" }),
        expect.objectContaining({
          id: personResource.id,
          person_id: personId,
          resource_kind: "person",
        }),
      ]));
      const ratePersonResponse = await page.request.put(
        `${resourcesUrl}?view=cost-resource`,
        {
          data: {
            id: personResource.id,
            resource_kind: "person",
            display_name: person.display_name,
            standard_rate: 75,
            cost_per_use: null,
            rate_unit: "hour",
            expected_cost_version: personResource.cost_version,
          },
        },
      );
      expect(ratePersonResponse.ok(), await responseError(ratePersonResponse)).toBeTruthy();
      const personCostAssignmentResponse = await page.request.post(
        `${tasksUrl}/${anchor.id}/assignments`,
        {
          data: {
            resource_id: personResource.id,
            allocation_percent: 50,
            planned_units: 8,
            actual_units: 4,
            actual_rate: 75,
            actual_cost: null,
            expected_cost_version: expectedPersonAssignments[0]?.cost_version,
          },
        },
      );
      expect(
        personCostAssignmentResponse.ok(),
        await responseError(personCostAssignmentResponse),
      ).toBeTruthy();
      const personCostAssignment = (await personCostAssignmentResponse.json() as {
        data: CostAssignmentRecord;
      }).data;
      expectedPersonAssignments = expectedPersonAssignments.map((assignment) =>
        assignment.id === personCostAssignment.id
          ? { ...assignment, cost_version: personCostAssignment.cost_version }
          : assignment,
      );

      const createCostAssignment = async (
        resourceId: string,
        plannedUnits: number,
        actualUnits: number,
        actualRate: number,
        actualCost: number | null,
      ) => {
        const response = await page.request.post(
          `${tasksUrl}/${anchor.id}/assignments`,
          {
            data: {
              resource_id: resourceId,
              allocation_percent: 100,
              planned_units: plannedUnits,
              actual_units: actualUnits,
              actual_rate: actualRate,
              actual_cost: actualCost,
              expected_cost_version: null,
            },
          },
        );
        expect(response.status(), await responseError(response)).toBe(201);
        const assignment = (await response.json() as { data: CostAssignmentRecord }).data;
        assignments.push({
          taskId: assignment.task_id,
          id: assignment.id,
          costVersion: assignment.cost_version,
        });
        return assignment;
      };

      const equipmentAssignment = await createCostAssignment(
        equipment.id,
        2,
        1,
        900,
        1_150,
      );
      const materialAssignment = await createCostAssignment(
        material.id,
        10,
        4,
        125,
        null,
      );

      const updateAssignmentResponse = await page.request.post(
        `${tasksUrl}/${anchor.id}/assignments`,
        {
          data: {
            resource_id: equipment.id,
            allocation_percent: 100,
            planned_units: 2,
            actual_units: 1,
            actual_rate: 900,
            actual_cost: 1_200,
            expected_cost_version: equipmentAssignment.cost_version,
          },
        },
      );
      expect(
        updateAssignmentResponse.ok(),
        await responseError(updateAssignmentResponse),
      ).toBeTruthy();
      const updatedAssignment = (await updateAssignmentResponse.json() as {
        data: CostAssignmentRecord;
      }).data;
      assignments[0].costVersion = updatedAssignment.cost_version;

      const staleAssignmentResponse = await page.request.post(
        `${tasksUrl}/${anchor.id}/assignments`,
        {
          data: {
            resource_id: equipment.id,
            allocation_percent: 100,
            planned_units: 2,
            actual_units: 1,
            actual_rate: 900,
            actual_cost: 9_999,
            expected_cost_version: equipmentAssignment.cost_version,
          },
        },
      );
      expect(staleAssignmentResponse.status()).toBe(409);

      const costReadbackResponse = await page.request.get(`${resourcesUrl}?view=cost`);
      const costReadback = await costReadbackResponse.json() as {
        assignments: CostAssignmentRecord[];
      };
      expect(costReadback.assignments.find((item) => item.id === equipmentAssignment.id))
        .toMatchObject({ actual_cost: 1_200 });
      expect(costReadback.assignments.find((item) => item.id === materialAssignment.id))
        .toMatchObject({
          resource_id: material.id,
          actual_cost: null,
        });

      const renderedDependencyResponse = await page.request.post(
        `${tasksUrl}/${successor.id}/dependencies`,
        {
          data: {
            predecessor_task_id: alternate.id,
            dependency_type: "start_to_start",
            lag_days: 1,
          },
        },
      );
      expect(
        renderedDependencyResponse.status(),
        await responseError(renderedDependencyResponse),
      ).toBe(201);

      await page.goto(`/${projectId}/schedule`);
      await expect(
        page.getByRole("button", { name: unscheduled.name, exact: true }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: unscheduled.name, exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Unscheduled").last()).toBeVisible();
      await expect(
        page.getByRole("button", { name: successor.name, exact: true }),
      ).toHaveCount(2);
      await expect(
        page.getByTestId(`gantt-dependency-${alternate.id}-${successor.id}`),
      ).toBeVisible();

      await page
        .getByRole("button", { name: conflictWinnerName, exact: true })
        .first()
        .click();
      const editDialog = page.getByRole("dialog", { name: "Edit Task" });
      await expect(editDialog).toBeVisible();
      await expect(editDialog.getByLabel("Task Name")).toHaveValue(conflictWinnerName);

      const uiCapturedVersion = (await readTask(anchor.id)).schedule_version;
      if (typeof uiCapturedVersion !== "number") {
        throw new Error("UI stale-edit fixture has no schedule version.");
      }
      const uiConflictWinnerName = `E2E UI conflict winner ${suffix}`;
      const competingUiWriteResponse = await page.request.put(
        `${tasksUrl}/${anchor.id}`,
        {
          data: {
            name: uiConflictWinnerName,
            expected_schedule_version: uiCapturedVersion,
          },
        },
      );
      expect(
        competingUiWriteResponse.ok(),
        await responseError(competingUiWriteResponse),
      ).toBeTruthy();

      await editDialog
        .getByLabel("Task Name")
        .fill(`E2E UI stale writer ${suffix}`);
      await editDialog.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText(/schedule task version conflict/i)).toBeVisible();
      await expect(editDialog).toBeHidden();
      expect((await readTask(anchor.id)).name).toBe(uiConflictWinnerName);
      await expect(
        page.getByRole("button", { name: uiConflictWinnerName, exact: true }).first(),
      ).toBeVisible();

      await page.goto(`/${projectId}/schedule?workspace=planning`);
      const costPanel = page.getByRole("region", {
        name: "Cost and earned value",
      });
      await expect(costPanel.getByText(equipment.display_name).first()).toBeVisible();
      await expect(costPanel.getByText(material.display_name).first()).toBeVisible();
      const statusDateInput = costPanel.getByRole("textbox", { name: "Status date" });
      await statusDateInput.fill("07/29/2026");
      await expect(statusDateInput).toHaveValue("07/29/2026");
      await expect(costPanel.getByText("BAC", { exact: true }).locator(".."))
        .toContainText("$3,900");
      await expect(costPanel.getByText("PV", { exact: true }).locator(".."))
        .toContainText("$0");
      await expect(costPanel.getByText("EV", { exact: true }).locator(".."))
        .toContainText("$0");
      await expect(costPanel.getByText("AC", { exact: true }).locator(".."))
        .toContainText("$2,000");
      await expect(costPanel.getByText("CV", { exact: true }).locator(".."))
        .toContainText("-$2,000");
      await expect(costPanel.getByText("SV", { exact: true }).locator(".."))
        .toContainText("$0");
      await expect(costPanel.getByText("CPI", { exact: true }).locator(".."))
        .toContainText("0.000");
      await expect(costPanel.getByText("SPI", { exact: true }).locator(".."))
        .toContainText("Unavailable");
      await expect(costPanel.getByText("Incomplete cost facts")).toHaveCount(0);

      const clearPersonResponse = await page.request.put(
        `${tasksUrl}/${anchor.id}/assignments`,
        {
          data: {
            assignments: [],
            expected_assignments: expectedPersonAssignments,
          },
        },
      );
      expect(
        clearPersonResponse.ok(),
        await responseError(clearPersonResponse),
      ).toBeTruthy();
      expectedPersonAssignments = [];

      const restorePersonResponse = await page.request.put(
        `${tasksUrl}/${anchor.id}/assignments`,
        {
          data: {
            assignments: [{ person_id: personId, allocation_percent: 50 }],
            expected_assignments: [],
          },
        },
      );
      expect(
        restorePersonResponse.ok(),
        await responseError(restorePersonResponse),
      ).toBeTruthy();
      expectedPersonAssignments = assignmentExpectations((await restorePersonResponse.json() as {
        data: Array<{ id: string; person_id: string; cost_version: number }>;
      }).data);
      await page.reload();
      await expect(costPanel.getByText(person.display_name).first()).toBeVisible();
      await expect(costPanel.getByText("Incomplete cost facts")).toBeVisible();
      await expect(costPanel.getByText(/needs planned hour for/i).first()).toBeVisible();

      const anonymous = await playwrightRequest.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
      });
      try {
        const anonymousResponse = await anonymous.get(tasksUrl);
        expect(anonymousResponse.status()).toBe(401);
        expect(await anonymousResponse.json()).toMatchObject({
          error_code: "AUTH_EXPIRED",
        });
      } finally {
        await anonymous.dispose();
      }
      const sessionCookie = (await page.context().cookies()).find((cookie) =>
        cookie.name.endsWith("-auth-token"),
      );
      expect(sessionCookie).toBeDefined();
      if (!sessionCookie) throw new Error("Authenticated browser has no Supabase session cookie.");
      const invalidSession = await playwrightRequest.newContext({
        baseURL,
        storageState: {
          cookies: [{
            ...sessionCookie,
            value: "base64-W10=",
            expires: Math.floor(Date.now() / 1000) + 3600,
          }],
          origins: [],
        },
      });
      try {
        const invalidSessionMutation = await invalidSession.put(
          `${tasksUrl}/${anchor.id}`,
          { data: { name: "Expired session mutation must fail" } },
        );
        expect(invalidSessionMutation.status()).toBe(401);
      } finally {
        await invalidSession.dispose();
      }
      expect((await readTask(anchor.id)).name).toBe(uiConflictWinnerName);
    } catch (error) {
      journeyError = error;
    } finally {
      if (expectedPersonAssignments.length > 0 && taskIds.length > 0) {
        await cleanupAttempt("clear person assignments", async () => {
          const response = await page.request.put(
            `${tasksUrl}/${taskIds[0]}/assignments`,
            {
              data: {
                assignments: [],
                expected_assignments: expectedPersonAssignments,
              },
            },
          );
          if (!response.ok()) throw new Error(await responseError(response));
        });
      }

      for (const assignment of assignments.reverse()) {
        await cleanupAttempt(`delete cost assignment ${assignment.id}`, async () => {
          const response = await page.request.delete(
            `${tasksUrl}/${assignment.taskId}/assignments`,
            {
              data: {
                assignment_id: assignment.id,
                expected_cost_version: assignment.costVersion,
              },
            },
          );
          if (!response.ok()) throw new Error(await responseError(response));
        });
      }

      for (const resourceId of resourceIds.reverse()) {
        await cleanupAttempt(`delete cost resource ${resourceId}`, async () => {
          const modelResponse = await page.request.get(`${resourcesUrl}?view=cost`);
          if (!modelResponse.ok()) throw new Error(await responseError(modelResponse));
          const model = await modelResponse.json() as { resources: CostResourceRecord[] };
          const resource = model.resources.find((item) => item.id === resourceId);
          if (!resource) return;
          const response = await page.request.delete(resourcesUrl, {
            data: {
              resource_id: resource.id,
              expected_cost_version: resource.cost_version,
            },
          });
          if (!response.ok()) throw new Error(await responseError(response));
        });
      }
      if (projectId !== null) {
        await cleanupAttempt("delete isolated person schedule resources", async () => {
          const { error } = await admin
            .from("schedule_resources")
            .delete()
            .eq("project_id", projectId)
            .eq("resource_kind", "person");
          if (error) throw new Error(error.message);
        });
      }

      for (const taskId of taskIds.reverse()) {
        await cleanupAttempt(`delete task ${taskId}`, async () => {
          const response = await page.request.delete(`${tasksUrl}/${taskId}`);
          if (!response.ok() && response.status() !== 404) {
            throw new Error(await responseError(response));
          }
        });
      }
      if (projectId !== null) {
        await cleanupAttempt("delete isolated project memberships", () =>
          deleteProjectMembers(projectId!),
        );
        await cleanupAttempt("delete isolated scheduling project", () =>
          deleteProject(projectId!),
        );
      }

    }
    if (journeyError && cleanupErrors.length > 0) {
      throw new AggregateError(
        [journeyError, ...cleanupErrors],
        aggregateErrorMessage(
          `Scheduling E2E failed and cleanup also failed in ${cleanupErrors.length} operation(s).`,
          journeyError,
          cleanupErrors,
        ),
      );
    }
    if (journeyError) throw journeyError;
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        aggregateErrorMessage(
          `Scheduling E2E cleanup failed in ${cleanupErrors.length} operation(s).`,
          null,
          cleanupErrors,
        ),
      );
    }
  });

  test("fans published trade alerts out once to eligible company users", async ({
    page,
    baseURL,
  }) => {
    test.skip(
      test.info().project.name === "debug",
      "This isolated production-data journey runs once in the chromium project.",
    );
    test.setTimeout(300_000);
    const {
      addProjectMember,
      createProject,
      deleteProject,
      deleteProjectMembers,
      getAdminClient,
    } = await import("../../helpers/db");
    const admin = getAdminClient();
    const cleanupErrors: Error[] = [];
    const syntheticAuthUserIds: string[] = [];
    const syntheticPersonIds: string[] = [];
    const syntheticCompanyIds: string[] = [];
    let journeyError: unknown;
    let projectId: number | null = null;

    const cleanupAttempt = async (
      label: string,
      operation: () => Promise<void>,
    ) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(
          new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`),
        );
      }
    };

    try {
      const profileResponse = await page.request.get("/api/users/me/profile");
      expect(profileResponse.ok(), await responseError(profileResponse)).toBeTruthy();
      const profile = (await profileResponse.json() as {
        profile: { id: string };
      }).profile;
      const syntheticSuffix = randomUUID().slice(0, 8);
      const { data: companies, error: companiesError } = await admin
        .from("companies")
        .insert([
          { name: `E2E alert trade ${syntheticSuffix}` },
          { name: `E2E unrelated trade ${syntheticSuffix}` },
        ])
        .select("id")
        .order("id");
      if (companiesError || !companies || companies.length !== 2) {
        throw new Error(
          `Unable to create isolated alert companies: ${companiesError?.message ?? "unexpected row count"}`,
        );
      }
      syntheticCompanyIds.push(...companies.map((company) => company.id));

      const syntheticPeople: Array<{
        id: string;
        auth_user_id: string;
        company_id: string;
      }> = [];
      for (let index = 0; index < 4; index += 1) {
        const email = `schedule-alert-${syntheticSuffix}-${index}@example.com`;
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email,
          password: `E2E-${randomUUID()}-aA1!`,
          email_confirm: true,
        });
        if (authError || !authData.user) {
          throw new Error(
            `Unable to create isolated alert user ${index}: ${authError?.message ?? "missing user"}`,
          );
        }
        syntheticAuthUserIds.push(authData.user.id);
        const companyId = index < 3 ? companies[0].id : companies[1].id;
        const { data: existingPerson, error: personLookupError } = await admin
          .from("people")
          .select("id")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();
        if (personLookupError) throw new Error(personLookupError.message);
        const personMutation = {
          auth_user_id: authData.user.id,
          company_id: companyId,
          company: index < 3
            ? `E2E alert trade ${syntheticSuffix}`
            : `E2E unrelated trade ${syntheticSuffix}`,
          email,
          first_name: "Schedule",
          last_name: `Recipient ${index}`,
          person_type: "employee",
          status: "active",
        };
        const personResult = existingPerson
          ? await admin
            .from("people")
            .update(personMutation)
            .eq("id", existingPerson.id)
            .select("id,auth_user_id,company_id")
            .single()
          : await admin
            .from("people")
            .insert(personMutation)
            .select("id,auth_user_id,company_id")
            .single();
        if (personResult.error || !personResult.data?.auth_user_id) {
          throw new Error(
            `Unable to create isolated alert person ${index}: ${personResult.error?.message ?? "missing person"}`,
          );
        }
        syntheticPersonIds.push(personResult.data.id);
        syntheticPeople.push({
          id: personResult.data.id,
          auth_user_id: personResult.data.auth_user_id,
          company_id: personResult.data.company_id!,
        });
      }
      const activeCompanyRecipients = syntheticPeople.slice(0, 2);
      const inactiveCompanyExclusion = syntheticPeople[2];
      const differentCompanyExclusion = syntheticPeople[3];

      projectId = await createProject(`E2E schedule alerts ${randomUUID().slice(0, 8)}`);
      await addProjectMember(projectId, profile.id, "admin");
      const { error: recipientMembershipError } = await admin
        .from("project_directory_memberships")
        .insert([
          ...activeCompanyRecipients.map((person) => ({
            project_id: projectId!,
            person_id: person.id,
            role: "editor",
            user_type: "employee",
            status: "active",
          })),
          {
            project_id: projectId,
            person_id: inactiveCompanyExclusion.id,
            role: "editor",
            user_type: "employee",
            status: "inactive",
          },
          {
            project_id: projectId,
            person_id: differentCompanyExclusion.id,
            role: "editor",
            user_type: "employee",
            status: "active",
          },
        ]);
      if (recipientMembershipError) throw new Error(recipientMembershipError.message);

      const isolatedTasksUrl = `/api/projects/${projectId}/scheduling/tasks`;
      const taskResponse = await page.request.post(isolatedTasksUrl, {
        data: {
          name: "E2E published trade activity",
          start_date: "2026-08-03",
          finish_date: "2026-08-04",
          duration_days: 2,
          parent_task_id: null,
          after_task_id: null,
        },
      });
      expect(taskResponse.status(), await responseError(taskResponse)).toBe(201);
      const sourceTask = await taskResponse.json() as TaskRecord;

      const assignResponse = await page.request.put(
        `${isolatedTasksUrl}/${sourceTask.id}`,
        { data: { assignee_person_id: activeCompanyRecipients[0].id } },
      );
      expect(assignResponse.ok(), await responseError(assignResponse)).toBeTruthy();

      const createRevision = async () => {
        const response = await page.request.post(
          `/api/projects/${projectId}/scheduling/revisions`,
          { data: {} },
        );
        expect(response.status(), await responseError(response)).toBe(201);
        return (await response.json() as { data: { id: string } }).data;
      };
      const transitionRevision = async (
        revisionId: string,
        status: "review" | "published",
      ) => {
        const response = await page.request.post(
          `/api/projects/${projectId}/scheduling/actions`,
          {
            data: {
              entity_type: "revision",
              action: "transition",
              entity_id: revisionId,
              payload: { status },
            },
          },
        );
        expect(response.ok(), await responseError(response)).toBeTruthy();
      };

      const firstRevision = await createRevision();
      await transitionRevision(firstRevision.id, "review");
      await transitionRevision(firstRevision.id, "published");

      const updateResponse = await page.request.put(
        `${isolatedTasksUrl}/${sourceTask.id}`,
        {
          data: {
            start_date: "2026-08-05",
            finish_date: "2026-08-06",
            duration_days: 2,
          },
        },
      );
      expect(updateResponse.ok(), await responseError(updateResponse)).toBeTruthy();

      const secondRevision = await createRevision();
      await transitionRevision(secondRevision.id, "review");
      await transitionRevision(secondRevision.id, "published");

      const { data: deliveries, error: deliveryError } = await admin
        .from("schedule_alert_deliveries")
        .select("recipient_user_id,change_kind,event_key")
        .eq("project_id", projectId)
        .eq("revision_id", secondRevision.id)
        .eq("source_task_id", sourceTask.id)
        .eq("change_kind", "date_changed")
        .order("recipient_user_id");
      if (deliveryError) throw new Error(deliveryError.message);
      expect(deliveries).toHaveLength(2);
      expect(deliveries?.map((delivery) => delivery.recipient_user_id).sort()).toEqual(
        activeCompanyRecipients.map((person) => person.auth_user_id).sort(),
      );
      expect(deliveries).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          recipient_user_id: inactiveCompanyExclusion.auth_user_id,
        }),
      ]));
      expect(deliveries).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          recipient_user_id: differentCompanyExclusion.auth_user_id,
        }),
      ]));

      const replayResponse = await page.request.post(
        `/api/projects/${projectId}/scheduling/trade-alerts`,
        {
          data: {
            revisionId: secondRevision.id,
            sourceTaskId: sourceTask.id,
            changeKind: "date_changed",
            title: "Replay must remain idempotent",
            body: "No duplicate notification should be created.",
          },
        },
      );
      expect(replayResponse.ok(), await responseError(replayResponse)).toBeTruthy();
      expect(await replayResponse.json()).toMatchObject({
        delivered: false,
        duplicate: true,
      });
      const { count: replayCount, error: replayCountError } = await admin
        .from("schedule_alert_deliveries")
        .select("event_key", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("revision_id", secondRevision.id)
        .eq("source_task_id", sourceTask.id)
        .eq("change_kind", "date_changed");
      if (replayCountError) throw new Error(replayCountError.message);
      expect(replayCount).toBe(2);

      const anonymous = await playwrightRequest.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
      });
      try {
        const unauthorizedMutation = await anonymous.put(
          `/api/projects/${projectId}/scheduling/tasks/${sourceTask.id}`,
          { data: { name: "Anonymous mutation must fail" } },
        );
        expect(unauthorizedMutation.status()).toBe(401);
      } finally {
        await anonymous.dispose();
      }
      const sourceReadback = await page.request.get(
        `${isolatedTasksUrl}/${sourceTask.id}`,
      );
      expect(sourceReadback.ok(), await responseError(sourceReadback)).toBeTruthy();
      expect((await sourceReadback.json() as { data: TaskRecord }).data.name)
        .toBe("E2E published trade activity");
    } catch (error) {
      journeyError = error;
    } finally {
      if (projectId !== null) {
        await cleanupAttempt("delete alert deliveries", async () => {
          const { error } = await admin
            .from("schedule_alert_deliveries")
            .delete()
            .eq("project_id", projectId);
          if (error) throw new Error(error.message);
        });
        await cleanupAttempt("delete alert notifications", async () => {
          const { error } = await admin
            .from("collaboration_notifications")
            .delete()
            .eq("project_id", projectId);
          if (error) throw new Error(error.message);
        });
        await cleanupAttempt("delete project memberships", () =>
          deleteProjectMembers(projectId!),
        );
        await cleanupAttempt("delete isolated scheduling project", () =>
          deleteProject(projectId!),
        );
      }
      if (syntheticPersonIds.length > 0) {
        await cleanupAttempt("delete isolated alert people", async () => {
          const { error } = await admin
            .from("people")
            .delete()
            .in("id", syntheticPersonIds);
          if (error) throw new Error(error.message);
        });
      }
      for (const userId of syntheticAuthUserIds.reverse()) {
        await cleanupAttempt(`delete isolated alert auth user ${userId}`, async () => {
          const { error } = await admin.auth.admin.deleteUser(userId);
          if (error) throw new Error(error.message);
        });
      }
      if (syntheticCompanyIds.length > 0) {
        await cleanupAttempt("delete isolated alert companies", async () => {
          const { error } = await admin
            .from("companies")
            .delete()
            .in("id", syntheticCompanyIds);
          if (error) throw new Error(error.message);
        });
      }
    }

    if (journeyError && cleanupErrors.length > 0) {
      throw new AggregateError(
        [journeyError, ...cleanupErrors],
        aggregateErrorMessage(
          `Alert E2E failed and cleanup also failed in ${cleanupErrors.length} operation(s).`,
          journeyError,
          cleanupErrors,
        ),
      );
    }
    if (journeyError) throw journeyError;
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        aggregateErrorMessage(
          `Alert E2E cleanup failed in ${cleanupErrors.length} operation(s).`,
          null,
          cleanupErrors,
        ),
      );
    }
  });
});
