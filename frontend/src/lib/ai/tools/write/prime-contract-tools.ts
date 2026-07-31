import { tool } from "ai";
import { createHash, randomUUID } from "crypto";

import type { PrimeContractDraftWidgetPayload } from "@/lib/ai/assistant-widgets";
import {
  createPrimeContractDescription,
  createPrimeContractInputSchema,
  editPrimeContractSovDescription,
  editPrimeContractSovInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  hasPermission,
  loadUserPermissionsWithClient,
} from "@/lib/permissions";
import {
  createPrimeContract,
  createSupabasePrimeContractCreationStore,
  PrimeContractCreationError,
  type PrimeContractCreationLineItem,
} from "@/lib/prime-contracts/create-prime-contract";

import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

type PrimeContractLineInput = {
  description: string;
  amount: number;
  budgetCodeId?: string;
  costCodeId?: string;
  quantity?: number;
  unitCost?: number;
  unitOfMeasure?: string;
};

type BudgetLineRow = {
  id: string;
  project_budget_code_id: string | null;
  cost_code_id: string;
  description: string | null;
  original_amount: number;
  quantity: number | null;
  unit_cost: number | null;
  unit_of_measure: string | null;
};

type WorkbookRowInput = {
  sourceSheet: "General Conditions" | "Details";
  rowNumber: number;
  costCode: string;
  costTypeCode: string;
  description: string;
  workDescription?: string | null;
  budgetAmount: number;
  unitQty?: number | null;
  unitOfMeasure?: string | null;
  unitCost?: number | null;
  warnings: string[];
};

type OwnerResolution =
  | { status: "none"; id: null; name: null; message: string }
  | { status: "resolved"; id: string; name: string; message: string }
  | { status: "missing" | "ambiguous"; id: null; name: string | null; message: string };

type PrimeContractSovEditContract = {
  id: string;
  project_id: number;
  contract_number: string;
  title: string;
  status: string;
  executed: boolean;
  original_contract_value: number;
  revised_contract_value: number;
  is_private: boolean;
  allowed_user_ids: string[];
  created_by: string | null;
  updated_at: string;
};

type PrimeContractSovExistingRow = {
  id: string;
  contract_id: string;
  line_number: number;
  description: string;
  budget_code_id: string | null;
  cost_code_id: string | null;
  quantity: number | null;
  unit_cost: number | null;
  unit_of_measure: string | null;
  markup_type: string | null;
  updated_at: string;
};

type PrimeContractSovProjectCode = {
  id: string;
  cost_code_id: string;
  cost_type_id: string | null;
  description: string;
};

type PrimeContractSovCostType = {
  id: string;
  code: string;
  description: string;
};

type PrimeContractSovBudgetLine = {
  project_budget_code_id: string | null;
  cost_code_id: string;
  cost_type_id: string;
  original_amount: number;
};

type PrimeContractSovEditInputRow = {
  projectBudgetCodeId?: string;
  costCode?: string;
  costType?: string;
  description?: string;
  amount: number;
  quantity?: number;
  unitCost?: number;
  unitOfMeasure?: string;
};

type PrimeContractSovPlannedRow = {
  action: "update" | "append";
  existingId: string | null;
  lineNumber: number;
  projectBudgetCodeId: string;
  costCode: string;
  costType: string | null;
  description: string;
  amount: number;
  quantity: number;
  unitCost: number;
  unitOfMeasure: string | null;
};

type AtomicPrimeContractSovEditResult = {
  sovTotal: number | string;
  updatedRows: number;
  appendedRows: number;
  contractUpdatedAt: string;
};

type RuntimePrimeContractSovRpcClient = {
  rpc: (
    functionName: "ai_edit_draft_prime_contract_sov",
    params: Record<string, unknown>,
  ) => Promise<{
    data: AtomicPrimeContractSovEditResult | null;
    error: { code?: string; message: string } | null;
  }>;
};

const SOV_PREVIEW_AUDIT_TOOL = "editPrimeContractSovPreview";
const MAX_QUANTITY = 99_999_999_999.9999;
const MAX_CURRENCY = 9_999_999_999_999.99;

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeLineItems(
  lineItems: PrimeContractLineInput[],
  options: { allowManualZeroPlaceholders?: boolean } = {},
): {
  normalized: PrimeContractCreationLineItem[];
  errors: string[];
} {
  const errors: string[] = [];
  const normalized = lineItems.map((lineItem, index) => {
    const isManualZeroPlaceholderPair =
      options.allowManualZeroPlaceholders === true &&
      lineItem.amount > 0 &&
      lineItem.quantity === 0 &&
      lineItem.unitCost === 0;
    const hasQuantity =
      lineItem.quantity !== undefined && !isManualZeroPlaceholderPair;
    const hasUnitCost =
      lineItem.unitCost !== undefined && !isManualZeroPlaceholderPair;

    if (hasQuantity !== hasUnitCost) {
      errors.push(
        `Line ${index + 1}: provide both quantity and unit cost, or use the amount alone.`,
      );
    }

    if (hasQuantity && hasUnitCost) {
      const calculated = Number(lineItem.quantity) * Number(lineItem.unitCost);
      if (Math.abs(calculated - lineItem.amount) > 0.01) {
        errors.push(
          `Line ${index + 1}: quantity × unit cost must equal ${money(lineItem.amount)}.`,
        );
      }
    }

    return {
      line_number: index + 1,
      description: lineItem.description.trim(),
      budget_code_id: lineItem.budgetCodeId?.trim() || null,
      cost_code_id: lineItem.costCodeId?.trim() || null,
      quantity: hasQuantity && hasUnitCost ? lineItem.quantity : 1,
      unit_cost: hasQuantity && hasUnitCost ? lineItem.unitCost : lineItem.amount,
      unit_of_measure: lineItem.unitOfMeasure?.trim() || null,
      markup_type: null,
    } satisfies PrimeContractCreationLineItem;
  });

  return { normalized, errors };
}

function widgetFields(input: {
  title: string;
  ownerCompanyName: string | null;
  status: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  retentionPercentage: number;
  paymentTerms?: string;
  billingSchedule?: string;
}) {
  return [
    { label: "Title", value: input.title, editable: true },
    { label: "Owner / client", value: input.ownerCompanyName ?? "", editable: true },
    { label: "Status", value: input.status, editable: true },
    ...(input.description
      ? [{ label: "Description", value: input.description, editable: true, multiline: true }]
      : []),
    ...(input.startDate
      ? [{ label: "Start date", value: input.startDate, editable: true }]
      : []),
    ...(input.endDate
      ? [{ label: "End date", value: input.endDate, editable: true }]
      : []),
    ...(input.retentionPercentage > 0
      ? [
          {
            label: "Retainage %",
            value: String(input.retentionPercentage),
            editable: true,
          },
        ]
      : []),
    ...(input.paymentTerms
      ? [{ label: "Payment terms", value: input.paymentTerms, editable: true }]
      : []),
    ...(input.billingSchedule
      ? [{ label: "Billing schedule", value: input.billingSchedule, editable: true }]
      : []),
  ];
}

