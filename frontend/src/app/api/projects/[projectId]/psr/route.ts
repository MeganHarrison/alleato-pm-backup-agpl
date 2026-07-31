import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import {
  BudgetFetchError,
  computeBudgetGrandTotals,
} from "@/lib/budget/compute-grand-totals";
import { apiErrorResponse } from "@/lib/api-error";
import type { BudgetLineItem } from "@/types/budget";
import type {
  PsrApiResponse,
  PsrBudgetLine,
  PsrBudgetGrandTotals,
  PsrMonthlyBilling,
  PsrOpenItemCounts,
  PsrProjectInfo,
} from "@/types/psr.types";

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/psr?month=YYYY-MM
// Aggregates all 7 PSR sections from existing data sources.
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/psr#GET",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Default to current month if not specified
    const url = new URL(request.url);
    const month =
      url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM." },
        { status: 400 },
      );
    }

    const developerGuard = await requireDeveloperApi();
    if (developerGuard) return developerGuard;

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Compute budget grand totals (authoritative — do not re-query budget tables)
    let budgetResult: Awaited<ReturnType<typeof computeBudgetGrandTotals>>;
    try {
      budgetResult = await computeBudgetGrandTotals(supabase, projectIdNum);
    } catch (error) {
      if (error instanceof BudgetFetchError) {
        return apiErrorResponse(error.cause);
      }
      throw error;
    }

    const billingStart = getMonthStart(month, -5);

    // All remaining queries run in parallel
    const [
      projectResult,
      submittalsResult,
      rfisResult,
      changeEventsResult,
      changeOrdersResult,
      scheduleResult,
      subInvoicesResult,
      commentsResult,
    ] = await Promise.all([
      // 1. Project info + prime contract
      supabase
        .from("projects")
        .select(
          `id, name, project_number, "start date", "est completion", budget,
           prime_contracts(id, contract_number, original_contract_value, revised_contract_value, start_date, end_date)`,
        )
        .eq("id", projectIdNum)
        .single(),

      // 2. Submittals (exclude deleted)
      supabase
        .from("submittals")
        .select("id, submittal_number, title, status, ball_in_court")
        .eq("project_id", projectIdNum)
        .is("deleted_at", null)
        .order("submittal_number", { ascending: true }),

      // 3. RFIs
      supabase
        .from("rfis")
        .select("id, number, subject, status, due_date, ball_in_court")
        .eq("project_id", projectIdNum)
        .order("number", { ascending: true }),

      // 4. Change events (exclude deleted)
      supabase
        .from("change_events")
        .select(
          "id, number, title, status, scope, type, sent_to_prime_pco, sent_to_commitment_pco",
        )
        .eq("project_id", projectIdNum)
        .is("deleted_at", null)
        .order("number", { ascending: true }),

      // 5. Change orders (PCCOs and commitment COs)
      supabase
        .from("change_orders")
        .select(
          "id, number, title, description, status, amount, type, prime_contract_id",
        )
        .eq("project_id", projectIdNum)
        .order("number", { ascending: true }),

      // 6. Schedule tasks
      supabase
        .from("schedule_tasks")
        .select(
          "id, name, status, percent_complete, start_date, finish_date, duration_days, is_milestone, wbs_code, parent_task_id",
        )
        .eq("project_id", projectIdNum)
        .order("sort_order", { ascending: true })
        .limit(200),

      // 7. Subcontractor invoices (last 6 months — has direct project_id)
      supabase
        .from("subcontractor_invoices")
        .select("id, billing_date, status")
        .eq("project_id", projectIdNum)
        .gte("billing_date", billingStart)
        .order("billing_date", { ascending: true }),

      // 8. PSR comments for this month
      supabase
        .from("psr_comments")
        .select("section, body, updated_at")
        .eq("project_id", projectIdNum)
        .eq("month", month),
    ]);

    // Get prime contract IDs to fetch owner invoices
    const project = projectResult.data;
    const primeContracts = Array.isArray(project?.prime_contracts)
      ? project.prime_contracts
      : project?.prime_contracts
        ? [project.prime_contracts]
        : [];
    const primeContractIds = primeContracts.map((pc) => pc.id);

    // Fetch owner invoices (no direct project_id — must filter by prime_contract_id).
    // We do NOT filter by billing_date here because many invoices store their period
    // in `period_end` rather than `billing_date`, and PostgreSQL silently drops rows
    // where billing_date IS NULL when a .gte() filter is applied.
    let ownerInvoicesData: Array<{
      id: number;
      billing_date: string | null;
      period_end: string | null;
      gross_amount: number | null;
      paid_amount: number | null;
    }> = [];

    if (primeContractIds.length > 0) {
      const { data: ownerInvoices } = await supabase
        .from("owner_invoices")
        .select("id, billing_date, period_end, gross_amount, paid_amount")
        .in("prime_contract_id", primeContractIds)
        .order("billing_date", { ascending: true });
      ownerInvoicesData = ownerInvoices ?? [];
    }

    // ---------------------------------------------------------------------------
    // Shape the response
    // ---------------------------------------------------------------------------

    const { lineItems, grandTotals } = budgetResult;

    // Project info
    const primeContract = primeContracts[0] ?? null;
    const projectInfo = buildProjectInfo(
      project,
      primeContract,
      lineItems,
      grandTotals,
    );

    // Monthly billing (last 6 months)
    const monthlyBilling = buildMonthlyBilling(
      month,
      ownerInvoicesData,
      subInvoicesResult.data ?? [],
    );

    // Open item counts — computed from already-fetched arrays (no extra DB calls)
    const openItems = buildOpenItemCounts(
      rfisResult.data ?? [],
      submittalsResult.data ?? [],
      changeEventsResult.data ?? [],
      changeOrdersResult.data ?? [],
    );

    // Budget lines — map BudgetLineItem → PsrBudgetLine
    const budgetLines = lineItems.map(mapBudgetLineItem);

    const budgetGrandTotals: PsrBudgetGrandTotals = {
      originalBudget: grandTotals.originalBudgetAmount,
      revisedBudget: grandTotals.revisedBudget,
      actualAmount: grandTotals.jobToDateCostDetail,
      committedCosts: grandTotals.committedCosts,
      forecastToComplete: grandTotals.forecastToComplete,
      estimatedCostAtCompletion: grandTotals.estimatedCostAtCompletion,
      projectOverUnder: grandTotals.projectedOverUnder,
    };

    // Submittals
    const submittals = (submittalsResult.data ?? []).map((s) => ({
      submittalNumber: s.submittal_number,
      title: s.title,
      status: s.status ?? "Unknown",
      ballInCourt: s.ball_in_court,
    }));

    // RFIs
    const rfis = (rfisResult.data ?? []).map((r) => ({
      number: r.number,
      subject: r.subject,
      status: r.status,
      dueDate: r.due_date,
      ballInCourt: r.ball_in_court,
    }));

    // Change requests (change events that are open or draft)
    const changeRequests = (changeEventsResult.data ?? [])
      .filter((ce) => !["Void", "Resolved"].includes(ce.status))
      .map((ce) => ({
        number: ce.number,
        contractNumber: null,
        title: ce.title,
        scope: ce.scope,
        status: ce.status,
        cost: 0, // Markup calculations require vertical_markup join — simplified
        markup: 0,
        total: 0,
      }));

    // Change orders (PCCOs)
    const changeOrders = (changeOrdersResult.data ?? []).map((co) => ({
      number: co.number,
      contractNumber: null,
      description: co.description ?? co.title,
      status: co.status ?? "Unknown",
      amount: co.amount ?? 0,
    }));

    // Schedule tasks
    const scheduleTasks = (scheduleResult.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      duration: t.duration_days,
      startDate: t.start_date,
      finishDate: t.finish_date,
      status: t.status,
      percentComplete: t.percent_complete,
      isMilestone: t.is_milestone,
      wbsCode: t.wbs_code,
    }));

    // Comments
    const comments = (commentsResult.data ?? []).map((c) => ({
      section: c.section,
      body: c.body,
      updatedAt: c.updated_at,
    }));

    const psrData: PsrApiResponse = {
      month,
      projectInfo,
      monthlyBilling,
      openItems,
      budgetLines,
      budgetGrandTotals,
      submittals,
      rfis,
      changeRequests,
      changeOrders,
      scheduleTasks,
      comments,
    };

    return NextResponse.json(psrData);
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns YYYY-MM-DD for the first day of (baseMonth + offsetMonths). */
function getMonthStart(month: string, offsetMonths: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + offsetMonths, 1);
  return d.toISOString().slice(0, 10);
}

