"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { PunchItemListResponse } from "@/services/PunchItemService";
import type { Database } from "@/types/database.types";

type PunchItemRow = Database["public"]["Tables"]["punch_items"]["Row"];

// =============================================================================
// Query Hooks
// =============================================================================

interface UsePunchItemsOptions {
  status?: string;
  priority?: string;
  assignee_id?: string;
  is_deleted?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export function usePunchItems(
  projectId: number,
  options: UsePunchItemsOptions = {},
) {
  return useQuery<PunchItemListResponse>({
    queryKey: ["punch-items", projectId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.priority) params.set("priority", options.priority);
      if (options.assignee_id) params.set("assignee_id", options.assignee_id);
      if (options.is_deleted !== undefined)
        params.set("is_deleted", String(options.is_deleted));
      if (options.search) params.set("search", options.search);
      if (options.page) params.set("page", String(options.page));
      if (options.page_size) params.set("page_size", String(options.page_size));

      return apiFetch<PunchItemListResponse>(
        `/api/projects/${projectId}/punch-items?${params.toString()}`,
      );
    },
    enabled: !!projectId,
  });
}

export function usePunchItem(projectId: number, punchItemId: string) {
  return useQuery<PunchItemRow>({
    queryKey: ["punch-item", projectId, punchItemId],
    queryFn: () =>
      apiFetch<PunchItemRow>(
        `/api/projects/${projectId}/punch-items/${punchItemId}`,
      ),
    enabled: !!projectId && !!punchItemId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

interface UseCreatePunchItemOptions {
  /**
   * Set to false when the create mutation is one step in a larger workflow
   * that owns the final user-facing success message.
   */
  showSuccessToast?: boolean;
}

export function useCreatePunchItem(
  projectId: number,
  options: UseCreatePunchItemOptions = {},
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: Partial<PunchItemRow> & { title: string }) =>
      apiFetch<PunchItemRow>(`/api/projects/${projectId}/punch-items`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["punch-items", projectId] });
      router.refresh();
      if (options.showSuccessToast !== false) {
        toast.success("Punch item created successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create punch item: ${error.message}`);
    },
  });
}

export function useUpdatePunchItem(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({
      punchItemId,
      data,
    }: {
      punchItemId: string;
      data: Partial<PunchItemRow>;
    }) =>
      apiFetch<PunchItemRow>(
        `/api/projects/${projectId}/punch-items/${punchItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["punch-items", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["punch-item", projectId, variables.punchItemId],
      });
      router.refresh();
      toast.success("Punch item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update punch item: ${error.message}`);
    },
  });
}

export function useDeletePunchItem(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (punchItemId: string) =>
      apiFetch(`/api/projects/${projectId}/punch-items/${punchItemId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["punch-items", projectId] });
      router.refresh();
      toast.success("Punch item moved to recycle bin");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete punch item: ${error.message}`);
    },
  });
}

export function useRestorePunchItem(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (punchItemId: string) =>
      apiFetch<PunchItemRow>(
        `/api/projects/${projectId}/punch-items/${punchItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_deleted: false }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["punch-items", projectId] });
      router.refresh();
      toast.success("Punch item restored");
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore punch item: ${error.message}`);
    },
  });
}
