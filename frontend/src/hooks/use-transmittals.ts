"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransmittalSummary {
  id: number;
  project_id: number;
  number: string;
  subject: string;
  status: "Draft" | "Open" | "Closed" | "Void" | string;
  to_company: string | null;
  to_contact: string | null;
  from_company: string | null;
  from_contact: string | null;
  sent_date: string | null;
  due_date: string | null;
  received_date: string | null;
  remarks: string | null;
  delivery_method: "Email" | "Hand Delivery" | "Mail" | "Courier" | "Fax" | "Other" | string;
  copies_sent: number | null;
  is_private: boolean | null;
  ball_in_court: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CreateTransmittalInput {
  number: string;
  subject: string;
  status?: "Draft" | "Open" | "Closed" | "Void";
  to_company?: string | null;
  to_contact?: string | null;
  from_company?: string | null;
  from_contact?: string | null;
  sent_date?: string | null;
  due_date?: string | null;
  received_date?: string | null;
  remarks?: string | null;
  delivery_method?: "Email" | "Hand Delivery" | "Mail" | "Courier" | "Fax" | "Other";
  copies_sent?: number | null;
  is_private?: boolean;
  ball_in_court?: string | null;
}

export type UpdateTransmittalInput = Partial<CreateTransmittalInput>;

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const transmittalKeys = {
  all: (projectId: number) => ["transmittals", projectId] as const,
  list: (projectId: number, status?: string) =>
    ["transmittals", projectId, "list", status] as const,
  detail: (projectId: number, id: string) =>
    ["transmittals", projectId, "detail", id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTransmittals(projectId: number, status?: string) {
  return useQuery({
    queryKey: transmittalKeys.list(projectId, status),
    queryFn: ({ signal }): Promise<TransmittalSummary[]> => {
      const params = new URLSearchParams();
      if (status) params.set("tab", status);
      return apiFetch<TransmittalSummary[]>(
        `/api/projects/${projectId}/transmittals?${params.toString()}`,
        { signal },
      );
    },
    enabled: Boolean(projectId),
  });
}

export function useTransmittal(projectId: number, transmittalId: string) {
  return useQuery({
    queryKey: transmittalKeys.detail(projectId, transmittalId),
    queryFn: ({ signal }): Promise<TransmittalSummary> =>
      apiFetch<TransmittalSummary>(
        `/api/projects/${projectId}/transmittals/${transmittalId}`,
        { signal },
      ),
    enabled: Boolean(projectId) && Boolean(transmittalId),
  });
}

export function useCreateTransmittal(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransmittalInput): Promise<TransmittalSummary> =>
      apiFetch<TransmittalSummary>(`/api/projects/${projectId}/transmittals`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transmittalKeys.all(projectId) });
      toast.success("Transmittal created");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateTransmittal(projectId: number, transmittalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTransmittalInput): Promise<TransmittalSummary> =>
      apiFetch<TransmittalSummary>(
        `/api/projects/${projectId}/transmittals/${transmittalId}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transmittalKeys.all(projectId) });
      toast.success("Transmittal updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteTransmittal(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transmittalId: string): Promise<unknown> =>
      apiFetch(
        `/api/projects/${projectId}/transmittals/${transmittalId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transmittalKeys.all(projectId) });
      toast.success("Transmittal moved to Recycle Bin");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
