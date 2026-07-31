/**
 * Acumatica ERP RAG Tools
 *
 * These tools give the CFO agent access to live accounting data from
 * Acumatica ERP: AP aging, AR aging, cash position, vendor spend,
 * GL journal entries, and purchase orders.
 *
 * Each tool calls the Acumatica REST API via the singleton client,
 * computes summaries, and returns structured data for the agent.
 */

import { tool } from "ai";
import { createAcumaticaClient } from "@/lib/acumatica/client";
import {
  getAcumaticaProjectBudgetDescription,
  getAcumaticaProjectBudgetInputSchema,
  getAcumaticaProjectListDescription,
  getAcumaticaProjectListInputSchema,
  getAPAgingReportDescription,
  getAPAgingReportInputSchema,
  getARAgingReportDescription,
  getARAgingReportInputSchema,
  getCashPositionReportDescription,
  getCashPositionReportInputSchema,
  getPurchaseOrderSummaryDescription,
  getPurchaseOrderSummaryInputSchema,
  getRecentBillsDescription,
  getRecentBillsInputSchema,
  getRecentInvoicesDescription,
  getRecentInvoicesInputSchema,
  getVendorSpendReportDescription,
  getVendorSpendReportInputSchema,
} from "@/lib/ai/tool-descriptors";

type ToolTracePayload = {
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp: string;
};

type CreateAcumaticaToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateAcumaticaToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return async (input: TInput): Promise<TResult> => {
    try {
      const output = await execute(input);
      options.onTrace?.({
        tool: name,
        input,
        output,
        timestamp: new Date().toISOString(),
      });
      return output;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown tool error";
      options.onTrace?.({
        tool: name,
        input,
        error: message,
        timestamp: new Date().toISOString(),
      });
      // Return error as structured data instead of throwing
      // so the agent can explain the issue to the user
      return {
        error: message,
        suggestion:
          "The Acumatica ERP connection may be temporarily unavailable. " +
          "Try again or rely on the Supabase financial data.",
      } as TResult;
    }
  };
}

// ---------------------------------------------------------------------------
// Tool Factory
// ---------------------------------------------------------------------------

