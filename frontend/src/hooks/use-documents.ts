"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// =============================================================================
// Types
// =============================================================================

export interface ProjectDocument {
  id: number;
  project_id: number;
  folder: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  version: number | null;
  status: "Draft" | "Published" | "Superseded" | "Archived";
  category: string | null;
  document_type: string | null;
  is_private: boolean | null;
  source_system: string | null;
  source_drive_id: string | null;
  source_item_id: string | null;
  source_site_id: string | null;
  source_path: string | null;
  source_web_url: string | null;
  source_etag: string | null;
  source_last_modified_at: string | null;
  source_size: number | null;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  content_hash: string | null;
  workflow_target: string | null;
  division: string | null;
  trade: string | null;
  source_metadata: unknown;
  uploaded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface GlobalProjectDocument extends ProjectDocument {
  project_name: string | null;
  project_number: string | null;
}

export interface CreateDocumentInput {
  title: string;
  description?: string | null;
  folder?: string | null;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  content_type?: string | null;
  version?: number | null;
  status?: "Draft" | "Published" | "Superseded" | "Archived";
  category?: string | null;
  is_private?: boolean | null;
  uploaded_by?: string | null;
}

export type CreateDocumentPayload = CreateDocumentInput | FormData;

export interface UpdateDocumentInput {
  title?: string;
  description?: string | null;
  folder?: string | null;
  file_name?: string;
  file_url?: string;
  file_size?: number | null;
  content_type?: string | null;
  version?: number | null;
  status?: "Draft" | "Published" | "Superseded" | "Archived";
  category?: string | null;
  is_private?: boolean | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

// =============================================================================
// Query Keys
// =============================================================================

export const documentKeys = {
  all: (projectId: number) => ["documents", projectId] as const,
  list: (projectId: number, folder?: string) =>
    ["documents", projectId, "list", folder] as const,
  detail: (projectId: number, id: string) =>
    ["documents", projectId, "detail", id] as const,
  globalList: () => ["documents", "global", "list"] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

export function useDocuments(projectId: number, folder?: string) {
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  const queryString = params.toString();
  const url = `/api/projects/${projectId}/documents${queryString ? `?${queryString}` : ""}`;

  return useQuery<ProjectDocument[]>({
    queryKey: documentKeys.list(projectId, folder),
    queryFn: ({ signal }) => apiFetch<ProjectDocument[]>(url, { signal }),
    enabled: !!projectId,
  });
}

export function useDocument(projectId: number, documentId: string) {
  return useQuery<ProjectDocument>({
    queryKey: documentKeys.detail(projectId, documentId),
    queryFn: ({ signal }) =>
      apiFetch<ProjectDocument>(
        `/api/projects/${projectId}/documents/${documentId}`,
        { signal },
      ),
    enabled: !!projectId && !!documentId,
  });
}

export function useGlobalDocuments() {
  return useQuery<GlobalProjectDocument[]>({
    queryKey: documentKeys.globalList(),
    queryFn: ({ signal }) =>
      apiFetch<GlobalProjectDocument[]>("/api/project-documents", { signal }),
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useCreateDocument(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentPayload) => {
      const isFormData =
        typeof FormData !== "undefined" && data instanceof FormData;

      return apiFetch<ProjectDocument>(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: isFormData ? data : JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.all(projectId),
      });
      toast.success("Document created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create document: ${error.message}`);
    },
  });
}

export function useUpdateDocument(projectId: number, documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateDocumentInput) =>
      apiFetch<ProjectDocument>(
        `/api/projects/${projectId}/documents/${documentId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.all(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(projectId, documentId),
      });
      toast.success("Document updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document: ${error.message}`);
    },
  });
}

export function useUpdateDocumentInline(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: UpdateDocumentInput;
    }) =>
      apiFetch<ProjectDocument>(
        `/api/projects/${projectId}/documents/${documentId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (_updatedDocument, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.all(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(projectId, variables.documentId),
      });
    },
  });
}

export function useDeleteDocument(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch(`/api/projects/${projectId}/documents/${documentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.all(projectId),
      });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}