/** Formats a YYYY-MM string into a month label like "April 2026". */
function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Maps a BudgetLineItem (from computeBudgetGrandTotals) to a PsrBudgetLine. */
function mapBudgetLineItem(item: BudgetLineItem): PsrBudgetLine {
  const parts = [item.costCode, item.costCodeDescription, item.costType].filter(
    Boolean,
  );
  const budgetCode = parts.join(" - ") || item.description || item.costCode;

  return {
    budgetCode,
    originalBudget: item.originalBudgetAmount,
    budgetModifications: item.budgetModifications,
    contractChangeOrders: item.approvedCOs,
    revisedBudget: item.revisedBudget,
    actualAmount: item.jobToDateCostDetail,
    pendingBudgetChanges: item.pendingChanges,
    projectedBudget: item.projectedBudget,
    directCosts: item.directCosts,
    commitments: item.committedCosts,
    commitmentChangeOrders: 0, // Not separately tracked at line-item level
    committedCosts: item.committedCosts,
    projectedCosts: item.projectedCosts,
    committedInvoicedAmount: item.jobToDateCostDetail,
    pendingCostChanges: item.pendingCostChanges,
    forecastToComplete: item.forecastToComplete,
    estimatedCostAtCompletion: item.estimatedCostAtCompletion,
    projectOverUnder: item.projectedOverUnder,
  };
}

