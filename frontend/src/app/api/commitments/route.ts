import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import type { PaginatedResponse, Commitment, Company } from "@/app/api/types";
import { apiErrorResponse } from "@/lib/api-error";
import {
  buildCommitmentScopeRecords,
  costCodeLookupKeys,
  type CommitmentScopeLine,
  type CommitmentScopeSource,
  type CostCodeInsight,
} from "@/lib/commitments/scope-finder";

/**
 * Columns selected from *_with_totals views.
 * Only fetch columns needed for the list page to reduce payload size.
 */
/**
 * Shared columns that exist on both *_with_totals views.
 */
const BASE_LIST_COLUMNS = [
  "id",
  "project_id",
  "contract_number",
  "title",
  "status",
  "executed",
  "contract_company_id",
  "company_name",
  "company_type",
  "description",
  "contract_date",
  "default_retainage_percent",
  "created_at",
  "updated_at",
  "total_sov_amount",
  "total_billed_to_date",
  "total_amount_remaining",
  "sov_line_count",
  "is_private",
];

/** subcontracts_with_totals has start_date/inclusions/exclusions; purchase_orders_with_totals does not */
const SC_LIST_COLUMNS = [...BASE_LIST_COLUMNS, "start_date", "inclusions", "exclusions"].join(",");
const PO_LIST_COLUMNS = BASE_LIST_COLUMNS.join(",");

interface WithTotalsRow {
  id: string | null;
  project_id: number | null;
  contract_number: string | null;
  title: string | null;
  status: string | null;
  executed: boolean | null;
  contract_company_id: string | null;
  company_name: string | null;
  company_type?: string | null;
  description: string | null;
  start_date?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  contract_date: string | null;
  default_retainage_percent: number | null;
  created_at: string | null;
  updated_at: string | null;
  total_sov_amount: number | null;
  total_billed_to_date: number | null;
  total_amount_remaining: number | null;
  sov_line_count: number | null;
  erp_status?: string | null;
  ssov_status?: string | null;
  is_private?: boolean | null;
}

interface UnifiedCommitmentRow {
  id: string | null;
  commitment_type: string | null;
  created_at: string | null;
  created_by: string | null;
}

interface CoAggRow {
  contract_id: string | null;
  status: string | null;
  amount: number | null;
}

interface CoTotals {
  approved: number;
  pending: number;
  draft: number;
  count: number;
}

interface PurchaseOrderScopeRow {
  id: string | null;
  inclusions: string | null;
  exclusions: string | null;
}

type CompanyType = Company["type"];

const VALID_COMPANY_TYPES = new Set<CompanyType>(["vendor", "subcontractor", "supplier", "owner"]);

// Normalize database company type values into the API union expected by Commitment.company.
function normalizeCompanyType(value: string | null | undefined): CompanyType {
  return value && VALID_COMPANY_TYPES.has(value as CompanyType) ? (value as CompanyType) : "vendor";
}

