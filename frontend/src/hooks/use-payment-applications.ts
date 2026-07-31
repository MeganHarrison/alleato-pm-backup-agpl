"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PaymentApplication,
  PaymentApplicationLineItem,
} from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

// =============================================================================
// Query Keys
// =============================================================================

export const paymentApplicationKeys = {
  all: (projectId: number, contractId: string) =>
    ["payment-applications", projectId, contractId] as const,
  list: (projectId: number, contractId: string) =>
    [...paymentApplicationKeys.all(projectId, contractId), "list"] as const,
  detail: (projectId: number, contractId: string, applicationId: string) =>
    [...paymentApplicationKeys.all(projectId, contractId), applicationId] as const,
  lineItems: (projectId: number, contractId: string, applicationId: string) =>
    [...paymentApplicationKeys.detail(projectId, contractId, applicationId), "line-items"] as const,
};

// =============================================================================
// API Helpers
// =============================================================================

const basePath = (projectId: number, contractId: string) =>
  `/api/projects/${projectId}/contracts/${contractId}/payment-applications`;

const detailPath = (projectId: number, contractId: string, applicationId: string) =>
  `${basePath(projectId, contractId)}/${applicationId}`;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// =============================================================================
// Query Hooks
// =============================================================================

export function usePaymentApplications(projectId: number, contractId: string) {
  return useQuery<PaymentApplication[]>({
    queryKey: paymentApplicationKeys.list(projectId, contractId),
    queryFn: () => fetchJson<PaymentApplication[]>(basePath(projectId, contractId)),
    staleTime: 30_000,
    enabled: !!projectId && !!contractId,
  });
}

export function usePaymentApplication(
  projectId: number,
  contractId: string,
  applicationId: string,
) {
  return useQuery<PaymentApplication>({
    queryKey: paymentApplicationKeys.detail(projectId, contractId, applicationId),
    queryFn: () =>
      fetchJson<PaymentApplication>(detailPath(projectId, contractId, applicationId)),
    staleTime: 30_000,
    enabled: !!projectId && !!contractId && !!applicationId,
  });
}

export function usePaymentApplicationLineItems(
  projectId: number,
  contractId: string,
  applicationId: string,
) {
  return useQuery<PaymentApplicationLineItem[]>({
    queryKey: paymentApplicationKeys.lineItems(projectId, contractId, applicationId),
    queryFn: () =>
      fetchJson<PaymentApplicationLineItem[]>(
        `${detailPath(projectId, contractId, applicationId)}/line-items`,
      ),
    staleTime: 30_000,
    enabled: !!projectId && !!contractId && !!applicationId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useCreatePaymentApplication(projectId: number, contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PaymentApplication>) =>
      fetchJson<PaymentApplication>(basePath(projectId, contractId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.list(projectId, contractId),
      });
      toast.success("Payment application created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create payment application");
    },
  });
}

export function useUpdatePaymentApplication(
  projectId: number,
  contractId: string,
  applicationId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PaymentApplication>) =>
      fetchJson<PaymentApplication>(detailPath(projectId, contractId, applicationId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.detail(projectId, contractId, applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.list(projectId, contractId),
      });
      toast.success("Payment application updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update payment application");
    },
  });
}

export function useDeletePaymentApplication(projectId: number, contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationId: string) =>
      fetchJson<void>(detailPath(projectId, contractId, applicationId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.list(projectId, contractId),
      });
      toast.success("Payment application deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete payment application");
    },
  });
}

export function usePopulateSOV(
  projectId: number,
  contractId: string,
  applicationId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<PaymentApplicationLineItem[]>(
        `${detailPath(projectId, contractId, applicationId)}/populate-sov`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.lineItems(projectId, contractId, applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.detail(projectId, contractId, applicationId),
      });
      toast.success("Schedule of values populated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to populate schedule of values");
    },
  });
}

export function useUpdateLineItems(
  projectId: number,
  contractId: string,
  applicationId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lineItems: Partial<PaymentApplicationLineItem>[]) =>
      fetchJson<PaymentApplicationLineItem[]>(
        `${detailPath(projectId, contractId, applicationId)}/line-items`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lineItems }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.lineItems(projectId, contractId, applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentApplicationKeys.detail(projectId, contractId, applicationId),
      });
      toast.success("Line items updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update line items");
    },
  });
}
