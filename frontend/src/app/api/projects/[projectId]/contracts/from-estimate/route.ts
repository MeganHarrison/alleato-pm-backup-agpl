/**
 * POST /api/projects/[projectId]/contracts/from-estimate
 *
 * Creates a new prime contract seeded from an approved estimate.
 * Maps estimate_detail_items + estimate_gc_items (+ optional alternates/allowances)
 * → contract_line_items, activating any missing project_budget_codes.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { activateBudgetCodes, BudgetCodeActivationError, type BudgetCodeActivationRow } from "@/lib/estimates/activate-budget-codes";
import type { Database } from "@/types/database.types";

const WHERE = "projects/[projectId]/contracts/from-estimate#POST";

const bodySchema = z.object({
  estimateId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  contract_number: z.string().min(1).max(100).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  client_id: z.string().uuid().optional(),
  contractor_id: z.string().uuid().optional(),
  contract_company_id: z.string().uuid().optional(),
  retention_percentage: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  includedDetailItemIds: z.array(z.number().int()).optional(),
  includedAlternateIds: z.array(z.number().int()).optional(),
  includedAllowanceIds: z.array(z.number().int()).optional(),
});

type LineItemInsert = Database["public"]["Tables"]["contract_line_items"]["Insert"];

/**
 * Map estimate cost_type description ("Labor", "Subcontract", "Revenue", "Expense")
 * to its short code in cost_code_types ("L", "S", "R", "X").
 */
function descriptionToCostTypeCode(description: string | null | undefined): string | null {
  if (!description) return null;
  const normalized = description.trim().toLowerCase();
  switch (normalized) {
    case "labor":
      return "L";
    case "material":
      return "M";
    case "equipment":
      return "E";
    case "subcontract":
      return "S";
    case "other":
      return "O";
    case "overhead":
      return "OH";
    case "profit":
      return "P";
    case "contract revenue":
    case "revenue":
      return "R";
    case "expense":
      return "X";
    default:
      return null;
  }
}

