import { z } from "zod";

export const getAPAgingReportDescription =
  "Get Accounts Payable (AP) aging report from the Acumatica ERP system. " +
  "Shows outstanding bills grouped by how many days past due they are " +
  "(Current, 1-30, 31-60, 61-90, 90+ days). This is LIVE accounting data. " +
  "Use when asked about: AP aging, outstanding bills, what we owe vendors, " +
  "overdue payables, accounts payable status, or vendor payment obligations.";

export const getAPAgingReportInputSchema = z.object({});

export const getARAgingReportDescription =
  "Get Accounts Receivable (AR) aging report from Acumatica ERP. " +
  "Shows outstanding invoices grouped by how many days past due they are. " +
  "This is LIVE accounting data. Use when asked about: AR aging, " +
  "outstanding invoices, what clients owe us, overdue receivables, " +
  "collections, or accounts receivable status.";

export const getARAgingReportInputSchema = z.object({});

export const getCashPositionReportDescription =
  "Get cash position summary from Acumatica ERP. Shows net cash flow " +
  "over a rolling window: total AR payments received (inflows) vs " +
  "AP checks issued (outflows). This is LIVE accounting data. " +
  "Use when asked about: cash position, cash flow, liquidity, " +
  "how much cash we have, net inflows/outflows, or working capital.";

export const getCashPositionReportInputSchema = z.object({
  windowDays: z
    .number()
    .optional()
    .default(90)
    .describe("Number of days to look back (default 90)"),
});

export const getVendorSpendReportDescription =
  "Get vendor spend analysis from Acumatica ERP. Shows how much has " +
  "been invoiced by vendors, how much is still outstanding, and how " +
  "much has been paid. Can filter to a specific vendor or show top " +
  "vendors by total spend. This is LIVE accounting data. " +
  "Use when asked about: vendor spend, vendor payments, top vendors, " +
  "how much we've paid a vendor, or vendor cost analysis.";

export const getVendorSpendReportInputSchema = z.object({
  vendorId: z
    .string()
    .optional()
    .describe(
      "Optional vendor ID to filter (e.g. 'PROOUT'). " +
        "Omit to see top vendors by spend.",
    ),
});

export const getRecentBillsDescription =
  "Get recent AP bills (vendor invoices) from Acumatica ERP. " +
  "Shows the latest bills with vendor, amount, balance, and status. " +
  "This is LIVE accounting data. Use when asked about: recent bills, " +
  "vendor invoices, AP transactions, or what bills came in recently.";

export const getRecentBillsInputSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by status: 'Open', 'Closed', 'Balanced', etc."),
  limit: z.number().optional().default(20).describe("Max bills to return (default 20)"),
});

export const getRecentInvoicesDescription =
  "Get recent AR invoices (customer billings) from Acumatica ERP. " +
  "Shows customer invoices with amounts, balances, and status. " +
  "This is LIVE accounting data. Use when asked about: invoices, " +
  "customer billings, AR transactions, pay applications, or what " +
  "we've billed recently.";

export const getRecentInvoicesInputSchema = z.object({
  status: z.string().optional().describe("Filter by status: 'Open', 'Closed', etc."),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Max invoices to return (default 20)"),
});

export const getAcumaticaProjectBudgetDescription =
  "Get a comprehensive project budget from the Acumatica ERP system. " +
  "Returns budget line items with original budget, revised budget, " +
  "actual costs, committed costs, cost to complete, cost at completion, " +
  "variance, and change order amounts. This is LIVE accounting data " +
  "from the official financial system of record. " +
  "Use when asked about: ERP budget, Acumatica budget, official project " +
  "budget, accounting budget, project financials from ERP, cost codes " +
  "from Acumatica, or when the user wants the 'real' budget numbers " +
  "from the accounting system. " +
  "The projectId is the Acumatica project code (e.g., '25108'), NOT " +
  "the Supabase project ID (which is a number like 67).";

export const getAcumaticaProjectBudgetInputSchema = z.object({
  projectId: z
    .string()
    .describe(
      "Acumatica project code (e.g., '25108' for Goodwill Tremont). " +
        "This is the code shown in Acumatica, not the Supabase ID.",
    ),
  typeFilter: z
    .enum(["Expense", "Income", "all"])
    .optional()
    .default("all")
    .describe(
      "Filter budget lines by type: 'Expense' for costs, " +
        "'Income' for revenue lines, or 'all' for everything.",
    ),
});

export const getAcumaticaProjectListDescription =
  "Get a list of all projects from the Acumatica ERP system with " +
  "high-level financial totals (income, expenses, net position). " +
  "This is LIVE accounting data. Use when asked about: all projects " +
  "in Acumatica, project portfolio from ERP, which projects are active " +
  "in the accounting system, or for a financial overview across all " +
  "projects from the official books.";

export const getAcumaticaProjectListInputSchema = z.object({
  statusFilter: z
    .string()
    .optional()
    .describe(
      "Filter by project status: 'Active', 'In Planning', 'Completed', etc. " +
        "Omit to see all non-planning projects.",
    ),
});

export const getPurchaseOrderSummaryDescription =
  "Get purchase order summary from Acumatica ERP. Shows POs by " +
  "vendor with totals, billed amounts, and status. This is LIVE " +
  "accounting data. Use when asked about: purchase orders, POs, " +
  "what we've ordered, procurement status, or vendor commitments.";

export const getPurchaseOrderSummaryInputSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by status: 'Open', 'Closed', 'On Hold', etc."),
  limit: z.number().optional().default(30).describe("Max POs to return (default 30)"),
});
