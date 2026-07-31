"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { SubcontractorInvoiceWorkflowAction } from "@/lib/invoicing/subcontractor-invoice-status-transitions";
import type { PaymentApplicationRollup } from "@/lib/invoicing/payment-application";

export type { SubcontractorInvoiceWorkflowAction };

// =============================================================================
// Types
// =============================================================================

export interface SubcontractorInvoiceListFilters {
  billing_period_id?: string;
  subcontract_id?: string;
  purchase_order_id?: string;
  status?: string;
}

export interface CreateSubcontractorInvoiceInput {
  subcontract_id?: string;
  purchase_order_id?: string;
  billing_period_id?: string;
  invoice_number?: string;
  period_start?: string;
  period_end?: string;
  billing_date?: string;
  notes?: string;
}

interface SubcontractorInvoiceApiResponse<T> {
  data?: T;
}

interface SubcontractorInvoiceLineItem {
  id: number;
  sort_order?: number | null;
  budget_code?: string | null;
  description?: string | null;
  line_item_type?: string | null;
  commitment_value?: number | null;
  change_value?: number | null;
  scheduled_value?: number | null;
  work_completed_previous?: number | null;
  work_completed_previous_pct?: number | null;
  work_completed_period?: number | null;
  materials_stored?: number | null;
  total_completed_stored?: number | null;
  work_completed_pct?: number | null;
  balance_to_finish?: number | null;
  retainage_pct?: number | null;
  retainage_amount?: number | null;
  materials_retainage_pct?: number | null;
  materials_retainage_amount?: number | null;
  previous_work_retainage?: number | null;
  previous_materials_retainage?: number | null;
  work_retainage_released?: number | null;
  materials_retainage_released?: number | null;
  net_amount_this_period?: number | null;
}

interface SubcontractorInvoiceTabCounts {
  related_items: number;
  emails: number;
  change_history: number;
}

// The G702 rollup shape is owned by the payment-application module.
type SubcontractorInvoiceRollup = PaymentApplicationRollup;

interface SubcontractorInvoiceCoSummary {
  additions: number;
  deductions: number;
  net: number;
}

export interface SubcontractorInvoiceDetailData {
  id: number;
  invoice_number?: string | null;
  subcontract_id?: number | null;
  purchase_order_id?: number | null;
  status?: string | null;
  notes?: string | null;
  contract_number?: string | null;
  contract_title?: string | null;
  contract_company_name?: string | null;
  contract_company_address?: string | null;
  contract_company_city?: string | null;
  contract_company_state?: string | null;
  contract_company_zip?: string | null;
  contract_date?: string | null;
  gc_company_name?: string | null;
  gc_company_address?: string | null;
  gc_company_city?: string | null;
  gc_company_state?: string | null;
  gc_company_zip?: string | null;
  project_name?: string | null;
  project_number?: string | null;
  project_address?: string | null;
  application_number?: number | null;
  billing_period_name?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  billing_date?: string | null;
  percent_complete?: number | null;
  approved_at?: string | null;
  submitted_at?: string | null;
  is_retainage_release?: boolean | null;
  attachments?: Array<{ id?: string | number; file_name?: string | null; url?: string | null }> | null;
  subcontractor_invoice_line_items?: SubcontractorInvoiceLineItem[] | null;
  rollup?: SubcontractorInvoiceRollup | null;
  co_summary?: SubcontractorInvoiceCoSummary | null;
  tab_counts?: SubcontractorInvoiceTabCounts | null;
}

// =============================================================================
// Query Keys
// =============================================================================

export const subInvoiceKeys = {
  all: ["subcontractor-invoices"] as const,
  lists: () => [...subInvoiceKeys.all, "list"] as const,
  list: (projectId: string, filters?: SubcontractorInvoiceListFilters) =>
    [...subInvoiceKeys.lists(), projectId, filters] as const,
  detail: (projectId: string, invoiceId: number) =>
    [...subInvoiceKeys.all, "detail", projectId, invoiceId] as const,
};

// =============================================================================
// List Query Hook
// =============================================================================

/**
 * React Query hook for fetching subcontractor invoices for a project.
 *
 * Features:
 * - Automatic caching (stale time: 30s)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Keeps previous data during filter transitions
 */
