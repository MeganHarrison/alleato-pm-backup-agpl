/**
 * Shared budget grand-totals computation.
 *
 * This is the single source of truth for "what are the current budget totals
 * for project N?". It is consumed by:
 *
 *   - GET /api/projects/[id]/budget            (main budget table)
 *   - GET /api/projects/[id]/budget/snapshots  ("current" comparison block)
 *   - POST /api/projects/[id]/budget/snapshots (captured grand_totals JSON)
 *
 * Every number that ends up in a snapshot or a budget grand-totals row flows
 * through this helper. Keep all money/aggregation logic here — do not
 * duplicate it in route handlers.
 *
 * Per Procore parity:
 *   - Job-to-Date cost detail includes Subcontractor Invoice
 *   - Direct Costs excludes Subcontractor Invoice
 *   - Committed Costs = executed subcontracts + POs + approved commitment COs
 *   - Pending Cost Changes = pending subcontracts + POs + pending commitment COs
 *   - Pending Budget Changes = pending prime contract COs
 */

import type { createClient } from "@/lib/supabase/server";
import type { ForecastMethod } from "@/types/budget";

// ---------------------------------------------------------------------------
// Status + cost-type constants (kept in lock-step with Procore semantics)
// ---------------------------------------------------------------------------

/** Cost types that count towards Job to Date Cost Detail (ALL approved types) */
const JTD_COST_TYPES = [
  "Invoice",
  "Expense",
  "Payroll",
  "Subcontractor Invoice",
];

/** Cost types that count towards Direct Costs (EXCLUDES Subcontractor Invoice) */
const DIRECT_COST_TYPES = ["Invoice", "Expense", "Payroll"];
const APPROVED_DIRECT_COST_STATUSES = ["Approved"];

const PENDING_SUBCONTRACT_STATUSES = ["Out for Signature", "Pending"];
const PENDING_PO_STATUSES = ["Draft", "Sent", "Acknowledged"];

const EXECUTED_SUBCONTRACT_STATUSES = ["Approved", "Complete"];
const EXECUTED_PO_STATUSES = ["Approved", "Completed"];

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface CostAggregation {
  jobToDateCostDetail: number;
  directCosts: number;
  pendingCostChanges: number;
  committedCosts: number;
  approvedBudgetChanges: number;
  pendingBudgetChanges: number;
}

const EMPTY_COST_AGGREGATION: CostAggregation = {
  jobToDateCostDetail: 0,
  directCosts: 0,
  pendingCostChanges: 0,
  committedCosts: 0,
  approvedBudgetChanges: 0,
  pendingBudgetChanges: 0,
};

interface DirectCostParent {
  cost_type: string | null;
  status: string | null;
  project_id: number | null;
}

interface DirectCostWithRelations {
  budget_code_id: string | null;
  line_total: number | null;
  quantity: number | null;
  unit_cost: number | null;
  direct_costs: DirectCostParent | DirectCostParent[] | null;
}

function getDirectCostParent(
  raw: DirectCostWithRelations["direct_costs"],
): DirectCostParent | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

interface SOVItem {
  budget_code: string | null;
  project_budget_code_id: string | null;
  amount: number | null;
}

interface ChangeOrderLineItem {
  cost_code_id: string | null;
  amount: number | null;
}

interface PrimeContractChangeOrderLineItem {
  cost_code: string | null;
  line_amount: number | null;
}

interface CommitmentChangeOrderLineItem {
  cost_code_id: string | null;
  amount: number | null;
}

interface CostForecastEntry {
  budget_item_id: string | null;
  forecast_to_complete: number;
  notes: string | null;
  forecast_date: string;
  created_at: string | null;
}

interface ApprovedBudgetModificationLineItem {
  cost_code_id: string | null;
  cost_type_id: string | null;
  sub_job_id: string | null;
  amount: number | null;
}

interface EditableBudgetFieldsRow {
  id: string;
  quantity: number | null;
  unit_cost: number | null;
  unit_of_measure: string | null;
}

export function mergeBudgetRowsWithEditableFields(
  rows: Record<string, unknown>[],
  editableRows: EditableBudgetFieldsRow[],
) {
  const editableById = new Map(
    editableRows.map((row) => [row.id, row]),
  );

  return rows.map((row) => {
    const editable = editableById.get(String(row.id));
    if (!editable) {
      return row;
    }

    return {
      ...row,
      quantity: editable.quantity,
      unit_cost: editable.unit_cost,
      unit_of_measure: editable.unit_of_measure,
    };
  });
}

interface ForecastDetailRow {
  budget_line_id: string;
  method: "manual" | "monitored_resources";
  description: string | null;
  quantity: number | null;
  units: string | null;
  unit_cost: number | null;
  utilization_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  units_remaining_mode: "weeks" | "months" | null;
  forecast_date: string;
  sort_order: number | null;
}

// ---------------------------------------------------------------------------
// Budget-row fetch with v_budget_lines → budget_lines fallback
// ---------------------------------------------------------------------------

type BudgetRowSource = "view" | "table";
const BUDGET_LINES_VIEW = "v_budget_lines";
const PRIME_CHANGE_ORDER_LINES_TABLE = "change_order_lines";

