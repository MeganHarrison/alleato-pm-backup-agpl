"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// =============================================================================
// Types
// =============================================================================

export interface CostCode {
  id: string;
  division_id: string;
  division_title: string | null;
  title: string | null;
}

export interface CostCodeType {
  id: string;
  code: string;
  description: string;
  category: string | null;
}

export interface ProjectCostCode {
  id: string;
  cost_code_id: string;
  cost_type_id: string | null;
  is_active: boolean;
}

// =============================================================================
// Query Keys
// =============================================================================

const keys = {
  all: (projectId: string) => ["project-cost-codes", projectId] as const,
  masterCodes: () => ["master-cost-codes"] as const,
  costTypes: () => ["cost-code-types"] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch all master cost codes (the full CSI list)
 */
export function useMasterCostCodes() {
  return useQuery({
    queryKey: keys.masterCodes(),
    queryFn: async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("cost_codes")
        .select("id, division_id, division_title, title")
        .order("division_id", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;
      return (data || []) as CostCode[];
    },
    staleTime: 1000 * 60 * 10, // Master codes rarely change
  });
}

/**
 * Fetch all cost code types (L, E, S, M, etc.)
 */
export function useCostCodeTypes() {
  return useQuery({
    queryKey: keys.costTypes(),
    queryFn: async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("cost_code_types")
        .select("id, code, description, category")
        .order("code", { ascending: true });

      if (error) throw error;
      return (data || []) as CostCodeType[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Fetch project cost codes (which codes are active for this project)
 */
export function useProjectCostCodes(projectId: string) {
  return useQuery({
    queryKey: keys.all(projectId),
    queryFn: async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_budget_codes")
        .select("id, cost_code_id, cost_type_id, is_active")
        .eq("project_id", Number.parseInt(projectId, 10))
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as ProjectCostCode[];
    },
    enabled: !!projectId,
  });
}

export interface BudgetLineAmount {
  cost_code_id: string;
  cost_type_id: string;
  original_amount: number;
}

interface BulkSyncCostCodesResponse {
  added: number;
  activated: number;
  deactivated: number;
}

/**
 * Fetch existing budget line amounts for a project (cost_code_id + cost_type_id → original_amount).
 * Used to pre-populate the amount field on the cost-codes tab.
 */
export function useProjectBudgetAmounts(projectId: string) {
  return useQuery({
    queryKey: ["project-budget-amounts", projectId] as const,
    queryFn: async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("budget_lines")
        .select("cost_code_id, cost_type_id, original_amount")
        .eq("project_id", Number.parseInt(projectId, 10))
        .not("cost_type_id", "is", null);

      if (error) throw error;
      return (data || []) as BudgetLineAmount[];
    },
    enabled: !!projectId,
  });
}

/**
 * Bulk sync cost codes for a specific cost type
 */
export function useBulkSyncCostCodes(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      costTypeId,
      costCodeIds,
    }: {
      costTypeId: string;
      costCodeIds: string[];
    }) =>
      apiFetch<BulkSyncCostCodesResponse>(
        `/api/projects/${projectId}/budget-codes/bulk`,
        {
          method: "PUT",
          body: JSON.stringify({
            cost_type_id: costTypeId,
            cost_code_ids: costCodeIds,
          }),
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: keys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: ["budget-codes", projectId] });
      const total = data.added + data.activated + data.deactivated;
      if (total > 0) {
        toast.success(`Updated cost codes (${data.added} added, ${data.deactivated} removed)`);
      } else {
        toast.success("No changes needed");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
