"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addPlaneCycleTasks,
  createPlaneCycle,
  deletePlaneCycle,
  listPlaneCycles,
  listPlaneCycleTasks,
  removePlaneCycleTasks,
  updatePlaneCycle,
} from "./api";
import type {
  CreatePlaneCycleInput,
  PlaneCycleMembershipInput,
  UpdatePlaneCycleInput,
} from "./types";

export const planeCycleKeys = {
  all: ["plane-cycles-domain"] as const,
  project: (projectId: number) =>
    [...planeCycleKeys.all, "project", projectId] as const,
  memberships: (projectId: number, cycleId: string) =>
    [...planeCycleKeys.project(projectId), "cycle", cycleId, "tasks"] as const,
};

export function usePlaneCycles(projectId: number) {
  return useQuery({
    queryKey: planeCycleKeys.project(projectId),
    queryFn: () => listPlaneCycles(projectId),
    enabled: Number.isInteger(projectId) && projectId > 0,
  });
}

export function usePlaneCycleTasks(projectId: number, cycleId: string) {
  return useQuery({
    queryKey: planeCycleKeys.memberships(projectId, cycleId),
    queryFn: () => listPlaneCycleTasks(projectId, cycleId),
    enabled: Number.isInteger(projectId) && projectId > 0 && !!cycleId,
  });
}

export function useCreatePlaneCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlaneCycleInput) => createPlaneCycle(input),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: planeCycleKeys.project(input.project_id),
      }),
  });
}

export function useUpdatePlaneCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlaneCycleInput) => updatePlaneCycle(input),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: planeCycleKeys.project(input.project_id),
      }),
  });
}

export function useDeletePlaneCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      cycleId,
    }: {
      projectId: number;
      cycleId: string;
    }) => deletePlaneCycle(projectId, cycleId),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: planeCycleKeys.project(input.projectId),
      }),
  });
}

function useCycleMembershipMutation(
  mutationFn: (input: PlaneCycleMembershipInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: planeCycleKeys.memberships(
          input.project_id,
          input.cycle_id,
        ),
      }),
  });
}

export function useAddPlaneCycleTasks() {
  return useCycleMembershipMutation(addPlaneCycleTasks);
}

export function useRemovePlaneCycleTasks() {
  return useCycleMembershipMutation(removePlaneCycleTasks);
}