// The `v_budget_lines` view exists in the database but is not yet included in
// the generated `Database` types. Cast the client to an untyped shape for the
// single call that needs it so we don't blow up the whole file with deep
// inference / "no overload" errors. This is a documented escape hatch; regen
// types once the view is added to the generator output.
type UntypedFrom = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{
          data: Record<string, unknown>[] | null;
          error: unknown;
        }>;
      };
    };
  };
};

type PendingChangeOrderLinesClient = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: number,
      ) => {
        like: (
          nextColumn: string,
          pattern: string,
        ) => Promise<{ data: ChangeOrderLineItem[] | null; error: unknown }>;
      };
    };
  };
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type RuntimeCommitmentsLookupClient = {
  from: (table: "commitments_unified") => {
    select: (query: "id") => {
      eq: (column: "project_id", value: number) => {
        in: (
          column: "id",
          values: string[],
        ) => Promise<{ data: Array<{ id: string }> | null; error: unknown }>;
      };
    };
  };
};

type RuntimeForecastDetailClient = {
  from: (table: "budget_forecast_line_items") => {
    select: (query: string) => {
      in: (
        column: "budget_line_id",
        values: string[],
      ) => {
        order: (
          column: "forecast_date" | "sort_order",
          options?: { ascending?: boolean },
        ) => Promise<{ data: ForecastDetailRow[] | null; error: unknown }>;
      };
    };
  };
};

async function fetchBudgetRows(
  supabase: SupabaseServerClient,
  projectIdNum: number,
): Promise<{
  data: Record<string, unknown>[] | null;
  error: unknown;
  source: BudgetRowSource;
}> {
  const untypedClient = supabase as unknown as UntypedFrom;
  const viewResult = await untypedClient
    .from(BUDGET_LINES_VIEW)
    .select(
      `
      *,
      cost_code:cost_codes(id, title, division_id, division:cost_code_divisions(code, title)),
      cost_type:cost_code_types(code, description),
      sub_job:sub_jobs(code, name)
    `,
    )
    .eq("project_id", projectIdNum)
    .order("cost_code_id", { ascending: true });

  if (!viewResult.error) {
    const editableFieldsResult = await supabase
      .from("budget_lines")
      .select("id, quantity, unit_cost, unit_of_measure")
      .eq("project_id", projectIdNum);

    if (editableFieldsResult.error) {
      return {
        data: null,
        error: editableFieldsResult.error,
        source: "view",
      };
    }

    return {
      data: mergeBudgetRowsWithEditableFields(
        (viewResult.data as Record<string, unknown>[] | null) ?? [],
        (editableFieldsResult.data as EditableBudgetFieldsRow[] | null) ?? [],
      ),
      error: null,
      source: "view",
    };
  }

  const serializedError = JSON.stringify(viewResult.error);
  const isMissingView =
    serializedError.includes("v_budget_lines") ||
    serializedError.includes(BUDGET_LINES_VIEW) ||
    serializedError.includes("PGRST205") ||
    serializedError.includes("schema cache");

  if (!isMissingView) {
    return {
      data: null,
      error: viewResult.error,
      source: "view",
    };
  }

  console.warn(
    "[budget] Falling back to budget_lines because v_budget_lines is unavailable",
    viewResult.error,
  );

  const tableResult = await supabase
    .from("budget_lines")
    .select(
      `
      *,
      cost_code:cost_codes(id, title, division_id, division:cost_code_divisions(code, title)),
      cost_type:cost_code_types(code, description),
      sub_job:sub_jobs(code, name)
    `,
    )
    .eq("project_id", projectIdNum)
    .order("cost_code_id", { ascending: true });

  return {
    data: (tableResult.data as Record<string, unknown>[] | null) ?? [],
    error: tableResult.error,
    source: "table",
  };
}

async function fetchPendingPrimeChangeOrderLines(
  supabase: SupabaseServerClient,
  projectIdNum: number,
) {
  const runtimeClient = supabase as unknown as PendingChangeOrderLinesClient;
  const result = await runtimeClient
    .from(PRIME_CHANGE_ORDER_LINES_TABLE)
    .select("cost_code_id, amount, change_orders!inner(status, project_id)")
    .eq("change_orders.project_id", projectIdNum)
    .like("change_orders.status", "Pending%");

  const serializedError = JSON.stringify(result.error);
  const isMissingTable =
    serializedError.includes(PRIME_CHANGE_ORDER_LINES_TABLE) ||
    serializedError.includes("PGRST205") ||
    serializedError.includes("schema cache");

  if (result.error && isMissingTable) {
    return { data: [], error: null };
  }

  return result;
}

