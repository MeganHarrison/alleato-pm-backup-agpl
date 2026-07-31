"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type {
  RevisionListResponse,
  RevisionWithUploader,
} from "@/types/specifications.types";
import type { AddRevisionFormData } from "@/lib/schemas/specification-schemas";

/**
 * React Query hook for fetching specification revisions
 */
export function useSpecificationRevisions(
  projectId: string,
  sectionId: string,
) {
  return useQuery<RevisionListResponse>({
    queryKey: ["specification-revisions", projectId, sectionId],
    queryFn: async () =>
      apiFetch<RevisionListResponse>(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions`,
      ),
    enabled: !!projectId && !!sectionId,
  });
}

/**
 * React Query hook for fetching a single revision
 */
export function useSpecificationRevision(
  projectId: string,
  sectionId: string,
  revisionId: string,
) {
  return useQuery<RevisionWithUploader>({
    queryKey: ["specification-revision", projectId, sectionId, revisionId],
    queryFn: async () =>
      apiFetch<RevisionWithUploader>(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions/${revisionId}`,
      ),
    enabled: !!projectId && !!sectionId && !!revisionId,
  });
}

/**
 * React Query mutation for adding a new revision
 */
export function useAddRevision(projectId: string, sectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddRevisionFormData) => {
      const formData = new FormData();
      formData.append("file", data.file);
      if (data.notes) formData.append("notes", data.notes);
      formData.append(
        "notify_subscribers",
        data.notify_subscribers ? "true" : "false",
      );

      return apiFetch<RevisionWithUploader>(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions`,
        {
          method: "POST",
          body: formData,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specification-revisions", projectId, sectionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["specification", projectId, sectionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["specifications", projectId],
      });
      toast.success("Revision added successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not add revision", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for setting current revision
 */
export function useSetCurrentRevision(projectId: string, sectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (revisionId: string) =>
      apiFetch<RevisionWithUploader>(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions/${revisionId}`,
        {
          method: "PATCH",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specification-revisions", projectId, sectionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["specification", projectId, sectionId],
      });
      toast.success("Current revision updated");
    },
    onError: (error: Error) => {
      toast.error("Could not set current revision", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for deleting a revision
 */
export function useDeleteRevision(projectId: string, sectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (revisionId: string) =>
      apiFetch(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions/${revisionId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specification-revisions", projectId, sectionId],
      });
      toast.success("Revision deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not delete revision", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query hook for getting revision download URL
 */
export function useRevisionDownloadUrl(
  projectId: string,
  sectionId: string,
  revisionId: string,
) {
  return useQuery<{ url: string }>({
    queryKey: [
      "revision-download-url",
      projectId,
      sectionId,
      revisionId,
    ],
    queryFn: async () =>
      apiFetch<{ url: string }>(
        `/api/projects/${projectId}/specifications/${sectionId}/revisions/${revisionId}/download`,
      ),
    enabled: !!projectId && !!sectionId && !!revisionId,
    staleTime: 5 * 60 * 1000, // 5 minutes (signed URL valid for 1 hour)
  });
}
