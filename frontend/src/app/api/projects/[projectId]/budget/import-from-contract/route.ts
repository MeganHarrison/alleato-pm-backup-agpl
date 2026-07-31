import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import {
  activateBudgetCodes,
  BudgetCodeActivationError,
  type BudgetCodeActivationRow,
} from "@/lib/estimates/activate-budget-codes";

const MARKUP_BUDGET_CODE_BY_TYPE = {
  insurance: {
    costCode: "55-0050",
    costTypeCode: "R",
    description: "Insurance",
  },
  fee: {
    costCode: "55-0500",
    costTypeCode: "R",
    description: "Contractor Fee",
  },
} satisfies Record<string, BudgetCodeActivationRow>;

type MarkupType = keyof typeof MARKUP_BUDGET_CODE_BY_TYPE;

function isSupportedMarkupType(value: string | null): value is MarkupType {
  return value != null && value in MARKUP_BUDGET_CODE_BY_TYPE;
}

type ResolvedSovItem = {
  contractLineItemId: string;
  lineNumber: number | null;
  description: string | null;
  costCodeId: string;
  costTypeId: string;
  budgetCodeId: string | null;
  originalAmount: number;
  quantity: number | null;
  unitCost: number | null;
  unitOfMeasure: string | null;
};

type BudgetLineLookup = {
  id: string;
  project_budget_code_id: string | null;
  cost_code_id: string;
  cost_type_id: string;
  original_amount: number | string | null;
  source_contract_line_item_id: string | null;
};

const amountMatches = (left: number, right: number) =>
  Math.abs(left - right) < 0.005;

