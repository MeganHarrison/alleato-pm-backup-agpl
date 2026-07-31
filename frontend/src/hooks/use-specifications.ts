"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type {
  SpecificationWithRevision,
  SpecificationWithAreas,
  SpecificationFilters,
  SpecificationListResponse,
} from "@/types/specifications.types";
import type {
  UploadSpecificationFormData,
  EditSpecificationFormData,
} from "@/lib/schemas/specification-schemas";

export interface ProjectSpecificationRevision {
  id: number;
  section_id: number;
  section_number: string;
  section_title: string;
  revision_number: number;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  notes: string | null;
}

interface ProjectSpecificationRevisionsResponse {
  revisions: ProjectSpecificationRevision[];
}

/**
 * React Query hook for fetching specifications list
 */
export function useSpecifications(
  projectId: string,
  filters?: SpecificationFilters,
) {
  return useQuery<SpecificationListResponse>({
    queryKey: ["specifications", projectId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.area_id) params.set("area_id", filters.area_id.toString());
      if (filters?.status) params.set("status", filters.status);
      if (filters?.uploaded_after)
        params.set("uploaded_after", filters.uploaded_after);
      if (filters?.uploaded_before)
        params.set("uploaded_before", filters.uploaded_before);
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.page_size)
        params.set("page_size", filters.page_size.toString());

      return apiFetch<SpecificationListResponse>(
        `/api/projects/${projectId}/specifications?${params.toString()}`,
      );
    },
    enabled: !!projectId,
  });
}

/**
 * React Query hook for fetching a single specification
 */
export function useSpecification(projectId: string, sectionId: string) {
  return useQuery<SpecificationWithAreas>({
    queryKey: ["specification", projectId, sectionId],
    queryFn: async () =>
      apiFetch<SpecificationWithAreas>(
        `/api/projects/${projectId}/specifications/${sectionId}`,
      ),
    enabled: !!projectId && !!sectionId,
  });
}

/**
 * React Query hook for fetching all revisions across a project.
 */
export function useProjectSpecificationRevisions(projectId: string) {
  return useQuery<ProjectSpecificationRevisionsResponse>({
    queryKey: ["project-specification-revisions", projectId],
    queryFn: async () =>
      apiFetch<ProjectSpecificationRevisionsResponse>(
        `/api/projects/${projectId}/specifications/revisions`,
      ),
    enabled: !!projectId,
  });
}

/**
 * React Query mutation for creating a specification
 */
export function useCreateSpecification(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UploadSpecificationFormData) => {
      const formData = new FormData();
      formData.append("specification_set_name", data.specification_set_name);
      if (data.specification_set_instructions) {
        formData.append("specification_set_instructions", data.specification_set_instructions);
      }
      formData.append("format", data.format);
      if (data.default_issue_date) formData.append("default_issue_date", data.default_issue_date);
      if (data.default_receive_date) formData.append("default_receive_date", data.default_receive_date);
      if (data.default_revision_instruction) {
        formData.append("default_revision_instruction", data.default_revision_instruction);
      }
      if (data.number_to_ignore) formData.append("number_to_ignore", data.number_to_ignore);
      formData.append("specifications_language", data.specifications_language);
      formData.append("file", data.file);
      if (data.area_ids)
        formData.append("area_ids", JSON.stringify(data.area_ids));
      if (data.subscriber_ids)
        formData.append("subscriber_ids", JSON.stringify(data.subscriber_ids));

      return apiFetch<SpecificationWithRevision>(
        `/api/projects/${projectId}/specifications`,
        {
          method: "POST",
          body: formData,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specifications", projectId],
      });
      toast.success("Specification created successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not create specification", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for updating a specification
 */
export function useUpdateSpecification(projectId: string, sectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EditSpecificationFormData) =>
      apiFetch<SpecificationWithAreas>(
        `/api/projects/${projectId}/specifications/${sectionId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specifications", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["specification", projectId, sectionId],
      });
      toast.success("Specification updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not update specification", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for deleting a specification
 */
export function useDeleteSpecification(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionId: string) =>
      apiFetch(
        `/api/projects/${projectId}/specifications/${sectionId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specifications", projectId],
      });
      toast.success("Specification deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not delete specification", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for archiving a specification (move to recycle bin).
 */
export function useArchiveSpecification(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (specification: SpecificationWithRevision) =>
      apiFetch<SpecificationWithAreas>(
        `/api/projects/${projectId}/specifications/${specification.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            section_number: specification.section_number,
            title: specification.title,
            description: specification.description ?? "",
            status: "archived",
          } satisfies EditSpecificationFormData),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["specifications", projectId],
      });
      toast.success("Moved to recycle bin");
    },
    onError: (error: Error) => {
      toast.error("Could not archive specification", {
        description: error.message,
      });
    },
  });
}

/**
 * React Query mutation for subscribing or unsubscribing the current user from a specification.
 */
export function useToggleSpecificationSubscription(projectId: string) {
  return useMutation({
    mutationFn: async ({
      sectionId,
      subscribe,
    }: {
      sectionId: number;
      subscribe: boolean;
    }) =>
      apiFetch<{ subscribed: boolean }>(
        `/api/projects/${projectId}/specifications/${sectionId}/subscribe`,
        {
          method: subscribe ? "POST" : "DELETE",
        },
      ),
    onSuccess: (_, variables) => {
      toast.success(
        variables.subscribe ? "Subscribed to revisions" : "Unsubscribed from revisions",
      );
    },
    onError: (error: Error) => {
      toast.error("Could not update subscription", {
        description: error.message,
      });
    },
  });
}