export function useSubcontractorInvoicesList(
  projectId: string,
  filters?: SubcontractorInvoiceListFilters,
) {
  return useQuery({
    queryKey: subInvoiceKeys.list(projectId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.billing_period_id) params.set("billing_period_id", filters.billing_period_id);
      if (filters?.subcontract_id) params.set("subcontract_id", filters.subcontract_id);
      if (filters?.purchase_order_id) params.set("purchase_order_id", filters.purchase_order_id);
      if (filters?.status) params.set("status", filters.status);
      const qs = params.toString();
      const data = await apiFetch<SubcontractorInvoiceApiResponse<unknown[]>>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices${qs ? `?${qs}` : ""}`,
      );
      return data.data ?? [];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

// =============================================================================
// Detail Query Hook
// =============================================================================

/**
 * React Query hook for fetching a single subcontractor invoice with line items.
 */
export function useSubcontractorInvoiceDetail(
  projectId: string,
  invoiceId: number | null | undefined,
) {
  return useQuery<SubcontractorInvoiceDetailData | null>({
    queryKey: subInvoiceKeys.detail(projectId, invoiceId ?? 0),
    queryFn: async () => {
      const data = await apiFetch<
        SubcontractorInvoiceApiResponse<SubcontractorInvoiceDetailData | null>
      >(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
      );
      return data.data ?? null;
    },
    enabled: !!projectId && !!invoiceId,
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Mutation hook for creating a subcontractor invoice.
 * Automatically invalidates list cache on success.
 */
export function useCreateSubcontractorInvoice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSubcontractorInvoiceInput) =>
      apiFetch<SubcontractorInvoiceApiResponse<unknown>>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
      toast.success("Subcontractor invoice created");
    },
    onError: (error: Error) => {
      toast.error("Could not create invoice", { description: error.message });
    },
  });
}

/**
 * Mutation hook for updating a subcontractor invoice (summary fields).
 */
export function useUpdateSubcontractorInvoice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      ...fields
    }: { invoiceId: number } & Record<string, unknown>) =>
      apiFetch<SubcontractorInvoiceApiResponse<unknown>>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
        {
          method: "PATCH",
          body: JSON.stringify(fields),
        },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: subInvoiceKeys.detail(projectId, vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error("Could not update invoice", { description: error.message });
    },
  });
}

/**
 * Mutation hook for changing invoice status (submit, approve, revise, void).
 */
export function useSubcontractorInvoiceStatusChange(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      status,
      notes,
    }: {
      invoiceId: number;
      status: string;
      notes?: string;
    }) =>
      apiFetch<SubcontractorInvoiceApiResponse<unknown>>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, ...(notes !== undefined && { notes }) }),
        },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: subInvoiceKeys.detail(projectId, vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error("Status update failed", { description: error.message });
    },
  });
}

/**
 * Workflow transitions reachable inline from the invoices table. Each maps to a
 * dedicated POST endpoint that carries the correct side effects (submit sends
 * the PM notification email, approve/approve-as-noted run the financial calc,
 * revise resets to revise_and_resubmit). This is why status is NOT a free-form
 * PATCH field — writing it directly would skip those side effects. The set of
 * actions and which status each is reachable from lives in
 * `@/lib/invoicing/subcontractor-invoice-status-transitions`.
 */
const WORKFLOW_ACTION_SUCCESS: Record<
  SubcontractorInvoiceWorkflowAction,
  string
> = {
  submit: "Invoice submitted for review",
  approve: "Invoice approved",
  "approve-as-noted": "Invoice approved as noted",
  "pending-owner-approval": "Invoice sent for owner approval",
  revise: "Invoice sent back for revision",
};

/**
 * Mutation hook that drives an invoice through a single workflow transition via
 * its dedicated endpoint. Used by the inline status control on the invoices
 * table so a status change from the list behaves exactly like changing it from
 * the detail page (side effects intact, invalid transitions fail loudly).
 */
export function useSubcontractorInvoiceWorkflowAction(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      action,
    }: {
      invoiceId: number;
      action: SubcontractorInvoiceWorkflowAction;
    }) => {
      try {
        return await apiFetch<SubcontractorInvoiceApiResponse<unknown>>(
          `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/${action}`,
          { method: "POST", body: JSON.stringify({}) },
        );
      } catch (error) {
        // Submit changes the status AND sends the PM a notification email. A 502
        // means the status update landed but the email failed — the detail page
        // treats this as a partial success, so we do too rather than misreport
        // it as a failed transition.
        const status = (error as { status?: number })?.status;
        if (action === "submit" && status === 502) {
          return { data: undefined };
        }
        throw error;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: subInvoiceKeys.detail(projectId, vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
      toast.success(WORKFLOW_ACTION_SUCCESS[vars.action]);
    },
    onError: (error: Error) => {
      toast.error("Status update failed", { description: error.message });
    },
  });
}

/**
 * Mutation hook for invoice workflow transitions that use dedicated endpoints
 * (approve-as-noted, pending-owner-approval).
 */
export function useSubcontractorInvoiceTransition(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      action,
    }: {
      invoiceId: number;
      action: "approve-as-noted" | "pending-owner-approval";
    }) =>
      apiFetch<SubcontractorInvoiceApiResponse<unknown>>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/${action}`,
        { method: "POST" },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: subInvoiceKeys.detail(projectId, vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error("Transition failed", { description: error.message });
    },
  });
}

/**
 * Mutation hook for batch-updating line items (SOV edits).
 */
export function useUpdateSubcontractorLineItems(
  projectId: string,
  invoiceId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{
        id: number;
        work_completed_period: number;
        materials_stored: number;
        retainage_pct: number;
        materials_retainage_pct: number;
      }>,
    ) =>
      apiFetch<SubcontractorInvoiceApiResponse<unknown>>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/line-items`,
        {
          method: "PATCH",
          body: JSON.stringify({ updates }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subInvoiceKeys.detail(projectId, invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
      toast.success("SOV updated");
    },
    onError: (error: Error) => {
      toast.error("Could not save line items", {
        description: error.message,
      });
    },
  });
}

/**
 * Mutation hook for deleting a subcontractor invoice.
 * Automatically invalidates list cache on success.
 */
export function useDeleteSubcontractorInvoice(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: number) =>
      apiFetch(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subInvoiceKeys.lists() });
      toast.success("Invoice deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Could not delete invoice", { description: error.message });
    },
  });
}
