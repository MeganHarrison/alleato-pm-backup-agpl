"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-client";
import type { BudgetLineAmountPolicy } from "@/lib/budget/new-line-amount-policy";

const DEFAULT_POLICY: BudgetLineAmountPolicy = {
  requireZeroAmount: false,
  flagEnabled: false,
  primeContractExecuted: false,
};

interface UseBudgetNewLinePolicyReturn extends BudgetLineAmountPolicy {
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the policy that governs new budget line item creation.
 * When `requireZeroAmount` is true, callers must force the amount field to $0.00.
 */
export function useBudgetNewLinePolicy(
  projectId: string | number | null | undefined,
): UseBudgetNewLinePolicyReturn {
  const [policy, setPolicy] =
    React.useState<BudgetLineAmountPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPolicy = React.useCallback(async () => {
    if (projectId === null || projectId === undefined || projectId === "") {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BudgetLineAmountPolicy>(
        `/api/projects/${projectId}/budget/new-line-policy`,
      );
      setPolicy(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policy");
      setPolicy(DEFAULT_POLICY);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void fetchPolicy();
  }, [fetchPolicy]);

  return {
    ...policy,
    loading,
    error,
    refetch: fetchPolicy,
  };
}
