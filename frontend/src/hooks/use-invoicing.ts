"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { OwnerInvoice } from "@/features/invoicing/invoicing-table-config";

// =============================================================================
// Types
// =============================================================================

export interface InvoiceListFilters {
  billing_period_id?: string;
  prime_contract_id?: string;
  search?: string;
}

interface OwnerInvoicesApiResponse<T> {
  data?: T;
  success?: boolean;
  id?: string;
}

// =============================================================================
// Query Keys
// =============================================================================

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (projectId: string, filters?: InvoiceListFilters) =>
    [...invoiceKeys.lists(), projectId, filters] as const,
  detail: (id: number) => [...invoiceKeys.all, "detail", id] as const,
};

// =============================================================================
// List Query Hook
// =============================================================================

/**
 * React Query hook for fetching owner invoices for a project.
 *
 * Features:
 * - Automatic caching (stale time: 30s)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Keeps previous data during filter transitions
 */
export function useOwnerInvoicesList(
  projectId: string,
  filters?: InvoiceListFilters,
) {
  return useQuery<OwnerInvoice[]>({
    queryKey: invoiceKeys.list(projectId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.billing_period_id) {
        params.set("billing_period_id", filters.billing_period_id);
      }
      if (filters?.prime_contract_id) {
        params.set("prime_contract_id", filters.prime_contract_id);
      }
      const qs = params.toString();
      const response = await apiFetch<OwnerInvoicesApiResponse<OwnerInvoice[]>>(
        `/api/projects/${projectId}/invoicing/owner${qs ? `?${qs}` : ""}`,
      );
      return response.data ?? [];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export interface SendInvoiceEmailPayload {
  invoiceId: number;
  to: string[];
  cc?: string[];
  subject?: string;
  message?: string;
}

/**
 * Mutation hook for emailing an owner invoice with a PDF attachment.
 */
export function useSendInvoiceEmail(projectId: string) {
  return useMutation({
    mutationFn: async (payload: SendInvoiceEmailPayload) => {
      const { invoiceId, ...body } = payload;
      return apiFetch<OwnerInvoicesApiResponse<never>>(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/email`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: () => {
      toast.success("Invoice emailed successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not send invoice", { description: error.message });
    },
  });
}

/**
 * Mutation hook for deleting an owner invoice.
 * Automatically invalidates list cache on success.
 */
export function useDeleteOwnerInvoice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: number) =>
      apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success("Invoice deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not delete invoice", { description: error.message });
    },
  });
}

/**
 * Mutation hook for approving an owner invoice as noted.
 * Automatically invalidates list and detail cache on success.
 */
export function useApproveOwnerInvoiceAsNoted(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: number) =>
      apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/approve-as-noted`,
        { method: "POST" },
      ),
    onSuccess: (_data, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(invoiceId),
      });
      toast.success("Invoice approved as noted");
    },
    onError: (error: Error) => {
      toast.error("Could not approve invoice as noted", {
        description: error.message,
      });
    },
  });
}

/**
 * Mutation hook for voiding an owner invoice.
 * Accepts an optional reason. Invalidates list and detail cache on success.
 */
export function useVoidOwnerInvoice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      reason,
    }: {
      invoiceId: number;
      reason?: string;
    }) =>
      apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/void`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      ),
    onSuccess: (_data, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(invoiceId),
      });
      toast.success("Invoice voided");
    },
    onError: (error: Error) => {
      toast.error("Could not void invoice", { description: error.message });
    },
  });
}
