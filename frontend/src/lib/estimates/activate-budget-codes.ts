/**
 * Shared budget-code activation for estimate → contract / budget seeding flows.
 *
 * Given a project + a set of (cost_code, cost_type_code) rows, this:
 * 1. Creates any missing rows in `cost_codes` (with division inferred from prefix).
 * 2. Inserts any missing `project_budget_codes`, or reactivates them if previously archived.
 * 3. Returns a map of (cost_code_id|cost_type_id) → project_budget_code.id for callers
 *    to attach to their downstream inserts (contract_line_items, budget_lines).
 *
 * Extracted from:
 *   frontend/src/app/api/projects/[projectId]/contracts/[contractId]/line-items/estimate-import/activate-budget-codes/route.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface BudgetCodeActivationRow {
  costCode: string;
  costTypeCode: string;
  description: string;
}

export interface ActivationResult {
  /** Map of `${costCodeId}|${costTypeId}` → project_budget_code id */
  budgetCodeByKey: Map<string, string>;
  /** Map of `${costCode}|${costTypeCode}` → cost_type_id (UUID) */
  costTypeIdByCode: Map<string, string>;
  createdCostCodes: number;
  addedProjectBudgetCodes: number;
  reactivatedProjectBudgetCodes: number;
}

export class BudgetCodeActivationError extends Error {
  constructor(message: string, public readonly details?: string) {
    super(message);
    this.name = "BudgetCodeActivationError";
  }
}

interface CostCodeDivision {
  id: string;
  code: string;
}

function resolveDivisionId(costCodeId: string, divisions: CostCodeDivision[]): string | null {
  const [prefix] = costCodeId.split("-");
  const cleanedPrefix = prefix?.trim() || "";
  const normalizedPrefix = cleanedPrefix.replace(/^0+(\d)/, "$1");

  const byCode = divisions.find((division) => {
    const divisionCode = division.code.trim();
    const normalizedDivisionCode = divisionCode.replace(/^0+(\d)/, "$1");
    return divisionCode === cleanedPrefix || normalizedDivisionCode === normalizedPrefix;
  });
  if (byCode) return byCode.id;

  const generalDivision = divisions.find(
    (division) =>
      division.id.toLowerCase() === "general" || division.code.toLowerCase() === "general",
  );
  if (generalDivision) return generalDivision.id;

  return divisions[0]?.id ?? null;
}

