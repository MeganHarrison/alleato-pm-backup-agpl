"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { ProcurementLifecycleStatus } from "@/lib/procurement/api";

export type ProcurementSubmittal = {
  id: string;
  submittal_number: string;
  title: string;
  status: string;
  lead_time: number | null;
  required_on_site_date: string | null;
};

export type ProcurementScheduleTask = {
  id: string;
  name: string;
  start_date: string | null;
  finish_date: string | null;
  status: string | null;
};

export type ProcurementItem = {
  id: string;
  project_id: number;
  title: string;
  description: string | null;
  lifecycle_status: ProcurementLifecycleStatus;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
  procurement_item_submittal_links: Array<{ submittal_id: string; submittals: ProcurementSubmittal | null }>;
  procurement_item_schedule_task_links: Array<{ schedule_task_id: string; schedule_tasks: ProcurementScheduleTask | null }>;
};

export type ProcurementItemDetail = ProcurementItem & {
  procurement_item_events: Array<{
    id: string;
    event_type: string;
    payload: unknown;
    actor_user_id: string;
    created_at: string;
  }>;
};

export type ProcurementItemInput = {
  title: string;
  description?: string | null;
  lifecycle_status?: ProcurementLifecycleStatus;
  responsible_user_id?: string | null;
};

export const procurementKeys = {
  list: (projectId: number) => ["procurement", projectId, "list"] as const,
  detail: (projectId: number, procurementItemId: string) => ["procurement", projectId, "detail", procurementItemId] as const,
};

export function useProcurementItems(projectId: number) {
  return useQuery({
    queryKey: procurementKeys.list(projectId),
    queryFn: ({ signal }): Promise<{ data: ProcurementItem[] }> =>
      apiFetch(`/api/projects/${projectId}/procurement`, { signal }),
    enabled: Number.isInteger(projectId),
  });
}

export function useProcurementItem(projectId: number, procurementItemId: string) {
  return useQuery({
    queryKey: procurementKeys.detail(projectId, procurementItemId),
    queryFn: ({ signal }): Promise<{ data: ProcurementItemDetail }> =>
      apiFetch(`/api/projects/${projectId}/procurement/${procurementItemId}`, { signal }),
    enabled: Number.isInteger(projectId) && Boolean(procurementItemId),
  });
}

export function useCreateProcurementItem(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProcurementItemInput): Promise<{ data: ProcurementItem }> =>
      apiFetch(`/api/projects/${projectId}/procurement`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.list(projectId) }),
  });
}

export function useUpdateProcurementItem(projectId: number, procurementItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProcurementItemInput): Promise<{ data: ProcurementItem }> =>
      apiFetch(`/api/projects/${projectId}/procurement/${procurementItemId}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: procurementKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: procurementKeys.detail(projectId, procurementItemId) });
    },
  });
}

export function useLinkProcurementSubmittal(projectId: number, procurementItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submittalId: string) => apiFetch(
      `/api/projects/${projectId}/procurement/${procurementItemId}/submittals`,
      { method: "POST", body: JSON.stringify({ submittal_id: submittalId }) },
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.detail(projectId, procurementItemId) }),
  });
}

export function useLinkProcurementScheduleTask(projectId: number, procurementItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleTaskId: string) => apiFetch(
      `/api/projects/${projectId}/procurement/${procurementItemId}/schedule-tasks`,
      { method: "POST", body: JSON.stringify({ schedule_task_id: scheduleTaskId }) },
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.detail(projectId, procurementItemId) }),
  });
}

export function useUnlinkProcurementSubmittal(projectId: number, procurementItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submittalId: string) => apiFetch(
      `/api/projects/${projectId}/procurement/${procurementItemId}/submittals?submittalId=${encodeURIComponent(submittalId)}`,
      { method: "DELETE" },
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.detail(projectId, procurementItemId) }),
  });
}

export function useUnlinkProcurementScheduleTask(projectId: number, procurementItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleTaskId: string) => apiFetch(
      `/api/projects/${projectId}/procurement/${procurementItemId}/schedule-tasks?scheduleTaskId=${encodeURIComponent(scheduleTaskId)}`,
      { method: "DELETE" },
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: procurementKeys.detail(projectId, procurementItemId) }),
  });
}
