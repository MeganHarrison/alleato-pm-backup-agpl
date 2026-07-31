"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import {
  commitmentListResponseSchema,
  type CommitmentListItem,
  type CommitmentListResponse,
  commitmentScopeLookupResponseSchema,
  type CommitmentScopeLookupResponse,
} from "@/lib/validation/commitments";

// =============================================================================
// Types
// =============================================================================

export interface CommitmentListFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  companyId?: string;
  type?: string;
  primeContractId?: string;
  deleted?: "exclude" | "only" | "include";
}

export interface CommitmentInlineUpdateInput {
  id: string;
  field: "number" | "title";
  value: string;
}

// =============================================================================
// Query Keys - centralized for cache invalidation
// =============================================================================

export const commitmentKeys = {
  all: ["commitments"] as const,
  lists: () => [...commitmentKeys.all, "list"] as const,
  list: (projectId: string, filters?: CommitmentListFilters) =>
    [...commitmentKeys.lists(), projectId, filters] as const,
  details: () => [...commitmentKeys.all, "detail"] as const,
  detail: (id: string) => [...commitmentKeys.details(), id] as const,
  changeOrders: (commitmentId: string) =>
    [...commitmentKeys.all, "change-orders", commitmentId] as const,
  invoices: (commitmentId: string) =>
    [...commitmentKeys.all, "invoices", commitmentId] as const,
  attachments: (commitmentId: string) =>
    [...commitmentKeys.all, "attachments", commitmentId] as const,
  scopeLookup: (projectId: string, query: string, companyId?: string) =>
    [...commitmentKeys.all, "scope-lookup", projectId, query, companyId ?? null] as const,
};

// =============================================================================
// List Query Hook
// =============================================================================

/**
 * React Query hook for fetching paginated commitments list.
 *
 * Features:
 * - Automatic caching (stale time: 30s)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Keeps previous data during page transitions (no loading flash)
 * - Automatic retry on failure
 */
export function useCommitmentsList(
  projectId: string,
  filters?: CommitmentListFilters,
) {
  return useQuery<CommitmentListResponse>({
    queryKey: commitmentKeys.list(projectId, filters),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("projectId", projectId);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.status) params.set("status", filters.status);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.companyId) params.set("companyId", filters.companyId);
      if (filters?.type) params.set("type", filters.type);
      if (filters?.primeContractId) params.set("prime_contract_id", filters.primeContractId);
      if (filters?.deleted) params.set("deleted", filters.deleted);

      const data = await apiFetch<unknown>(`/api/commitments?${params}`, { signal });
      const parsed = commitmentListResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error("Commitments data from the server was in an unexpected format — try refreshing the page");
      }
      return parsed.data;
    },
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds - commitments change infrequently
  });
}

