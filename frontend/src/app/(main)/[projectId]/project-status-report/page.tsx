export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/layout";
import { PsrClient } from "./psr-client";
import {
  BudgetFetchError,
  computeBudgetGrandTotals,
} from "@/lib/budget/compute-grand-totals";
import type { BudgetLineItem } from "@/types/budget";
import type {
  PsrApiResponse,
  PsrBudgetLine,
  PsrBudgetGrandTotals,
} from "@/types/psr.types";
import { notFound } from "next/navigation";
import { requireDeveloper } from "@/lib/auth/require-developer";

// ---------------------------------------------------------------------------
// Helpers (duplicated from API route to avoid cross-layer import)
// ---------------------------------------------------------------------------

function getMonthStart(month: string, offsetMonths: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + offsetMonths, 1);
  return d.toISOString().slice(0, 10);
}

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
    commitmentChangeOrders: 0,
    committedCosts: item.committedCosts,
    projectedCosts: item.projectedCosts,
    committedInvoicedAmount: item.jobToDateCostDetail,
    pendingCostChanges: item.pendingCostChanges,
    forecastToComplete: item.forecastToComplete,
    estimatedCostAtCompletion: item.estimatedCostAtCompletion,
    projectOverUnder: item.projectedOverUnder,
  };
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Server-side PSR data fetch
// ---------------------------------------------------------------------------

