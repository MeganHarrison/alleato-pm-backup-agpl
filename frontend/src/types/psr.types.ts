/**
 * PSR (Project Status Report) TypeScript interfaces.
 *
 * These types model the data returned by GET /api/projects/[projectId]/psr
 * and consumed by the PSR page and its section components.
 */

export interface PsrProjectInfo {
  name: string;
  projectNumber: string | null;
  startDate: string | null;
  completionDate: string | null; // from prime_contracts.end_date
  contractBudget: number; // prime_contracts.original_contract_value, or budget grandTotals.originalBudgetAmount if absent
  currentBudget: number; // prime_contracts.revised_contract_value, or budget grandTotals.revisedBudget if absent
  currentProjectedProfit: number; // currentBudget - estimatedCostAtCompletion
  originalFee: number; // budget line 550500 original_amount
  currentFee: number; // budget line 550500 revised amount
  originalInsurance: number; // budget line 550050 original_amount
  currentInsurance: number; // budget line 550050 revised amount
  currentUnallocatedCosts: number; // budget line 550099 amount
  currentOwnerContingency: number; // budget line 550100 amount
  remainingBuyout: number; // projectedBudget - committedCosts
  jobToDateCost: number; // grandTotals.jobToDateCostDetail
}

export interface PsrMonthlyBilling {
  month: string; // 'YYYY-MM'
  monthLabel: string; // 'April', 'May', etc.
  ownerPayments: number; // sum of owner_invoices.paid_amount in month
  ownerBilling: number; // sum of owner_invoices.gross_amount in month
  subBilling: number; // count of subcontractor_invoices in month (no amount column)
}

export interface PsrOpenItemCounts {
  openRfis: number;
  openSubmittals: number;
  openCEsNotInPCO: number;
  openPCCOs: number;
  subCOsNotFunded: number;
  openPCOs: number;
}

/** Maps to a single BudgetLineItem from computeBudgetGrandTotals */
export interface PsrBudgetLine {
  budgetCode: string; // e.g. "013128 - Project Manager - Labor"
  originalBudget: number;
  budgetModifications: number;
  contractChangeOrders: number;
  revisedBudget: number;
  actualAmount: number;
  pendingBudgetChanges: number;
  projectedBudget: number;
  directCosts: number;
  commitments: number;
  commitmentChangeOrders: number;
  committedCosts: number;
  projectedCosts: number;
  committedInvoicedAmount: number;
  pendingCostChanges: number;
  forecastToComplete: number;
  estimatedCostAtCompletion: number;
  projectOverUnder: number;
}

export interface PsrBudgetGrandTotals {
  originalBudget: number;
  revisedBudget: number;
  actualAmount: number;
  committedCosts: number;
  forecastToComplete: number;
  estimatedCostAtCompletion: number;
  projectOverUnder: number;
}

export interface PsrSubmittal {
  submittalNumber: string;
  title: string;
  status: string;
  ballInCourt: string | null;
}

export interface PsrRfi {
  number: number;
  subject: string;
  status: string;
  dueDate: string | null;
  ballInCourt: string | null;
}

export interface PsrChangeRequest {
  number: string;
  contractNumber: string | null;
  title: string;
  scope: string;
  status: string;
  cost: number;
  markup: number;
  total: number;
}

export interface PsrChangeOrder {
  number: number | null;
  contractNumber: string | null;
  description: string | null;
  status: string;
  amount: number;
}

export interface PsrScheduleTask {
  id: string;
  name: string;
  duration: number | null;
  startDate: string | null;
  finishDate: string | null;
  status: string | null;
  percentComplete: number | null;
  isMilestone: boolean | null;
  wbsCode: string | null;
}

export interface PsrComment {
  section: string;
  body: string;
  updatedAt: string;
}

/** Root response type for GET /api/projects/[projectId]/psr */
export interface PsrApiResponse {
  month: string; // 'YYYY-MM'
  projectInfo: PsrProjectInfo;
  monthlyBilling: PsrMonthlyBilling[];
  openItems: PsrOpenItemCounts;
  budgetLines: PsrBudgetLine[];
  budgetGrandTotals: PsrBudgetGrandTotals;
  submittals: PsrSubmittal[];
  rfis: PsrRfi[];
  changeRequests: PsrChangeRequest[];
  changeOrders: PsrChangeOrder[];
  scheduleTasks: PsrScheduleTask[];
  comments: PsrComment[];
}
