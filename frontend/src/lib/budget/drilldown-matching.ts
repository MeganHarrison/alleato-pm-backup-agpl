/**
 * Shared target resolution + budget-code matching for budget drilldown
 * sidebars (Approved COs, Committed Costs, Pending Cost Changes, …).
 *
 * Two invariants every drilldown route must respect:
 *
 * 1. The sidebar can be opened from a real budget line (budgetLineId is a
 *    budget_lines UUID) or from a synthetic division/subdivision group row
 *    (id like "division-50" with the code prefix in costCode).
 * 2. SOV / line-item budget codes are stored in mixed formats across
 *    imports — "50-5500.S", "505500", or a project_budget_codes UUID —
 *    so rows must be matched by normalized lookup key (exactly like
 *    computeBudgetGrandTotals), never by exact string equality.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  normalizeBudgetCode,
  normalizeBudgetCodeLookupKey,
} from "@/lib/budget/compute-grand-totals";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface BudgetDrilldownTargets {
  /** budget_lines.id values in scope (one line, or every line in a division). */
  budgetLineIds: string[];
  /** cost_codes.id values in scope. */
  costCodeIds: string[];
}

/** Resolve which budget lines / cost codes a drilldown request targets. */
export async function resolveBudgetDrilldownTargets(
  supabase: SupabaseServerClient,
  projectIdNum: number,
  budgetLineId: string | null,
  costCodeParam: string | null,
): Promise<BudgetDrilldownTargets> {
  const { data: projectLines, error } = await supabase
    .from("budget_lines")
    .select("id, cost_code_id")
    .eq("project_id", projectIdNum);

  if (error || !projectLines) {
    return { budgetLineIds: [], costCodeIds: [] };
  }

  const isGroupRow =
    !budgetLineId ||
    budgetLineId.startsWith("division-") ||
    budgetLineId.startsWith("subdivision-");

  if (!isGroupRow) {
    const line = projectLines.find((row) => row.id === budgetLineId);
    if (line) {
      return {
        budgetLineIds: [line.id],
        costCodeIds: line.cost_code_id ? [line.cost_code_id] : [],
      };
    }
  }

  const prefix =
    costCodeParam?.trim() ||
    budgetLineId?.replace(/^(division|subdivision)-/, "") ||
    "";
  if (!prefix) {
    return { budgetLineIds: [], costCodeIds: [] };
  }

  const matching = projectLines.filter(
    (row) => row.cost_code_id && row.cost_code_id.startsWith(prefix),
  );
  return {
    budgetLineIds: matching.map((row) => row.id),
    costCodeIds: Array.from(
      new Set(
        matching
          .map((row) => row.cost_code_id)
          .filter((code): code is string => Boolean(code)),
      ),
    ),
  };
}

/**
 * Build a matcher that answers "does this stored budget_code belong to one
 * of the target cost codes?" using the same translation + normalization as
 * the grand-totals aggregation.
 */
export async function createBudgetCodeMatcher(
  supabase: SupabaseServerClient,
  projectIdNum: number,
  targetCostCodeIds: string[],
): Promise<(budgetCode: string | null | undefined) => boolean> {
  const targetKeys = new Set(
    targetCostCodeIds.map((code) => normalizeBudgetCodeLookupKey(code)),
  );

  // project_budget_codes translation: some rows store the
  // project_budget_codes UUID instead of the cost code string.
  const { data: pccRows } = await supabase
    .from("project_budget_codes")
    .select("id, cost_code_id")
    .eq("project_id", projectIdNum);
  const pccToCostCodeId = new Map<string, string>();
  for (const pcc of pccRows ?? []) {
    if (pcc.id && pcc.cost_code_id) pccToCostCodeId.set(pcc.id, pcc.cost_code_id);
  }

  return (budgetCode) => {
    if (!budgetCode) return false;
    const translated = pccToCostCodeId.get(budgetCode) ?? budgetCode;
    return targetKeys.has(
      normalizeBudgetCodeLookupKey(normalizeBudgetCode(translated)),
    );
  };
}