function mapRowToCommitment(
  row: WithTotalsRow,
  type: "subcontract" | "purchase_order",
  coTotals: CoTotals,
  paymentsIssued: number,
  erpStatus: string | null,
  ssovStatus: string | null,
  createdByName: string | null,
  scopeRecord?: {
    costCodes: string[];
    tradeNames: string[];
    scopeSummary: string | null;
  },
): Commitment {
  const originalAmount = Number(row.total_sov_amount) || 0;
  const billedToDate = Number(row.total_billed_to_date) || 0;
  const balanceToFinish = Number(row.total_amount_remaining) || 0;

  const approvedCOs = coTotals.approved;
  const pendingCOs = coTotals.pending;
  const draftCOs = coTotals.draft;
  const revisedContractAmount = originalAmount + approvedCOs;
  const invoicedAmount = billedToDate;
  const percentPaid = revisedContractAmount > 0 ? (paymentsIssued / revisedContractAmount) * 100 : 0;
  const remainingBalance = revisedContractAmount - paymentsIssued;

  return {
    id: row.id || "",
    project_id: row.project_id || 0,
    number: row.contract_number || "",
    title: row.title,
    status: row.status?.toLowerCase() || "draft",
    type,
    executed: row.executed ?? false,
    contract_company_id: row.contract_company_id,
    contract_company: row.company_name
      ? {
          id: row.contract_company_id || "",
          name: row.company_name,
          type: normalizeCompanyType(row.company_type),
        }
      : null,
    description: row.description,
    original_amount: originalAmount,
    approved_change_orders: approvedCOs,
    revised_contract_amount: revisedContractAmount,
    billed_to_date: billedToDate,
    balance_to_finish: balanceToFinish,
    start_date: row.start_date || null,
    executed_date: row.contract_date,
    retention_percentage: row.default_retainage_percent,
    created_at: row.created_at || new Date().toISOString(),
    created_by_name: createdByName,
    updated_at: row.updated_at || new Date().toISOString(),
    erp_status: erpStatus,
    ssov_status: ssovStatus,
    change_order_count: coTotals.count,
    pending_change_orders: pendingCOs,
    draft_change_orders: draftCOs,
    invoiced_amount: invoicedAmount,
    payments_issued: paymentsIssued,
    percent_paid: percentPaid,
    remaining_balance: remainingBalance,
    cost_codes: scopeRecord?.costCodes ?? [],
    trade_names: scopeRecord?.tradeNames ?? [],
    scope_summary: scopeRecord?.scopeSummary ?? null,
    is_private: row.is_private ?? true,
  };
}

/**
 * GET /api/commitments
 *
 * Retrieves a paginated list of commitments (subcontracts and purchase orders)
 * with filtering, search, and automatic subcontractor company scoping.
 *
 * Performance optimizations (Phase 9):
 * - Selects only needed columns instead of SELECT *
 * - Filters soft-deleted records at the database level
 * - Runs subcontract and purchase order queries in parallel
 * - Uses server-side range limiting to reduce payload
 * - Response includes Cache-Control headers for client caching
 *
 * @route GET /api/commitments
 *
 * @queryparam {string} projectId - (Required) Project ID to filter commitments
 * @queryparam {number} [page=1] - Page number for pagination (1-based)
 * @queryparam {number} [limit=50] - Items per page (default reduced from 100 to 50)
 * @queryparam {string} [status] - Filter by commitment status (case-insensitive)
 * @queryparam {string} [search] - Search in contract_number and title fields
 * @queryparam {string} [companyId] - Filter by contract company ID
 * @queryparam {string} [type] - Filter by type: "subcontract" or "purchase_order"
 * @queryparam {"exclude"|"only"|"include"} [deleted=exclude] - Soft-delete filter mode
 *
 * @returns {PaginatedResponse<Commitment>} 200 - Paginated list of commitments with metadata
 * @returns {object} 401 - Unauthorized (missing or invalid session)
 * @returns {object} 400/500 - Error response from database or server
 */
