"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { DrawingRevision } from "@/types/drawings.types";

/**
 * React Query hook for fetching drawing revisions
 */
export function useDrawingRevisions(projectId: string, drawingId: string) {
  return useQuery<DrawingRevision[]>({
    queryKey: ["drawing-revisions", projectId, drawingId],
    queryFn: async () =>
      apiFetch<DrawingRevision[]>(
        `/api/projects/${projectId}/drawings/${drawingId}/revisions`,
      ),
    enabled: !!drawingId,
  });
}

/**
 * React Query mutation for creating a new revision with file upload
 */
export function useCreateRevision(projectId: string, drawingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) =>
      apiFetch<DrawingRevision>(
        `/api/projects/${projectId}/drawings/${drawingId}/revisions`,
        {
          method: "POST",
          body: formData,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["drawing-revisions", drawingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["drawing", projectId, drawingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["drawings", projectId],
      });
      toast.success("Revision created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create revision", {
        description: error.message,
      });
    },
  });
}
