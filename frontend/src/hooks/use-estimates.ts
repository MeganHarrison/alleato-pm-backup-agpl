"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import type {
  EstimateCreate,
  EstimateLineItem,
  EstimateListParams,
  EstimateRow,
  EstimateUpdate,
  EstimateWithLineItems,
} from "@/lib/schemas/estimates";

// =============================================================================
// List Response Types
// =============================================================================

interface EstimateListResponse {
  data: EstimateRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Fetch paginated list of estimates with optional filters
 */
export function useEstimates(
  projectId: number,
  params?: Partial<EstimateListParams>,
) {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    });
  }

  const queryString = searchParams.toString();
  const url = `/api/projects/${projectId}/estimates${queryString ? `?${queryString}` : ""}`;

  return useQuery<EstimateListResponse>({
    queryKey: ["estimates", projectId, params],
    queryFn: ({ signal }) => apiFetch<EstimateListResponse>(url, { signal }),
    enabled: !!projectId,
  });
}

/**
 * Fetch a single estimate by ID with full details (line items, alternates, allowances)
 */
export function useEstimate(projectId: number, estimateId: number) {
  return useQuery<EstimateWithLineItems>({
    queryKey: ["estimate", estimateId],
    queryFn: ({ signal }) =>
      apiFetch<EstimateWithLineItems>(
        `/api/projects/${projectId}/estimates/${estimateId}`,
        { signal },
      ),
    enabled: !!projectId && !!estimateId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Create a new estimate
 */
export function useCreateEstimate(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: EstimateCreate) =>
      apiFetch<EstimateWithLineItems>(`/api/projects/${projectId}/estimates`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["estimates", projectId],
      });
      router.refresh();
      toast.success("Estimate created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create estimate: ${error.message}`);
    },
  });
}

/**
 * Update an existing estimate (uses PUT)
 */
export function useUpdateEstimate(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({
      estimateId,
      data,
    }: {
      estimateId: number;
      data: Omit<EstimateUpdate, "estimate_id">;
    }) =>
      apiFetch<EstimateWithLineItems>(
        `/api/projects/${projectId}/estimates/${estimateId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["estimates", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["estimate", variables.estimateId],
      });
      router.refresh();
      toast.success("Estimate updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update estimate: ${error.message}`);
    },
  });
}

/**
 * Delete an estimate
 */
export function useDeleteEstimate(projectId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (estimateId: number) =>
      apiFetch(
        `/api/projects/${projectId}/estimates/${estimateId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["estimates", projectId],
      });
      router.refresh();
      toast.success("Estimate deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete estimate: ${error.message}`);
    },
  });
}

// =============================================================================
// Line Item Mutation Hooks
// =============================================================================

/**
 * Add a line item to an estimate
 */
export function useAddLineItem(projectId: number, estimateId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EstimateLineItem) =>
      apiFetch<EstimateLineItem>(
        `/api/projects/${projectId}/estimates/${estimateId}/line-items`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["estimate", estimateId],
      });
      toast.success("Line item added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add line item: ${error.message}`);
    },
  });
}

/**
 * Update an existing line item on an estimate
 */
export function useUpdateLineItem(projectId: number, estimateId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lineItemId,
      data,
    }: {
      lineItemId: number;
      data: Partial<EstimateLineItem>;
    }) =>
      apiFetch<EstimateLineItem>(
        `/api/projects/${projectId}/estimates/${estimateId}/line-items/${lineItemId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["estimate", estimateId],
      });
      toast.success("Line item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update line item: ${error.message}`);
    },
  });
}

/**
 * Delete a line item from an estimate
 */
export function useDeleteLineItem(projectId: number, estimateId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineItemId: number) =>
      apiFetch(
        `/api/projects/${projectId}/estimates/${estimateId}/line-items/${lineItemId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["estimate", estimateId],
      });
      toast.success("Line item deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete line item: ${error.message}`);
    },
  });
}
