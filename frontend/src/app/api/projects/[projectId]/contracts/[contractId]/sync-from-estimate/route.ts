/**
 * POST /api/projects/[projectId]/contracts/[contractId]/sync-from-estimate
 *
 * Resyncs a prime contract's SOV from its source estimate.
 * Guardrails: contract must be linked to an estimate, not executed, and in draft / out_for_signature status.
 *
 * Merge strategies:
 *  - replace_amounts: UPDATE existing line totals where cost_code matches, INSERT new lines, do not delete.
 *  - add_new_lines_only: only INSERT lines for cost codes not already in SOV.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import { activateBudgetCodes, BudgetCodeActivationError, type BudgetCodeActivationRow } from "@/lib/estimates/activate-budget-codes";
import type { Database } from "@/types/database.types";

const WHERE = "projects/[projectId]/contracts/[contractId]/sync-from-estimate#POST";

const RESYNC_ALLOWED_STATUSES = ["draft", "out_for_signature"] as const;

const bodySchema = z.object({
  mergeStrategy: z.enum(["replace_amounts", "add_new_lines_only"]),
});

type LineItemInsert = Database["public"]["Tables"]["contract_line_items"]["Insert"];

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

export const POST = withApiGuardrails<{ projectId: string; contractId: string }>(WHERE, async ({ request, params }) => {
  const projectId = parseInt(params.projectId, 10);
  if (Number.isNaN(projectId)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid project ID." });
  }
  const guard = await requirePermission(projectId, "contracts", "write");
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
  const { mergeStrategy } = parsed.data;

  const supabase = await createClient();

  // 1. Fetch contract
  const { data: contract, error: contractError } = await supabase
    .from("prime_contracts")
    .select("id, project_id, status, executed, estimate_id, estimate_version")
    .eq("id", params.contractId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (contractError) {
    throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: contractError.message });
  }
  if (!contract) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Contract not found." });
  }
  if (!contract.estimate_id) {
    return NextResponse.json({ error: "Contract is not linked to an estimate." }, { status: 422 });
  }
  if (contract.executed) {
    return NextResponse.json({ error: "Contract is executed. SOV cannot be changed." }, { status: 422 });
  }
  if (!(RESYNC_ALLOWED_STATUSES as readonly string[]).includes(contract.status)) {
    return NextResponse.json(
      {
        error: `Contract is ${contract.status}. Only Draft and Out for Signature contracts can be resynced.`,
      },
      { status: 422 },
    );
  }

  // 2. Fetch estimate + items
  const { data: estimate, error: estError } = await supabase
    .from("estimates")
    .select("estimate_id, status, revision")
    .eq("estimate_id", contract.estimate_id)
    .maybeSingle();
  if (estError) {
    throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: estError.message });
  }
  if (!estimate) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Linked estimate no longer exists." });
  }
  if (estimate.status !== "approved") {
    return NextResponse.json({ error: "Linked estimate is not approved." }, { status: 422 });
  }

  const [detailRes, gcRes, existingLinesRes] = await Promise.all([
    supabase.from("estimate_detail_items").select("*").eq("estimate_id", estimate.estimate_id),
    supabase.from("estimate_gc_items").select("*").eq("estimate_id", estimate.estimate_id),
    supabase.from("contract_line_items").select("id, cost_code_id, line_number, total_cost").eq("contract_id", contract.id),
  ]);
  if (detailRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: detailRes.error.message });
  if (gcRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: gcRes.error.message });
  if (existingLinesRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: existingLinesRes.error.message });

  const existingLines = existingLinesRes.data ?? [];
  const existingByCostCode = new Map<string, { id: string; line_number: number; total_cost: number | null }>();
  let maxLineNumber = 0;
  for (const line of existingLines) {
    if (line.cost_code_id) existingByCostCode.set(line.cost_code_id, line);
    if (line.line_number > maxLineNumber) maxLineNumber = line.line_number;
  }

  // 3. Build activation
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

  // 4. Compute target rows (cost_code → { description, totalCost, budgetCodeId })
  interface Target { description: string; totalCost: number; quantity: number | null; unitCost: number | null; budgetCodeId: string | null; costCodeId: string }
  const targetByCostCode = new Map<string, Target>();

  for (const item of detailRes.data ?? []) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    const costTypeId = activation.costTypeIdByCode.get(code);
    const budgetCodeId = costTypeId ? activation.budgetCodeByKey.get(`${item.cost_code}|${costTypeId}`) ?? null : null;
    const existing = targetByCostCode.get(item.cost_code);
    const amount = Number(item.estimated_amount) || 0;
    if (existing) {
      existing.totalCost += amount;
    } else {
      targetByCostCode.set(item.cost_code, {
        description: `${item.division_name}: ${item.work_description ?? item.cost_code_name ?? item.cost_code}`,
        totalCost: amount,
        quantity: null,
        unitCost: null,
        budgetCodeId,
        costCodeId: item.cost_code,
      });
    }
  }

  for (const item of gcRes.data ?? []) {
    if (!item.cost_code) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    const costTypeId = code ? activation.costTypeIdByCode.get(code) : undefined;
    const budgetCodeId = costTypeId ? activation.budgetCodeByKey.get(`${item.cost_code}|${costTypeId}`) ?? null : null;
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const allocation = (Number(item.allocation) ?? 100) / 100;
    const amount = qty * rate * allocation;
    const existing = targetByCostCode.get(item.cost_code);
    if (existing) {
      existing.totalCost += amount;
    } else {
      targetByCostCode.set(item.cost_code, {
        description: item.description,
        totalCost: amount,
        quantity: qty,
        unitCost: rate,
        budgetCodeId,
        costCodeId: item.cost_code,
      });
    }
  }

  // 5. Apply merge strategy
  let updatedCount = 0;
  let addedCount = 0;
  let skippedCount = 0;
  const inserts: LineItemInsert[] = [];

  for (const [costCode, target] of targetByCostCode) {
    const existing = existingByCostCode.get(costCode);
    if (existing) {
      if (mergeStrategy === "replace_amounts") {
        const { error: updError } = await supabase
          .from("contract_line_items")
          .update({ total_cost: target.totalCost })
          .eq("id", existing.id);
        if (updError) {
          throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: updError.message });
        }
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      inserts.push({
        contract_id: contract.id,
        line_number: ++maxLineNumber,
        description: target.description,
        total_cost: target.totalCost,
        quantity: target.quantity,
        unit_cost: target.unitCost,
        cost_code_id: target.costCodeId,
        budget_code_id: target.budgetCodeId,
      });
      addedCount++;
    }
  }

  if (inserts.length > 0) {
    const { error: insError } = await supabase.from("contract_line_items").insert(inserts);
    if (insError) {
      throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: insError.message });
    }
  }

  // 6. Update contract metadata
  const newTotal = Array.from(targetByCostCode.values()).reduce((s, t) => s + t.totalCost, 0);
  const { error: updateContractError } = await supabase
    .from("prime_contracts")
    .update({
      estimate_version: estimate.revision,
      last_synced_from_estimate_at: new Date().toISOString(),
      // Only refresh original_contract_value when caller did a full replace.
      ...(mergeStrategy === "replace_amounts" ? { original_contract_value: newTotal, revised_contract_value: newTotal } : {}),
    })
    .eq("id", contract.id);
  if (updateContractError) {
    throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: updateContractError.message });
  }

  return NextResponse.json({
    updatedCount,
    addedCount,
    skippedCount,
    estimateVersion: estimate.revision,
  });
});
