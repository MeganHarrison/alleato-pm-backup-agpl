"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-client";

export interface ProjectBudgetCode {
  id: string;
  code: string;
  costType: string | null;
  costTypeId?: string | null;
  description: string;
  fullLabel: string;
  divisionId?: string | null;
  divisionTitle?: string | null;
}

export interface CreateProjectBudgetCodeInput {
  costCodeId: string;
  costTypeId: string;
  description?: string | null;
}

interface UseProjectBudgetCodesOptions {
  enabled?: boolean;
}

export function useProjectBudgetCodes(
  projectId: string,
  options: UseProjectBudgetCodesOptions = {},
) {
  const { enabled = true } = options;
  const [budgetCodes, setBudgetCodes] = React.useState<ProjectBudgetCode[]>([]);
  const [loadingCodes, setLoadingCodes] = React.useState(enabled);

  const refreshBudgetCodes = React.useCallback(async () => {
    if (!projectId || !enabled) {
      setLoadingCodes(false);
      return [];
    }

    try {
      setLoadingCodes(true);
      const response = await apiFetch<{ budgetCodes: ProjectBudgetCode[] }>(
        `/api/projects/${projectId}/budget-codes`,
      );
      const nextBudgetCodes = response.budgetCodes ?? [];
      setBudgetCodes(nextBudgetCodes);
      return nextBudgetCodes;
    } catch (error) {
      console.error(
        "Failed to load project budget codes:",
        error instanceof Error ? error.message : error,
      );
      setBudgetCodes([]);
      return [];
    } finally {
      setLoadingCodes(false);
    }
  }, [enabled, projectId]);

  React.useEffect(() => {
    void refreshBudgetCodes();
  }, [refreshBudgetCodes]);

  const createBudgetCode = React.useCallback(
    async (input: CreateProjectBudgetCodeInput) => {
      const response = await apiFetch<{ budgetCode: ProjectBudgetCode }>(
        `/api/projects/${projectId}/budget-codes`,
        {
          method: "POST",
          body: JSON.stringify({
            cost_code_id: input.costCodeId,
            cost_type_id: input.costTypeId,
            description: input.description ?? null,
          }),
        },
      );

      const createdCode = response?.budgetCode;
      // A 2xx response must carry the created code. If it doesn't, fail loudly
      // here (surfaced as a toast by callers) instead of returning null and
      // letting a deferred setState updater dereference `.id` and crash the page.
      if (!createdCode) {
        throw new Error("Budget code creation returned no code");
      }
      setBudgetCodes((prev) =>
        prev.some((code) => code.id === createdCode.id)
          ? prev.map((code) => (code.id === createdCode.id ? createdCode : code))
          : [...prev, createdCode],
      );
      return createdCode;
    },
    [projectId],
  );

  return {
    budgetCodes,
    loadingCodes,
    refreshBudgetCodes,
    createBudgetCode,
  };
}