async function fetchPsrServerSide(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIdNum: number,
  month: string,
): Promise<PsrApiResponse | null> {
  const billingStart = getMonthStart(month, -5);

  let budgetResult: Awaited<ReturnType<typeof computeBudgetGrandTotals>>;
  try {
    budgetResult = await computeBudgetGrandTotals(supabase, projectIdNum);
  } catch (error) {
    if (error instanceof BudgetFetchError) return null;
    throw error;
  }

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
    supabase
      .from("projects")
      .select(
        `id, name, project_number, "start date", "est completion", budget,
         prime_contracts(id, contract_number, original_contract_value, revised_contract_value, start_date, end_date)`,
      )
      .eq("id", projectIdNum)
      .single(),

    supabase
      .from("submittals")
      .select("id, submittal_number, title, status, ball_in_court")
      .eq("project_id", projectIdNum)
      .is("deleted_at", null)
      .order("submittal_number", { ascending: true }),

    supabase
      .from("rfis")
      .select("id, number, subject, status, due_date, ball_in_court")
      .eq("project_id", projectIdNum)
      .order("number", { ascending: true }),

    supabase
      .from("change_events")
      .select(
        "id, number, title, status, scope, type, sent_to_prime_pco, sent_to_commitment_pco",
      )
      .eq("project_id", projectIdNum)
      .is("deleted_at", null)
      .order("number", { ascending: true }),

    supabase
      .from("change_orders")
      .select("id, number, title, description, status, amount, type, prime_contract_id")
      .eq("project_id", projectIdNum)
      .order("number", { ascending: true }),

    supabase
      .from("schedule_tasks")
      .select(
        "id, name, status, percent_complete, start_date, finish_date, duration_days, is_milestone, wbs_code, parent_task_id",
      )
      .eq("project_id", projectIdNum)
      .order("sort_order", { ascending: true })
      .limit(200),

    supabase
      .from("subcontractor_invoices")
      .select("id, billing_date, status")
      .eq("project_id", projectIdNum)
      .gte("billing_date", billingStart)
      .order("billing_date", { ascending: true }),

    supabase
      .from("psr_comments")
      .select("section, body, updated_at")
      .eq("project_id", projectIdNum)
      .eq("month", month),
  ]);

  const project = projectResult.data;
  if (!project) return null;

  const primeContracts = Array.isArray(project.prime_contracts)
    ? project.prime_contracts
    : project.prime_contracts
      ? [project.prime_contracts]
      : [];
  const primeContractIds = primeContracts.map((pc) => pc.id);

  let ownerInvoicesData: Array<{
    billing_date: string | null;
    gross_amount: number | null;
    paid_amount: number | null;
  }> = [];

  if (primeContractIds.length > 0) {
    const { data: ownerInvoices } = await supabase
      .from("owner_invoices")
      .select("id, billing_date, gross_amount, paid_amount")
      .in("prime_contract_id", primeContractIds)
      .gte("billing_date", billingStart)
      .order("billing_date", { ascending: true });
    ownerInvoicesData = ownerInvoices ?? [];
  }

  const { lineItems, grandTotals } = budgetResult;
  const primeContract = primeContracts[0] ?? null;

  // Extract special budget lines
  const sumOriginal = (lines: BudgetLineItem[]) =>
    lines.reduce((sum, l) => sum + l.originalBudgetAmount, 0);
  const sumRevised = (lines: BudgetLineItem[]) =>
    lines.reduce((sum, l) => sum + l.revisedBudget, 0);

  const hasBudgetPrefix = (line: BudgetLineItem, prefix: string) =>
    (line.costCode ?? "").replace(/\D/g, "").startsWith(prefix);

  const feeLines = lineItems.filter((l) => hasBudgetPrefix(l, "550500"));
  const insuranceLines = lineItems.filter((l) => hasBudgetPrefix(l, "550050"));
  const unallocatedLines = lineItems.filter((l) => hasBudgetPrefix(l, "550099"));
  const contingencyLines = lineItems.filter((l) => hasBudgetPrefix(l, "550100"));

  const contractBudget =
    grandTotals.originalBudgetAmount ||
    primeContract?.original_contract_value ||
    0;
  const currentBudget =
    grandTotals.revisedBudget ||
    primeContract?.revised_contract_value ||
    0;
  const eca = grandTotals.estimatedCostAtCompletion;

  // Monthly billing
  const months: PsrApiResponse["monthlyBilling"] = [];
  for (let i = -5; i <= 0; i++) {
    const [year, m] = month.split("-").map(Number);
    const d = new Date(year, m - 1 + i, 1);
    const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ml = d.toLocaleString("en-US", { month: "long" });
    const own = ownerInvoicesData.filter((inv) => inv.billing_date?.slice(0, 7) === ms);
    const sub = (subInvoicesResult.data ?? []).filter((inv) => inv.billing_date?.slice(0, 7) === ms);
    months.push({
      month: ms,
      monthLabel: ml,
      ownerPayments: own.reduce((s, inv) => s + (inv.paid_amount ?? 0), 0),
      ownerBilling: own.reduce((s, inv) => s + (inv.gross_amount ?? 0), 0),
      subBilling: sub.length,
    });
  }

  // Open items
  const rfisArr = rfisResult.data ?? [];
  const submittalsArr = submittalsResult.data ?? [];
  const ceArr = changeEventsResult.data ?? [];
  const coArr = changeOrdersResult.data ?? [];

  const budgetGrandTotals: PsrBudgetGrandTotals = {
    originalBudget: grandTotals.originalBudgetAmount,
    revisedBudget: grandTotals.revisedBudget,
    actualAmount: grandTotals.jobToDateCostDetail,
    committedCosts: grandTotals.committedCosts,
    forecastToComplete: grandTotals.forecastToComplete,
    estimatedCostAtCompletion: grandTotals.estimatedCostAtCompletion,
    projectOverUnder: grandTotals.projectedOverUnder,
  };

  return {
    month,
    projectInfo: {
      name: project.name ?? "Unknown Project",
      projectNumber: project.project_number ?? null,
      startDate: (project as Record<string, unknown>)["start date"] as string | null ?? null,
      completionDate: primeContract?.end_date ?? (project as Record<string, unknown>)["est completion"] as string | null ?? null,
      contractBudget,
      currentBudget,
      currentProjectedProfit: currentBudget - eca,
      originalFee: sumOriginal(feeLines),
      currentFee: sumRevised(feeLines),
      originalInsurance: sumOriginal(insuranceLines),
      currentInsurance: sumRevised(insuranceLines),
      currentUnallocatedCosts: sumRevised(unallocatedLines),
      currentOwnerContingency: sumRevised(contingencyLines),
      remainingBuyout: grandTotals.revisedBudget - grandTotals.committedCosts,
      jobToDateCost: grandTotals.jobToDateCostDetail,
    },
    monthlyBilling: months,
    openItems: {
      openRfis: rfisArr.filter((r) => r.status !== "Closed").length,
      openSubmittals: submittalsArr.filter(
        (s) => s.status !== null && !["Closed", "Distributed"].includes(s.status),
      ).length,
      openCEsNotInPCO: ceArr.filter(
        (ce) => ce.sent_to_prime_pco !== true && ce.status !== "Void",
      ).length,
      openPCCOs: coArr.filter(
        (co) =>
          co.type?.toLowerCase().includes("prime") && co.status === "Pending",
      ).length,
      subCOsNotFunded: coArr.filter(
        (co) =>
          (co.type?.toLowerCase().includes("commitment") ||
            co.type?.toLowerCase().includes("subcontract") ||
            co.type?.toLowerCase().includes("purchase")) &&
          co.status === "Pending",
      ).length,
      openPCOs: ceArr.filter(
        (ce) =>
          ce.sent_to_prime_pco !== true &&
          !["Void", "Resolved"].includes(ce.status),
      ).length,
    },
    budgetLines: lineItems.map(mapBudgetLineItem),
    budgetGrandTotals,
    submittals: submittalsArr.map((s) => ({
      submittalNumber: s.submittal_number,
      title: s.title,
      status: s.status ?? "Unknown",
      ballInCourt: s.ball_in_court,
    })),
    rfis: rfisArr.map((r) => ({
      number: r.number,
      subject: r.subject,
      status: r.status,
      dueDate: r.due_date,
      ballInCourt: r.ball_in_court,
    })),
    changeRequests: ceArr
      .filter((ce) => !["Void", "Resolved"].includes(ce.status))
      .map((ce) => ({
        number: ce.number,
        contractNumber: null,
        title: ce.title,
        scope: ce.scope,
        status: ce.status,
        cost: 0,
        markup: 0,
        total: 0,
      })),
    changeOrders: coArr.map((co) => ({
      number: co.number,
      contractNumber: null,
      description: co.description ?? co.title,
      status: co.status ?? "Unknown",
      amount: co.amount ?? 0,
    })),
    scheduleTasks: (scheduleResult.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      duration: t.duration_days,
      startDate: t.start_date,
      finishDate: t.finish_date,
      status: t.status,
      percentComplete: t.percent_complete,
      isMilestone: t.is_milestone,
      wbsCode: t.wbs_code,
    })),
    comments: (commentsResult.data ?? []).map((c) => ({
      section: c.section,
      body: c.body,
      updatedAt: c.updated_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProjectStatusReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  await requireDeveloper();

  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const month =
    resolvedSearchParams.month ?? new Date().toISOString().slice(0, 7);

  const projectIdNum = parseInt(projectId, 10);
  if (Number.isNaN(projectIdNum)) notFound();

  const supabase = await createClient();
  const psrData = await fetchPsrServerSide(supabase, projectIdNum, month);

  if (!psrData) notFound();

  return (
    <PageShell
      variant="content"
      title="Project Status Report"
      description={`Month ending: ${formatMonthLabel(month)}`}
    >
      <PsrClient
        projectId={projectId}
        initialData={psrData}
        initialMonth={month}
      />
    </PageShell>
  );
}
