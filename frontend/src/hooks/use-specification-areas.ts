"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { AreaWithSectionCount } from "@/types/specifications.types";
import type { SpecificationAreaFormData } from "@/lib/schemas/specification-schemas";

/**
 * React Query hook for fetching specification areas
 */
export function useSpecificationAreas(projectId: string) {
  return useQuery<AreaWithSectionCount[]>({
    queryKey: ["specification-areas", projectId],
    queryFn: async () =>
      apiFetch<AreaWithSectionCount[]>(
        `/api/projects/${projectId}/specifications/areas`,
      ),
    enabled: !!projectId,
  });
}

/**
 * React Query hook for fetching a single area
 */
export function useSpecificationArea(projectId: string, areaId: string) {
  return useQuery<AreaWithSectionCount>({
    queryKey: ["specification-area", projectId, areaId],
    queryFn: async () =>
      apiFetch<AreaWithSectionCount>(
        `/api/projects/${projectId}/specifications/areas/${areaId}`,
      ),
    enabled: !!projectId && !!areaId,
  });
}

/**
 * React Query mutation for creating an area
 */
export function useCreateArea(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SpecificationAreaFormData) =>
      apiFetch<AreaWithSectionCount[]>(
        `/api/projects/${projectId}/specifications/areas`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specification-areas", projectId],
      });
      toast.success("Area created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create area", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for updating an area
 */
export function useUpdateArea(projectId: string, areaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SpecificationAreaFormData) =>
      apiFetch<AreaWithSectionCount>(
        `/api/projects/${projectId}/specifications/areas/${areaId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specification-areas", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["specification-area", projectId, areaId],
      });
      toast.success("Area updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update area", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for deleting an area
 */
export function useDeleteArea(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (areaId: string) =>
      apiFetch(
        `/api/projects/${projectId}/specifications/areas/${areaId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specification-areas", projectId],
      });
      toast.success("Area deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete area", {
        description: error.message,
      });
    },
  });
}