export function buildPrimeContractDraftWidget(input: {
  projectId: number;
  title: string;
  contractNumber: string;
  owner: OwnerResolution;
  contractStatus: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  retentionPercentage: number;
  paymentTerms?: string;
  billingSchedule?: string;
  lineItems: PrimeContractLineInput[];
  sovSource?: PrimeContractDraftWidgetPayload["sovSource"];
  sourceLineIds?: string[];
  workbookRows?: PrimeContractDraftWidgetPayload["workbookRows"];
  workbookOmittedRows?: number;
  savedMarkups?: PrimeContractDraftWidgetPayload["savedMarkups"];
  markupLoadError?: string;
  lineItemErrors?: string[];
  status?: PrimeContractDraftWidgetPayload["status"];
  recordId?: string | null;
  failures?: PrimeContractDraftWidgetPayload["failures"];
}): PrimeContractDraftWidgetPayload {
  const totalAmount = input.lineItems.reduce((sum, lineItem) => sum + lineItem.amount, 0);
  const status = input.status ?? "draft";
  const lineItemErrors = input.lineItemErrors ?? [];
  const validation: PrimeContractDraftWidgetPayload["validation"] = [
    {
      label: "Owner / client",
      status:
        input.owner.status === "resolved"
          ? "pass"
          : "fail",
      message: input.owner.message,
    },
    {
      label: "Contract number",
      status: input.contractNumber ? "pass" : "fail",
      message: input.contractNumber || "A contract number is required.",
    },
    {
      label: "Schedule of Values",
      status:
        lineItemErrors.length > 0
          ? "fail"
          : input.contractStatus === "approved" && totalAmount <= 0
            ? "fail"
            : input.lineItems.length === 0
              ? "warning"
              : "pass",
      message:
        lineItemErrors[0] ??
        (input.contractStatus === "approved" && totalAmount <= 0
          ? "An approved Prime Contract requires a positive SOV value."
          : input.lineItems.length === 0
            ? "No SOV rows are planned; they can be added from the contract detail page."
            : `${input.lineItems.length} row${input.lineItems.length === 1 ? "" : "s"} totaling ${money(totalAmount)}.`),
    },
  ];

  if (input.sovSource === "budget") {
    validation.splice(2, 0, {
      label: "Budget source",
      status: lineItemErrors.length > 0 ? "fail" : "pass",
      message:
        lineItemErrors[0] ??
        `${input.sourceLineIds?.length ?? 0} current project budget line${input.sourceLineIds?.length === 1 ? " is" : "s are"} linked and will refresh at approval.`,
    });
  }

  if (input.sovSource === "workbook") {
    validation.splice(2, 0, {
      label: "Workbook source",
      status: lineItemErrors.length > 0 ? "fail" : "pass",
      message:
        lineItemErrors[0] ??
        `${input.sourceLineIds?.length ?? 0} workbook row${input.sourceLineIds?.length === 1 ? " is" : "s are"} matched to active project budget codes.`,
    });
  }

  validation.push({
    label: "Saved markups",
    status: input.markupLoadError
      ? "warning"
      : input.savedMarkups?.length
        ? "pass"
        : "warning",
    message:
      input.markupLoadError ??
      (input.savedMarkups?.length
        ? `${input.savedMarkups.length} saved project markup${input.savedMarkups.length === 1 ? " is" : "s are"} shown for reference; none will be applied automatically.`
        : "No saved project markups are configured; none will be applied automatically."),
  });

  if (status === "blocked" && input.failures?.length) {
    validation.unshift({
      label: "Create readiness",
      status: "fail",
      message: input.failures[0].message,
    });
  }

  const recordHref = input.recordId
    ? `/${input.projectId}/prime-contracts/${input.recordId}`
    : null;

  return {
    type: "prime_contract_draft",
    id: input.recordId
      ? `prime-contract-${input.recordId}`
      : `prime-contract-draft-${input.projectId}-${input.contractNumber}`,
    title:
      status === "created"
        ? "Prime Contract created"
        : status === "partial"
          ? "Prime Contract created with SOV issues"
          : status === "blocked"
            ? "Prime Contract needs attention"
            : "Prime Contract draft",
    status,
    projectId: input.projectId,
    contractNumber: input.contractNumber,
    ownerCompanyId: input.owner.id,
    ownerCompanyName: input.owner.name,
    sovSource: input.sovSource ?? "manual",
    sourceLineIds: input.sourceLineIds,
    workbookRows: input.workbookRows,
    workbookOmittedRows: input.workbookOmittedRows ?? 0,
    savedMarkups: input.savedMarkups,
    fields: widgetFields({
      title: input.title,
      ownerCompanyName: input.owner.name,
      status: input.contractStatus,
      description: input.description,
      startDate: input.startDate,
      endDate: input.endDate,
      retentionPercentage: input.retentionPercentage,
      paymentTerms: input.paymentTerms,
      billingSchedule: input.billingSchedule,
    }),
    validation,
    lineItems: input.lineItems.map((lineItem, index) => ({
      id: `prime-contract-line-${index + 1}`,
      budgetCodeId: lineItem.budgetCodeId ?? null,
      costCodeId: lineItem.costCodeId ?? null,
      description: lineItem.description,
      amount: lineItem.amount,
      quantity: lineItem.quantity ?? null,
      unitCost: lineItem.unitCost ?? null,
      unitOfMeasure: lineItem.unitOfMeasure ?? null,
    })),
    totalAmount,
    plannedWrites: {
      contractRows: 1,
      sovRows: input.lineItems.length,
    },
    recordId: input.recordId ?? null,
    recordHref,
    failures: input.failures,
    confirmPrompt:
      "Create this Prime Contract with createPrimeContract. Preserve these reviewed fields and SOV rows. " +
      "Call the tool with confirmed: true so the product can request my explicit approval before writing.",
  };
}

async function resolveOwnerCompany(
  supabase: ActionToolInternals["supabase"],
  ownerCompanyId?: string,
  ownerCompanyName?: string,
): Promise<OwnerResolution> {
  if (ownerCompanyId) {
    const { data, error } = await supabase
      .from("companies")
      .select("id,name")
      .eq("id", ownerCompanyId)
      .maybeSingle();
    if (error) throw new Error("The owner/client company could not be checked.");
    if (!data) {
      return {
        status: "missing",
        id: null,
        name: ownerCompanyName ?? null,
        message: "The selected owner/client company no longer exists.",
      };
    }
    return {
      status: "resolved",
      id: data.id,
      name: data.name,
      message: `${data.name} is linked to the Prime Contract.`,
    };
  }

  const requestedName = ownerCompanyName?.trim();
  if (!requestedName) {
    return {
      status: "none",
      id: null,
      name: null,
      message: "No owner/client is linked yet.",
    };
  }

  const { data: exactRows, error: exactError } = await supabase
    .from("companies")
    .select("id,name")
    .ilike("name", requestedName)
    .limit(5);
  if (exactError) throw new Error("The owner/client company could not be resolved.");

  const exactMatches = (exactRows ?? []).filter(
    (company) => company.name.trim().toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
  );
  if (exactMatches.length === 1) {
    return {
      status: "resolved",
      id: exactMatches[0].id,
      name: exactMatches[0].name,
      message: `${exactMatches[0].name} is linked to the Prime Contract.`,
    };
  }
  if (exactMatches.length > 1) {
    return {
      status: "ambiguous",
      id: null,
      name: requestedName,
      message: `More than one company is named “${requestedName}”. Select the exact owner/client before creating.`,
    };
  }

  const { data: partialRows, error: partialError } = await supabase
    .from("companies")
    .select("id,name")
    .ilike("name", `%${requestedName}%`)
    .limit(5);
  if (partialError) throw new Error("The owner/client company could not be resolved.");
  if ((partialRows ?? []).length > 1) {
    return {
      status: "ambiguous",
      id: null,
      name: requestedName,
      message: `“${requestedName}” matches multiple companies. Select the exact owner/client before creating.`,
    };
  }

  return {
    status: "missing",
    id: null,
    name: requestedName,
    message:
      (partialRows ?? []).length === 1
        ? `“${requestedName}” is not an exact company name. Select “${partialRows![0].name}” explicitly if it is the owner/client.`
        : `No company matched “${requestedName}”. Add or select the owner/client before creating.`,
  };
}

