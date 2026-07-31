"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgeDocument {
  id: string;
  title: string | null;
  category: string | null;
  source: string | null;
  status: string | null;
  tags: string[] | null;
  date: string | null;
  file_name: string | null;
  file_path: string | null;
  project_id: number | null;
  created_at: string | null;
}

type KnowledgeDocumentApiRow = Omit<KnowledgeDocument, "tags"> & {
  tags: string[] | string | null;
};

export function normalizeKnowledgeDocumentTags(
  raw: string[] | string | null | undefined,
): string[] | null {
  if (raw == null) return null;

  const tags = Array.isArray(raw) ? raw : raw.split(/[,;]/);
  const cleaned = tags.map((tag) => String(tag).trim()).filter(Boolean);

  return cleaned.length > 0 ? cleaned : null;
}

function normalizeKnowledgeDocument(row: KnowledgeDocumentApiRow): KnowledgeDocument {
  return {
    ...row,
    tags: normalizeKnowledgeDocumentTags(row.tags),
  };
}

export interface KnowledgeDocumentFilters {
  search?: string;
  projectId?: number;
  manage?: boolean;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const knowledgeDocumentKeys = {
  all: ["knowledge-documents"] as const,
  list: (filters?: KnowledgeDocumentFilters) =>
    ["knowledge-documents", "list", filters] as const,
};

// ---------------------------------------------------------------------------
// useKnowledgeDocuments — list knowledge documents
// ---------------------------------------------------------------------------

export function useKnowledgeDocuments(filters?: KnowledgeDocumentFilters) {
  const params = new URLSearchParams();
  if (filters?.search) {
    params.set("search", filters.search);
  }
  if (filters?.projectId) {
    params.set("projectId", String(filters.projectId));
  }
  if (filters?.manage) {
    params.set("manage", "true");
  }

  return useQuery({
    queryKey: knowledgeDocumentKeys.list(filters),
    queryFn: async ({ signal }): Promise<KnowledgeDocument[]> => {
      const json = await apiFetch<{ data: KnowledgeDocumentApiRow[] }>(
        `/api/knowledge?${params.toString()}`,
        { signal },
      );
      return json.data.map(normalizeKnowledgeDocument);
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateKnowledgeDocument
// ---------------------------------------------------------------------------

export function useUpdateKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; tags?: string; status?: string }) =>
      apiFetch(`/api/knowledge?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeDocumentKeys.all });
      toast.success("Knowledge document updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteKnowledgeDocument
// ---------------------------------------------------------------------------

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/knowledge?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeDocumentKeys.all });
      toast.success("Knowledge document deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
