import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import {
  isAlleatoEstimateWorkbook,
  parseAlleatoEstimateWorkbook,
} from "@/lib/prime-contracts/estimate-workbook-sov";

const WHERE =
  "projects/[projectId]/contracts/[contractId]/line-items/estimate-import/preview#POST";

export const POST = withApiGuardrails<{
  projectId: string;
  contractId: string;
}>(WHERE, async ({ request, params }) => {
  const numericProjectId = Number.parseInt(params.projectId, 10);

  if (Number.isNaN(numericProjectId)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid project ID.",
    });
  }

  const guard = await requirePermission(numericProjectId, "contracts", "read");
  if (guard.denied) return guard.response;

  const authResult = await verifyProjectAccess(numericProjectId);
  if (isAuthError(authResult)) return authResult;
  const supabase = authResult.serviceClient;

  const { data: contract, error: contractError } = await supabase
    .from("prime_contracts")
    .select("id")
    .eq("id", params.contractId)
    .eq("project_id", numericProjectId)
    .maybeSingle();

  if (contractError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to verify prime contract.",
      details: contractError.message,
    });
  }

  if (!contract) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Prime contract not found for this project.",
    });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "No estimate workbook provided.",
    });
  }

  const isExcel =
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xlsm") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel";

  if (!isExcel) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Upload an Alleato estimate workbook as .xlsx or .xlsm.",
    });
  }

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
    type: "buffer",
  });

  if (!isAlleatoEstimateWorkbook(workbook)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "This workbook is not an Alleato estimate template.",
      details: "Expected sheets named General Conditions and Details.",
    });
  }

  const preview = parseAlleatoEstimateWorkbook(workbook);
  const { data: existingLineItems, error: existingLineItemsError } =
    await supabase
      .from("contract_line_items")
      .select("cost_code_id, budget_code_id")
      .eq("contract_id", params.contractId);

  if (existingLineItemsError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to check existing schedule of values lines.",
      details: existingLineItemsError.message,
    });
  }

  const existingBudgetCodeIds = new Set(
    (existingLineItems ?? [])
      .map((item) => item.budget_code_id)
      .filter((id): id is string => Boolean(id)),
  );
  const existingUnmappedCostCodeIds = new Set(
    (existingLineItems ?? [])
      .filter((item) => !item.budget_code_id)
      .map((item) => item.cost_code_id)
      .filter((id): id is string => Boolean(id)),
  );

  const importableRows = preview.rows.filter((row) => row.includeInOwnerSov);
  const rowCostCodes = [...new Set(importableRows.map((row) => row.costCode))];
  const rowCostTypeCodes = [
    ...new Set(importableRows.map((row) => row.costTypeCode).filter(Boolean)),
  ];

  const { data: costTypes, error: costTypesError } = await supabase
    .from("cost_code_types")
    .select("id, code")
    .in("code", rowCostTypeCodes);

  if (costTypesError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to resolve estimate cost types.",
      details: costTypesError.message,
    });
  }

  const costTypeIdByCode = new Map(
    (costTypes ?? []).map((costType) => [costType.code, costType.id]),
  );

  const { data: projectBudgetCodes, error: projectBudgetCodesError } =
    await supabase
      .from("project_budget_codes")
      .select("id, cost_code_id, cost_type_id, is_active")
      .eq("project_id", numericProjectId)
      .in("cost_code_id", rowCostCodes);

  if (projectBudgetCodesError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to check project budget-code mappings.",
      details: projectBudgetCodesError.message,
    });
  }

  const activeBudgetCodeByCostCodeAndType = new Map<string, string>();
  for (const projectBudgetCode of projectBudgetCodes ?? []) {
    if (projectBudgetCode.is_active) {
      activeBudgetCodeByCostCodeAndType.set(
        `${projectBudgetCode.cost_code_id}|${projectBudgetCode.cost_type_id}`,
        projectBudgetCode.id,
      );
    }
  }

  const rows = preview.rows.map((row) => {
    const costTypeId = costTypeIdByCode.get(row.costTypeCode) ?? null;
    const budgetCodeId =
      activeBudgetCodeByCostCodeAndType.get(
        `${row.costCode}|${costTypeId ?? ""}`,
      ) ?? null;
    const alreadyInSov = budgetCodeId
      ? existingBudgetCodeIds.has(budgetCodeId)
      : existingUnmappedCostCodeIds.has(row.costCode);

    return {
      ...row,
      costTypeId,
      budgetCodeId,
      alreadyInSov,
      hasBudgetCodeMapping: Boolean(budgetCodeId),
      selectedByDefault:
        row.includeInOwnerSov && !alreadyInSov && row.warnings.length === 0,
    };
  });

  return NextResponse.json({
    ...preview,
    rows,
    importableCount: rows.filter((row) => row.includeInPrimeContract).length,
    ownerSovCount: rows.filter((row) => row.includeInOwnerSov).length,
    selectedByDefaultCount: rows.filter((row) => row.selectedByDefault).length,
    existingSovMatchCount: rows.filter((row) => row.alreadyInSov).length,
    missingBudgetCodeMappingCount: rows.filter(
      (row) => row.includeInOwnerSov && !row.hasBudgetCodeMapping,
    ).length,
    totalRows: rows.length,
  });
});
