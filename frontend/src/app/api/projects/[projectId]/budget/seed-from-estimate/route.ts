/**
 * POST /api/projects/[projectId]/budget/seed-from-estimate
 *
 * Seeds (creates / merges) budget_lines from an approved estimate.
 * Groups estimate_detail_items + estimate_gc_items by (cost_code, cost_type)
 * and applies a user-chosen merge strategy:
 *
 *   - replace:   overwrite original_amount on existing matching budget_lines
 *   - merge_add: increment original_amount on existing matching budget_lines
 *   - merge_max: take the higher of existing vs estimate amount
 *
 * Inserts net-new budget_lines for any (cost_code, cost_type) not yet on the budget.
 * Activates any missing project_budget_codes + cost_codes along the way.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { activateBudgetCodes, BudgetCodeActivationError, type BudgetCodeActivationRow } from "@/lib/estimates/activate-budget-codes";
import { getBudgetLineAmountPolicy } from "@/lib/budget/new-line-amount-policy";
import type { Database } from "@/types/database.types";

const WHERE = "projects/[projectId]/budget/seed-from-estimate#POST";

const bodySchema = z.object({
  estimateId: z.number().int().positive(),
  mergeStrategy: z.enum(["replace", "merge_add", "merge_max"]),
});

type BudgetLineInsert = Database["public"]["Tables"]["budget_lines"]["Insert"];

function descriptionToCostTypeCode(description: string | null | undefined): string | null {
  if (!description) return null;
  const n = description.trim().toLowerCase();
  if (n === "labor") return "L";
  if (n === "material") return "M";
  if (n === "equipment") return "E";
  if (n === "subcontract") return "S";
  if (n === "other") return "O";
  if (n === "overhead") return "OH";
  if (n === "profit") return "P";
  if (n === "contract revenue" || n === "revenue") return "R";
  if (n === "expense") return "X";
  return null;
}

export const POST = withApiGuardrails<{ projectId: string }>(WHERE, async ({ request, params }) => {
  const projectId = parseInt(params.projectId, 10);
  if (Number.isNaN(projectId)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid project ID." });
  }
  const guard = await requirePermission(projectId, "budget", "write");
  if (guard.denied) return guard.response;

  const body = await request.json().catch(() => {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Malformed payload." });
  });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid payload.",
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const { estimateId, mergeStrategy } = parsed.data;

  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  // Post-execution amount lock: seeding from an estimate would write non-zero
  // amounts onto budget_lines, which violates the rule that budget amounts
  // can only come from the executed prime contract. Block the entire seed
  // operation when the lock is active. Controlled by
  // NEXT_PUBLIC_LOCK_NEW_BUDGET_LINE_AMOUNTS_AFTER_CONTRACT_EXECUTION.
  const amountPolicy = await getBudgetLineAmountPolicy(supabase, projectId);
  if (amountPolicy.requireZeroAmount) {
    return NextResponse.json(
      {
        error:
          "Budget amounts are locked after prime contract execution. Seeding the budget from an estimate is not allowed; budget changes flow through change orders.",
        code: "BUDGET_AMOUNT_LOCKED",
      },
      { status: 422 },
    );
  }

  // 1. Validate estimate
  const { data: estimate, error: estError } = await supabase
    .from("estimates")
    .select("estimate_id, project_id, status")
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (estError) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: estError.message });
  if (!estimate) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Estimate not found." });
  }
  if (estimate.project_id !== projectId) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Estimate does not belong to this project." });
  }
  if (estimate.status !== "approved") {
    return NextResponse.json(
      { error: "Estimate is not approved.", status: estimate.status },
      { status: 422 },
    );
  }

  // 2. Fetch estimate items
  const [detailRes, gcRes] = await Promise.all([
    supabase.from("estimate_detail_items").select("*").eq("estimate_id", estimateId),
    supabase.from("estimate_gc_items").select("*").eq("estimate_id", estimateId),
  ]);
  if (detailRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: detailRes.error.message });
  if (gcRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: gcRes.error.message });

  // 3. Activate budget codes
  const activationRows: BudgetCodeActivationRow[] = [];
  for (const item of detailRes.data ?? []) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    activationRows.push({
      costCode: item.cost_code,
      costTypeCode: code,
      description: item.cost_code_name || item.work_description || item.cost_code,
    });
  }
  for (const item of gcRes.data ?? []) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    activationRows.push({
      costCode: item.cost_code,
      costTypeCode: code,
      description: item.description || item.cost_code,
    });
  }

  let activation;
  try {
    activation = await activateBudgetCodes(supabase, projectId, activationRows);
  } catch (err) {
    if (err instanceof BudgetCodeActivationError) {
      throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: err.message, details: err.details });
    }
    throw err;
  }

  // 4. Group by (cost_code, cost_type_id)
  interface Group {
    costCodeId: string;
    costTypeId: string;
    description: string;
    amount: number;
    projectBudgetCodeId: string | null;
  }
  const groups = new Map<string, Group>();

  const addToGroup = (costCode: string, costTypeCode: string, description: string, amount: number) => {
    const costTypeId = activation.costTypeIdByCode.get(costTypeCode);
    if (!costTypeId) return;
    const key = `${costCode}|${costTypeId}`;
    const projectBudgetCodeId = activation.budgetCodeByKey.get(key) ?? null;
    const existing = groups.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      groups.set(key, {
        costCodeId: costCode,
        costTypeId,
        description,
        amount,
        projectBudgetCodeId,
      });
    }
  };

  for (const item of detailRes.data ?? []) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    addToGroup(
      item.cost_code,
      code,
      item.cost_code_name || item.work_description || item.cost_code,
      Number(item.estimated_amount) || 0,
    );
  }
  for (const item of gcRes.data ?? []) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const allocation = (Number(item.allocation) ?? 100) / 100;
    addToGroup(item.cost_code, code, item.description || item.cost_code, qty * rate * allocation);
  }

  // 5. Fetch existing budget_lines for this project & these (cost_code, cost_type) combos
  const costCodeIds = [...new Set([...groups.values()].map((g) => g.costCodeId))];
  const costTypeIds = [...new Set([...groups.values()].map((g) => g.costTypeId))];
  const { data: existingLines, error: existingError } = await supabase
    .from("budget_lines")
    .select("id, cost_code_id, cost_type_id, original_amount")
    .eq("project_id", projectId)
    .in("cost_code_id", costCodeIds)
    .in("cost_type_id", costTypeIds);
  if (existingError) {
    throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: existingError.message });
  }
  const existingByKey = new Map(
    (existingLines ?? []).map((row) => [`${row.cost_code_id}|${row.cost_type_id}`, row]),
  );

  // 6. Apply merge strategy
  let upsertedCount = 0;
  let skippedCount = 0;
  const inserts: BudgetLineInsert[] = [];

  for (const [key, group] of groups) {
    const existing = existingByKey.get(key);
    if (existing) {
      const currentAmount = Number(existing.original_amount) || 0;
      let nextAmount = currentAmount;
      if (mergeStrategy === "replace") {
        nextAmount = group.amount;
      } else if (mergeStrategy === "merge_add") {
        nextAmount = currentAmount + group.amount;
      } else if (mergeStrategy === "merge_max") {
        nextAmount = Math.max(currentAmount, group.amount);
      }
      if (nextAmount === currentAmount) {
        skippedCount++;
        continue;
      }
      const { error: updError } = await supabase
        .from("budget_lines")
        .update({
          original_amount: nextAmount,
          estimate_id: estimateId,
          updated_by: user.id,
        })
        .eq("id", existing.id);
      if (updError) {
        throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: updError.message });
      }
      upsertedCount++;
    } else {
      inserts.push({
        project_id: projectId,
        cost_code_id: group.costCodeId,
        cost_type_id: group.costTypeId,
        description: group.description,
        original_amount: group.amount,
        project_budget_code_id: group.projectBudgetCodeId,
        estimate_id: estimateId,
        created_by: user.id,
      });
    }
  }

  if (inserts.length > 0) {
    const { error: insError } = await supabase.from("budget_lines").insert(inserts);
    if (insError) {
      throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: insError.message });
    }
    upsertedCount += inserts.length;
  }

  // 7. Refresh projects.budget total
  const { data: allLines, error: allLinesError } = await supabase
    .from("budget_lines")
    .select("original_amount")
    .eq("project_id", projectId);
  if (allLinesError) {
    throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: allLinesError.message });
  }
  const totalBudget = (allLines ?? []).reduce((sum, row) => sum + (Number(row.original_amount) || 0), 0);

  await supabase.from("projects").update({ budget: totalBudget }).eq("id", projectId);

  return NextResponse.json({
    upsertedCount,
    skippedCount,
    totalBudget,
    budgetCodes: {
      created: activation.createdCostCodes,
      added: activation.addedProjectBudgetCodes,
      reactivated: activation.reactivatedProjectBudgetCodes,
    },
  });
});