export function useCommitmentScopeLookup(
  projectId: string,
  query: string,
  options?: { companyId?: string; limit?: number },
) {
  return useQuery<CommitmentScopeLookupResponse>({
    queryKey: commitmentKeys.scopeLookup(projectId, query, options?.companyId),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("q", query);
      if (options?.companyId) params.set("companyId", options.companyId);
      if (options?.limit) params.set("limit", String(options.limit));

      const data = await apiFetch<unknown>(
        `/api/projects/${projectId}/commitments/scope-lookup?${params.toString()}`,
        { signal },
      );
      const parsed = commitmentScopeLookupResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error("Commitment scope finder returned an unexpected format.");
      }
      return parsed.data;
    },
    enabled: Boolean(projectId) && query.trim().length >= 2,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

// =============================================================================
// Detail Query Hook
// =============================================================================

/**
 * React Query hook for fetching a single commitment detail.
 *
 * Features:
 * - Cached by commitment ID
 * - Deduplication prevents duplicate fetches when multiple components need same data
 * - Stale time of 15 seconds for detail views
 */
export function useCommitmentDetail(commitmentId: string) {
  return useQuery({
    queryKey: commitmentKeys.detail(commitmentId),
    queryFn: async ({ signal }) => {
      const data = await apiFetch<{ data?: unknown } | unknown>(
        `/api/commitments/${commitmentId}`,
        { signal },
      );
      if (data && typeof data === "object" && "data" in data && (data as { data: unknown }).data) {
        return (data as { data: unknown }).data;
      }
      return data;
    },
    enabled: !!commitmentId,
    staleTime: 15 * 1000, // 15 seconds
  });
}

// =============================================================================
// Change Orders Query Hook
// =============================================================================

/**
 * React Query hook for fetching change orders for a commitment.
 * Cached and deduplicated - safe to call from multiple components.
 */
export function useCommitmentChangeOrdersQuery(commitmentId: string) {
  return useQuery({
    queryKey: commitmentKeys.changeOrders(commitmentId),
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<{ data: unknown[]; meta: unknown }>(
          `/api/commitments/${commitmentId}/change-orders`,
          { signal },
        );
      } catch (err) {
        // Treat 404 as empty list (commitment has no change orders yet)
        if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
          return { data: [], meta: null };
        }
        throw err;
      }
    },
    enabled: !!commitmentId,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// Invoices Query Hook
// =============================================================================

/**
 * React Query hook for fetching invoice data for a commitment.
 */
export function useCommitmentInvoicesQuery(commitmentId: string) {
  return useQuery({
    queryKey: commitmentKeys.invoices(commitmentId),
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<{ summary: unknown; line_items: unknown[] }>(
          `/api/commitments/${commitmentId}/invoices`,
          { signal },
        );
      } catch (err) {
        // Treat 404 as empty (no invoices yet for this commitment)
        if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
          return { summary: null, line_items: [] };
        }
        throw err;
      }
    },
    enabled: !!commitmentId,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Mutation hook for deleting a commitment.
 * Automatically invalidates list cache on success.
 */
export function useDeleteCommitment(_projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commitmentId: string) =>
      apiFetch(`/api/commitments/${commitmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      // Invalidate the list cache to refetch
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.lists(),
      });
      toast.success("Commitment deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not delete commitment", { description: error.message });
    },
  });
}

function applyInlineCommitmentUpdate(
  item: CommitmentListItem,
  input: CommitmentInlineUpdateInput,
): CommitmentListItem {
  if (item.id !== input.id) return item;

  if (input.field === "number") {
    return {
      ...item,
      number: input.value,
    };
  }

  return {
    ...item,
    title: input.value,
  };
}

/**
 * Mutation hook for inline editing commitments from list tables.
 * Uses optimistic updates for low-latency UX and invalidates detail/list queries after success.
 */
export function useUpdateCommitmentInline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CommitmentInlineUpdateInput) => {
      const payload =
        input.field === "number"
          ? { number: input.value }
          : { title: input.value };

      return apiFetch(`/api/commitments/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: commitmentKeys.lists() });
      await queryClient.cancelQueries({
        queryKey: commitmentKeys.detail(input.id),
      });

      const previousLists = queryClient.getQueriesData<CommitmentListResponse>({
        queryKey: commitmentKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData(commitmentKeys.detail(input.id));

      for (const [queryKey, data] of previousLists) {
        if (!data?.data) continue;
        queryClient.setQueryData<CommitmentListResponse>(queryKey, {
          ...data,
          data: data.data.map((item) => applyInlineCommitmentUpdate(item, input)),
        });
      }

      queryClient.setQueryData(
        commitmentKeys.detail(input.id),
        (current: unknown) => {
          if (!current || typeof current !== "object") return current;
          const record = current as Record<string, unknown>;
          return {
            ...record,
            number: input.field === "number" ? input.value : record.number,
            title: input.field === "title" ? input.value : record.title,
          };
        },
      );

      return { previousLists, previousDetail };
    },
    onError: (_error, input, context) => {
      if (!context) return;

      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data);
      }

      queryClient.setQueryData(commitmentKeys.detail(input.id), context.previousDetail);
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.detail(input.id),
      });
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.lists(),
      });
      toast.success("Commitment updated");
    },
    onSettled: (_result, _error, input) => {
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.detail(input.id),
      });
    },
  });
}

/**
 * Mutation hook for approving a change order.
 * Invalidates both change orders and commitment detail caches.
 */
export function useApproveChangeOrder(commitmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changeOrderId: string) =>
      apiFetch(
        `/api/commitments/${commitmentId}/change-orders/${changeOrderId}/approve`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.changeOrders(commitmentId),
      });
      queryClient.invalidateQueries({
        queryKey: commitmentKeys.detail(commitmentId),
      });
      toast.success("Change order approved");
    },
    onError: (error: Error) => {
      toast.error("Could not approve change order", { description: error.message });
    },
  });
}

// =============================================================================
// Legacy Compatibility — useCommitments (dropdown-friendly)
// =============================================================================

export interface CommitmentOption {
  value: string;
  label: string;
  commitmentNumber?: string;
  type?: string;
  amount?: number;
}

/**
 * Drop-in replacement for the old useState-based useCommitments hook.
 * Returns `options` for use in dropdown selects and `isLoading`.
 */
export function useCommitments(projectId?: string) {
  const query = useCommitmentsList(projectId || "", {
    limit: 100,
  });

  const commitments = query.data?.data || [];

  const options: CommitmentOption[] = commitments.map((c: CommitmentListItem) => {
    const typeLabel = c.type === "purchase_order" ? "PO" : "SC";
    const companyName = c.contract_company?.name || "";
    const label = c.number
      ? `${c.number} - ${c.title || companyName || "Untitled"}`
      : `${typeLabel} #${c.id}`;

    return {
      value: c.id,
      label,
      commitmentNumber: c.number || undefined,
      type: c.type || undefined,
      amount: c.revised_contract_amount ?? c.original_amount ?? undefined,
    };
  });

  return {
    commitments,
    options,
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
