import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

/**
 * Direct Costs API Endpoint
 *
 * Returns direct cost data for a project or specific budget line.
 * Implements Procore cost calculation rules:
 * - Job to Date Cost Detail = ALL approved types (Invoice, Expense, Payroll, Subcontractor Invoice)
 * - Direct Costs = Approved types EXCLUDING Subcontractor Invoice
 */

// Cost types that count towards Job to Date (all approved)
const JTD_COST_TYPES = [
  "Invoice",
  "Expense",
  "Payroll",
  "Subcontractor Invoice",
];

// Cost types that count towards Direct Costs (excludes Subcontractor Invoice)
const DIRECT_COST_TYPES = ["Invoice", "Expense", "Payroll"];
const APPROVED_DIRECT_COST_STATUSES = ["Approved"];

interface DirectCostParent {
  cost_type: string | null;
  status: string | null;
  vendor_id: string | null;
  invoice_number: string | null;
  date: string | null;
  companies: { name: string }[] | { name: string } | null;
}

interface DirectCostWithRelations {
  id: string;
  direct_cost_id: string;
  budget_code_id: string | null;
  line_total: number | null;
  quantity: number | null;
  unit_cost: number | null;
  description: string | null;
  // Supabase returns object for belongs-to or array for has-many depending on join type
  direct_costs: DirectCostParent | DirectCostParent[] | null;
}

/** Normalize direct_costs from Supabase (could be object or array) */
function getDirectCost(raw: DirectCostWithRelations["direct_costs"]): DirectCostParent | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

/** Normalize companies (could be object or array) */
function getVendorName(companies: DirectCostParent["companies"]): string | null {
  if (!companies) return null;
  if (Array.isArray(companies)) return companies[0]?.name ?? null;
  return (companies as { name: string }).name ?? null;
}

interface CostBreakdown {
  Invoice: number;
  Expense: number;
  Payroll: number;
  "Subcontractor Invoice": number;
}

