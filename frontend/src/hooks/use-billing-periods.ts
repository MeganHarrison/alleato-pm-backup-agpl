"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// =============================================================================
// Types
// =============================================================================

export interface BillingPeriod {
  id: string;
  project_id: number;
  name: string | null;
  start_date: string;
  end_date: string;
  due_date: string | null;
  is_closed: boolean;
  period_number: number;
  closed_by: string | null;
  closed_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BillingPeriodListFilters {
  is_closed?: boolean;
}

export interface CreateBillingPeriodInput {
  start_date: string;
  end_date: string;
  name?: string;
  due_date?: string;
}

export interface UpdateBillingPeriodInput {
  periodId: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  is_closed?: boolean;
}

export type BillingPeriodFrequency = "never" | "monthly" | "weekly";

export interface InvoicingSettings {
  id: number | null;
  project_id: number;
  automatic_billing_frequency: BillingPeriodFrequency;
  automatic_anchor_start_date: string | null;
  automatic_anchor_end_date: string | null;
  automatic_anchor_due_date: string | null;
  automatic_occurrence_cursor: number;
  default_billing_start_day: number;
  default_billing_end_day: number;
  default_billing_due_day: number;
}

export interface ConfigureAutomaticBillingInput {
  automatic_billing_frequency: BillingPeriodFrequency;
  automatic_anchor_start_date?: string | null;
  automatic_anchor_end_date?: string | null;
  automatic_anchor_due_date?: string | null;
}

interface BillingPeriodsApiResponse<T> {
  data?: T;
}

// =============================================================================
// Query Keys
// =============================================================================

export const billingPeriodKeys = {
  all: ["billing-periods"] as const,
  lists: () => [...billingPeriodKeys.all, "list"] as const,
  list: (projectId: string, filters?: BillingPeriodListFilters) =>
    [...billingPeriodKeys.lists(), projectId, filters] as const,
  detail: (id: string) => [...billingPeriodKeys.all, "detail", id] as const,
  settings: (projectId: string) =>
    [...billingPeriodKeys.all, "settings", projectId] as const,
};

// =============================================================================
// List Query Hook
// =============================================================================

/**
 * React Query hook for fetching billing periods for a project.
 *
 * Features:
 * - Automatic caching (stale time: 30s)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Keeps previous data during filter transitions
 * - Optional is_closed filter
 */
export function useBillingPeriodsList(
  projectId: string,
  filters?: BillingPeriodListFilters,
) {
  return useQuery<BillingPeriod[]>({
    queryKey: billingPeriodKeys.list(projectId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.is_closed !== undefined) {
        params.set("is_closed", String(filters.is_closed));
      }
      const qs = params.toString();
      const data = await apiFetch<BillingPeriodsApiResponse<BillingPeriod[]>>(
        `/api/projects/${projectId}/invoicing/billing-periods${qs ? `?${qs}` : ""}`,
      );
      return data.data ?? [];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useInvoicingSettings(projectId: string) {
  return useQuery<InvoicingSettings>({
    queryKey: billingPeriodKeys.settings(projectId),
    queryFn: async () => {
      const response = await apiFetch<
        BillingPeriodsApiResponse<InvoicingSettings>
      >(`/api/projects/${projectId}/invoicing/settings`);
      if (!response.data)
        throw new Error("Invoicing settings were not returned.");
      return response.data;
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// Detail Query Hook
// =============================================================================

/**
 * React Query hook for fetching a single billing period by id.
 * Backs the billing-period detail page.
 */
export function useBillingPeriod(projectId: string, periodId: string) {
  return useQuery<BillingPeriod>({
    queryKey: billingPeriodKeys.detail(periodId),
    queryFn: async () => {
      const data = await apiFetch<BillingPeriodsApiResponse<BillingPeriod>>(
        `/api/projects/${projectId}/invoicing/billing-periods/${periodId}`,
      );
      if (!data.data) {
        throw new Error("Billing period not found");
      }
      return data.data;
    },
    enabled: !!projectId && !!periodId,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Mutation hook for creating a billing period.
 * Automatically invalidates list cache on success.
 */
export function useCreateBillingPeriod(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBillingPeriodInput) =>
      apiFetch<BillingPeriodsApiResponse<BillingPeriod>>(
        `/api/projects/${projectId}/invoicing/billing-periods`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingPeriodKeys.lists() });
      toast.success("Billing period created successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not create billing period", {
        description: error.message,
      });
    },
  });
}

/**
 * Mutation hook for updating a billing period.
 * Automatically invalidates list and detail caches on success.
 */
export function useUpdateBillingPeriod(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, ...fields }: UpdateBillingPeriodInput) =>
      apiFetch<BillingPeriodsApiResponse<BillingPeriod>>(
        `/api/projects/${projectId}/invoicing/billing-periods/${periodId}`,
        {
          method: "PATCH",
          body: JSON.stringify(fields),
        },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingPeriodKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: billingPeriodKeys.detail(variables.periodId),
      });
      toast.success("Billing period updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not update billing period", {
        description: error.message,
      });
    },
  });
}

/**
 * Mutation hook for deleting a billing period.
 * Returns 409 if any invoices reference the period.
 * Automatically invalidates list cache on success.
 */
export function useDeleteBillingPeriod(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string) =>
      apiFetch(
        `/api/projects/${projectId}/invoicing/billing-periods/${periodId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingPeriodKeys.lists() });
      toast.success("Billing period deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not delete billing period", {
        description: error.message,
      });
    },
  });
}

export function useConfigureAutomaticBillingPeriods(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConfigureAutomaticBillingInput) =>
      apiFetch<BillingPeriodsApiResponse<InvoicingSettings>>(
        `/api/projects/${projectId}/invoicing/settings`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: billingPeriodKeys.settings(projectId),
      });
      toast.success("Automatic billing schedule saved");
    },
    onError: (error: Error) => {
      toast.error("Could not save automatic billing schedule", {
        description: error.message,
      });
    },
  });
}