/** Builds PsrProjectInfo from project + prime contract + budget data. */
function buildProjectInfo(
  project: {
    id: number;
    name: string | null;
    project_number?: string | null;
    "start date"?: string | null;
    "est completion"?: string | null;
    budget?: number | null;
  } | null,
  primeContract: {
    original_contract_value: number;
    revised_contract_value: number;
    end_date?: string | null;
  } | null,
  lineItems: BudgetLineItem[],
  grandTotals: {
    originalBudgetAmount: number;
    revisedBudget: number;
    committedCosts: number;
    estimatedCostAtCompletion: number;
    jobToDateCostDetail: number;
  },
): PsrProjectInfo {
  const hasBudgetPrefix = (line: BudgetLineItem, prefix: string) =>
    (line.costCode ?? "").replace(/\D/g, "").startsWith(prefix);

  // Extract special budget lines by canonical numeric prefix so formatted codes
  // like `55-0500` and `55-0050` still map into the PSR summary buckets.
  const feeLines = lineItems.filter((l) => hasBudgetPrefix(l, "550500"));
  const insuranceLines = lineItems.filter((l) => hasBudgetPrefix(l, "550050"));
  const unallocatedLines = lineItems.filter((l) => hasBudgetPrefix(l, "550099"));
  const contingencyLines = lineItems.filter((l) => hasBudgetPrefix(l, "550100"));

  const sumOriginal = (lines: BudgetLineItem[]) =>
    lines.reduce((sum, l) => sum + l.originalBudgetAmount, 0);
  const sumRevised = (lines: BudgetLineItem[]) =>
    lines.reduce((sum, l) => sum + l.revisedBudget, 0);

  // Budget detail rows in the PSR already use budget-tool totals, so the summary
  // must use the same source of truth to avoid conflicting numbers on one page.
  const contractBudget =
    grandTotals.originalBudgetAmount ||
    primeContract?.original_contract_value ||
    0;
  const currentBudget =
    grandTotals.revisedBudget ||
    primeContract?.revised_contract_value ||
    0;
  const eca = grandTotals.estimatedCostAtCompletion;
  const currentProjectedProfit = currentBudget - eca;
  const remainingBuyout =
    grandTotals.revisedBudget - grandTotals.committedCosts;

  return {
    name: project?.name ?? "Unknown Project",
    projectNumber: project?.project_number ?? null,
    startDate: project?.["start date"] ?? null,
    completionDate: primeContract?.end_date ?? project?.["est completion"] ?? null,
    contractBudget,
    currentBudget,
    currentProjectedProfit,
    originalFee: sumOriginal(feeLines),
    currentFee: sumRevised(feeLines),
    originalInsurance: sumOriginal(insuranceLines),
    currentInsurance: sumRevised(insuranceLines),
    currentUnallocatedCosts: sumRevised(unallocatedLines),
    currentOwnerContingency: sumRevised(contingencyLines),
    remainingBuyout,
    jobToDateCost: grandTotals.jobToDateCostDetail,
  };
}

