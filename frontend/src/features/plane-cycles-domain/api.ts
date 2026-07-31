import { apiFetch } from "@/lib/api-client";
import type {
  CreatePlaneCycleInput,
  PlaneCycle,
  PlaneCycleMembershipInput,
  PlaneCycleMembershipWithTask,
  UpdatePlaneCycleInput,
} from "./types";

const CYCLES_API = "/api/plane-cycles";
const MEMBERSHIPS_API = "/api/plane-cycles/memberships";

export async function listPlaneCycles(projectId: number) {
  return apiFetch<{ cycles: PlaneCycle[] }>(
    `${CYCLES_API}?projectId=${projectId}`,
  );
}

export async function createPlaneCycle(input: CreatePlaneCycleInput) {
  return apiFetch<{ cycle: PlaneCycle }>(CYCLES_API, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePlaneCycle(input: UpdatePlaneCycleInput) {
  return apiFetch<{ cycle: PlaneCycle }>(CYCLES_API, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deletePlaneCycle(projectId: number, cycleId: string) {
  return apiFetch<{ success: true }>(
    `${CYCLES_API}?projectId=${projectId}&cycleId=${cycleId}`,
    { method: "DELETE" },
  );
}

export async function listPlaneCycleTasks(
  projectId: number,
  cycleId: string,
) {
  return apiFetch<{ memberships: PlaneCycleMembershipWithTask[] }>(
    `${MEMBERSHIPS_API}?projectId=${projectId}&cycleId=${cycleId}`,
  );
}

export async function addPlaneCycleTasks(input: PlaneCycleMembershipInput) {
  return apiFetch<{ memberships: PlaneCycleMembershipWithTask[] }>(
    MEMBERSHIPS_API,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function removePlaneCycleTasks(input: PlaneCycleMembershipInput) {
  return apiFetch<{ removed: number }>(MEMBERSHIPS_API, {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