async function nextPrimeContractNumber(
  supabase: ActionToolInternals["supabase"],
  projectId: number,
): Promise<string> {
  const { data, error } = await supabase
    .from("prime_contracts")
    .select("contract_number")
    .eq("project_id", projectId)
    .limit(1000);
  if (error) throw new Error("The next Prime Contract number could not be generated.");

  let maximum = 0;
  for (const row of data ?? []) {
    const match = row.contract_number.match(/^PC-(\d+)$/i);
    if (!match) continue;
    maximum = Math.max(maximum, Number.parseInt(match[1], 10));
  }
  return `PC-${String(maximum + 1).padStart(4, "0")}`;
}

async function loadContractsWriteAuthorization(
  supabase: ActionToolInternals["supabase"],
  userId: string,
  projectId: number,
): Promise<{ canWrite: boolean; isAdmin: boolean }> {
  const permissions = await loadUserPermissionsWithClient(
    supabase,
    projectId,
    userId,
  );
  return {
    canWrite: Boolean(
      permissions && hasPermission(permissions, "contracts", "write"),
    ),
    isAdmin: permissions?.isAdmin === true,
  };
}

async function loadBudgetLineItems(
  supabase: ActionToolInternals["supabase"],
  projectId: number,
  budgetLineIds?: string[],
): Promise<{
  lineItems: PrimeContractLineInput[];
  sourceLineIds: string[];
  errors: string[];
}> {
  let query = supabase
    .from("budget_lines")
    .select(
      "id,project_budget_code_id,cost_code_id,description,original_amount,quantity,unit_cost,unit_of_measure",
    )
    .eq("project_id", projectId)
    .order("cost_code_id", { ascending: true });

  if (budgetLineIds?.length) {
    query = query.in("id", budgetLineIds);
  }

  const { data, error } = await query.limit(500);
  if (error) {
    throw new Error("The project budget could not be loaded for this Prime Contract draft.");
  }

  const rows = (data ?? []) as BudgetLineRow[];
  const errors: string[] = [];
  if (budgetLineIds?.length) {
    const found = new Set(rows.map((row) => row.id));
    const missingCount = budgetLineIds.filter((id) => !found.has(id)).length;
    if (missingCount > 0) {
      errors.push(
        `${missingCount} selected budget line${missingCount === 1 ? " is" : "s are"} missing or outside this project.`,
      );
    }
  }

  const positiveRows = rows.filter((row) => row.original_amount > 0);
  if (positiveRows.length === 0) {
    errors.push("No positive project budget lines are available to build the SOV.");
  }
  const missingBudgetCodeCount = positiveRows.filter(
    (row) => !row.project_budget_code_id,
  ).length;
  if (missingBudgetCodeCount > 0) {
    errors.push(
      `${missingBudgetCodeCount} budget line${missingBudgetCodeCount === 1 ? " is" : "s are"} missing a project budget-code link.`,
    );
  }

  const linkedRows = positiveRows.filter((row) => row.project_budget_code_id);
  return {
    sourceLineIds: linkedRows.map((row) => row.id),
    errors,
    lineItems: linkedRows.map((row) => {
      const calculated =
        row.quantity != null && row.unit_cost != null
          ? row.quantity * row.unit_cost
          : null;
      const preserveCalculation =
        calculated != null && Math.abs(calculated - row.original_amount) <= 0.01;
      return {
        description: row.description?.trim() || `${row.cost_code_id} budget`,
        amount: row.original_amount,
        budgetCodeId: row.project_budget_code_id!,
        costCodeId: row.cost_code_id,
        quantity: preserveCalculation ? row.quantity! : undefined,
        unitCost: preserveCalculation ? row.unit_cost! : undefined,
        unitOfMeasure: preserveCalculation
          ? row.unit_of_measure ?? undefined
          : undefined,
      };
    }),
  };
}