function getBudgetLineKey(row: {
  budgetCodeId?: string | null;
  project_budget_code_id?: string | null;
  costCodeId?: string | null;
  cost_code_id?: string | null;
  costTypeId?: string | null;
  cost_type_id?: string | null;
}) {
  const budgetCodeId = row.budgetCodeId ?? row.project_budget_code_id;
  if (budgetCodeId) return `budget-code:${budgetCodeId}`;

  const costCodeId = row.costCodeId ?? row.cost_code_id;
  const costTypeId = row.costTypeId ?? row.cost_type_id;
  return `cost-code:${costCodeId ?? ""}|cost-type:${costTypeId ?? ""}`;
}

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/import-from-contract#POST",
  async ({ request, params }) => {
    const { projectId } = params;
    const numericProjectId = parseInt(projectId, 10);

    if (Number.isNaN(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const guard = await requirePermission(numericProjectId, "budget", "write");
    if (guard.denied) return guard.response;

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const body = await request.json() as { contractId?: string };
    const { contractId } = body;

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    // Verify the contract belongs to this project
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id, title, contract_number")
      .eq("id", contractId)
      .eq("project_id", numericProjectId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Fetch all SOV line items for the contract
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("contract_line_items")
      .select("id, description, budget_code_id, cost_code_id, quantity, unit_cost, total_cost, unit_of_measure, line_number, markup_type")
      .eq("contract_id", contractId)
      .order("line_number", { ascending: true });

    if (lineItemsError) {
      return NextResponse.json(
        { error: "Failed to fetch contract line items", details: lineItemsError.message },
        { status: 500 },
      );
    }

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: "No line items found in the contract's Schedule of Values" },
        { status: 400 },
      );
    }

    // Collect all budget_code_ids to batch-fetch project_budget_codes
    const budgetCodeIds = Array.from(
      new Set(lineItems.map((li) => li.budget_code_id).filter((id): id is string => id != null)),
    );

    const budgetCodeMap = new Map<string, { cost_code_id: string; cost_type_id: string | null }>();
    const markupBudgetCodeMap = new Map<MarkupType, {
      id: string;
      cost_code_id: string;
      cost_type_id: string;
    }>();

    if (budgetCodeIds.length > 0) {
      const { data: budgetCodes, error: budgetCodesError } = await supabase
        .from("project_budget_codes")
        .select("id, cost_code_id, cost_type_id")
        .in("id", budgetCodeIds);

      if (budgetCodesError) {
        return NextResponse.json(
          { error: "Failed to resolve project budget codes", details: budgetCodesError.message },
          { status: 500 },
        );
      }

      for (const bc of budgetCodes ?? []) {
        budgetCodeMap.set(bc.id, { cost_code_id: bc.cost_code_id, cost_type_id: bc.cost_type_id });
      }
    }

    const markupRowsToActivate = Array.from(
      new Map(
        lineItems
          .filter((item) => !item.budget_code_id && isSupportedMarkupType(item.markup_type))
          .map((item) => {
            const row = MARKUP_BUDGET_CODE_BY_TYPE[item.markup_type as MarkupType];
            return [`${row.costCode}|${row.costTypeCode}`, row] as const;
          }),
      ).values(),
    );

    if (markupRowsToActivate.length > 0) {
      try {
        const activation = await activateBudgetCodes(
          supabase as Parameters<typeof activateBudgetCodes>[0],
          numericProjectId,
          markupRowsToActivate,
        );

        for (const [markupType, row] of Object.entries(MARKUP_BUDGET_CODE_BY_TYPE)) {
          const costTypeId = activation.costTypeIdByCode.get(row.costTypeCode);
          if (!costTypeId) continue;
          const budgetCodeId = activation.budgetCodeByKey.get(`${row.costCode}|${costTypeId}`);
          if (!budgetCodeId) continue;

          budgetCodeMap.set(budgetCodeId, {
            cost_code_id: row.costCode,
            cost_type_id: costTypeId,
          });
          markupBudgetCodeMap.set(markupType as MarkupType, {
            id: budgetCodeId,
            cost_code_id: row.costCode,
            cost_type_id: costTypeId,
          });
        }
      } catch (error) {
        const details = error instanceof BudgetCodeActivationError ? error.details : undefined;
        return NextResponse.json(
          {
            error: "Failed to activate markup budget codes",
            details: details ?? (error instanceof Error ? error.message : "Unknown error"),
          },
          { status: 500 },
        );
      }
    }

    const resolvedItems: ResolvedSovItem[] = [];
    const created: unknown[] = [];
    const updated: unknown[] = [];
    const matched: string[] = [];
    const skipped: string[] = [];

    for (const item of lineItems) {
      // Resolve cost_code_id and cost_type_id
      let costCodeId: string | null = null;
      let costTypeId: string | null = null;
      let budgetCodeId: string | null = null;

      if (item.budget_code_id && budgetCodeMap.has(item.budget_code_id)) {
        const bc = budgetCodeMap.get(item.budget_code_id)!;
        costCodeId = bc.cost_code_id;
        costTypeId = bc.cost_type_id;
        budgetCodeId = item.budget_code_id;
      } else if (isSupportedMarkupType(item.markup_type) && markupBudgetCodeMap.has(item.markup_type)) {
        const bc = markupBudgetCodeMap.get(item.markup_type)!;
        costCodeId = bc.cost_code_id;
        costTypeId = bc.cost_type_id;
        budgetCodeId = bc.id;
      } else if (item.cost_code_id) {
        // Fallback: use cost_code_id directly, no cost type
        costCodeId = item.cost_code_id;
      }

      if (!costCodeId || !costTypeId) {
        skipped.push(`Line ${item.line_number}: "${item.description}" — no budget code or cost code mapped`);
        continue;
      }

      const originalAmount = Number(
        item.total_cost ??
          (item.unit_cost != null && item.quantity != null
            ? item.unit_cost * item.quantity
            : 0),
      );

      resolvedItems.push({
      contractLineItemId: item.id,
      lineNumber: item.line_number ?? null,
      description: item.description ?? null,
        costCodeId,
        costTypeId,
        budgetCodeId,
        originalAmount,
        quantity: item.quantity ?? null,
        unitCost: item.unit_cost ?? null,
        unitOfMeasure: item.unit_of_measure ?? null,
      });
    }

    const { data: existingLines, error: existingLinesError } = await supabase
      .from("budget_lines")
      .select("id, project_budget_code_id, cost_code_id, cost_type_id, original_amount, source_contract_line_item_id")
      .eq("project_id", numericProjectId);

    if (existingLinesError) {
      return NextResponse.json(
        { error: "Failed to check existing budget lines", details: existingLinesError.message },
        { status: 500 },
      );
    }

    const existingLinesBySource = new Map<string, BudgetLineLookup[]>();
    const unsourcedLegacyLinesByKey = new Map<string, BudgetLineLookup[]>();
    for (const line of (existingLines ?? []) as BudgetLineLookup[]) {
      if (line.source_contract_line_item_id) {
        const bucket = existingLinesBySource.get(line.source_contract_line_item_id) ?? [];
        bucket.push(line);
        existingLinesBySource.set(line.source_contract_line_item_id, bucket);
      } else {
        const key = getBudgetLineKey(line);
        const bucket = unsourcedLegacyLinesByKey.get(key) ?? [];
        bucket.push(line);
        unsourcedLegacyLinesByKey.set(key, bucket);
      }
    }

    const updateBudgetLine = async (lineId: string, item: ResolvedSovItem) =>
      supabase
        .from("budget_lines")
        .update({
          source_contract_line_item_id: item.contractLineItemId,
          cost_code_id: item.costCodeId,
          cost_type_id: item.costTypeId,
          project_budget_code_id: item.budgetCodeId,
          original_amount: item.originalAmount,
          description: item.description ?? null,
          quantity: item.quantity,
          unit_cost: item.unitCost,
          unit_of_measure: item.unitOfMeasure,
        })
        .eq("id", lineId)
        .select("id")
        .single();

    for (const item of resolvedItems) {
      const label = item.lineNumber != null
        ? `Line ${item.lineNumber}`
        : `Contract line ${item.contractLineItemId}`;
      const existingForSource = existingLinesBySource.get(item.contractLineItemId) ?? [];

      if (existingForSource.length > 1) {
        skipped.push(
          `${label} — multiple budget lines already reference this SOV line; reconcile duplicates before importing`,
        );
        continue;
      }

      if (existingForSource.length === 1) {
        const existingLine = existingForSource[0];
        const existingAmount = Number(existingLine.original_amount ?? 0);

        if (amountMatches(existingAmount, item.originalAmount)) {
          matched.push(existingLine.id);
          continue;
        }

        const { data: updateResult, error: updateError } =
          await updateBudgetLine(existingLine.id, item);

        if (updateError) {
          skipped.push(`${label} — ${updateError.message}`);
        } else {
          updated.push(updateResult);
        }
        continue;
      }

      const legacyKey = getBudgetLineKey(item);
      const legacyBucket = unsourcedLegacyLinesByKey.get(legacyKey) ?? [];
      const legacyLine = legacyBucket.shift();

      if (legacyLine) {
        unsourcedLegacyLinesByKey.set(legacyKey, legacyBucket);
        const { data: updateResult, error: updateError } =
          await updateBudgetLine(legacyLine.id, item);

        if (updateError) {
          skipped.push(`${label} — ${updateError.message}`);
        } else {
          updated.push(updateResult);
        }
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("budget_lines")
        .insert({
          project_id: numericProjectId,
          source_contract_line_item_id: item.contractLineItemId,
          cost_code_id: item.costCodeId,
          cost_type_id: item.costTypeId,
          project_budget_code_id: item.budgetCodeId,
          description: item.description ?? null,
          original_amount: item.originalAmount,
          quantity: item.quantity,
          unit_cost: item.unitCost,
          unit_of_measure: item.unitOfMeasure,
        })
        .select("id")
        .single();

      if (insertError) {
        skipped.push(`${label} — ${insertError.message}`);
      } else {
        created.push(inserted);
      }
    }

    const changedCount = created.length + updated.length;
    const reconciledCount = changedCount + matched.length;

    return NextResponse.json({
      success: true,
      importedCount: changedCount,
      createdCount: created.length,
      updatedCount: updated.length,
      matchedCount: matched.length,
      reconciledCount,
      totalRows: lineItems.length,
      skippedCount: skipped.length,
      skipped: skipped.length > 0 ? skipped : undefined,
      message: `Reconciled ${reconciledCount} budget line${reconciledCount === 1 ? "" : "s"} from ${lineItems.length} SOV row${lineItems.length === 1 ? "" : "s"} in "${contract.title || contract.contract_number}"`,
    });
  },
);
