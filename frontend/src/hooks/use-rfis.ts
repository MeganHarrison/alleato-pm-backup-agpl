"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import type { RFI } from "@/types/database-extensions";
import type { RfiFormValues } from "@/lib/schemas/rfi-schema";

// =============================================================================
// Query Hook
// =============================================================================

export function useRfis(projectId: number) {
  return useQuery<RFI[]>({
    queryKey: ["rfis", projectId],
    queryFn: async () => {
      const json = await apiFetch<RFI[] | { data: RFI[] }>(`/api/projects/${projectId}/rfis`);
      return Array.isArray(json) ? json : (json as { data: RFI[] }).data;
    },
    enabled: !!projectId,
  });
}

export function useRfi(projectId: number, rfiId: string) {
  return useQuery<RFI>({
    queryKey: ["rfi", rfiId],
    queryFn: () => apiFetch<RFI>(`/api/projects/${projectId}/rfis/${rfiId}`),
    enabled: !!projectId && !!rfiId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useCreateRfi(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: RfiFormValues & { status: string }) =>
      apiFetch<RFI>(`/api/projects/${projectId}/rfis`, {
        method: "POST",
        body: JSON.stringify({ ...data, project_id: projectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfis", projectId] });
      router.refresh();
      toast.success("RFI created successfully");
    },
    onError: (error: unknown) => {
      handleFormError(error, { entity: "RFI", action: "create" });
    },
  });
}

export function useUpdateRfi(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ rfiId, data }: { rfiId: string; data: Partial<RfiFormValues> & { status?: string } }) =>
      apiFetch<RFI & { _emailWarning?: string }>(`/api/projects/${projectId}/rfis/${rfiId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rfis", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["rfi", variables.rfiId],
      });
      router.refresh();
      toast.success("RFI updated successfully");
      // The update succeeded; if a close-notification email failed, surface it
      // as a non-blocking warning rather than a failure.
      if (data?._emailWarning) {
        toast.warning(data._emailWarning);
      }
    },
    onError: (error: unknown) => {
      handleFormError(error, { entity: "RFI", action: "update" });
    },
  });
}

export function useDeleteRfi(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (rfiId: string) =>
      apiFetch(`/api/projects/${projectId}/rfis/${rfiId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfis", projectId] });
      router.refresh();
      toast.success("RFI deleted successfully");
    },
    onError: (error: unknown) => {
      handleFormError(error, { entity: "RFI", action: "delete" });
    },
  });
}
