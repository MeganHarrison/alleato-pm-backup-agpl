"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type {
  DrawingArea,
  DrawingAreaWithCount,
  DrawingAreaFormData,
} from "@/types/drawings.types";

/**
 * React Query hook for fetching drawing areas
 */
export function useDrawingAreas(projectId: string) {
  return useQuery<DrawingAreaWithCount[]>({
    queryKey: ["drawing-areas", projectId],
    queryFn: ({ signal }) =>
      apiFetch<DrawingAreaWithCount[]>(
        `/api/projects/${projectId}/drawings/areas`,
        { signal },
      ),
    enabled: !!projectId,
  });
}

/**
 * React Query hook for fetching a single drawing area
 */
export function useDrawingArea(projectId: string, areaId: string) {
  return useQuery<DrawingArea>({
    queryKey: ["drawing-area", projectId, areaId],
    queryFn: ({ signal }) =>
      apiFetch<DrawingArea>(
        `/api/projects/${projectId}/drawings/areas/${areaId}`,
        { signal },
      ),
    enabled: !!areaId,
  });
}

/**
 * React Query mutation for creating a drawing area
 */
export function useCreateDrawingArea(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DrawingAreaFormData) =>
      apiFetch<DrawingArea>(
        `/api/projects/${projectId}/drawings/areas`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["drawing-areas", projectId],
      });
      toast.success("Drawing area created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create drawing area", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for updating a drawing area
 */
export function useUpdateDrawingArea(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      areaId,
      data,
    }: {
      areaId: string;
      data: Partial<DrawingAreaFormData>;
    }) =>
      apiFetch<DrawingArea>(
        `/api/projects/${projectId}/drawings/areas/${areaId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["drawing-areas", projectId],
      });
      toast.success("Drawing area updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update drawing area", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for deleting a drawing area
 */
export function useDeleteDrawingArea(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (areaId: string) =>
      apiFetch(
        `/api/projects/${projectId}/drawings/areas/${areaId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["drawing-areas", projectId],
      });
      toast.success("Drawing area deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete drawing area", {
        description: error.message,
      });
    },
  });
}
