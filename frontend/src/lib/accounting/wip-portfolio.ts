import type { SupabaseClient } from "@supabase/supabase-js";
import { GuardrailError } from "@/lib/guardrails/errors";
import { toNumber, roundMoney, getMaxDate } from "@/lib/accounting/utils";
import {
  calculateWipPosition,
  isClosedInvoiceStatus,
} from "@/lib/accounting/wip-calculator";

/**
 * Shared work-in-progress (WIP) portfolio computation.
 *
 * Single source of truth used by both `/api/accounting/wip` (full report)
 * and `/api/accounting/dashboard` (summary tile + margin bars). Keeping the
 * math in one place prevents the dashboard and the WIP report from drifting.
 *
 * IMPORTANT data caveat: Acumatica is not currently syncing `cost_to_complete`
 * or `cost_at_completion` (every budget line is 0 for both). When that is the
 * case the estimated-final-cost falls back to costs-to-date, which makes
 * percent-complete = 100% and earned-revenue = full contract for every job.
 * In that state, forecast-to-complete figures are NOT real forecasts — they are
 * costs-to-date actuals. Callers must surface `forecastDataAvailable: false`
 * rather than present these as forward-looking projections.
 */

type BudgetLine = {
  project_code: string;
  record_type: string | null;
  original_budgeted_amount: number | null;
  revised_budgeted_amount: number | null;
  actual_amount: number | null;
  revised_committed_amount: number | null;
  committed_open_amount: number | null;
  cost_to_complete: number | null;
  cost_at_completion: number | null;
  variance_amount: number | null;
  acumatica_sync_at: string | null;
};

type ArInvoiceRow = {
  project: string | null;
  type: string | null;
  status: string | null;
  amount: number | null;
  acumatica_sync_at: string | null;
};

type ProjectMetaRow = {
  project_id: string | null;
  description: string | null;
  status: string | null;
  customer: string | null;
  income: number | null;
  last_modified_at: string | null;
  acumatica_sync_at: string | null;
};

export type WipRow = {
  projectCode: string;
  projectDescription: string | null;
  customer: string | null;
  projectStatus: string | null;
  contractValue: number;
  revisedCostBudget: number;
  costsToDate: number;
  committedCosts: number;
  openCommitments: number;
  costToComplete: number;
  estimatedFinalCost: number;
  costVariance: number;
  percentComplete: number;
  earnedRevenue: number;
  billedToDate: number;
  overUnderBilling: number;
  forecastGrossProfit: number;
  forecastGrossMarginPct: number;
  wipPosition: "overbilled" | "underbilled" | "balanced";
  budgetLineCount: number;
  latestSyncAt: string | null;
};

export type WipSummary = {
  projectCount: number;
  contractValue: number;
  revisedCostBudget: number;
  costsToDate: number;
  estimatedFinalCost: number;
  earnedRevenue: number;
  billedToDate: number;
  overUnderBilling: number;
  forecastGrossProfit: number;
};

export type WipPortfolio = {
  rows: WipRow[];
  summary: WipSummary;
  /**
   * True when Acumatica is supplying cost-to-complete / cost-at-completion data
   * for at least one budget line. When false, all forecast-to-complete figures
   * are costs-to-date actuals and must be labeled as such.
   */
  forecastDataAvailable: boolean;
};

function getInvoiceSignedAmount(invoice: ArInvoiceRow): number {
  const amount = toNumber(invoice.amount);
  if (invoice.type === "Credit Memo") return -amount;
  if (invoice.type === "Debit Memo") return amount;
  return amount;
}

function normalizeRecordType(
  type: string | null,
): "income" | "expense" | "other" {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized.includes("income")) return "income";
  if (normalized.includes("expense")) return "expense";
  return "other";
}