export const POST = withApiGuardrails<{ projectId: string }>(WHERE, async ({ request, params }) => {
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
  const payload = parsed.data;

  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  // 1. Validate estimate belongs to project + is approved
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("estimate_id, project_id, status, revision, title")
    .eq("estimate_id", payload.estimateId)
    .maybeSingle();
  if (estimateError) {
    throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: estimateError.message });
  }
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

  // 2. Fetch estimate detail data
  const [detailRes, gcRes, altRes, allowRes] = await Promise.all([
    supabase.from("estimate_detail_items").select("*").eq("estimate_id", payload.estimateId),
    supabase.from("estimate_gc_items").select("*").eq("estimate_id", payload.estimateId),
    supabase.from("estimate_alternates").select("*").eq("estimate_id", payload.estimateId).order("sort_order"),
    supabase.from("estimate_allowances").select("*").eq("estimate_id", payload.estimateId).order("sort_order"),
  ]);
  if (detailRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: detailRes.error.message });
  if (gcRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: gcRes.error.message });
  if (altRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: altRes.error.message });
  if (allowRes.error) throw new GuardrailError({ code: "UPSTREAM_FAILURE", where: WHERE, message: allowRes.error.message });

  let detailItems = detailRes.data ?? [];
  const gcItems = gcRes.data ?? [];

  if (payload.includedDetailItemIds && payload.includedDetailItemIds.length > 0) {
    const includeSet = new Set(payload.includedDetailItemIds);
    detailItems = detailItems.filter((row) => includeSet.has(row.id));
  }

  const includedAlternates = payload.includedAlternateIds
    ? (altRes.data ?? []).filter((a) => payload.includedAlternateIds!.includes(a.alternate_id))
    : [];
  const includedAllowances = payload.includedAllowanceIds
    ? (allowRes.data ?? []).filter((a) => payload.includedAllowanceIds!.includes(a.allowance_id))
    : [];

  // 3. Build activation rows (cost code + cost-type code + description)
  const activationRows: BudgetCodeActivationRow[] = [];
  for (const item of detailItems) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    activationRows.push({
      costCode: item.cost_code,
      costTypeCode: code,
      description: item.cost_code_name || item.work_description || item.cost_code,
    });
  }
  for (const item of gcItems) {
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

  // 4. Compute contract total + generate contract_number
  const detailTotal = detailItems.reduce((sum, item) => sum + (Number(item.estimated_amount) || 0), 0);
  const gcTotal = gcItems.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.rate) || 0) * ((Number(item.allocation) ?? 100) / 100),
    0,
  );
  const altTotal = includedAlternates.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const allowTotal = includedAllowances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalValue = detailTotal + gcTotal + altTotal + allowTotal;

  let contractNumber = payload.contract_number;
  if (!contractNumber) {
    const { count } = await supabase
      .from("prime_contracts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    contractNumber = `PC-${String((count ?? 0) + 1).padStart(4, "0")}`;
  }

  // 5. Insert prime contract
  const { data: contract, error: insertError } = await supabase
    .from("prime_contracts")
    .insert({
      project_id: projectId,
      contract_number: contractNumber,
      title: payload.title,
      description: payload.description ?? null,
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
      client_id: payload.client_id ?? null,
      contractor_id: payload.contractor_id ?? null,
      contract_company_id: payload.contract_company_id ?? null,
      retention_percentage: payload.retention_percentage ?? null,
      original_contract_value: totalValue,
      revised_contract_value: totalValue,
      status: "draft",
      estimate_id: payload.estimateId,
      estimate_version: estimate.revision,
      last_synced_from_estimate_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !contract) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to create prime contract.",
      details: insertError?.message,
    });
  }

  // 6. Build + insert contract_line_items
  const lineItems: LineItemInsert[] = [];
  let lineNumber = 1;

  for (const item of detailItems) {
    if (!item.cost_code || !item.cost_type) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    if (!code) continue;
    const costTypeId = activation.costTypeIdByCode.get(code);
    const budgetCodeId = costTypeId ? activation.budgetCodeByKey.get(`${item.cost_code}|${costTypeId}`) : null;
    lineItems.push({
      contract_id: contract.id,
      line_number: lineNumber++,
      description: `${item.division_name}: ${item.work_description ?? item.cost_code_name ?? item.cost_code}`,
      total_cost: Number(item.estimated_amount) || 0,
      cost_code_id: item.cost_code,
      budget_code_id: budgetCodeId ?? null,
    });
  }

  for (const item of gcItems) {
    if (!item.cost_code) continue;
    const code = descriptionToCostTypeCode(item.cost_type);
    const costTypeId = code ? activation.costTypeIdByCode.get(code) : undefined;
    const budgetCodeId = costTypeId ? activation.budgetCodeByKey.get(`${item.cost_code}|${costTypeId}`) : null;
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const allocation = (Number(item.allocation) ?? 100) / 100;
    lineItems.push({
      contract_id: contract.id,
      line_number: lineNumber++,
      description: item.description,
      quantity: qty,
      unit_cost: rate,
      total_cost: qty * rate * allocation,
      cost_code_id: item.cost_code,
      budget_code_id: budgetCodeId ?? null,
    });
  }

  for (const alt of includedAlternates) {
    lineItems.push({
      contract_id: contract.id,
      line_number: lineNumber++,
      description: `Alternate ${alt.alternate_number}: ${alt.description}`,
      total_cost: Number(alt.amount) || 0,
    });
  }
  for (const allow of includedAllowances) {
    lineItems.push({
      contract_id: contract.id,
      line_number: lineNumber++,
      description: `Allowance ${allow.allowance_number}: ${allow.description}`,
      total_cost: Number(allow.amount) || 0,
    });
  }

  if (lineItems.length > 0) {
    const { error: linesError } = await supabase.from("contract_line_items").insert(lineItems);
    if (linesError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to insert contract line items.",
        details: linesError.message,
      });
    }
  }

  return NextResponse.json(
    {
      contractId: contract.id,
      contractNumber,
      lineItemCount: lineItems.length,
      totalValue,
      estimateVersion: estimate.revision,
      budgetCodes: {
        created: activation.createdCostCodes,
        added: activation.addedProjectBudgetCodes,
        reactivated: activation.reactivatedProjectBudgetCodes,
      },
    },
    { status: 201 },
  );
});
