"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { ReconciliationFinding } from "@/lib/accounting/reconciliation";

export type ReviewStatus = "open" | "reviewed" | "resolved";

export type ReconciliationFindingItem = ReconciliationFinding & {
  reviewStatus: ReviewStatus;
};

export type ReconciliationResponseSummary = {
  projects: number;
  totalFindings: number;
  highCount: number;
  dollarsAtRiskCents: number;
  acumaticaChecked: boolean;
  byKind: Record<string, number>;
};

export type ReconciliationResponse = {
  generatedAt: string | null;
  summary: ReconciliationResponseSummary | null;
  findings: ReconciliationFindingItem[];
};

const QUERY_KEY = ["reconciliation", "findings"] as const;

export function useReconciliationFindings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<ReconciliationResponse>("/api/reconciliation/findings"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRunReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch("/api/reconciliation/findings", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useResolveFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fingerprint, reviewStatus }: { fingerprint: string; reviewStatus: ReviewStatus }) =>
      apiFetch(`/api/reconciliation/findings/${encodeURIComponent(fingerprint)}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewStatus }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