export const GET = withApiGuardrails(
  "commitments#GET",
  async ({ request }) => {

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments#GET", message: "Authentication required." });
    }
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    let companyId = searchParams.get("companyId");
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type");
    const primeContractId = searchParams.get("prime_contract_id");
    const deletedParam = searchParams.get("deleted");
    const deleted: "exclude" | "only" | "include" =
      deletedParam === "only" || deletedParam === "include" ? deletedParam : "exclude";

    // For subcontractors, auto-filter to only their company's commitments
    if (projectId && !companyId) {
            const { data: authLink } = await serviceDb.from("users_auth")
        .select("person_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (authLink) {
        const projectIdNum = parseInt(projectId, 10);
        const { data: membership } = await serviceDb.from("project_directory_memberships")
          .select("user_type")
          .eq("person_id", authLink.person_id)
          .eq("project_id", projectIdNum)
          .eq("status", "active")
          .maybeSingle();

        if (membership?.user_type === "subcontractor") {
          const { data: person } = await serviceDb.from("people")
            .select("company_id")
            .eq("id", authLink.person_id)
            .maybeSingle();

          if (person?.company_id) {
            companyId = String(person.company_id);
          }
        }
      }
    }

    const filters = { projectId, status, companyId, search, type, primeContractId };
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // When filtering by prime_contract_id, pre-resolve matching subcontract + PO ids
    // (commitments_unified view does not expose prime_contract_id).
    let primeContractFilterIds: string[] | null = null;
    if (filters.primeContractId) {
      const [scIds, poIds] = await Promise.all([
        supabase.from("subcontracts").select("id").eq("prime_contract_id", filters.primeContractId),
        supabase.from("purchase_orders").select("id").eq("prime_contract_id", filters.primeContractId),
      ]);
      if (scIds.error) throw scIds.error;
      if (poIds.error) throw poIds.error;
      primeContractFilterIds = [
        ...((scIds.data ?? []).map((r) => r.id).filter((id): id is string => Boolean(id))),
        ...((poIds.data ?? []).map((r) => r.id).filter((id): id is string => Boolean(id))),
      ];
    }

    let baseQuery = supabase
      .from("commitments_unified")
      .select("id, commitment_type, created_at, created_by", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (deleted === "exclude") {
      baseQuery = baseQuery.is("deleted_at", null);
    } else if (deleted === "only") {
      baseQuery = baseQuery.not("deleted_at", "is", null);
    }
    if (filters.projectId) baseQuery = baseQuery.eq("project_id", parseInt(filters.projectId, 10));
    if (filters.status) baseQuery = baseQuery.ilike("status", filters.status);
    if (filters.companyId) baseQuery = baseQuery.eq("contract_company_id", filters.companyId);
    if (filters.search) baseQuery = baseQuery.or(`contract_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
    if (filters.type) baseQuery = baseQuery.eq("commitment_type", filters.type);
    if (primeContractFilterIds !== null) {
      if (primeContractFilterIds.length === 0) {
        // No commitments linked to this contract — short-circuit to empty result.
        return NextResponse.json({
          data: [],
          meta: { page, limit, total: 0, totalPages: 1 },
        }, {
          headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
        });
      }
      baseQuery = baseQuery.in("id", primeContractFilterIds);
    }

    const {
      data: baseRows,
      error: baseError,
      count: totalCount,
    } = await baseQuery;
    if (baseError) throw baseError;

    const orderedBaseRows = (baseRows || []) as UnifiedCommitmentRow[];
    const createdByAuthUserIdByCommitmentId = new Map<string, string | null>();
    for (const row of orderedBaseRows) {
      if (row.id) {
        createdByAuthUserIdByCommitmentId.set(row.id, row.created_by ?? null);
      }
    }
    const createdByAuthUserIds = Array.from(
      new Set(
        orderedBaseRows
          .map((row) => row.created_by)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const subcontractIds = orderedBaseRows
      .filter((row) => row.id && row.commitment_type === "subcontract")
      .map((row) => row.id as string);
    const purchaseOrderIds = orderedBaseRows
      .filter((row) => row.id && row.commitment_type === "purchase_order")
      .map((row) => row.id as string);
    const allIds = [...subcontractIds, ...purchaseOrderIds];

    const [
      subcontractRows,
      purchaseOrderRows,
      purchaseOrderScopeRows,
      changeOrderRows,
      subcontractSovRows,
      purchaseOrderSovRows,
      creatorRows,
    ] = await Promise.all([
      subcontractIds.length > 0
        ? supabase
            .from("subcontracts_with_totals")
            .select(SC_LIST_COLUMNS)
            .in("id", subcontractIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length > 0
        ? supabase
            .from("purchase_orders_with_totals")
            .select(PO_LIST_COLUMNS)
            .in("id", purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length > 0
        ? supabase
            .from("purchase_orders")
            .select("id,inclusions,exclusions")
            .in("id", purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
      // Fetch CO totals for all commitments on this page
      allIds.length > 0
        ? supabase
            .from("contract_change_orders")
            .select("contract_id, status, amount")
            .in("contract_id", allIds)
        : Promise.resolve({ data: [], error: null }),
      subcontractIds.length > 0
        ? supabase
            .from("subcontract_sov_items")
            .select("subcontract_id,budget_code,description,amount,line_number")
            .in("subcontract_id", subcontractIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length > 0
        ? supabase
            .from("purchase_order_sov_items")
            .select("purchase_order_id,budget_code,description,amount,line_number")
            .in("purchase_order_id", purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
      createdByAuthUserIds.length > 0
        ? supabase
            .from("people")
            .select("auth_user_id, first_name, last_name")
            .in("auth_user_id", createdByAuthUserIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (subcontractRows.error) throw subcontractRows.error;
    if (purchaseOrderRows.error) throw purchaseOrderRows.error;
    if (purchaseOrderScopeRows.error) throw purchaseOrderScopeRows.error;
    if (changeOrderRows.error) throw changeOrderRows.error;
    if (subcontractSovRows.error) throw subcontractSovRows.error;
    if (purchaseOrderSovRows.error) throw purchaseOrderSovRows.error;
    if (creatorRows.error) throw creatorRows.error;

    const creatorNameByAuthUserId = new Map<string, string>();
    for (const row of creatorRows.data || []) {
      if (!row.auth_user_id) continue;
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        null;
      if (name) creatorNameByAuthUserId.set(row.auth_user_id, name);
    }

    const subcontractSovSummaryRows: CommitmentScopeLine[] = (subcontractSovRows.data || []).map((row) => ({
      commitmentId: row.subcontract_id,
      budgetCode: row.budget_code,
      description: row.description,
      amount: row.amount,
      lineNumber: row.line_number,
    }));
    const purchaseOrderSovSummaryRows: CommitmentScopeLine[] = (purchaseOrderSovRows.data || []).map((row) => ({
      commitmentId: row.purchase_order_id,
      budgetCode: row.budget_code,
      description: row.description,
      amount: row.amount,
      lineNumber: row.line_number,
    }));
    const sovSummaryRows = [...subcontractSovSummaryRows, ...purchaseOrderSovSummaryRows];
    const budgetCodes = Array.from(
      new Set(
        sovSummaryRows
          .flatMap((row) => (row.budgetCode ? costCodeLookupKeys(row.budgetCode) : [])),
      ),
    );
    const costCodeByBudgetCode = new Map<string, CostCodeInsight>();
    if (budgetCodes.length > 0) {
      const { data: costCodeRows, error: costCodeError } = await supabase
        .from("cost_codes")
        .select("id,title,division_title")
        .in("id", budgetCodes);
      if (costCodeError) throw costCodeError;
      for (const row of costCodeRows ?? []) {
        const insight = {
          divisionTitle: row.division_title?.replace(/\s+/g, " ").trim() || null,
          title: row.title?.replace(/\s+/g, " ").trim() || null,
        };
        if (insight.divisionTitle || insight.title) {
          for (const key of costCodeLookupKeys(row.id)) costCodeByBudgetCode.set(key, insight);
        }
      }
    }

    // Aggregate CO totals by commitment ID
    const coTotalsById = new Map<string, CoTotals>();
    for (const co of (changeOrderRows.data || []) as CoAggRow[]) {
      if (!co.contract_id) continue;
      const existing = coTotalsById.get(co.contract_id) ?? {
        approved: 0,
        pending: 0,
        draft: 0,
        count: 0,
      };
      const amount = Number(co.amount) || 0;
      const status = (co.status || "draft").toLowerCase();
      existing.count += 1;
      if (status === "approved" || status === "executed") {
        existing.approved += amount;
      } else if (status === "pending") {
        existing.pending += amount;
      } else if (status === "draft") {
        existing.draft += amount;
      }
      coTotalsById.set(co.contract_id, existing);
    }

    const emptyCoTotals: CoTotals = {
      approved: 0,
      pending: 0,
      draft: 0,
      count: 0,
    };
    const purchaseOrderScopeById = new Map<string, PurchaseOrderScopeRow>();
    for (const row of (purchaseOrderScopeRows.data || []) as PurchaseOrderScopeRow[]) {
      if (row.id) purchaseOrderScopeById.set(row.id, row);
    }

    const scopeSources: CommitmentScopeSource[] = [
      ...((subcontractRows.data || []) as WithTotalsRow[])
        .filter((row): row is WithTotalsRow & { id: string } => Boolean(row.id))
        .map((row) => ({
          id: row.id,
          projectId: row.project_id,
          commitmentType: "subcontract" as const,
          contractCompanyId: row.contract_company_id,
          companyName: row.company_name,
          contractNumber: row.contract_number,
          title: row.title,
          description: row.description,
          inclusions: row.inclusions ?? null,
          exclusions: row.exclusions ?? null,
        })),
      ...((purchaseOrderRows.data || []) as WithTotalsRow[])
        .filter((row): row is WithTotalsRow & { id: string } => Boolean(row.id))
        .map((row) => {
          const scopeRow = purchaseOrderScopeById.get(row.id);
          return {
            id: row.id,
            projectId: row.project_id,
            commitmentType: "purchase_order" as const,
            contractCompanyId: row.contract_company_id,
            companyName: row.company_name,
            contractNumber: row.contract_number,
            title: row.title,
            description: row.description,
            inclusions: scopeRow?.inclusions ?? null,
            exclusions: scopeRow?.exclusions ?? null,
          };
        }),
    ];
    const scopeRecordsById = buildCommitmentScopeRecords(
      scopeSources,
      sovSummaryRows,
      costCodeByBudgetCode,
    );

    const commitmentsById = new Map<string, Commitment>();
    for (const row of (subcontractRows.data || []) as WithTotalsRow[]) {
      if (!row.id) continue;
      // payments_issued: use total_billed_to_date as a proxy (no dedicated payments table yet)
      const paymentsIssued = Number(row.total_billed_to_date) || 0;
      commitmentsById.set(
        row.id,
        mapRowToCommitment(
          row,
          "subcontract",
          coTotalsById.get(row.id) ?? emptyCoTotals,
          paymentsIssued,
          null,
          null,
          creatorNameByAuthUserId.get(
            createdByAuthUserIdByCommitmentId.get(row.id) ?? "",
          ) ?? null,
          scopeRecordsById.get(row.id),
        ),
      );
    }
    for (const row of (purchaseOrderRows.data || []) as WithTotalsRow[]) {
      if (!row.id) continue;
      const paymentsIssued = Number(row.total_billed_to_date) || 0;
      commitmentsById.set(
        row.id,
        mapRowToCommitment(
          row,
          "purchase_order",
          coTotalsById.get(row.id) ?? emptyCoTotals,
          paymentsIssued,
          null,
          null,
          creatorNameByAuthUserId.get(
            createdByAuthUserIdByCommitmentId.get(row.id) ?? "",
          ) ?? null,
          scopeRecordsById.get(row.id),
        ),
      );
    }

    const paginatedData = orderedBaseRows
      .map((row) => (row.id ? commitmentsById.get(row.id) : undefined))
      .filter((item): item is Commitment => Boolean(item));
    const total = totalCount || 0;

    const response: PaginatedResponse<Commitment> = {
      data: paginatedData,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    // Add cache headers - list data can be cached briefly (10 seconds)
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
    },
);

/**
 * POST /api/commitments
 *
 * @deprecated This endpoint is deprecated and returns HTTP 410 Gone.
 * Use the following endpoints instead:
 * - POST /api/projects/[projectId]/subcontracts - Create a subcontract
 * - POST /api/projects/[projectId]/purchase-orders - Create a purchase order
 *
 * @route POST /api/commitments
 * @returns {object} 410 - Gone (endpoint deprecated)
 */
export const POST = withApiGuardrails(
  "commitments#POST",
  async () => {
  return NextResponse.json(
    {
      error: "Deprecated endpoint",
      message:
        "Use /api/projects/[id]/subcontracts for subcontracts or /api/projects/[id]/purchase-orders for purchase orders",
    },
    { status: 410 },
  );
  },
);