/** Groups invoices by month and sums billing amounts for the past 6 months. */
function buildMonthlyBilling(
  currentMonth: string,
  ownerInvoices: Array<{
    billing_date: string | null;
    period_end: string | null;
    gross_amount: number | null;
    paid_amount: number | null;
  }>,
  subInvoices: Array<{ billing_date: string | null }>,
): PsrMonthlyBilling[] {
  const months: PsrMonthlyBilling[] = [];
  for (let i = -5; i <= 0; i++) {
    const [year, m] = currentMonth.split("-").map(Number);
    const d = new Date(year, m - 1 + i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleString("en-US", { month: "long" });

    const ownerForMonth = ownerInvoices.filter((inv) => {
      // Use billing_date if set; fall back to period_end (common for pay-app–linked invoices)
      const effectiveDate = inv.billing_date ?? inv.period_end;
      return effectiveDate?.slice(0, 7) === monthStr;
    });
    const subForMonth = subInvoices.filter(
      (inv) => inv.billing_date?.slice(0, 7) === monthStr,
    );

    months.push({
      month: monthStr,
      monthLabel,
      ownerPayments: ownerForMonth.reduce(
        (sum, inv) => sum + (inv.paid_amount ?? 0),
        0,
      ),
      ownerBilling: ownerForMonth.reduce(
        (sum, inv) => sum + (inv.gross_amount ?? 0),
        0,
      ),
      subBilling: subForMonth.length, // count of invoices (no amount field on subcontractor_invoices)
    });
  }
  return months;
}

/** Computes open item counts from already-fetched data arrays. */
function buildOpenItemCounts(
  rfis: Array<{ status: string }>,
  submittals: Array<{ status: string | null }>,
  changeEvents: Array<{
    status: string;
    sent_to_prime_pco: boolean | null;
  }>,
  changeOrders: Array<{ type: string | null; status: string | null }>,
): PsrOpenItemCounts {
  const openRfis = rfis.filter((r) => r.status !== "Closed").length;

  const openSubmittals = submittals.filter(
    (s) => s.status !== null && !["Closed", "Distributed"].includes(s.status),
  ).length;

  const openCEsNotInPCO = changeEvents.filter(
    (ce) => ce.sent_to_prime_pco !== true && ce.status !== "Void",
  ).length;

  // PCCOs = prime change orders pending approval
  const openPCCOs = changeOrders.filter(
    (co) =>
      co.type != null &&
      co.type.toLowerCase().includes("prime") &&
      co.status === "Pending",
  ).length;

  // Sub COs not funded = commitment change orders still pending
  const subCOsNotFunded = changeOrders.filter(
    (co) =>
      co.type != null &&
      (co.type.toLowerCase().includes("commitment") ||
        co.type.toLowerCase().includes("subcontract") ||
        co.type.toLowerCase().includes("purchase")) &&
      co.status === "Pending",
  ).length;

  // Open PCOs = change events not yet sent to a prime PCO
  const openPCOs = changeEvents.filter(
    (ce) => ce.sent_to_prime_pco !== true && !["Void", "Resolved"].includes(ce.status),
  ).length;

  return {
    openRfis,
    openSubmittals,
    openCEsNotInPCO,
    openPCCOs,
    subCOsNotFunded,
    openPCOs,
  };
}

// suppress unused-import lint warning on formatMonthLabel (used in future)
void formatMonthLabel;