// GET /api/projects/[id]/budget/direct-costs
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/direct-costs#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const { searchParams } = new URL(request.url);
    const budgetLineId = searchParams.get("budgetLineId");
    const costCodeParam = searchParams.get("costCode"); // e.g., "21" for division or "21-1313" for specific
    const statusFilter = searchParams.get("status"); // 'approved', 'pending', 'all'

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget/direct-costs#GET", message: "Authentication required." });
    }

    // Resolve cost_code_ids to filter by.
    // Priority: costCode param (supports division prefix like "21") > budgetLineId lookup
    let costCodeIds: string[] | null = null;

    if (costCodeParam) {
      // costCode can be a division prefix (e.g., "21") or a full code (e.g., "21-1313")
      // Find all cost_codes matching this prefix
      const { data: matchingCodes } = await supabase
        .from("cost_codes")
        .select("id")
        .like("id", `${costCodeParam}%`);
      costCodeIds = (matchingCodes || []).map((r) => r.id);
    } else if (budgetLineId && !budgetLineId.startsWith("division-")) {
      // Real budget line ID — look up the cost_code_id
      const { data: budgetLine, error: lineError } = await supabase
        .from("budget_lines")
        .select("cost_code_id")
        .eq("id", budgetLineId)
        .single();

      if (lineError || !budgetLine) {
        return NextResponse.json(
          { error: "Budget line not found" },
          { status: 404 },
        );
      }
      costCodeIds = budgetLine.cost_code_id ? [budgetLine.cost_code_id] : null;
    }

    // Translate cost_code_ids to project_budget_code IDs
    // because direct_cost_line_items.budget_code_id references project_budget_codes.id (not cost_codes.id)
    let projectCostCodeIds: string[] | null = null;
    if (costCodeIds && costCodeIds.length > 0) {
      const { data: pccRows } = await supabase
        .from("project_budget_codes")
        .select("id")
        .eq("project_id", projectIdNum)
        .in("cost_code_id", costCodeIds);
      projectCostCodeIds = (pccRows || []).map((r) => r.id);
      if (projectCostCodeIds.length === 0) {
        return NextResponse.json({
          costs: [],
          totals: { jobToDateCostDetail: 0, directCosts: 0, pendingCosts: 0, count: 0 },
          breakdown: { Invoice: 0, Expense: 0, Payroll: 0, "Subcontractor Invoice": 0 },
          meta: { costCodeIds, projectId, statusFilter: statusFilter || "all" },
        });
      }
    }

    // Build query for direct_cost_line_items
    let query = supabase
      .from("direct_cost_line_items")
      .select(
        `
        id,
        direct_cost_id,
        budget_code_id,
        line_total,
        quantity,
        unit_cost,
        description,
        direct_costs!inner(
          cost_type,
          status,
          project_id,
          vendor_id,
          invoice_number,
          date,
          companies (
            name
          )
        )
      `,
      )
      .eq("direct_costs.project_id", projectIdNum);

    // Filter by project_cost_code IDs (translated from cost_code_id)
    if (projectCostCodeIds) {
      query = query.in("budget_code_id", projectCostCodeIds);
    }

    const { data: costs, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch direct costs" },
        { status: 500 },
      );
    }

    // Calculate aggregates using Procore cost rules
    let jobToDateCostDetail = 0;
    let directCosts = 0;
    let pendingCosts = 0;

    const breakdown: CostBreakdown = {
      Invoice: 0,
      Expense: 0,
      Payroll: 0,
      "Subcontractor Invoice": 0,
    };

    const isApprovedStatus = (status: string | null) =>
      status ? APPROVED_DIRECT_COST_STATUSES.includes(status) : false;

    const filteredCosts = (costs || []).filter((cost: DirectCostWithRelations) => {
      const directCost = getDirectCost(cost.direct_costs);
      const status = directCost?.status || null;
      if (statusFilter === "approved") {
        return isApprovedStatus(status);
      }
      if (statusFilter === "pending") {
        return !isApprovedStatus(status);
      }
      return true;
    });

    for (const cost of filteredCosts as DirectCostWithRelations[]) {
      const directCost = getDirectCost(cost.direct_costs);
      const costType = directCost?.cost_type || "Invoice";
      const amount =
        cost.line_total ?? (cost.quantity ?? 0) * (cost.unit_cost ?? 0);
      const isApproved = isApprovedStatus(directCost?.status || null);

      if (isApproved) {
        // Job to Date Cost Detail = ALL approved types (includes Subcontractor Invoice)
        if (JTD_COST_TYPES.includes(costType)) {
          jobToDateCostDetail += amount;

          // Track breakdown by type
          if (costType in breakdown) {
            breakdown[costType as keyof CostBreakdown] += amount;
          }
        }

        // Direct Costs = EXCLUDE Subcontractor Invoice
        if (DIRECT_COST_TYPES.includes(costType)) {
          directCosts += amount;
        }
      } else {
        // Pending (not yet approved)
        pendingCosts += amount;
      }
    }

    // Transform costs for frontend
    const transformedCosts = (filteredCosts || []).map(
      (cost: DirectCostWithRelations) => {
        const directCost = getDirectCost(cost.direct_costs);
        const amount =
          cost.line_total ?? (cost.quantity ?? 0) * (cost.unit_cost ?? 0);
        const status = isApprovedStatus(directCost?.status || null)
          ? "approved"
          : "pending";
        const vendor = directCost ? getVendorName(directCost.companies) : null;

        return {
          id: cost.id,
          description: cost.description || "",
          amount,
          costType: directCost?.cost_type || null,
          vendor,
          invoiceNumber: directCost?.invoice_number || null,
          transactionDate: directCost?.date || null,
          approved: status === "approved",
          approvedAt: null,
          approvedBy: null,
          costCodeId: cost.budget_code_id,
          status,
          payments: 0,
          incurredDate: directCost?.date || null,
          detailHref: `/${projectIdNum}/direct-costs/${cost.direct_cost_id}`,
        };
      },
    );

    return NextResponse.json({
      costs: transformedCosts,
      totals: {
        jobToDateCostDetail,
        directCosts,
        pendingCosts,
        count: transformedCosts.length,
      },
      breakdown,
      meta: {
        costCodeIds,
        projectId,
        statusFilter: statusFilter || "all",
      },
    });
    },
);