export async function activateBudgetCodes(
  supabase: SupabaseClient<Database>,
  projectId: number,
  rawRows: BudgetCodeActivationRow[],
): Promise<ActivationResult> {
  const uniqueRows = Array.from(
    new Map(rawRows.map((row) => [`${row.costCode}|${row.costTypeCode}`, row])).values(),
  );

  if (uniqueRows.length === 0) {
    return {
      budgetCodeByKey: new Map(),
      costTypeIdByCode: new Map(),
      createdCostCodes: 0,
      addedProjectBudgetCodes: 0,
      reactivatedProjectBudgetCodes: 0,
    };
  }

  // 1. Resolve cost types
  const { data: costTypes, error: costTypesError } = await supabase
    .from("cost_code_types")
    .select("id, code")
    .in("code", [...new Set(uniqueRows.map((row) => row.costTypeCode))]);
  if (costTypesError) {
    throw new BudgetCodeActivationError("Failed to resolve cost types.", costTypesError.message);
  }

  const costTypeIdByCode = new Map((costTypes ?? []).map((row) => [row.code, row.id]));
  const missingCostTypes = uniqueRows
    .map((row) => row.costTypeCode)
    .filter((code) => !costTypeIdByCode.has(code));
  if (missingCostTypes.length > 0) {
    throw new BudgetCodeActivationError(
      `Unknown cost type${missingCostTypes.length === 1 ? "" : "s"}: ${[...new Set(missingCostTypes)].join(", ")}.`,
    );
  }

  // 2. Create missing cost codes
  const costCodeIds = [...new Set(uniqueRows.map((row) => row.costCode))];
  const { data: existingCostCodes, error: existingCostCodesError } = await supabase
    .from("cost_codes")
    .select("id")
    .in("id", costCodeIds);
  if (existingCostCodesError) {
    throw new BudgetCodeActivationError(
      "Failed to check existing cost codes.",
      existingCostCodesError.message,
    );
  }

  const existingCostCodeIds = new Set((existingCostCodes ?? []).map((row) => row.id));
  const missingCostCodeRows = uniqueRows.filter((row) => !existingCostCodeIds.has(row.costCode));
  let createdCostCodes = 0;

  if (missingCostCodeRows.length > 0) {
    const { data: divisionsData, error: divisionsError } = await supabase
      .from("cost_code_divisions")
      .select("id, code")
      .eq("is_active", true)
      .order("code", { ascending: true });
    if (divisionsError) {
      throw new BudgetCodeActivationError(
        "Failed to resolve cost-code divisions.",
        divisionsError.message,
      );
    }

    const divisions: CostCodeDivision[] = divisionsData ?? [];
    const costCodesToInsert = missingCostCodeRows.map((row) => {
      const divisionId = resolveDivisionId(row.costCode, divisions);
      if (!divisionId) {
        throw new BudgetCodeActivationError(
          `Could not determine division for cost code "${row.costCode}".`,
        );
      }
      return {
        id: row.costCode,
        title: row.description,
        division_id: divisionId,
        status: "active",
      };
    });

    const { error: createCostCodesError } = await supabase
      .from("cost_codes")
      .upsert(costCodesToInsert, { onConflict: "id" });
    if (createCostCodesError) {
      throw new BudgetCodeActivationError(
        "Failed to create missing cost codes.",
        createCostCodesError.message,
      );
    }
    createdCostCodes = missingCostCodeRows.length;
  }

  // 3. Insert / reactivate project_budget_codes
  const { data: existingProjectBudgetCodes, error: existingPbcError } = await supabase
    .from("project_budget_codes")
    .select("id, cost_code_id, cost_type_id, is_active")
    .eq("project_id", projectId)
    .in("cost_code_id", costCodeIds);
  if (existingPbcError) {
    throw new BudgetCodeActivationError(
      "Failed to check existing project budget codes.",
      existingPbcError.message,
    );
  }

  const existingPbcByKey = new Map(
    (existingProjectBudgetCodes ?? []).map((row) => [`${row.cost_code_id}|${row.cost_type_id}`, row]),
  );

  const toInsert = uniqueRows
    .filter((row) => {
      const costTypeId = costTypeIdByCode.get(row.costTypeCode);
      return !existingPbcByKey.has(`${row.costCode}|${costTypeId}`);
    })
    .map((row) => ({
      project_id: projectId,
      cost_code_id: row.costCode,
      cost_type_id: costTypeIdByCode.get(row.costTypeCode)!,
      description: row.description,
      is_active: true,
    }));

  const toActivateIds = (existingProjectBudgetCodes ?? [])
    .filter((row) => {
      const matchesImport = uniqueRows.some((candidate) => {
        const costTypeId = costTypeIdByCode.get(candidate.costTypeCode);
        return candidate.costCode === row.cost_code_id && costTypeId === row.cost_type_id;
      });
      return matchesImport && !row.is_active;
    })
    .map((row) => row.id);

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("project_budget_codes")
      .insert(toInsert);
    if (insertError) {
      throw new BudgetCodeActivationError(
        "Failed to activate project budget codes.",
        insertError.message,
      );
    }
  }

  if (toActivateIds.length > 0) {
    const { error: reactivateError } = await supabase
      .from("project_budget_codes")
      .update({ is_active: true })
      .in("id", toActivateIds);
    if (reactivateError) {
      throw new BudgetCodeActivationError(
        "Failed to reactivate project budget codes.",
        reactivateError.message,
      );
    }
  }

  // 4. Reload to get all ids (including just-inserted)
  const { data: activePbcs, error: activeError } = await supabase
    .from("project_budget_codes")
    .select("id, cost_code_id, cost_type_id")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .in("cost_code_id", costCodeIds);
  if (activeError) {
    throw new BudgetCodeActivationError(
      "Failed to reload active project budget codes.",
      activeError.message,
    );
  }

  const budgetCodeByKey = new Map(
    (activePbcs ?? []).map((row) => [`${row.cost_code_id}|${row.cost_type_id}`, row.id]),
  );

  return {
    budgetCodeByKey,
    costTypeIdByCode,
    createdCostCodes,
    addedProjectBudgetCodes: toInsert.length,
    reactivatedProjectBudgetCodes: toActivateIds.length,
  };
}