async function loadWorkbookLineItems(
  supabase: ActionToolInternals["supabase"],
  projectId: number,
  workbookRows: WorkbookRowInput[] | undefined,
  reviewedLineItems: PrimeContractLineInput[],
): Promise<{
  lineItems: PrimeContractLineInput[];
  sourceLineIds: string[];
  errors: string[];
}> {
  if (!workbookRows?.length) {
    const budgetCodeIds = reviewedLineItems
      .map((line) => line.budgetCodeId)
      .filter((id): id is string => Boolean(id));
    if (
      budgetCodeIds.length !== reviewedLineItems.length ||
      reviewedLineItems.length === 0
    ) {
      return {
        lineItems: reviewedLineItems,
        sourceLineIds: [],
        errors: [
          "Every reviewed workbook SOV row must retain its project budget-code link.",
        ],
      };
    }
    const { data, error } = await supabase
      .from("project_budget_codes")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .in("id", budgetCodeIds)
      .limit(500);
    if (error) {
      throw new Error("The workbook SOV budget-code links could not be verified.");
    }
    const found = new Set((data ?? []).map((row) => row.id));
    const invalidCount = budgetCodeIds.filter((id) => !found.has(id)).length;
    return {
      lineItems: reviewedLineItems,
      sourceLineIds: budgetCodeIds,
      errors:
        invalidCount > 0
          ? [
              `${invalidCount} workbook SOV budget-code link${invalidCount === 1 ? " is" : "s are"} missing, inactive, or outside this project.`,
            ]
          : [],
    };
  }

  const { data: projectCodes, error: projectCodesError } = await supabase
    .from("project_budget_codes")
    .select("id,cost_code_id,cost_type_id")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .limit(1000);
  if (projectCodesError) {
    throw new Error("Project budget codes could not be loaded for the workbook SOV.");
  }
  const costTypeIds = Array.from(
    new Set(
      (projectCodes ?? [])
        .map((row) => row.cost_type_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: costTypes, error: costTypesError } = costTypeIds.length
    ? await supabase
        .from("cost_code_types")
        .select("id,code")
        .in("id", costTypeIds)
        .limit(100)
    : { data: [], error: null };
  if (costTypesError) {
    throw new Error("Cost types could not be resolved for the workbook SOV.");
  }

  const typeCodeById = new Map(
    (costTypes ?? []).map((row) => [row.id, row.code.trim().toUpperCase()]),
  );
  const matches = new Map<string, Array<{ id: string; costCodeId: string }>>();
  for (const projectCode of projectCodes ?? []) {
    const typeCode = projectCode.cost_type_id
      ? typeCodeById.get(projectCode.cost_type_id)
      : undefined;
    if (!typeCode) continue;
    const key = `${projectCode.cost_code_id.trim().toUpperCase()}::${typeCode}`;
    const rows = matches.get(key) ?? [];
    rows.push({ id: projectCode.id, costCodeId: projectCode.cost_code_id });
    matches.set(key, rows);
  }

  const errors: string[] = [];
  const lineItems: PrimeContractLineInput[] = [];
  const sourceLineIds: string[] = [];
  for (const row of workbookRows) {
    const source = `${row.sourceSheet} row ${row.rowNumber}`;
    if (row.warnings.length > 0) {
      errors.push(`${source}: ${row.warnings[0]}`);
      continue;
    }
    const key = `${row.costCode.trim().toUpperCase()}::${row.costTypeCode.trim().toUpperCase()}`;
    const candidates = matches.get(key) ?? [];
    if (candidates.length !== 1) {
      errors.push(
        candidates.length === 0
          ? `${source}: no active project budget code matches ${row.costCode} / ${row.costTypeCode}.`
          : `${source}: ${row.costCode} / ${row.costTypeCode} matches multiple project budget codes.`,
      );
      continue;
    }
    const calculated =
      row.unitQty != null && row.unitCost != null
        ? row.unitQty * row.unitCost
        : null;
    const preserveCalculation =
      calculated != null && Math.abs(calculated - row.budgetAmount) <= 0.01;
    lineItems.push({
      description: row.workDescription?.trim() || row.description.trim(),
      amount: row.budgetAmount,
      budgetCodeId: candidates[0].id,
      costCodeId: candidates[0].costCodeId,
      quantity: preserveCalculation ? row.unitQty! : undefined,
      unitCost: preserveCalculation ? row.unitCost! : undefined,
      unitOfMeasure: preserveCalculation
        ? row.unitOfMeasure ?? undefined
        : undefined,
    });
    sourceLineIds.push(source);
  }

  if (lineItems.length === 0 && errors.length === 0) {
    errors.push("The workbook did not contain any eligible owner SOV rows.");
  }
  return { lineItems, sourceLineIds, errors };
}

async function loadSavedProjectMarkups(
  supabase: ActionToolInternals["supabase"],
  projectId: number,
): Promise<{
  markups: NonNullable<PrimeContractDraftWidgetPayload["savedMarkups"]>;
  error?: string;
}> {
  const { data, error } = await supabase
    .from("vertical_markup")
    .select("id,markup_type,percentage,compound,calculation_order")
    .eq("project_id", projectId)
    .order("calculation_order", { ascending: true })
    .limit(25);
  if (error) {
    return {
      markups: [],
      error:
        "Saved project markups could not be loaded. They will not be applied automatically.",
    };
  }
  return {
    markups: (data ?? []).map((markup) => ({
      id: markup.id,
      markupType: markup.markup_type,
      percentage: markup.percentage,
      compound: Boolean(markup.compound),
    })),
  };
}

function normalizeBudgetCodeLookup(value?: string | null): string {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function hasAtMostDecimalPlaces(value: number, decimalPlaces: number): boolean {
  const factor = 10 ** decimalPlaces;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-7;
}

function sovRowAmount(
  row: Pick<PrimeContractSovExistingRow, "quantity" | "unit_cost">,
): number {
  // total_cost is numeric(15,2), so round each persisted line before summing.
  return roundCurrency(Number(row.quantity ?? 0) * Number(row.unit_cost ?? 0));
}

function primeContractSovSnapshot(rows: PrimeContractSovExistingRow[]) {
  return rows.map((row) => ({
    id: row.id,
    contract_id: row.contract_id,
    line_number: row.line_number,
    description: row.description,
    budget_code_id: row.budget_code_id,
    cost_code_id: row.cost_code_id,
    quantity: row.quantity,
    unit_cost: row.unit_cost,
    unit_of_measure: row.unit_of_measure,
    markup_type: row.markup_type,
    updated_at: row.updated_at,
  }));
}

function primeContractSovPreviewFingerprint(params: {
  userId: string;
  projectId: number;
  contract: PrimeContractSovEditContract;
  currentRows: PrimeContractSovExistingRow[];
  plannedRows: PrimeContractSovPlannedRow[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId: params.userId,
        projectId: params.projectId,
        contractId: params.contract.id,
        contractUpdatedAt: params.contract.updated_at,
        currentRows: primeContractSovSnapshot(params.currentRows),
        plannedRows: params.plannedRows,
      }),
    )
    .digest("hex");
}

function primeContractSovWriteIdempotencyKey(params: {
  resolvedKey: string;
  userId: string;
  input: {
    projectId: number;
    contractId: string;
    previewToken?: string;
    rows: PrimeContractSovEditInputRow[];
  };
}): string {
  // The shared resolver intentionally honors caller-provided keys. Bind that
  // base key to this exact approved payload so reusing one explicit key for a
  // different contract, preview, or row set can never replay another receipt.
  return createHash("sha256")
    .update(
      JSON.stringify({
        toolName: "editPrimeContractSov",
        resolvedKey: params.resolvedKey,
        userId: params.userId,
        projectId: params.input.projectId,
        contractId: params.input.contractId,
        previewToken: params.input.previewToken,
        rows: params.input.rows,
      }),
    )
    .digest("hex");
}

function storedPreviewMatches(
  value: unknown,
  previewToken: string,
  previewFingerprint: string,
): boolean {
  if (!value || typeof value !== "object") return false;
  const stored = value as Record<string, unknown>;
  return (
    stored.previewToken === previewToken &&
    stored.previewFingerprint === previewFingerprint &&
    stored.action === "preview"
  );
}

function atomicSovFailureMessage(message: string): string {
  if (message.includes("AI_SOV_STATE_CHANGED")) {
    return "The Prime Contract or its SOV changed since the preview. Nothing from this request was saved; run a new preview and approve that version.";
  }
  if (message.includes("AI_SOV_CONTRACT_NOT_DRAFT")) {
    return "The Prime Contract is no longer an unexecuted draft. Nothing from this request was saved.";
  }
  if (message.includes("AI_SOV_CONTRACT_UNAVAILABLE")) {
    return "The Prime Contract is unavailable or is not shared with your account. Nothing from this request was saved.";
  }
  if (
    message.includes("AI_SOV_INVALID") ||
    message.includes("AI_SOV_DUPLICATE_ROWS") ||
    message.includes("AI_SOV_NUMERIC_OUT_OF_RANGE")
  ) {
    return "The approved SOV rows no longer satisfy the contract's validation rules. Nothing was saved; run a new preview.";
  }
  return "The SOV update could not be completed atomically. Nothing from this request was saved; run a new preview before retrying.";
}

type PrimeContractSovAccessContract = Pick<
  PrimeContractSovEditContract,
  "id" | "project_id" | "is_private" | "allowed_user_ids" | "created_by"
>;

async function loadPrimeContractSovAccess(
  supabase: ActionToolInternals["supabase"],
  input: { projectId: number; contractId: string },
  authorization: { userId: string; isAdmin: boolean },
): Promise<
  | { ok: true; contract: PrimeContractSovAccessContract }
  | { ok: false; error: string }
> {
  const accessResult = await supabase
    .from("prime_contracts")
    .select("id,project_id,is_private,allowed_user_ids,created_by")
    .eq("id", input.contractId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (accessResult.error) {
    console.error("[editPrimeContractSov] contract access lookup failed", {
      message: accessResult.error.message,
    });
    return {
      ok: false,
      error: "The Prime Contract is unavailable or is not shared with your account.",
    };
  }
  if (!accessResult.data) {
    return {
      ok: false,
      error: "The Prime Contract is unavailable or is not shared with your account.",
    };
  }

  const contract = accessResult.data as PrimeContractSovAccessContract;
  const allowedPrivateUsers = Array.isArray(contract.allowed_user_ids)
    ? contract.allowed_user_ids
    : [];
  if (
    contract.is_private &&
    !authorization.isAdmin &&
    contract.created_by !== authorization.userId &&
    !allowedPrivateUsers.includes(authorization.userId)
  ) {
    return {
      ok: false,
      error: "The Prime Contract is unavailable or is not shared with your account.",
    };
  }

  return { ok: true, contract };
}

async function loadPrimeContractSovEditPreview(
  supabase: ActionToolInternals["supabase"],
  input: {
    projectId: number;
    contractId: string;
    rows: PrimeContractSovEditInputRow[];
  },
  accessContract: PrimeContractSovAccessContract,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      contract: PrimeContractSovEditContract;
      currentRows: PrimeContractSovExistingRow[];
      plannedRows: PrimeContractSovPlannedRow[];
      currentSovTotal: number;
      proposedSovTotal: number;
    }
> {
  if (
    accessContract.id !== input.contractId ||
    accessContract.project_id !== input.projectId
  ) {
    return {
      ok: false,
      error: "The Prime Contract is unavailable or is not shared with your account.",
    };
  }

  const contractResult = await supabase
    .from("prime_contracts")
    .select(
      "id,project_id,contract_number,title,status,executed,original_contract_value,revised_contract_value,is_private,allowed_user_ids,created_by,updated_at",
    )
    .eq("id", input.contractId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (contractResult.error) {
    console.error("[editPrimeContractSov] contract detail lookup failed", {
      message: contractResult.error.message,
    });
    return {
      ok: false,
      error: "The Prime Contract could not be loaded. Try again before making any changes.",
    };
  }
  if (!contractResult.data) {
    return {
      ok: false,
      error: "The Prime Contract was not found in the selected project.",
    };
  }

  const contract = contractResult.data as PrimeContractSovEditContract;
  if (contract.status !== "draft" || contract.executed) {
    return {
      ok: false,
      error:
        "AI SOV edits are limited to unexecuted draft Prime Contracts. Open the contract and use its governed change workflow instead.",
    };
  }

  const [existingResult, budgetCodeResult, budgetLineResult] = await Promise.all([
    supabase
      .from("contract_line_items")
      .select(
        "id,contract_id,line_number,description,budget_code_id,cost_code_id,quantity,unit_cost,unit_of_measure,markup_type,updated_at",
      )
      .eq("contract_id", input.contractId)
      .order("line_number", { ascending: true }),
    supabase
      .from("project_budget_codes")
      .select("id,cost_code_id,cost_type_id,description")
      .eq("project_id", input.projectId)
      .eq("is_active", true)
      .limit(2000),
    supabase
      .from("budget_lines")
      .select(
        "project_budget_code_id,cost_code_id,cost_type_id,original_amount",
      )
      .eq("project_id", input.projectId)
      .limit(2000),
  ]);

  if (existingResult.error) {
    console.error("[editPrimeContractSov] SOV lookup failed", {
      message: existingResult.error.message,
    });
    return {
      ok: false,
      error: "The existing SOV could not be loaded. Try again before making any changes.",
    };
  }
  if (budgetCodeResult.error) {
    console.error("[editPrimeContractSov] budget-code lookup failed", {
      message: budgetCodeResult.error.message,
    });
    return {
      ok: false,
      error: "Active project budget codes could not be loaded. Nothing was changed.",
    };
  }

  const currentRows = (existingResult.data ?? []) as PrimeContractSovExistingRow[];
  const projectBudgetCodes = (budgetCodeResult.data ?? []) as PrimeContractSovProjectCode[];
  const projectBudgetLines = (budgetLineResult.data ??
    []) as PrimeContractSovBudgetLine[];
  const costTypeIds = Array.from(
    new Set(
      projectBudgetCodes
        .map((row) => row.cost_type_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  let costTypes: PrimeContractSovCostType[] = [];
  if (costTypeIds.length > 0) {
    const costTypeResult = await supabase
      .from("cost_code_types")
      .select("id,code,description")
      .in("id", costTypeIds)
      .limit(500);
    if (costTypeResult.error) {
      console.error("[editPrimeContractSov] cost-type lookup failed", {
        message: costTypeResult.error.message,
      });
      return {
        ok: false,
        error: "Project cost types could not be loaded. Nothing was changed.",
      };
    }
    costTypes = (costTypeResult.data ?? []) as PrimeContractSovCostType[];
  }

  const costTypeById = new Map(costTypes.map((row) => [row.id, row]));
  const existingByBudgetCode = new Map<string, PrimeContractSovExistingRow[]>();
  for (const row of currentRows) {
    if (!row.budget_code_id) continue;
    const matches = existingByBudgetCode.get(row.budget_code_id) ?? [];
    matches.push(row);
    existingByBudgetCode.set(row.budget_code_id, matches);
  }

  const usedBudgetCodes = new Set<string>();
  let nextLineNumber =
    currentRows.reduce((maximum, row) => Math.max(maximum, row.line_number), 0) + 1;
  const plannedRows: PrimeContractSovPlannedRow[] = [];

  for (const [index, requested] of input.rows.entries()) {
    const rowLabel = `SOV row ${index + 1}`;
    const requestedBudgetCodeId = requested.projectBudgetCodeId?.trim();
    const requestedCostCode = requested.costCode?.trim();
    const requestedCostType = requested.costType?.trim();
    let candidates = requestedBudgetCodeId
      ? projectBudgetCodes.filter((row) => row.id === requestedBudgetCodeId)
      : projectBudgetCodes.filter(
          (row) =>
            normalizeBudgetCodeLookup(row.cost_code_id) ===
            normalizeBudgetCodeLookup(requestedCostCode),
        );

    if (requestedCostType) {
      const normalizedType = normalizeBudgetCodeLookup(requestedCostType);
      candidates = candidates.filter((row) => {
        const costType = row.cost_type_id
          ? costTypeById.get(row.cost_type_id)
          : undefined;
        return Boolean(
          costType &&
            (normalizeBudgetCodeLookup(costType.code) === normalizedType ||
              normalizeBudgetCodeLookup(costType.description) === normalizedType),
        );
      });
    }

    let amountReconciliationAttempted = false;
    if (!requestedCostType && candidates.length > 1) {
      amountReconciliationAttempted = true;
      if (budgetLineResult.error) {
        console.error("[editPrimeContractSov] budget-line lookup failed", {
          message: budgetLineResult.error.message,
        });
        return {
          ok: false,
          error: `${rowLabel} needs project budget amounts to resolve its cost type, but those amounts could not be loaded. Nothing was changed; retry or provide the exact cost type.`,
        };
      }

      const requestedAmountIsValid =
        Number.isFinite(requested.amount) &&
        requested.amount >= 0 &&
        requested.amount <= MAX_CURRENCY &&
        hasAtMostDecimalPlaces(requested.amount, 2);
      const matchingBudgetCodeIds = new Set<string>();
      if (requestedAmountIsValid) {
        for (const budgetLine of projectBudgetLines) {
          if (
            normalizeBudgetCodeLookup(budgetLine.cost_code_id) !==
              normalizeBudgetCodeLookup(requestedCostCode) ||
            roundCurrency(budgetLine.original_amount) !==
              roundCurrency(requested.amount)
          ) {
            continue;
          }

          if (budgetLine.project_budget_code_id) {
            matchingBudgetCodeIds.add(budgetLine.project_budget_code_id);
            continue;
          }

          for (const candidate of candidates) {
            if (
              candidate.cost_type_id === budgetLine.cost_type_id &&
              normalizeBudgetCodeLookup(candidate.cost_code_id) ===
                normalizeBudgetCodeLookup(budgetLine.cost_code_id)
            ) {
              matchingBudgetCodeIds.add(candidate.id);
            }
          }
        }
      }
      candidates = candidates.filter((candidate) =>
        matchingBudgetCodeIds.has(candidate.id),
      );
    }

    if (candidates.length === 0) {
      return {
        ok: false,
        error: amountReconciliationAttempted
          ? `${rowLabel} has no active project budget code whose cost code and project budget amount exactly match ${money(requested.amount)}. Provide the exact cost type or project budget-code ID; the AI will not guess.`
          : `${rowLabel} has no exact active project budget-code match. Provide the project budget-code ID or the exact cost code and cost type.`,
      };
    }
    if (candidates.length > 1) {
      return {
        ok: false,
        error: amountReconciliationAttempted
          ? `${rowLabel} still matches multiple active project budget codes after comparing the exact project budget amount. Add the cost type or exact project budget-code ID; the AI will not guess.`
          : `${rowLabel} matches multiple active project budget codes. Add the cost type or exact project budget-code ID; the AI will not guess.`,
      };
    }

    const budgetCode = candidates[0];
    if (usedBudgetCodes.has(budgetCode.id)) {
      return {
        ok: false,
        error: `${rowLabel} duplicates project budget code ${budgetCode.cost_code_id} in this request. Combine it into one row.`,
      };
    }
    usedBudgetCodes.add(budgetCode.id);

    const existingMatches = existingByBudgetCode.get(budgetCode.id) ?? [];
    if (existingMatches.length > 1) {
      return {
        ok: false,
        error: `${rowLabel} cannot be edited safely because the current SOV already contains duplicate rows for project budget code ${budgetCode.cost_code_id}. Resolve those duplicates in the contract first.`,
      };
    }

    const requestedQuantity = requested.quantity ?? 1;
    const requestedUnitCost = requested.unitCost ?? requested.amount;
    if (
      !Number.isFinite(requested.amount) ||
      requested.amount < 0 ||
      requested.amount > MAX_CURRENCY ||
      !hasAtMostDecimalPlaces(requested.amount, 2)
    ) {
      return {
        ok: false,
        error: `${rowLabel} amount must be nonnegative, within the supported range, and use no more than two decimal places.`,
      };
    }
    if (
      !Number.isFinite(requestedQuantity) ||
      requestedQuantity <= 0 ||
      requestedQuantity > MAX_QUANTITY ||
      !hasAtMostDecimalPlaces(requestedQuantity, 4)
    ) {
      return {
        ok: false,
        error: `${rowLabel} quantity must be positive, within the supported range, and use no more than four decimal places.`,
      };
    }
    if (
      !Number.isFinite(requestedUnitCost) ||
      requestedUnitCost < 0 ||
      requestedUnitCost > MAX_CURRENCY ||
      !hasAtMostDecimalPlaces(requestedUnitCost, 2)
    ) {
      return {
        ok: false,
        error: `${rowLabel} unit cost must be nonnegative, within the supported range, and use no more than two decimal places.`,
      };
    }

    const quantity = roundQuantity(requestedQuantity);
    const unitCost = roundCurrency(requestedUnitCost);
    const amount = roundCurrency(quantity * unitCost);
    if (amount !== roundCurrency(requested.amount)) {
      return {
        ok: false,
        error: `${rowLabel} quantity times unit cost must equal ${money(requested.amount)}.`,
      };
    }

    const existing = existingMatches[0] ?? null;
    const costType = budgetCode.cost_type_id
      ? costTypeById.get(budgetCode.cost_type_id)
      : undefined;
    const description =
      requested.description?.trim() ||
      budgetCode.description.trim() ||
      budgetCode.cost_code_id;
    if (description.length > 500) {
      return {
        ok: false,
        error: `${rowLabel} description must be 500 characters or fewer.`,
      };
    }
    plannedRows.push({
      action: existing ? "update" : "append",
      existingId: existing?.id ?? null,
      lineNumber: existing?.line_number ?? nextLineNumber++,
      projectBudgetCodeId: budgetCode.id,
      costCode: budgetCode.cost_code_id,
      costType: costType?.description ?? costType?.code ?? null,
      description,
      amount,
      quantity,
      unitCost,
      unitOfMeasure: requested.unitOfMeasure?.trim() || null,
    });
  }

  const currentSovTotal = roundCurrency(
    currentRows.reduce((total, row) => total + sovRowAmount(row), 0),
  );
  const replacedLineNumbers = new Set(plannedRows.map((row) => row.lineNumber));
  const retainedTotal = currentRows.reduce(
    (total, row) =>
      replacedLineNumbers.has(row.line_number) ? total : total + sovRowAmount(row),
    0,
  );
  const proposedSovTotal = roundCurrency(
    retainedTotal + plannedRows.reduce((total, row) => total + row.amount, 0),
  );
  if (proposedSovTotal > MAX_CURRENCY) {
    return {
      ok: false,
      error: "The proposed SOV total exceeds the supported Prime Contract value range.",
    };
  }

  return {
    ok: true,
    contract,
    currentRows,
    plannedRows,
    currentSovTotal,
    proposedSovTotal,
  };
}

function safeFailureMessage(error: unknown): string {
  return error instanceof PrimeContractCreationError
    ? error.message
    : "The Prime Contract could not be created. No unreported write was attempted.";
}

export function createPrimeContractWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    supabase,
    enforceProjectWriteAccess,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    finalizeWriteAudit,
    failWriteAudit,
  } = internals;

  return {
    createPrimeContract: tool({
      description: createPrimeContractDescription,
      inputSchema: createPrimeContractInputSchema,
      execute: withWriteTrace("createPrimeContract", options, async (input) => {
        const access = await enforceProjectWriteAccess(input.projectId);
        if (!access.ok) {
          return { success: false, action: "blocked", error: access.error };
        }

        const contractsAuthorization = await loadContractsWriteAuthorization(
          supabase,
          userId,
          input.projectId,
        );
        if (!contractsAuthorization.canWrite) {
          return {
            success: false,
            action: "blocked",
            error: "You need write access to Contracts before this Prime Contract can be created.",
          };
        }

        const idempotencyKey = input.confirmed
          ? resolveIdempotencyKey("createPrimeContract", input)
          : null;
        if (idempotencyKey) {
          const replay = await getReplayResponse(
            "createPrimeContract",
            idempotencyKey,
          );
          if (replay) return replay;
        }

        const contractNumber =
          input.contractNumber ??
          (await nextPrimeContractNumber(supabase, input.projectId));
        const owner = await resolveOwnerCompany(
          supabase,
          input.ownerCompanyId,
          input.ownerCompanyName,
        );
        const budgetLines =
          input.sovSource === "budget"
            ? await loadBudgetLineItems(
                supabase,
                input.projectId,
                input.budgetLineIds,
              )
            : null;
        const workbookLines =
          input.sovSource === "workbook"
            ? await loadWorkbookLineItems(
                supabase,
                input.projectId,
                input.workbookRows,
                input.lineItems,
              )
            : null;
        const sourceLineItems =
          budgetLines?.lineItems ?? workbookLines?.lineItems ?? input.lineItems;
        const { normalized: normalizedLineItems, errors: normalizationErrors } =
          normalizeLineItems(sourceLineItems, {
            allowManualZeroPlaceholders: input.sovSource === "manual",
          });
        const lineItemErrors = [
          ...(budgetLines?.errors ?? []),
          ...(workbookLines?.errors ?? []),
          ...(input.sovSource === "workbook" && input.workbookOmittedRows > 0
            ? [
                `${input.workbookOmittedRows} workbook row${input.workbookOmittedRows === 1 ? " was" : "s were"} omitted by the attachment size limit. Split the workbook before approval.`,
              ]
            : []),
          ...normalizationErrors,
        ];
        const savedMarkupResult = await loadSavedProjectMarkups(
          supabase,
          input.projectId,
        );
        const widgetInput = {
          projectId: input.projectId,
          title: input.title,
          contractNumber,
          owner,
          contractStatus: input.status,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          retentionPercentage: input.retentionPercentage,
          paymentTerms: input.paymentTerms,
          billingSchedule: input.billingSchedule,
    lineItems: sourceLineItems,
    sovSource: input.sovSource,
    sourceLineIds:
      budgetLines?.sourceLineIds ?? workbookLines?.sourceLineIds,
    workbookRows: input.workbookRows,
    workbookOmittedRows: input.workbookOmittedRows,
    savedMarkups: savedMarkupResult.markups,
    markupLoadError: savedMarkupResult.error,
    lineItemErrors,
        };
        const previewWidget = buildPrimeContractDraftWidget(widgetInput);
        const validationFailures = previewWidget.validation.filter(
          (item) => item.status === "fail",
        );

        if (!input.confirmed) {
          return {
            success: validationFailures.length === 0,
            action: validationFailures.length === 0 ? "preview" : "blocked",
            message:
              validationFailures.length === 0
                ? "Review the Prime Contract draft, planned writes, and SOV before requesting approval."
                : "The Prime Contract draft needs correction before it can be approved.",
            widget:
              validationFailures.length === 0
                ? previewWidget
                : buildPrimeContractDraftWidget({
                    ...widgetInput,
                    status: "blocked",
                    failures: validationFailures.map((failure) => ({
                      description: failure.label,
                      message: failure.message,
                    })),
                  }),
          };
        }

        if (validationFailures.length > 0) {
          const failure = {
            success: false,
            action: "blocked",
            error: "The Prime Contract draft is not ready to create.",
            widget: buildPrimeContractDraftWidget({
              ...widgetInput,
              status: "blocked",
              failures: validationFailures.map((validation) => ({
                description: validation.label,
                message: validation.message,
              })),
            }),
          };
          await recordWriteAudit({
            toolName: "createPrimeContract",
            idempotencyKey: idempotencyKey!,
            projectId: input.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const reservationResponse = {
          success: false,
          action: "blocked",
          error:
            "This approved Prime Contract write was already started. Check Prime Contracts before retrying; edit the draft to submit a new request.",
          widget: buildPrimeContractDraftWidget({
            ...widgetInput,
            status: "blocked",
            failures: [
              {
                description: "Write status",
                message:
                  "A matching approved write is in progress or its final audit outcome is unknown. Do not retry unchanged.",
              },
            ],
          }),
        };

        // Reserve this exact approved payload before the financial write. If the
        // later receipt audit fails, replay returns this fail-loud response rather
        // than generating a new contract number and creating a duplicate record.
        try {
          await recordWriteAudit({
            toolName: "createPrimeContract",
            idempotencyKey: idempotencyKey!,
            projectId: input.projectId,
            input,
            status: "pending",
            response: reservationResponse,
          });
        } catch {
          return {
            ...reservationResponse,
            error:
              "The Prime Contract was not created because its idempotency reservation could not be recorded. Try again after the audit service is available.",
          };
        }

        try {
          const result = await createPrimeContract({
            store: createSupabasePrimeContractCreationStore(supabase),
            userId,
            contract: {
              project_id: input.projectId,
              contract_number: contractNumber,
              title: input.title,
              client_id: owner.id,
              contract_company_id: owner.id,
              description: input.description ?? null,
              status: input.status,
              executed: false,
              original_contract_value: previewWidget.totalAmount,
              revised_contract_value: previewWidget.totalAmount,
              start_date: input.startDate ?? null,
              end_date: input.endDate ?? null,
              retention_percentage: input.retentionPercentage,
              payment_terms: input.paymentTerms ?? null,
              billing_schedule: input.billingSchedule ?? null,
              is_private: input.isPrivate,
              inclusions: input.inclusions ?? null,
              exclusions: input.exclusions ?? null,
              allowed_user_ids: input.allowedUserIds,
              allow_sov_view: input.allowSovView,
            },
            lineItems: normalizedLineItems,
          });

          const response = {
            success: result.receipt.status === "complete",
            action: result.receipt.status === "complete" ? "created" : "partial",
            message:
              result.receipt.status === "complete"
                ? `Prime Contract ${result.receipt.contractNumber} was created with ${result.receipt.lineItems.created} SOV row${result.receipt.lineItems.created === 1 ? "" : "s"}.`
                : `Prime Contract ${result.receipt.contractNumber} was created, but ${result.receipt.lineItems.failed.length} SOV row${result.receipt.lineItems.failed.length === 1 ? "" : "s"} need attention.`,
            record: {
              id: result.contract.id,
              projectId: input.projectId,
              contractNumber: result.contract.contract_number,
              title: result.contract.title,
              status: result.contract.status,
            },
            receipt: result.receipt,
            widget: buildPrimeContractDraftWidget({
              ...widgetInput,
              status:
                result.receipt.status === "complete" ? "created" : "partial",
              recordId: result.contract.id,
              failures: result.receipt.lineItems.failed,
            }),
          };

          try {
            await finalizeWriteAudit({
              toolName: "createPrimeContract",
              idempotencyKey: idempotencyKey!,
              response,
            });
          } catch {
            return {
              ...response,
              success: false,
              action: "partial",
              error:
                "The Prime Contract was created, but its AI write audit could not be recorded. Open the contract; do not retry this request.",
              widget: buildPrimeContractDraftWidget({
                ...widgetInput,
                status: "partial",
                recordId: result.contract.id,
                failures: [
                  ...(result.receipt.lineItems.failed ?? []),
                  {
                    description: "AI write audit",
                    message:
                      "Audit recording failed after creation. Open the contract and do not retry this request.",
                  },
                ],
              }),
            };
          }

          return response;
        } catch (error) {
          const message = safeFailureMessage(error);
          const failure = {
            success: false,
            action: "blocked",
            error: message,
            widget: buildPrimeContractDraftWidget({
              ...widgetInput,
              status: "blocked",
              failures: [{ description: "Prime Contract", message }],
            }),
          };
          await failWriteAudit({
            toolName: "createPrimeContract",
            idempotencyKey: idempotencyKey!,
            projectId: input.projectId,
            input,
            response: failure,
          });
          return failure;
        }
      }),
    }),
    editPrimeContractSov: tool({
      description: editPrimeContractSovDescription,
      inputSchema: editPrimeContractSovInputSchema,
      execute: withWriteTrace("editPrimeContractSov", options, async (input) => {
        const access = await enforceProjectWriteAccess(input.projectId);
        if (!access.ok) {
          return { success: false, action: "blocked", error: access.error };
        }

        // The shared AI database seam uses a service client, so both project
        // access and module authorization must be enforced before every read or
        // write in this tool. Never rely on RLS at this boundary.
        const contractsAuthorization = await loadContractsWriteAuthorization(
          supabase,
          userId,
          input.projectId,
        );
        if (!contractsAuthorization.canWrite) {
          return {
            success: false,
            action: "blocked",
            error:
              "You need write access to Contracts before this Prime Contract SOV can be edited.",
          };
        }

        // The shared client is service-role. Re-check record privacy before any
        // financial/status read and before returning an idempotent receipt.
        const contractAccess = await loadPrimeContractSovAccess(supabase, input, {
          userId,
          isAdmin: contractsAuthorization.isAdmin,
        });
        if (!contractAccess.ok) {
          return {
            success: false,
            action: "blocked",
            error: contractAccess.error,
          };
        }

        if (input.confirmed && !input.previewToken) {
          return {
            success: false,
            action: "blocked",
            error:
              "Run the no-write SOV preview first, then approve that exact preview before confirming the edit.",
          };
        }

        const idempotencyKey = input.confirmed
          ? primeContractSovWriteIdempotencyKey({
              resolvedKey: resolveIdempotencyKey("editPrimeContractSov", input),
              userId,
              input,
            })
          : null;
        if (idempotencyKey) {
          // A successful write changes timestamps and append/update actions.
          // Replay the exact approved payload before rebuilding mutable state.
          const replay = await getReplayResponse(
            "editPrimeContractSov",
            idempotencyKey,
          );
          if (replay) return replay;
        }

        const plan = await loadPrimeContractSovEditPreview(
          supabase,
          input,
          contractAccess.contract,
        );
        if (!plan.ok) {
          return { success: false, action: "blocked", error: plan.error };
        }

        const previewFingerprint = primeContractSovPreviewFingerprint({
          userId,
          projectId: input.projectId,
          contract: plan.contract,
          currentRows: plan.currentRows,
          plannedRows: plan.plannedRows,
        });

        const preview = {
          contract: {
            id: plan.contract.id,
            contractNumber: plan.contract.contract_number,
            title: plan.contract.title,
            status: plan.contract.status,
            href: `/${input.projectId}/prime-contracts/${plan.contract.id}`,
          },
          currentSovTotal: plan.currentSovTotal,
          proposedSovTotal: plan.proposedSovTotal,
          rows: plan.plannedRows.map(({ existingId: _existingId, ...row }) => row),
          unchangedRows: plan.currentRows.length -
            plan.plannedRows.filter((row) => row.action === "update").length,
          deletions: 0,
        };

        if (!input.confirmed) {
          const previewToken = randomUUID();
          const previewResponse = {
            success: true,
            action: "preview",
            message:
              "Review every SOV row and the proposed total. No rows have been changed or deleted.",
            previewToken,
            previewFingerprint,
            preview,
            confirmPrompt:
              "Call editPrimeContractSov again with confirmed: true and this exact previewToken only after I explicitly approve this preview.",
          };
          try {
            await recordWriteAudit({
              toolName: SOV_PREVIEW_AUDIT_TOOL,
              idempotencyKey: previewToken,
              projectId: input.projectId,
              input,
              status: "success",
              response: previewResponse,
            });
          } catch (error) {
            console.error("[editPrimeContractSov] preview audit failed", {
              message: error instanceof Error ? error.message : String(error),
            });
            return {
              success: false,
              action: "blocked",
              error:
                "The SOV preview could not be secured for approval. Nothing was changed; try the preview again after the audit service is available.",
              preview,
            };
          }
          return previewResponse;
        }

        const storedPreview = await getReplayResponse(
          SOV_PREVIEW_AUDIT_TOOL,
          input.previewToken!,
        );
        if (
          !storedPreviewMatches(
            storedPreview,
            input.previewToken!,
            previewFingerprint,
          )
        ) {
          return {
            success: false,
            action: "blocked",
            error:
              "This confirmation does not match the current stored SOV preview. Nothing was changed; run a new preview and approve that version.",
            preview,
          };
        }

        const reservationResponse = {
          success: false,
          action: "blocked",
          error:
            "This approved Prime Contract SOV write was already started. Open the contract before retrying; submit a changed preview for a new request.",
          record: {
            id: plan.contract.id,
            href: `/${input.projectId}/prime-contracts/${plan.contract.id}`,
          },
        };
        try {
          await recordWriteAudit({
            toolName: "editPrimeContractSov",
            idempotencyKey: idempotencyKey!,
            projectId: input.projectId,
            input,
            status: "pending",
            response: reservationResponse,
          });
        } catch {
          return {
            success: false,
            action: "blocked",
            error:
              "The SOV was not changed because its audit reservation could not be recorded. Try again after the audit service is available.",
            preview,
          };
        }

        const upsertRows = plan.plannedRows.map((row) => ({
          id: row.existingId ?? randomUUID(),
          line_number: row.lineNumber,
          description: row.description,
          budget_code_id: row.projectBudgetCodeId,
          cost_code_id: row.costCode,
          quantity: row.quantity,
          unit_cost: row.unitCost,
          unit_of_measure: row.unitOfMeasure,
        }));
        let atomicResult: {
          data: AtomicPrimeContractSovEditResult | null;
          error: { code?: string; message: string } | null;
        };
        try {
          atomicResult = await (
            supabase as unknown as RuntimePrimeContractSovRpcClient
          ).rpc("ai_edit_draft_prime_contract_sov", {
            p_project_id: input.projectId,
            p_contract_id: plan.contract.id,
            p_user_id: userId,
            p_is_admin: contractsAuthorization.isAdmin,
            p_expected_contract_updated_at: plan.contract.updated_at,
            p_expected_sov_rows: primeContractSovSnapshot(plan.currentRows),
            p_rows: upsertRows,
          });
        } catch (error) {
          console.error("[editPrimeContractSov] atomic RPC outcome unknown", {
            message: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            action: "blocked",
            error:
              "The SOV update outcome could not be verified. Open the Prime Contract and do not retry this approved request unchanged.",
            record: {
              id: plan.contract.id,
              href: `/${input.projectId}/prime-contracts/${plan.contract.id}`,
            },
            preview,
          };
        }

        if (atomicResult.error) {
          console.error("[editPrimeContractSov] atomic RPC rejected", {
            code: atomicResult.error.code,
            message: atomicResult.error.message,
          });
          const failure = {
            success: false,
            action: "blocked",
            error: atomicSovFailureMessage(atomicResult.error.message),
            preview,
          };
          try {
            await failWriteAudit({
              toolName: "editPrimeContractSov",
              idempotencyKey: idempotencyKey!,
              projectId: input.projectId,
              input,
              response: failure,
            });
          } catch (error) {
            console.error("[editPrimeContractSov] failure audit could not finalize", {
              message: error instanceof Error ? error.message : String(error),
            });
          }
          return failure;
        }

        const persistedSovTotal = Number(atomicResult.data?.sovTotal);
        if (!atomicResult.data || !Number.isFinite(persistedSovTotal)) {
          const partialResponse = {
            success: false,
            action: "partial",
            error:
              "The atomic SOV update completed, but its receipt was incomplete. Open the Prime Contract and do not retry this request.",
            record: {
              id: plan.contract.id,
              href: `/${input.projectId}/prime-contracts/${plan.contract.id}`,
            },
            preview,
          };
          try {
            await finalizeWriteAudit({
              toolName: "editPrimeContractSov",
              idempotencyKey: idempotencyKey!,
              response: partialResponse,
            });
          } catch (error) {
            console.error("[editPrimeContractSov] incomplete receipt audit failed", {
              message: error instanceof Error ? error.message : String(error),
            });
          }
          return partialResponse;
        }

        const response = {
          success: true,
          action: "updated",
          message: `Prime Contract ${plan.contract.contract_number} now has ${persistedSovTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })} in its draft SOV.`,
          record: {
            id: plan.contract.id,
            projectId: input.projectId,
            contractNumber: plan.contract.contract_number,
            title: plan.contract.title,
            status: plan.contract.status,
            href: `/${input.projectId}/prime-contracts/${plan.contract.id}`,
          },
          receipt: {
            updatedRows: atomicResult.data.updatedRows,
            appendedRows: atomicResult.data.appendedRows,
            unchangedRows: preview.unchangedRows,
            deletedRows: 0,
            sovTotal: persistedSovTotal,
          },
          preview,
        };

        try {
          await finalizeWriteAudit({
            toolName: "editPrimeContractSov",
            idempotencyKey: idempotencyKey!,
            response,
          });
        } catch {
          return {
            ...response,
            success: false,
            action: "partial",
            error:
              "The SOV was updated, but its AI write audit could not be finalized. Open the contract and do not retry this request.",
          };
        }

        return response;
      }),
    }),
  };
}
