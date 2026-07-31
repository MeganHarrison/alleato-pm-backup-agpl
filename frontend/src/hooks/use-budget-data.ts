"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { BudgetLineItem, BudgetGrandTotals } from "@/types/budget";

interface BudgetApiResponse {
  lineItems?: BudgetLineItem[];
  grandTotals?: BudgetGrandTotals;
}

interface UseBudgetDataReturn {
  budgetData: BudgetLineItem[];
  grandTotals: BudgetGrandTotals;
  loading: boolean;
  error: string | null;
  refetchBudgetData: () => Promise<void>;
}

interface UseBudgetDataOptions {
  enabled?: boolean;
  initialBudgetData?: BudgetLineItem[];
  initialGrandTotals?: BudgetGrandTotals;
  showErrorToast?: boolean;
}

const EMPTY_GRAND_TOTALS: BudgetGrandTotals = {
  originalBudgetAmount: 0,
  budgetModifications: 0,
  approvedCOs: 0,
  revisedBudget: 0,
  jobToDateCostDetail: 0,
  directCosts: 0,
  pendingChanges: 0,
  projectedBudget: 0,
  committedCosts: 0,
  pendingCostChanges: 0,
  projectedCosts: 0,
  forecastToComplete: 0,
  estimatedCostAtCompletion: 0,
  projectedOverUnder: 0,
};

/**
 * Custom hook for fetching and managing budget data from SQL views
 * Uses pre-calculated values from mv_budget_rollup and v_budget_grand_totals
 */
export function useBudgetData(
  projectId: string,
  options?: UseBudgetDataOptions,
): UseBudgetDataReturn {
  const enabled = options?.enabled ?? true;
  const [budgetData, setBudgetData] = useState<BudgetLineItem[]>(
    options?.initialBudgetData ?? [],
  );
  const [grandTotals, setGrandTotals] = useState<BudgetGrandTotals>(
    options?.initialGrandTotals ?? EMPTY_GRAND_TOTALS,
  );
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetchBudgetData = useCallback(async () => {
    if (!projectId || !enabled) return;

    try {
      setLoading(true);
      setError(null);

      const data = await apiFetch<BudgetApiResponse>(`/api/projects/${projectId}/budget`);

      // Data from SQL views is already calculated - no manual calculations needed
      setBudgetData(data.lineItems || []);
      setGrandTotals(data.grandTotals || EMPTY_GRAND_TOTALS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch budget data";
      setError(errorMessage);
      console.error("Budget data fetch error:", err);
      if (options?.showErrorToast !== false) {
        toast.error("Failed to load budget", {
          description: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId, options?.showErrorToast]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    refetchBudgetData();
  }, [enabled, refetchBudgetData]);

  return {
    budgetData,
    grandTotals,
    loading,
    error,
    refetchBudgetData,
  };
}