export async function buildWipPortfolio(
  supabase: SupabaseClient,
  where: string,
): Promise<WipPortfolio> {
  const [budgetResult, invoicesResult, projectsResult] = await Promise.all([
    supabase
      .from("acumatica_project_budgets")
      .select(
        "project_code, record_type, original_budgeted_amount, revised_budgeted_amount, actual_amount, revised_committed_amount, committed_open_amount, cost_to_complete, cost_at_completion, variance_amount, acumatica_sync_at",
      )
      .not("project_code", "is", null),
    supabase
      .from("acumatica_ar_invoices")
      .select("project, type, status, amount, acumatica_sync_at")
      .not("project", "is", null),
    supabase
      .from("acumatica_projects")
      .select(
        "project_id, description, status, customer, income, last_modified_at, acumatica_sync_at",
      ),
  ]);

  if (budgetResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to load Acumatica project budgets for WIP reporting.",
      details: { reason: budgetResult.error.message },
      cause: budgetResult.error,
    });
  }
  if (invoicesResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message:
        "Failed to load AR invoices required for WIP billing calculations.",
      details: { reason: invoicesResult.error.message },
      cause: invoicesResult.error,
    });
  }
  if (projectsResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to load Acumatica project metadata for WIP reporting.",
      details: { reason: projectsResult.error.message },
      cause: projectsResult.error,
    });
  }

  const projectMetaByCode = new Map<string, ProjectMetaRow>();
  for (const project of (projectsResult.data ?? []) as ProjectMetaRow[]) {
    if (!project.project_id) continue;
    projectMetaByCode.set(project.project_id, project);
  }

  const billedByProject = new Map<
    string,
    { billedToDate: number; latestSyncAt: string | null }
  >();
  for (const invoice of (invoicesResult.data ?? []) as ArInvoiceRow[]) {
    if (!invoice.project) continue;
    if (isClosedInvoiceStatus(invoice.status)) continue;
    const signedAmount = getInvoiceSignedAmount(invoice);
    const existing = billedByProject.get(invoice.project) ?? {
      billedToDate: 0,
      latestSyncAt: null,
    };
    existing.billedToDate += signedAmount;
    existing.latestSyncAt = getMaxDate([
      existing.latestSyncAt,
      invoice.acumatica_sync_at,
    ]);
    billedByProject.set(invoice.project, existing);
  }

  type Aggregate = {
    projectCode: string;
    contractValueFromBudget: number;
    revisedCostBudget: number;
    costsToDate: number;
    committedCosts: number;
    openCommitments: number;
    costToComplete: number;
    estimatedFinalCost: number;
    explicitVariance: number;
    budgetLineCount: number;
    latestSyncAt: string | null;
  };

  const aggregateByProject = new Map<string, Aggregate>();
  let forecastDataAvailable = false;

  for (const line of (budgetResult.data ?? []) as BudgetLine[]) {
    const projectCode = line.project_code;
    const existing = aggregateByProject.get(projectCode) ?? {
      projectCode,
      contractValueFromBudget: 0,
      revisedCostBudget: 0,
      costsToDate: 0,
      committedCosts: 0,
      openCommitments: 0,
      costToComplete: 0,
      estimatedFinalCost: 0,
      explicitVariance: 0,
      budgetLineCount: 0,
      latestSyncAt: null,
    };

    const recordType = normalizeRecordType(line.record_type);
    const revisedBudget = toNumber(line.revised_budgeted_amount);
    const originalBudget = toNumber(line.original_budgeted_amount);
    const budgetValue = revisedBudget !== 0 ? revisedBudget : originalBudget;
    const actualAmount = toNumber(line.actual_amount);
    const revisedCommitted = toNumber(line.revised_committed_amount);
    const openCommitted = toNumber(line.committed_open_amount);
    const costToComplete = toNumber(line.cost_to_complete);
    const costAtCompletion = toNumber(line.cost_at_completion);
    const variance = toNumber(line.variance_amount);

    if (costToComplete !== 0 || costAtCompletion !== 0) {
      forecastDataAvailable = true;
    }

    if (recordType === "income") {
      existing.contractValueFromBudget += budgetValue;
    } else {
      existing.revisedCostBudget += budgetValue;
      existing.costsToDate += actualAmount;
      existing.committedCosts += revisedCommitted;
      existing.openCommitments += openCommitted;
      existing.costToComplete += costToComplete;
      existing.estimatedFinalCost += costAtCompletion;
      existing.explicitVariance += variance;
    }

    existing.budgetLineCount += 1;
    existing.latestSyncAt = getMaxDate([
      existing.latestSyncAt,
      line.acumatica_sync_at,
    ]);
    aggregateByProject.set(projectCode, existing);
  }

  const rows: WipRow[] = [];
  const summary: WipSummary = {
    projectCount: 0,
    contractValue: 0,
    revisedCostBudget: 0,
    costsToDate: 0,
    estimatedFinalCost: 0,
    earnedRevenue: 0,
    billedToDate: 0,
    overUnderBilling: 0,
    forecastGrossProfit: 0,
  };

  for (const aggregate of aggregateByProject.values()) {
    const projectMeta = projectMetaByCode.get(aggregate.projectCode);
    const invoiceAgg = billedByProject.get(aggregate.projectCode);

    const contractValue =
      aggregate.contractValueFromBudget > 0
        ? aggregate.contractValueFromBudget
        : toNumber(projectMeta?.income);
    const estimatedFinalCost =
      aggregate.estimatedFinalCost > 0
        ? aggregate.estimatedFinalCost
        : aggregate.costsToDate + aggregate.costToComplete;
    const billedToDate = invoiceAgg?.billedToDate ?? 0;
    const wip = calculateWipPosition(
      contractValue,
      aggregate.costsToDate,
      estimatedFinalCost,
      billedToDate,
    );
    const forecastGrossProfit = contractValue - estimatedFinalCost;
    const forecastGrossMarginPct =
      contractValue !== 0 ? (forecastGrossProfit / contractValue) * 100 : 0;
    const costVariance =
      aggregate.explicitVariance !== 0
        ? aggregate.explicitVariance
        : aggregate.revisedCostBudget - estimatedFinalCost;

    const row: WipRow = {
      projectCode: aggregate.projectCode,
      projectDescription: projectMeta?.description ?? null,
      customer: projectMeta?.customer ?? null,
      projectStatus: projectMeta?.status ?? null,
      contractValue: roundMoney(contractValue),
      revisedCostBudget: roundMoney(aggregate.revisedCostBudget),
      costsToDate: roundMoney(aggregate.costsToDate),
      committedCosts: roundMoney(aggregate.committedCosts),
      openCommitments: roundMoney(aggregate.openCommitments),
      costToComplete: roundMoney(aggregate.costToComplete),
      estimatedFinalCost: roundMoney(estimatedFinalCost),
      costVariance: roundMoney(costVariance),
      percentComplete: wip.percentComplete,
      earnedRevenue: wip.earnedRevenue,
      billedToDate: roundMoney(billedToDate),
      overUnderBilling: wip.overUnderBilling,
      forecastGrossProfit: roundMoney(forecastGrossProfit),
      forecastGrossMarginPct: roundMoney(forecastGrossMarginPct),
      wipPosition: wip.position,
      budgetLineCount: aggregate.budgetLineCount,
      latestSyncAt: getMaxDate([
        aggregate.latestSyncAt,
        projectMeta?.acumatica_sync_at,
        projectMeta?.last_modified_at,
        invoiceAgg?.latestSyncAt,
      ]),
    };

    rows.push(row);

    summary.projectCount += 1;
    summary.contractValue += row.contractValue;
    summary.revisedCostBudget += row.revisedCostBudget;
    summary.costsToDate += row.costsToDate;
    summary.estimatedFinalCost += row.estimatedFinalCost;
    summary.earnedRevenue += row.earnedRevenue;
    summary.billedToDate += row.billedToDate;
    summary.overUnderBilling += row.overUnderBilling;
    summary.forecastGrossProfit += row.forecastGrossProfit;
  }

  rows.sort((a, b) => b.contractValue - a.contractValue);

  return {
    rows,
    summary: {
      projectCount: summary.projectCount,
      contractValue: roundMoney(summary.contractValue),
      revisedCostBudget: roundMoney(summary.revisedCostBudget),
      costsToDate: roundMoney(summary.costsToDate),
      estimatedFinalCost: roundMoney(summary.estimatedFinalCost),
      earnedRevenue: roundMoney(summary.earnedRevenue),
      billedToDate: roundMoney(summary.billedToDate),
      overUnderBilling: roundMoney(summary.overUnderBilling),
      forecastGrossProfit: roundMoney(summary.forecastGrossProfit),
    },
    forecastDataAvailable,
  };
}