async function fetchPrimeContractChangeOrderLinesByStatus(
  supabase: SupabaseServerClient,
  projectIdNum: number,
  statusFilter: "approved" | "pending",
) {
  const statuses =
    statusFilter === "approved"
      ? ["approved", "Approved"]
      : ["proposed", "pending", "submitted", "under_review", "revised"];

  let query = supabase
    .from("pcco_line_items")
    .select("cost_code, line_amount, prime_contract_change_orders!inner(status, project_id)")
    .eq("prime_contract_change_orders.project_id", projectIdNum);

  if (statusFilter === "approved") {
    query = query.in("prime_contract_change_orders.status", statuses);
  } else {
    query = query.in("prime_contract_change_orders.status", statuses);
  }

  const { data, error } = await query;
  if (error) {
    const serialized = JSON.stringify(error);
    const isMissingTable =
      serialized.includes("pcco_line_items") ||
      serialized.includes("PGRST205") ||
      serialized.includes("schema cache");
    if (isMissingTable) {
      return { data: [] as PrimeContractChangeOrderLineItem[], error: null };
    }
    return { data: null, error };
  }

  return { data: data as PrimeContractChangeOrderLineItem[], error: null };
}

async function fetchCommitmentChangeOrderLinesByStatus(
  supabase: SupabaseServerClient,
  projectIdNum: number,
  statusFilter: "pending" | "approved",
) {
  const { data: lineRows, error: lineError } = await supabase
    .from("commitment_change_order_lines")
    .select("cost_code_id, amount, commitment_change_order_id");

  if (lineError) {
    return { data: null, error: lineError };
  }

  const changeOrderIds = Array.from(
    new Set(
      (lineRows ?? [])
        .map((row) => row.commitment_change_order_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  if (changeOrderIds.length === 0) {
    return { data: [] as ChangeOrderLineItem[], error: null };
  }

  let parentQuery = supabase
    .from("contract_change_orders")
    .select("id, contract_id, status")
    .in("id", changeOrderIds);
  if (statusFilter === "pending") {
    parentQuery = parentQuery.in("status", ["pending", "Pending", "Pending Approval"]);
  } else {
    parentQuery = parentQuery.in("status", ["approved", "Approved", "executed", "Executed"]);
  }

  const { data: parentRows, error: parentError } = await parentQuery;
  if (parentError) {
    return { data: null, error: parentError };
  }

  const commitmentIds = Array.from(
    new Set(
      (parentRows ?? [])
        .map((row) => row.contract_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  if (commitmentIds.length === 0) {
    return { data: [] as ChangeOrderLineItem[], error: null };
  }

  const runtimeCommitmentsClient =
    supabase as unknown as RuntimeCommitmentsLookupClient;
  const { data: commitments, error: commitmentsError } =
    await runtimeCommitmentsClient
      .from("commitments_unified")
      .select("id")
      .eq("project_id", projectIdNum)
      .in("id", commitmentIds);
  if (commitmentsError) {
    return { data: null, error: commitmentsError };
  }

  const allowedCommitmentIds = new Set((commitments ?? []).map((row) => row.id));
  const allowedParentIds = new Set(
    (parentRows ?? [])
      .filter((row) => allowedCommitmentIds.has(row.contract_id))
      .map((row) => row.id),
  );

  const filtered = (lineRows ?? [])
    .filter((row) => allowedParentIds.has(row.commitment_change_order_id))
    .map(
      (row): ChangeOrderLineItem => ({
        cost_code_id: row.cost_code_id,
        amount: row.amount,
      }),
    );

  return { data: filtered, error: null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes a SOV item budget_code to a bare cost_code_id.
 *
 * When SOV items are imported from budget lines the stored budget_code is
 * "cost_code_id.cost_type_code" (e.g. "03 00 00.L"). The costsByCode map
 * is keyed by the bare cost_code_id ("03 00 00"). Strip the type suffix so
 * lookups succeed.
 */
export function normalizeBudgetCode(budgetCode: string): string {
  const dotIndex = budgetCode.indexOf(".");
  return dotIndex === -1 ? budgetCode : budgetCode.substring(0, dotIndex).trim();
}

/**
 * Returns a comparison-only key for budget/cost code matching.
 *
 * External commitment imports can store `09-9723` as `099723`, while local
 * budget lines keep the formatted code. Use this only for lookup keys; keep
 * displaying the formatted source code.
 */
export function normalizeBudgetCodeLookupKey(budgetCode: string): string {
  return normalizeBudgetCode(budgetCode)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function resolveSovBudgetCodeToCostCodeId({
  projectBudgetCodeId,
  budgetCode,
  pccToCostCodeId,
  costCodeIdByLookupKey,
}: {
  projectBudgetCodeId: string | null;
  budgetCode: string | null;
  pccToCostCodeId: Record<string, string>;
  costCodeIdByLookupKey: Map<string, string>;
}): string | null {
  if (projectBudgetCodeId) {
    const mappedProjectBudgetCode = pccToCostCodeId[projectBudgetCodeId];
    if (mappedProjectBudgetCode) return mappedProjectBudgetCode;
  }

  if (!budgetCode) return null;
  const mappedLegacyProjectBudgetCode = pccToCostCodeId[budgetCode];
  if (mappedLegacyProjectBudgetCode) return mappedLegacyProjectBudgetCode;

  const normalizedBudgetCode = normalizeBudgetCode(budgetCode);
  return (
    costCodeIdByLookupKey.get(normalizeBudgetCodeLookupKey(normalizedBudgetCode)) ??
    normalizedBudgetCode
  );
}

export function buildBudgetLineRollupKey(
  costCodeId: string | null | undefined,
  costTypeId: string | null | undefined,
  subJobId: string | null | undefined,
): string | null {
  if (!costCodeId) return null;
  return [costCodeId, costTypeId ?? "", subJobId ?? ""].join("::");
}

export function aggregateApprovedBudgetModificationTotals(
  lines: ApprovedBudgetModificationLineItem[],
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const line of lines) {
    const key = buildBudgetLineRollupKey(
      line.cost_code_id,
      line.cost_type_id,
      line.sub_job_id,
    );
    if (!key) continue;

    totals.set(key, (totals.get(key) ?? 0) + (Number(line.amount) || 0));
  }

  return totals;
}

export function resolveBudgetModificationTotal(
  lineKey: string | null,
  approvedBudgetModificationTotalsByLineKey: Map<string, number>,
  fallbackViewValue: unknown,
): number {
  if (lineKey && approvedBudgetModificationTotalsByLineKey.has(lineKey)) {
    return approvedBudgetModificationTotalsByLineKey.get(lineKey) ?? 0;
  }

  return parseFloat(String(fallbackViewValue ?? 0)) || 0;
}

// ---------------------------------------------------------------------------
// Pure reducers — tested directly, no DB dependency
// ---------------------------------------------------------------------------

/**
 * Empty grand-totals object. Exported so callers can compare against it for
 * "no budget data yet" detection.
 */
export const EMPTY_GRAND_TOTALS: GrandTotals = {
  originalBudgetAmount: 0,
  budgetModifications: 0,
  approvedCOs: 0,
  revisedBudget: 0,
  jobToDateCostDetail: 0,
  directCosts: 0,
  pendingChanges: 0,
  projectedBudget: 0,
  committedCosts: 0,
  pendingCostChanges: 0,
  projectedCosts: 0,
  forecastToComplete: 0,
  estimatedCostAtCompletion: 0,
  projectedOverUnder: 0,
};

export interface BudgetLineItem {
  id: string;
  description: string;
  costCode: string;
  costCodeDescription: string;
  costType: string;
  division: string;
  divisionTitle: string;
  subJob: string;
  originalBudgetAmount: number;
  unitQty?: number;
  uom?: string;
  unitCost?: number;
  budgetModifications: number;
  approvedCOs: number;
  revisedBudget: number;
  jobToDateCostDetail: number;
  directCosts: number;
  pendingChanges: number;
  projectedBudget: number;
  committedCosts: number;
  pendingCostChanges: number;
  projectedCosts: number;
  forecastToComplete: number;
  estimatedCostAtCompletion: number;
  projectedOverUnder: number;
  forecastMethod?: ForecastMethod;
  forecastNotes?: string | null;
}

export type GrandTotals = Omit<
  BudgetLineItem,
  | "id"
  | "description"
  | "costCode"
  | "costCodeDescription"
  | "costType"
  | "division"
  | "divisionTitle"
  | "subJob"
  | "forecastMethod"
  | "forecastNotes"
>;

/**
 * Reduce an array of line items into their summed grand totals.
 * Pure function — safe to unit-test.
 */
export function reduceGrandTotals(lineItems: BudgetLineItem[]): GrandTotals {
  return lineItems.reduce<GrandTotals>(
    (totals, item) => ({
      originalBudgetAmount:
        totals.originalBudgetAmount + item.originalBudgetAmount,
      budgetModifications:
        totals.budgetModifications + item.budgetModifications,
      approvedCOs: totals.approvedCOs + item.approvedCOs,
      revisedBudget: totals.revisedBudget + item.revisedBudget,
      jobToDateCostDetail:
        totals.jobToDateCostDetail + item.jobToDateCostDetail,
      directCosts: totals.directCosts + item.directCosts,
      pendingChanges: totals.pendingChanges + item.pendingChanges,
      projectedBudget: totals.projectedBudget + item.projectedBudget,
      committedCosts: totals.committedCosts + item.committedCosts,
      pendingCostChanges:
        totals.pendingCostChanges + item.pendingCostChanges,
      projectedCosts: totals.projectedCosts + item.projectedCosts,
      forecastToComplete: totals.forecastToComplete + item.forecastToComplete,
      estimatedCostAtCompletion:
        totals.estimatedCostAtCompletion + item.estimatedCostAtCompletion,
      projectedOverUnder:
        totals.projectedOverUnder + item.projectedOverUnder,
    }),
    { ...EMPTY_GRAND_TOTALS },
  );
}

export function extractBudgetLineEditFields(item: Record<string, unknown>) {
  const quantity =
    item.quantity == null ? undefined : Number(item.quantity);
  const unitCost =
    item.unit_cost == null ? undefined : Number(item.unit_cost);
  const unitOfMeasure =
    typeof item.unit_of_measure === "string" && item.unit_of_measure.trim()
      ? item.unit_of_measure
      : undefined;

  return {
    unitQty: Number.isFinite(quantity) ? quantity : undefined,
    uom: unitOfMeasure,
    unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
  };
}

export function consumeCostAggregationOnce(
  costCodeId: string,
  costsByCode: Record<string, CostAggregation>,
  consumedCostCodes: Set<string>,
): CostAggregation {
  if (consumedCostCodes.has(costCodeId)) {
    return EMPTY_COST_AGGREGATION;
  }

  consumedCostCodes.add(costCodeId);
  return costsByCode[costCodeId] || EMPTY_COST_AGGREGATION;
}

// ---------------------------------------------------------------------------
// Orchestrator — fetches all 10 sources and returns line items + grand totals
// ---------------------------------------------------------------------------

export interface ComputeGrandTotalsResult {
  lineItems: BudgetLineItem[];
  grandTotals: GrandTotals;
  /** Informational: which data source the per-line budget rows came from. */
  source: BudgetRowSource;
}

export class BudgetFetchError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Failed to fetch budget data for grand-totals computation");
    this.name = "BudgetFetchError";
    this.cause = cause;
  }
}

export async function computeBudgetGrandTotals(
  supabase: SupabaseServerClient,
  projectIdNum: number,
): Promise<ComputeGrandTotalsResult> {
  const [
    budgetRowsResult,
    directCostsRes,
    projectCostCodesRes,
    approvedBudgetModificationsRes,
    subcontractSovRes,
    poSovRes,
    pendingPrimeChangeOrdersRes,
    approvedPrimeContractCOsRes,
    pendingPrimeContractCOsRes,
    executedSubcontractSovRes,
    executedPoSovRes,
    pendingCommitmentCOsRes,
    approvedCommitmentCOsRes,
  ] = await Promise.all([
    fetchBudgetRows(supabase, projectIdNum),
    supabase
      .from("direct_cost_line_items")
      .select(
        `
        budget_code_id,
        line_total,
        quantity,
        unit_cost,
        direct_costs!inner(
          cost_type,
          status,
          project_id
        )
      `,
      )
      .eq("direct_costs.project_id", projectIdNum)
      .in("direct_costs.status", APPROVED_DIRECT_COST_STATUSES),

    supabase
      .from("project_budget_codes")
      .select("id, cost_code_id")
      .eq("project_id", projectIdNum),

    supabase
      .from("budget_mod_lines")
      .select(
        `
        cost_code_id,
        cost_type_id,
        sub_job_id,
        amount,
        budget_modifications!inner(status, project_id)
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("budget_modifications.status", "approved"),

    supabase
      .from("subcontract_sov_items")
      .select("budget_code, project_budget_code_id, amount, subcontracts!inner(status, project_id)")
      .eq("subcontracts.project_id", projectIdNum)
      .in("subcontracts.status", PENDING_SUBCONTRACT_STATUSES),

    supabase
      .from("purchase_order_sov_items")
      .select(
        "budget_code, project_budget_code_id, amount, purchase_orders!inner(status, project_id)",
      )
      .eq("purchase_orders.project_id", projectIdNum)
      .in("purchase_orders.status", PENDING_PO_STATUSES),

    fetchPendingPrimeChangeOrderLines(supabase, projectIdNum),
    fetchPrimeContractChangeOrderLinesByStatus(supabase, projectIdNum, "approved"),
    fetchPrimeContractChangeOrderLinesByStatus(supabase, projectIdNum, "pending"),

    supabase
      .from("subcontract_sov_items")
      .select("budget_code, project_budget_code_id, amount, subcontracts!inner(status, project_id)")
      .eq("subcontracts.project_id", projectIdNum)
      .in("subcontracts.status", EXECUTED_SUBCONTRACT_STATUSES),

    supabase
      .from("purchase_order_sov_items")
      .select(
        "budget_code, project_budget_code_id, amount, purchase_orders!inner(status, project_id)",
      )
      .eq("purchase_orders.project_id", projectIdNum)
      .in("purchase_orders.status", EXECUTED_PO_STATUSES),

    fetchCommitmentChangeOrderLinesByStatus(supabase, projectIdNum, "pending"),
    fetchCommitmentChangeOrderLinesByStatus(supabase, projectIdNum, "approved"),
  ]);

  if (budgetRowsResult.error) {
    throw new BudgetFetchError(budgetRowsResult.error);
  }
  if (pendingCommitmentCOsRes.error) {
    throw new BudgetFetchError(pendingCommitmentCOsRes.error);
  }
  if (approvedCommitmentCOsRes.error) {
    throw new BudgetFetchError(approvedCommitmentCOsRes.error);
  }
  if (approvedPrimeContractCOsRes.error) {
    throw new BudgetFetchError(approvedPrimeContractCOsRes.error);
  }
  if (pendingPrimeContractCOsRes.error) {
    throw new BudgetFetchError(pendingPrimeContractCOsRes.error);
  }

  const budgetLineIds: string[] = [];
  for (const row of budgetRowsResult.data || []) {
    const id = row.id;
    if (typeof id === "string" && id.length > 0) {
      budgetLineIds.push(id);
    }
  }

  const defaultMethodByLineId = new Map<string, ForecastMethod>();
  const forecastEntryByLineId = new Map<string, CostForecastEntry>();
  const forecastDetailRowsByLineId = new Map<string, ForecastDetailRow[]>();

  if (budgetLineIds.length > 0) {
    const runtimeForecastDetailClient =
      supabase as unknown as RuntimeForecastDetailClient;

    const [lineConfigRes, costForecastRes, detailRowsRes] = await Promise.all([
      supabase
        .from("budget_lines")
        .select("id, default_ftc_method")
        .in("id", budgetLineIds),
      supabase
        .from("cost_forecasts")
        .select("budget_item_id, forecast_to_complete, notes, forecast_date, created_at")
        .in("budget_item_id", budgetLineIds)
        .order("forecast_date", { ascending: false })
        .order("created_at", { ascending: false }),
      runtimeForecastDetailClient
        .from("budget_forecast_line_items")
        .select(
          "budget_line_id, method, description, quantity, units, unit_cost, utilization_rate, start_date, end_date, units_remaining_mode, forecast_date, sort_order",
        )
        .in("budget_line_id", budgetLineIds)
        .order("forecast_date", { ascending: false }),
    ]);

    if (lineConfigRes.error) {
      throw new BudgetFetchError(lineConfigRes.error);
    }
    if (costForecastRes.error) {
      throw new BudgetFetchError(costForecastRes.error);
    }
    if (detailRowsRes.error) {
      const serialized = JSON.stringify(detailRowsRes.error);
      const isMissingDetailTable =
        serialized.includes("budget_forecast_line_items") ||
        serialized.includes("PGRST205") ||
        serialized.includes("schema cache");
      if (!isMissingDetailTable) {
        throw new BudgetFetchError(detailRowsRes.error);
      }
    }

    for (const row of lineConfigRes.data || []) {
      if (!row.id) continue;
      const method = (row.default_ftc_method ?? "automatic") as ForecastMethod;
      defaultMethodByLineId.set(row.id, method);
    }

    for (const entry of (costForecastRes.data || []) as CostForecastEntry[]) {
      const lineId = entry.budget_item_id;
      if (!lineId || forecastEntryByLineId.has(lineId)) continue;
      forecastEntryByLineId.set(lineId, entry);
    }

    const latestDateByLineId = new Map<string, string>();
    for (const row of detailRowsRes.data || []) {
      const lineId = row.budget_line_id;
      const latestDate = latestDateByLineId.get(lineId);
      if (!latestDate) {
        latestDateByLineId.set(lineId, row.forecast_date);
      }
      if (latestDateByLineId.get(lineId) !== row.forecast_date) {
        continue;
      }
      const existing = forecastDetailRowsByLineId.get(lineId) || [];
      existing.push(row);
      existing.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      forecastDetailRowsByLineId.set(lineId, existing);
    }
  }

  // ---- Aggregate costs by cost_code_id across all sources ----
  const costsByCode: Record<string, CostAggregation> = {};
  const ensureCostEntry = (codeId: string) => {
    if (!costsByCode[codeId]) {
      costsByCode[codeId] = {
        jobToDateCostDetail: 0,
        directCosts: 0,
        pendingCostChanges: 0,
        committedCosts: 0,
        approvedBudgetChanges: 0,
        pendingBudgetChanges: 0,
      };
    }
  };

  // Translation map: project_budget_codes.id -> cost_codes.id
  const pccToCostCodeId: Record<string, string> = {};
  for (const pcc of projectCostCodesRes.data || []) {
    if (pcc.id && pcc.cost_code_id) {
      pccToCostCodeId[pcc.id] = pcc.cost_code_id;
    }
  }

  const costCodeIdByLookupKey = new Map<string, string>();
  for (const row of budgetRowsResult.data || []) {
    const costCodeId = row.cost_code_id;
    if (typeof costCodeId !== "string" || costCodeId.length === 0) continue;
    costCodeIdByLookupKey.set(normalizeBudgetCodeLookupKey(costCodeId), costCodeId);
  }

  // Direct costs (approved only) → JTD + Direct Costs
  for (const cost of (directCostsRes.data || []) as DirectCostWithRelations[]) {
    const codeId = cost.budget_code_id
      ? (pccToCostCodeId[cost.budget_code_id] ?? null)
      : null;
    if (!codeId) continue;
    ensureCostEntry(codeId);

    const directCost = getDirectCostParent(cost.direct_costs);
    const costType = directCost?.cost_type || "Invoice";
    const amount =
      cost.line_total ?? (cost.quantity ?? 0) * (cost.unit_cost ?? 0);

    if (JTD_COST_TYPES.includes(costType)) {
      costsByCode[codeId].jobToDateCostDetail += amount;
    }
    if (DIRECT_COST_TYPES.includes(costType)) {
      costsByCode[codeId].directCosts += amount;
    }
  }

  // Pending Cost Changes: subcontracts, POs, commitment COs
  for (const item of (subcontractSovRes.data || []) as SOVItem[]) {
    const codeId = resolveSovBudgetCodeToCostCodeId({
      projectBudgetCodeId: item.project_budget_code_id,
      budgetCode: item.budget_code,
      pccToCostCodeId,
      costCodeIdByLookupKey,
    });
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].pendingCostChanges += item.amount || 0;
  }
  for (const item of (poSovRes.data || []) as SOVItem[]) {
    const codeId = resolveSovBudgetCodeToCostCodeId({
      projectBudgetCodeId: item.project_budget_code_id,
      budgetCode: item.budget_code,
      pccToCostCodeId,
      costCodeIdByLookupKey,
    });
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].pendingCostChanges += item.amount || 0;
  }
  for (const item of (pendingCommitmentCOsRes.data ||
    []) as CommitmentChangeOrderLineItem[]) {
    const codeId = item.cost_code_id;
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].pendingCostChanges += item.amount || 0;
  }

  // Pending Budget Changes: pending prime contract COs
  for (const item of (pendingPrimeChangeOrdersRes.data ||
    []) as ChangeOrderLineItem[]) {
    const codeId = item.cost_code_id;
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].pendingBudgetChanges += item.amount || 0;
  }
  for (const item of (pendingPrimeContractCOsRes.data ||
    []) as PrimeContractChangeOrderLineItem[]) {
    const codeId = item.cost_code;
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].pendingBudgetChanges += item.line_amount || 0;
  }

  // Approved Budget Changes: approved prime contract COs
  for (const item of (approvedPrimeContractCOsRes.data ||
    []) as PrimeContractChangeOrderLineItem[]) {
    const codeId = item.cost_code;
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].approvedBudgetChanges += item.line_amount || 0;
  }

  // Committed Costs: executed subs + POs + approved commitment COs
  for (const item of (executedSubcontractSovRes.data || []) as SOVItem[]) {
    const codeId = resolveSovBudgetCodeToCostCodeId({
      projectBudgetCodeId: item.project_budget_code_id,
      budgetCode: item.budget_code,
      pccToCostCodeId,
      costCodeIdByLookupKey,
    });
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].committedCosts += item.amount || 0;
  }
  for (const item of (executedPoSovRes.data || []) as SOVItem[]) {
    const codeId = resolveSovBudgetCodeToCostCodeId({
      projectBudgetCodeId: item.project_budget_code_id,
      budgetCode: item.budget_code,
      pccToCostCodeId,
      costCodeIdByLookupKey,
    });
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].committedCosts += item.amount || 0;
  }
  for (const item of (approvedCommitmentCOsRes.data ||
    []) as CommitmentChangeOrderLineItem[]) {
    const codeId = item.cost_code_id;
    if (!codeId) continue;
    ensureCostEntry(codeId);
    costsByCode[codeId].committedCosts += item.amount || 0;
  }

  // ---- Map budget rows to full line items ----
  const approvedBudgetModificationTotalsByLineKey =
    aggregateApprovedBudgetModificationTotals(
      (approvedBudgetModificationsRes.data ||
        []) as ApprovedBudgetModificationLineItem[],
    );

  const consumedCostCodes = new Set<string>();
  const lineItems: BudgetLineItem[] = (budgetRowsResult.data || []).map(
    (item: Record<string, unknown>) => {
      const costCode = item.cost_code as
        | {
            id?: string;
            title?: string;
            division_id?: string;
            division?:
              | { code?: string; title?: string }
              | Array<{ code?: string; title?: string }>
              | null;
          }
        | undefined;
      const divisionRaw = costCode?.division;
      const division = Array.isArray(divisionRaw) ? divisionRaw[0] : divisionRaw;
      const costType = item.cost_type as
        | { code?: string; description?: string }
        | undefined;
      const subJob = item.sub_job as
        | { code?: string; name?: string }
        | undefined;
      const costCodeId = item.cost_code_id as string;
      const lineKey = buildBudgetLineRollupKey(
        costCodeId,
        item.cost_type_id as string | null | undefined,
        item.sub_job_id as string | null | undefined,
      );

      const costData = consumeCostAggregationOnce(
        costCodeId,
        costsByCode,
        consumedCostCodes,
      );

      const originalBudgetAmount =
        parseFloat(item.original_amount as string) || 0;
      const budgetModifications = resolveBudgetModificationTotal(
        lineKey,
        approvedBudgetModificationTotalsByLineKey,
        item.budget_mod_total,
      );
      const approvedCOs = budgetRowsResult.source === "table"
        ? costData.approvedBudgetChanges
        : (parseFloat(item.approved_co_total as string) || 0) +
          costData.approvedBudgetChanges;
      const revisedBudget =
        originalBudgetAmount + budgetModifications + approvedCOs;

      const projectedBudget = revisedBudget + costData.pendingBudgetChanges;
      const projectedCosts =
        costData.directCosts +
        costData.committedCosts +
        costData.pendingCostChanges;

      const lineId = item.id as string;
      const forecastMethod =
        defaultMethodByLineId.get(lineId) ?? ("automatic" as ForecastMethod);
      const autoForecast = Math.max(0, projectedBudget - projectedCosts);
      const forecastEntry = forecastEntryByLineId.get(lineId);
      const detailRows = forecastDetailRowsByLineId.get(lineId) || [];
      const detailForecastAmount = computeDetailForecastAmount(
        forecastMethod,
        detailRows,
      );
      const forecastStartDate =
        detailRows
          .map((row) => row.start_date ?? null)
          .find((value): value is string => Boolean(value)) ?? null;
      const forecastEndDate =
        [...detailRows]
          .reverse()
          .map((row) => row.end_date ?? null)
          .find((value): value is string => Boolean(value)) ?? null;
      const savedForecast = Number(forecastEntry?.forecast_to_complete ?? NaN);
      const hasSavedForecast = Number.isFinite(savedForecast);
      const forecastToComplete =
        forecastMethod === "automatic"
          ? autoForecast
          : detailForecastAmount !== null
            ? detailForecastAmount
          : hasSavedForecast
            ? savedForecast
            : autoForecast;
      const estimatedCostAtCompletion = projectedCosts + forecastToComplete;
      const projectedOverUnder = projectedBudget - estimatedCostAtCompletion;

      return {
        id: item.id as string,
        description:
          (item.description as string) ||
          `${costCodeId} - ${costCode?.title || ""} ${costType?.code ? `(${costType.code})` : ""}`,
        costCode: costCodeId,
        costCodeDescription: costCode?.title || "",
        costType: costType?.code || "",
        division: division?.code || costCode?.division_id || "",
        divisionTitle: division?.title || "",
        subJob: subJob?.name || "",

        originalBudgetAmount,
        ...extractBudgetLineEditFields(item),
        budgetModifications,
        approvedCOs,
        revisedBudget,

        jobToDateCostDetail: costData.jobToDateCostDetail,
        directCosts: costData.directCosts,
        pendingChanges: costData.pendingBudgetChanges,
        projectedBudget,
        committedCosts: costData.committedCosts,
        pendingCostChanges: costData.pendingCostChanges,
        projectedCosts,
        forecastToComplete,
        estimatedCostAtCompletion,
        projectedOverUnder,
        forecastMethod,
        forecastNotes: forecastEntry?.notes ?? null,
        forecastStartDate,
        forecastEndDate,
      };
    },
  );

  const grandTotals = reduceGrandTotals(lineItems);

  return {
    lineItems,
    grandTotals,
    source: budgetRowsResult.source,
  };
}

// Computes FTC from persisted detail rows when method uses line-item detail.
function computeDetailForecastAmount(
  method: ForecastMethod,
  detailRows: ForecastDetailRow[],
): number | null {
  if (detailRows.length === 0) {
    return null;
  }

  if (method === "manual") {
    return detailRows.reduce((sum, row) => {
      const quantity = Math.max(0, Number(row.quantity) || 0);
      const unitCost = Math.max(0, Number(row.unit_cost) || 0);
      return sum + quantity * unitCost;
    }, 0);
  }

  if (method === "monitored_resources") {
    const today = new Date();
    return detailRows.reduce((sum, row) => {
      const utilization =
        row.utilization_rate == null ? 100 : Math.max(0, Number(row.utilization_rate));
      const calculatedUnitCost =
        Math.max(0, Number(row.unit_cost) || 0) * (utilization / 100);
      const start = row.start_date ? new Date(`${row.start_date}T00:00:00Z`) : null;
      const end = row.end_date ? new Date(`${row.end_date}T00:00:00Z`) : null;
      const mode = row.units_remaining_mode ?? "weeks";
      if (
        !start ||
        !end ||
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
      ) {
        return sum + calculatedUnitCost;
      }

      const totalUnits =
        mode === "months"
          ? monitoredMonthUnitsInclusive(start, end)
          : monitoredWeekUnitsInclusive(start, end);
      const elapsedUnits =
        mode === "months"
          ? monitoredElapsedMonthUnits(start, today)
          : monitoredElapsedWeekUnits(start, today);
      const unitsRemaining = Math.max(0, totalUnits - elapsedUnits);
      return sum + calculatedUnitCost * unitsRemaining;
    }, 0);
  }

  return null;
}

// Computes non-prorated monitored week units (8 days -> 2 weeks).
function monitoredWeekUnitsInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayCount = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
  return Math.max(1, Math.ceil(dayCount / 7));
}

// Computes elapsed full monitored week units since start date.
function monitoredElapsedWeekUnits(start: Date, today: Date): number {
  if (today <= start) return 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / msPerWeek));
}

// Computes non-prorated monitored month units.
function monitoredMonthUnitsInclusive(start: Date, end: Date): number {
  const years = end.getUTCFullYear() - start.getUTCFullYear();
  const months = end.getUTCMonth() - start.getUTCMonth();
  return Math.max(1, years * 12 + months + 1);
}

// Computes elapsed full monitored month units since start date.
function monitoredElapsedMonthUnits(start: Date, today: Date): number {
  if (today <= start) return 0;
  const years = today.getUTCFullYear() - start.getUTCFullYear();
  const months = today.getUTCMonth() - start.getUTCMonth();
  return Math.max(0, years * 12 + months);
}
