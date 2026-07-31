"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinancialAlert {
  id: number;
  title: string;
  description: string;
  severity: string | null;
  insight_type: string | null;
  confidence_score: number | null;
  financial_impact: number | null;
  project_id: number | null;
  project_name: string | null;
  status: string | null;
  created_at: string | null;
  business_impact: string | null;
  urgency_indicators: string[] | null;
  metadata: Record<string, unknown> | null;
}

export interface AlertsResponse {
  alerts: FinancialAlert[];
  total: number;
}

export interface ScanResult {
  scanned: number;
  alertsGenerated: number;
  errors: string[];
}

export interface CrossReferenceLineItem {
  costCode: string;
  description: string;
  alleatoBudget: number;
  acumaticaActual: number;
  acumaticaCommitted: number;
  variance: number;
}

export interface CrossReferenceResult {
  project: {
    id: number;
    name: string;
    acumaticaProjectId: string;
  };
  summary: {
    alleatoTotal: number;
    acumaticaTotal: number;
    variance: number;
    variancePercent: number;
  };
  lineItems: CrossReferenceLineItem[];
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const financialInsightsKeys = {
  all: ["financial-insights"] as const,
  alerts: (params?: { status?: string; severity?: string; projectId?: number }) =>
    [...financialInsightsKeys.all, "alerts", params] as const,
  crossReference: (projectId: number) =>
    [...financialInsightsKeys.all, "cross-reference", projectId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch financial alerts from ai_insights table.
 */
export function useFinancialAlerts(params?: {
  status?: string;
  severity?: string;
  projectId?: number;
  limit?: number;
}) {
  return useQuery<AlertsResponse>({
    queryKey: financialInsightsKeys.alerts(params),
    queryFn: ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.severity) searchParams.set("severity", params.severity);
      if (params?.projectId) searchParams.set("project_id", String(params.projectId));
      if (params?.limit) searchParams.set("limit", String(params.limit));

      const qs = searchParams.toString();
      const url = `/api/financial-insights/alerts${qs ? `?${qs}` : ""}`;
      return apiFetch<AlertsResponse>(url, { signal });
    },
  });
}

/**
 * Trigger a portfolio-wide budget health scan.
 * Invalidates the alerts cache on success.
 */
export function useScanPortfolio() {
  const queryClient = useQueryClient();

  return useMutation<ScanResult>({
    mutationFn: () =>
      apiFetch<ScanResult>("/api/financial-insights/scan", { method: "POST" }),
    onSuccess: () => {
      // Refetch alerts after a successful scan
      queryClient.invalidateQueries({ queryKey: financialInsightsKeys.all });
    },
  });
}

/**
 * Cross-reference a single project's budget between Alleato and Acumatica.
 */
export function useCrossReference() {
  return useMutation<CrossReferenceResult, Error, { projectId: number }>({
    mutationFn: ({ projectId }) =>
      apiFetch<CrossReferenceResult>("/api/financial-insights/cross-reference", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }),
  });
}