export function createAcumaticaTools(
  _userId: string,
  options: CreateAcumaticaToolsOptions = {},
) {
  return {
    // -----------------------------------------------------------------------
    // AP Aging
    // -----------------------------------------------------------------------
    getAPAgingReport: tool({
      description: getAPAgingReportDescription,
      inputSchema: getAPAgingReportInputSchema,
      execute: withTrace("getAPAgingReport", options, async () => {
        const client = createAcumaticaClient();
        await client.login();
        const aging = await client.getAPAging();

        return {
          source: "Acumatica ERP (live)",
          sourceRef: `[Source: Acumatica AP Aging - as of ${aging.asOf}]`,
          ...aging,
          summary: {
            totalOutstandingAP: aging.totalBalance,
            bucketBreakdown: aging.buckets
              .filter((b) => b.count > 0)
              .map((b) => `${b.label}: $${b.totalBalance.toLocaleString()} (${b.count} bills)`),
            overdueAmount: aging.buckets
              .filter((b) => b.label !== "Current")
              .reduce((s, b) => s + b.totalBalance, 0),
          },
        };
      }),
    }),

    // -----------------------------------------------------------------------
    // AR Aging
    // -----------------------------------------------------------------------
    getARAgingReport: tool({
      description: getARAgingReportDescription,
      inputSchema: getARAgingReportInputSchema,
      execute: withTrace("getARAgingReport", options, async () => {
        const client = createAcumaticaClient();
        await client.login();
        const aging = await client.getARAging();

        return {
          source: "Acumatica ERP (live)",
          sourceRef: `[Source: Acumatica AR Aging - as of ${aging.asOf}]`,
          ...aging,
          summary: {
            totalOutstandingAR: aging.totalBalance,
            bucketBreakdown: aging.buckets
              .filter((b) => b.count > 0)
              .map((b) => `${b.label}: $${b.totalBalance.toLocaleString()} (${b.count} invoices)`),
            overdueAmount: aging.buckets
              .filter((b) => b.label !== "Current")
              .reduce((s, b) => s + b.totalBalance, 0),
          },
        };
      }),
    }),

    // -----------------------------------------------------------------------
    // Cash Position
    // -----------------------------------------------------------------------
    getCashPositionReport: tool({
      description: getCashPositionReportDescription,
      inputSchema: getCashPositionReportInputSchema,
      execute: withTrace(
        "getCashPositionReport",
        options,
        async ({ windowDays }) => {
          const client = createAcumaticaClient();
          await client.login();
          const position = await client.getCashPosition(windowDays);

          return {
            source: "Acumatica ERP (live)",
            sourceRef: `[Source: Acumatica Cash Position - Last ${windowDays} days]`,
            ...position,
            summary: {
              totalInflows: `$${position.totalInflows.toLocaleString()}`,
              totalOutflows: `$${position.totalOutflows.toLocaleString()}`,
              netCashFlow: `$${position.netCashFlow.toLocaleString()}`,
              direction: position.netCashFlow >= 0 ? "positive" : "negative",
              period: `Last ${windowDays} days`,
            },
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // Vendor Spend
    // -----------------------------------------------------------------------
    getVendorSpendReport: tool({
      description: getVendorSpendReportDescription,
      inputSchema: getVendorSpendReportInputSchema,
      execute: withTrace(
        "getVendorSpendReport",
        options,
        async ({ vendorId }) => {
          const client = createAcumaticaClient();
          await client.login();
          const summaries = await client.getVendorSpend(vendorId);

          return {
            source: "Acumatica ERP (live)",
            sourceRef: `[Source: Acumatica Vendor Spend${vendorId ? ` - ${vendorId}` : " - Top Vendors"}]`,
            vendorCount: summaries.length,
            vendors: summaries.map((v) => ({
              vendorId: v.vendorId,
              vendorName: v.vendorName,
              totalInvoiced: v.totalInvoiced,
              totalOutstanding: v.totalOutstanding,
              totalPaid: v.totalPaid,
              billCount: v.billCount,
            })),
            totals: {
              totalInvoiced: summaries.reduce((s, v) => s + v.totalInvoiced, 0),
              totalOutstanding: summaries.reduce(
                (s, v) => s + v.totalOutstanding,
                0,
              ),
              totalPaid: summaries.reduce((s, v) => s + v.totalPaid, 0),
            },
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // Recent AP Bills
    // -----------------------------------------------------------------------
    getRecentBills: tool({
      description: getRecentBillsDescription,
      inputSchema: getRecentBillsInputSchema,
      execute: withTrace(
        "getRecentBills",
        options,
        async ({ status, limit }) => {
          const client = createAcumaticaClient();
          await client.login();

          const allBills = await client.getBills({
            $top: limit,
          });

          // Filter in-memory to avoid Acumatica OData $filter HTTP 500
          const bills = status
            ? allBills.filter((b) => (b.Status as unknown as { value?: string } | undefined)?.value === status)
            : allBills;

          const totalAmount = bills.reduce((s, b) => s + (b.Amount ?? 0), 0);
          const totalBalance = bills.reduce((s, b) => s + (b.Balance ?? 0), 0);

          return {
            source: "Acumatica ERP (live)",
            sourceRef: "[Source: Acumatica Recent AP Bills]",
            count: bills.length,
            totalAmount,
            totalBalance,
            bills: bills.map((b) => ({
              referenceNbr: b.ReferenceNbr,
              vendor: b.Vendor,
              date: b.Date,
              dueDate: b.DueDate,
              amount: b.Amount,
              balance: b.Balance,
              status: b.Status,
              description: b.Description,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // Recent AR Invoices
    // -----------------------------------------------------------------------
    getRecentInvoices: tool({
      description: getRecentInvoicesDescription,
      inputSchema: getRecentInvoicesInputSchema,
      execute: withTrace(
        "getRecentInvoices",
        options,
        async ({ status, limit }) => {
          const client = createAcumaticaClient();
          await client.login();

          const allInvoices = await client.getInvoices({
            $top: limit,
          });

          // Filter in-memory to avoid Acumatica OData $filter HTTP 500
          const invoices = status
            ? allInvoices.filter((i) => (i.Status as unknown as { value?: string } | undefined)?.value === status)
            : allInvoices;

          const totalAmount = invoices.reduce(
            (s, i) => s + (i.Amount ?? 0),
            0,
          );
          const totalBalance = invoices.reduce(
            (s, i) => s + (i.Balance ?? 0),
            0,
          );

          return {
            source: "Acumatica ERP (live)",
            sourceRef: "[Source: Acumatica Recent AR Invoices]",
            count: invoices.length,
            totalAmount,
            totalBalance,
            invoices: invoices.map((inv) => ({
              referenceNbr: inv.ReferenceNbr,
              customer: inv.Customer,
              customerName: inv.CustomerName,
              date: inv.Date,
              dueDate: inv.DueDate,
              amount: inv.Amount,
              balance: inv.Balance,
              status: inv.Status,
              description: inv.Description,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // Project Budget (from Acumatica ERP)
    // -----------------------------------------------------------------------
    getAcumaticaProjectBudget: tool({
      description: getAcumaticaProjectBudgetDescription,
      inputSchema: getAcumaticaProjectBudgetInputSchema,
      execute: withTrace(
        "getAcumaticaProjectBudget",
        options,
        async ({ projectId, typeFilter }) => {
          const client = createAcumaticaClient();
          await client.login();
          const summary = await client.getProjectBudgetSummary(projectId);

          // Filter lines if requested
          let lines = [
            ...summary.linesByType.income,
            ...summary.linesByType.expense,
          ];
          if (typeFilter === "Expense") {
            lines = summary.linesByType.expense;
          } else if (typeFilter === "Income") {
            lines = summary.linesByType.income;
          }

          // Format budget lines for the agent — include only lines with activity
          const activeBudgetLines = lines
            .filter(
              (l) =>
                (l.OriginalBudgetedAmount ?? 0) !== 0 ||
                (l.RevisedBudgetedAmount ?? 0) !== 0 ||
                (l.ActualAmount ?? 0) !== 0 ||
                (l.RevisedCommittedAmount ?? 0) !== 0,
            )
            .map((l) => ({
              costCode: l.CostCode,
              description: l.Description,
              type: l.Type,
              originalBudget: l.OriginalBudgetedAmount ?? 0,
              revisedBudget: l.RevisedBudgetedAmount ?? 0,
              changeOrders: l.BudgetedCOAmount ?? 0,
              actualCosts: l.ActualAmount ?? 0,
              committedCosts: l.RevisedCommittedAmount ?? 0,
              committedOpen: l.CommittedOpenAmount ?? 0,
              committedInvoiced: l.CommittedInvoicedAmount ?? 0,
              costToComplete: l.CostToComplete ?? 0,
              costAtCompletion: l.CostAtCompletion ?? 0,
              variance: l.VarianceAmount ?? 0,
              percentComplete: l.PercentageOfCompletion ?? 0,
              retainage: l.Retainage ?? 0,
            }));

          return {
            source: "Acumatica ERP (live)",
            sourceRef: `[Source: Acumatica Project Budget - ${summary.projectDescription} (${projectId})]`,
            project: {
              id: summary.projectId,
              description: summary.projectDescription,
              status: summary.projectStatus,
              customer: summary.customer,
            },
            totals: {
              ...summary.totals,
              margin:
                summary.totals.income > 0
                  ? (
                      ((summary.totals.income - summary.totals.expenses) /
                        summary.totals.income) *
                      100
                    ).toFixed(1) + "%"
                  : "N/A",
            },
            budgetLines: activeBudgetLines,
            lineCount: {
              total: summary.lineCount,
              withActivity: activeBudgetLines.length,
            },
            asOf: summary.asOf,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // Project List (from Acumatica ERP)
    // -----------------------------------------------------------------------
    getAcumaticaProjectList: tool({
      description: getAcumaticaProjectListDescription,
      inputSchema: getAcumaticaProjectListInputSchema,
      execute: withTrace(
        "getAcumaticaProjectList",
        options,
        async ({ statusFilter }) => {
          const client = createAcumaticaClient();
          await client.login();
          const projects = await client.getProjectList(statusFilter);

          const totalIncome = projects.reduce((s, p) => s + p.income, 0);
          const totalExpenses = projects.reduce((s, p) => s + p.expenses, 0);

          return {
            source: "Acumatica ERP (live)",
            sourceRef: `[Source: Acumatica Project List${statusFilter ? ` - ${statusFilter}` : ""}]`,
            projectCount: projects.length,
            projects,
            portfolioTotals: {
              totalIncome,
              totalExpenses,
              netPosition: totalIncome - totalExpenses,
            },
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // Purchase Orders
    // -----------------------------------------------------------------------
    getPurchaseOrderSummary: tool({
      description: getPurchaseOrderSummaryDescription,
      inputSchema: getPurchaseOrderSummaryInputSchema,
      execute: withTrace(
        "getPurchaseOrderSummary",
        options,
        async ({ status, limit }) => {
          const client = createAcumaticaClient();
          await client.login();

          const allPos = await client.getPurchaseOrders({
            $top: limit,
          });

          // Filter in-memory to avoid Acumatica OData $filter HTTP 500
          const pos = status
            ? allPos.filter((po) => (po.Status as unknown as { value?: string } | undefined)?.value === status)
            : allPos;

          const totalOrderValue = pos.reduce(
            (s, po) => s + (po.OrderTotal ?? 0),
            0,
          );
          const totalBilled = pos.reduce(
            (s, po) => s + (po.BilledAmount ?? 0),
            0,
          );

          return {
            source: "Acumatica ERP (live)",
            sourceRef: "[Source: Acumatica Purchase Orders]",
            count: pos.length,
            totalOrderValue,
            totalBilled,
            unbilledAmount: totalOrderValue - totalBilled,
            purchaseOrders: pos.map((po) => ({
              orderNbr: po.OrderNbr,
              vendor: po.Vendor,
              date: po.Date,
              status: po.Status,
              orderTotal: po.OrderTotal,
              billedAmount: po.BilledAmount,
              description: po.Description,
            })),
          };
        },
      ),
    }),
  };
}
