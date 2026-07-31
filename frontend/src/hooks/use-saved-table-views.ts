"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// Filter values are intentionally loose — UnifiedTablePage hosts many entity types
// and each defines its own filter shape. We mirror the FilterValue from
// use-unified-table-state here without importing it (avoids circular module hops).
export type SavedViewFilterValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface SavedTableView {
  id: string;
  scope_key: string;
  name: string;
  is_default: boolean;
  visible_columns: string[] | null;
  column_order: string[] | null;
  column_widths: Record<string, number> | null;
  sort_by: string | null;
  sort_direction: "asc" | "desc" | null;
  filters: Record<string, SavedViewFilterValue> | null;
  created_at: string;
  updated_at: string;
}

export interface SavedTableViewConfig {
  visible_columns?: string[] | null;
  column_order?: string[] | null;
  column_widths?: Record<string, number> | null;
  sort_by?: string | null;
  sort_direction?: "asc" | "desc" | null;
  filters?: Record<string, SavedViewFilterValue> | null;
}

export interface CreateSavedViewInput extends SavedTableViewConfig {
  scope_key: string;
  name: string;
  is_default?: boolean;
}

export interface UpdateSavedViewInput extends SavedTableViewConfig {
  name?: string;
  is_default?: boolean;
}

export const savedTableViewKeys = {
  all: ["table-views"] as const,
  byScope: (scopeKey: string) =>
    [...savedTableViewKeys.all, scopeKey] as const,
};

/**
 * Fetches the current user's saved views for a table scope (e.g. "meetings").
 * Returns rows ordered with the default first, then alphabetical by name.
 */
export function useSavedTableViews(scopeKey: string | undefined | null) {
  return useQuery<SavedTableView[]>({
    queryKey: savedTableViewKeys.byScope(scopeKey ?? ""),
    queryFn: async () => {
      const rows = await apiFetch<SavedTableView[]>(
        `/api/table-views?scope_key=${encodeURIComponent(scopeKey ?? "")}`,
      );
      return rows;
    },
    enabled: Boolean(scopeKey),
    staleTime: 60 * 1000,
  });
}

export function useCreateSavedTableView(scopeKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateSavedViewInput, "scope_key">) =>
      apiFetch<SavedTableView>("/api/table-views", {
        method: "POST",
        body: JSON.stringify({ scope_key: scopeKey, ...input }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: savedTableViewKeys.byScope(scopeKey),
      });
      toast.success("View saved");
    },
    onError: (error: Error) => {
      toast.error("Could not save view", { description: error.message });
    },
  });
}

export function useUpdateSavedTableView(scopeKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      viewId,
      input,
    }: {
      viewId: string;
      input: UpdateSavedViewInput;
    }) =>
      apiFetch<SavedTableView>(`/api/table-views/${viewId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: savedTableViewKeys.byScope(scopeKey),
      });
    },
    onError: (error: Error) => {
      toast.error("Could not update view", { description: error.message });
    },
  });
}

export function useDeleteSavedTableView(scopeKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (viewId: string) =>
      apiFetch<{ ok: true }>(`/api/table-views/${viewId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: savedTableViewKeys.byScope(scopeKey),
      });
      toast.success("View deleted");
    },
    onError: (error: Error) => {
      toast.error("Could not delete view", { description: error.message });
    },
  });
}
