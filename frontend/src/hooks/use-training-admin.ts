"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  TrainingAdminListResponse,
  TrainingAdminTableKey,
} from "@/features/training-admin/types";
import { apiFetch } from "@/lib/api-client";

const trainingAdminKeys = {
  all: ["training-admin"] as const,
  table: (tableKey: TrainingAdminTableKey) =>
    [...trainingAdminKeys.all, tableKey] as const,
};

export function useTrainingAdminTable(tableKey: TrainingAdminTableKey) {
  return useQuery({
    queryKey: trainingAdminKeys.table(tableKey),
    queryFn: () =>
      apiFetch<TrainingAdminListResponse>(
        `/api/admin/training-data/${tableKey}`,
      ),
  });
}

export function useCreateTrainingAdminRecord(
  tableKey: TrainingAdminTableKey,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(`/api/admin/training-data/${tableKey}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: trainingAdminKeys.table(tableKey),
      }),
  });
}

export function useUpdateTrainingAdminRecord(
  tableKey: TrainingAdminTableKey,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      payload,
    }: {
      recordId: string;
      payload: Record<string, unknown>;
    }) =>
      apiFetch(
        `/api/admin/training-data/${tableKey}/${encodeURIComponent(recordId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: trainingAdminKeys.table(tableKey),
      }),
  });
}

export function useDeleteTrainingAdminRecord(
  tableKey: TrainingAdminTableKey,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) =>
      apiFetch(
        `/api/admin/training-data/${tableKey}/${encodeURIComponent(recordId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: trainingAdminKeys.table(tableKey),
      }),
  });
}
