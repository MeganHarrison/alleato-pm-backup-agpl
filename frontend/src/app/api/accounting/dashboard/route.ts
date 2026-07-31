import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  classifyAgingBucket,
  type FinancialGuardrailAlert,
} from "@/lib/accounting/aging-calculator";
import { loadPaymentGuardrailAlerts } from "@/lib/accounting/payment-guardrails";
import { buildFinanceSpendRollup } from "@/lib/accounting/finance-spend";
import { listSopBacklog } from "@/lib/accounting/sop-backlog";
import { buildWipPortfolio } from "@/lib/accounting/wip-portfolio";
import {
  EMPTY_COST_BREAKDOWN_SERIES,
  rankProjectsByVisibleRevenue,
  type CostBreakdownSeriesResponse,
} from "@/lib/accounting/dashboard-contract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgingBucket {
  label: string;
  count: number;
  total: number;
}

interface AgingResult {
  current: AgingBucket;
  days31to60: AgingBucket;
  days61to90: AgingBucket;
  days90plus: AgingBucket;
  totalOutstanding: number;
}

interface CashPositionSummary {
  totalArOutstanding: number;
  totalApOutstanding: number;
  netCashPosition: number;
  paymentsReceivedThisMonth: number;
  checksIssuedThisMonth: number;
}

interface RevenueByProject {
  projectCode: string;
  description: string | null;
  customer: string | null;
  totalInvoiced: number;
  totalCollected: number;
  outstandingBalance: number;
}

interface BalanceByProject {
  projectCode: string;
  description: string | null;
  customer: string | null;
  outstandingBalance: number;
}

interface NetMarginByProject {
  projectCode: string;
  description: string | null;
  customer: string | null;
  revenue: number;
  cost: number;
  netMargin: number;
  netMarginPercent: number | null;
}

interface RecentPayment {
  referenceNbr: string;
  customerName: string | null;
  amount: number;
  date: string | null;
  status: string | null;
}

interface RecentCheck {
  referenceNbr: string;
  vendorId: string | null;
  vendorName: string | null;
  amount: number;
  date: string | null;
  status: string | null;
}

interface MonthlyRevenueMargin {
  month: string;
  revenue: number;
  cost: number;
  netMargin: number;
  netMarginPercent: number | null;
}

interface DashboardResponse {
  arAging: AgingResult;
  apAging: AgingResult;
  cashPosition: CashPositionSummary;
  revenueByProject: RevenueByProject[];
  arByProject: RevenueByProject[];
  apByProject: BalanceByProject[];
  netMarginByProject: NetMarginByProject[];
  costBreakdownSeries: CostBreakdownSeriesResponse;
  monthlyRevenueMargin: MonthlyRevenueMargin[];
  recentActivity: {
    payments: RecentPayment[];
    checks: RecentCheck[];
  };
  guardrailAlerts: FinancialGuardrailAlert[];
  leadership: {
    neededSopCount: number;
    staleNeededSopCount: number;
    linkedSopCount: number;
    trailingFinanceSpend: number;
    financeSpendExceptionCount: number;
  };
  reconciliation: {
    duplicateCount: number;
    onHoldCount: number;
    syncIssueCount: number;
    dollarsAtRisk: number;
    lastRunAt: string | null;
  };
  retainage: {
    apOwedTotal: number;
    apOwedCount: number;
    byProject: Array<{ projectCode: string; projectName: string; total: number }>;
  };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLOSED_STATUSES = ["Closed", "Voided"];

function getDaysPastDue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0; // treat null due_date as current
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function classifyIntoAging(
  items: Array<{ due_date: string | null; balance: number | null }>,
): AgingResult {
  const buckets = {
    current: { label: "Current (0–30 days)", count: 0, total: 0 },
    days31to60: { label: "31–60 days", count: 0, total: 0 },
    days61to90: { label: "61–90 days", count: 0, total: 0 },
    days90plus: { label: "90+ days", count: 0, total: 0 },
  };

  for (const item of items) {
    const days = getDaysPastDue(item.due_date);
    const amount = Number(item.balance ?? 0);
    const bucket = classifyAgingBucket(days);

    if (bucket === "current") {
      buckets.current.count++;
      buckets.current.total += amount;
    } else if (bucket === "31-60") {
      buckets.days31to60.count++;
      buckets.days31to60.total += amount;
    } else if (bucket === "61-90") {
      buckets.days61to90.count++;
      buckets.days61to90.total += amount;
    } else {
      buckets.days90plus.count++;
      buckets.days90plus.total += amount;
    }
  }

  const totalOutstanding =
    buckets.current.total +
    buckets.days31to60.total +
    buckets.days61to90.total +
    buckets.days90plus.total;

  // Round totals to 2 decimal places for cleanliness
  for (const b of Object.values(buckets)) {
    b.total = Math.round(b.total * 100) / 100;
  }

  return {
    ...buckets,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
  };
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfCurrentYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function buildCurrentYearMonthKeys(): string[] {
  const now = new Date();
  return Array.from({ length: now.getMonth() + 1 }, (_, index) => {
    const date = new Date(now.getFullYear(), index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function monthKey(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// GET /api/accounting/dashboard
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails(
  "/api/accounting/dashboard#GET",
  async () => {
    await requireCurrentUserAppCapability(
      "view_accounting",
      "/api/accounting/dashboard#GET",
      "Accounting access required.",
    );

    const supabase = createServiceClient();
    const monthStart = startOfCurrentMonth();
    const yearStart = startOfCurrentYear();

    // Run all independent queries in parallel for performance
    const [
      arInvoicesResult,
      apBillsResult,
      paymentsThisMonthResult,
      checksThisMonthResult,
      arInvoicesForProjectsResult,
      paymentApplicationsResult,
      recentPaymentsResult,
      recentChecksResult,
      wipPortfolio,
      monthlyRevenueResult,
      monthlyCostResult,
      guardrailAlerts,
      sopBacklogRecords,
      financeSpendRollup,
    ] = await Promise.all([
      // 1. AR invoices — outstanding only, for aging + cash position
      serviceDb.from("acumatica_ar_invoices")
        .select("due_date, balance, status")
        .not(
          "status",
          "in",
          `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(",")})`,
        )
        .not("balance", "is", null),

      // 2. AP bills — outstanding only, for aging + cash position
      serviceDb.from("acumatica_ap_bills")
        .select("due_date, balance, status, project_code")
        .not(
          "status",
          "in",
          `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(",")})`,
        )
        .not("balance", "is", null),

      // 3. Payments received this month
      serviceDb.from("acumatica_payments")
        .select("payment_amount")
        .gte("application_date", monthStart),

      // 4. Checks issued this month
      serviceDb.from("acumatica_checks")
        .select("payment_amount")
        .gte("application_date", monthStart),

      // 5. All AR invoices with project code for revenue grouping
      serviceDb.from("acumatica_ar_invoices")
        .select("project, customer_name, amount, balance, status"),

      // 6. Payment applications for collected amounts per project
      serviceDb.from("acumatica_payment_applications")
        .select("resolved_project_code, amount_applied"),

      // 7. Recent 10 payments received
      serviceDb.from("acumatica_payments")
        .select(
          "reference_nbr, customer_id, customer_name, payment_amount, application_date, status",
        )
        .order("application_date", { ascending: false })
        .limit(10),

      // 8. Recent 10 checks issued (exclude null dates so we get real recent ones)
      serviceDb.from("acumatica_checks")
        .select(
          "reference_nbr, vendor_id, vendor_name, payment_amount, application_date, status",
        )
        .not("application_date", "is", null)
        .order("application_date", { ascending: false })
        .limit(10),
      buildWipPortfolio(supabase, "/api/accounting/dashboard#GET"),
      serviceDb.from("acumatica_ar_invoices")
        .select("date, amount, status")
        .not("date", "is", null)
        .gte("date", yearStart),
      serviceDb.from("acumatica_ap_bills")
        .select("date, amount, status")
        .not("date", "is", null)
        .gte("date", yearStart),
      loadPaymentGuardrailAlerts(),
      listSopBacklog(supabase),
      buildFinanceSpendRollup(supabase, 12),
    ]);

    // Surface any query errors
    const errors = [
      arInvoicesResult.error,
      apBillsResult.error,
      paymentsThisMonthResult.error,
      checksThisMonthResult.error,
      arInvoicesForProjectsResult.error,
      paymentApplicationsResult.error,
      recentPaymentsResult.error,
      recentChecksResult.error,
      monthlyRevenueResult.error,
      monthlyCostResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/dashboard#GET",
        message: "Failed to load accounting dashboard data.",
        details: {
          reasons: errors.map((error) => error?.message).filter(Boolean),
        },
      });
    }

    // ---------------------------------------------------------------------------
    // 1 & 2. AR and AP Aging
    // ---------------------------------------------------------------------------
    const arAging = classifyIntoAging(arInvoicesResult.data ?? []);
    const apAging = classifyIntoAging(apBillsResult.data ?? []);

    // ---------------------------------------------------------------------------
    // 3. Cash Position
    // ---------------------------------------------------------------------------
    const paymentsReceivedThisMonth = (
      paymentsThisMonthResult.data ?? []
    ).reduce((sum, row) => sum + Number(row.payment_amount ?? 0), 0);

    const checksIssuedThisMonth = (checksThisMonthResult.data ?? []).reduce(
      (sum, row) => sum + Number(row.payment_amount ?? 0),
      0,
    );

    const cashPosition: CashPositionSummary = {
      totalArOutstanding: arAging.totalOutstanding,
      totalApOutstanding: apAging.totalOutstanding,
      netCashPosition:
        Math.round(
          (arAging.totalOutstanding - apAging.totalOutstanding) * 100,
        ) / 100,
      paymentsReceivedThisMonth:
        Math.round(paymentsReceivedThisMonth * 100) / 100,
      checksIssuedThisMonth: Math.round(checksIssuedThisMonth * 100) / 100,
    };

    // ---------------------------------------------------------------------------
    // 4. Revenue by Project (top 15)
    // ---------------------------------------------------------------------------

    // Group invoices by project code
    const invoicesByProject = new Map<
      string,
      { customer: string | null; totalInvoiced: number; totalBalance: number }
    >();

    for (const inv of arInvoicesForProjectsResult.data ?? []) {
      const code = inv.project ?? "(No Project)";
      const existing = invoicesByProject.get(code);
      const amount = Number(inv.amount ?? 0);
      const balance = Number(inv.balance ?? 0);

      if (existing) {
        existing.totalInvoiced += amount;
        existing.totalBalance += CLOSED_STATUSES.includes(inv.status ?? "")
          ? 0
          : balance;
      } else {
        invoicesByProject.set(code, {
          customer: inv.customer_name ?? null,
          totalInvoiced: amount,
          totalBalance: CLOSED_STATUSES.includes(inv.status ?? "")
            ? 0
            : balance,
        });
      }
    }

    // Sum collected amounts from payment applications per project
    const collectedByProject = new Map<string, number>();
    for (const pa of paymentApplicationsResult.data ?? []) {
      const code = pa.resolved_project_code ?? "(No Project)";
      collectedByProject.set(
        code,
        (collectedByProject.get(code) ?? 0) + Number(pa.amount_applied ?? 0),
      );
    }

    // Fetch ALL project descriptions (small table — only ~80 rows)
    const projectDescriptionsResult = await serviceDb.from("acumatica_projects")
      .select("project_id, description, customer");

    if (projectDescriptionsResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/dashboard#GET",
        message:
          "Failed to load project descriptions for accounting dashboard.",
        details: { reason: projectDescriptionsResult.error.message },
        cause: projectDescriptionsResult.error,
      });
    }

    const projectDescMap = new Map<
      string,
      { description: string | null; customer: string | null }
    >();
    for (const proj of projectDescriptionsResult.data ?? []) {
      projectDescMap.set(proj.project_id, {
        description: proj.description ?? null,
        customer: proj.customer ?? null,
      });
    }

    // Build full list for chart (all projects with outstanding balance) + top 15 by invoiced for table
    const allProjectEntries = [...invoicesByProject.entries()].map(
      ([code, inv]) => {
        const projMeta = projectDescMap.get(code);
        const collected = collectedByProject.get(code) ?? 0;
        return {
          projectCode: code,
          description: projMeta?.description ?? null,
          customer: projMeta?.customer ?? inv.customer ?? null,
          totalInvoiced: Math.round(inv.totalInvoiced * 100) / 100,
          totalCollected: Math.round(collected * 100) / 100,
          outstandingBalance: Math.round(inv.totalBalance * 100) / 100,
        };
      },
    );

    const revenueByProject: RevenueByProject[] = rankProjectsByVisibleRevenue(
      allProjectEntries.filter((project) =>
        projectDescMap.has(project.projectCode),
      ),
    ).slice(0, 15);

    const netMarginByProject: NetMarginByProject[] = wipPortfolio.rows
      .map((project) => {
        const revenue = project.billedToDate;
        const cost = project.costsToDate;
        const netMargin = Math.round((revenue - cost) * 100) / 100;
        return {
          projectCode: project.projectCode,
          description: project.projectDescription,
          customer: project.customer,
          revenue,
          cost,
          netMargin,
          netMarginPercent:
            revenue > 0 ? Math.round((netMargin / revenue) * 1000) / 10 : null,
        };
      })
      .filter((project) => project.revenue > 0 || project.cost > 0)
      .sort((a, b) => Math.abs(b.netMargin) - Math.abs(a.netMargin));

    const payablesByProject = new Map<string, number>();
    for (const bill of apBillsResult.data ?? []) {
      if (CLOSED_STATUSES.includes(bill.status ?? "")) continue;
      const code = bill.project_code ?? "(No Project)";
      payablesByProject.set(
        code,
        (payablesByProject.get(code) ?? 0) + Number(bill.balance ?? 0),
      );
    }

    const apByProject: BalanceByProject[] = [...payablesByProject.entries()]
      .map(([code, balance]) => {
        const projMeta = projectDescMap.get(code);
        return {
          projectCode: code,
          description: projMeta?.description ?? null,
          customer: projMeta?.customer ?? null,
          outstandingBalance: Math.round(balance * 100) / 100,
        };
      })
      .filter((project) => project.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // ---------------------------------------------------------------------------
    // 5. Monthly Revenue and Net Margin
    // ---------------------------------------------------------------------------
    const monthlyRevenueMap = new Map<string, number>();
    const monthlyCostMap = new Map<string, number>();
    const currentYearMonthKeys = buildCurrentYearMonthKeys();
    for (const key of currentYearMonthKeys) {
      monthlyRevenueMap.set(key, 0);
      monthlyCostMap.set(key, 0);
    }

    for (const invoice of monthlyRevenueResult.data ?? []) {
      if (CLOSED_STATUSES.includes(invoice.status ?? "")) continue;
      const key = monthKey(invoice.date ?? null);
      if (!key || !monthlyRevenueMap.has(key)) continue;
      monthlyRevenueMap.set(
        key,
        (monthlyRevenueMap.get(key) ?? 0) + Number(invoice.amount ?? 0),
      );
    }

    for (const bill of monthlyCostResult.data ?? []) {
      if (CLOSED_STATUSES.includes(bill.status ?? "")) continue;
      const key = monthKey(bill.date ?? null);
      if (!key || !monthlyCostMap.has(key)) continue;
      monthlyCostMap.set(
        key,
        (monthlyCostMap.get(key) ?? 0) + Number(bill.amount ?? 0),
      );
    }

    const monthlyRevenueMargin: MonthlyRevenueMargin[] =
      currentYearMonthKeys.map((month) => {
        const revenue = monthlyRevenueMap.get(month) ?? 0;
        const cost = monthlyCostMap.get(month) ?? 0;
        const netMargin = revenue - cost;
        return {
          month,
          revenue: Math.round(revenue * 100) / 100,
          cost: Math.round(cost * 100) / 100,
          netMargin: Math.round(netMargin * 100) / 100,
          netMarginPercent:
            revenue > 0 ? Math.round((netMargin / revenue) * 1000) / 10 : null,
        };
      });

    // ---------------------------------------------------------------------------
    // 6. Recent Activity
    // ---------------------------------------------------------------------------
    const recentPayments: RecentPayment[] = (
      recentPaymentsResult.data ?? []
    ).map((p) => ({
      referenceNbr: p.reference_nbr,
      customerName: p.customer_name ?? p.customer_id ?? null,
      amount: Math.round(Number(p.payment_amount ?? 0) * 100) / 100,
      date: p.application_date ?? null,
      status: p.status ?? null,
    }));

    const recentChecks: RecentCheck[] = (recentChecksResult.data ?? []).map(
      (c) => ({
        referenceNbr: c.reference_nbr,
        vendorId: c.vendor_id ?? null,
        vendorName: c.vendor_name ?? null,
        amount: Math.round(Number(c.payment_amount ?? 0) * 100) / 100,
        date: c.application_date ?? null,
        status: c.status ?? null,
      }),
    );

    // ---------------------------------------------------------------------------
    // Response
    // ---------------------------------------------------------------------------
    // All projects with outstanding balance, sorted by outstanding desc — for bar chart
    const arByProject = allProjectEntries
      .filter((p) => p.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // ---------------------------------------------------------------------------
    // Reconciliation health (JP <-> Acumatica): surface the active findings.
    const [reconFindingsResult, reconRunResult] = await Promise.all([
      serviceDb.from("reconciliation_findings")
        .select("kind, tier, amount_cents")
        .eq("is_active", true),
      serviceDb.from("reconciliation_runs")
        .select("finished_at")
        .eq("status", "complete")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const reconFindings = reconFindingsResult.data ?? [];
    const reconciliation = {
      duplicateCount: reconFindings.filter((f) => f.kind === "duplicate-ap-bill").length,
      onHoldCount: reconFindings.filter((f) => f.kind === "stale-on-hold-bill").length,
      syncIssueCount: reconFindings.filter(
        (f) => f.kind !== "duplicate-ap-bill" && f.kind !== "stale-on-hold-bill",
      ).length,
      dollarsAtRisk:
        reconFindings
          .filter((f) => f.tier === "HIGH")
          .reduce((sum, f) => sum + Math.abs(Number(f.amount_cents ?? 0)), 0) / 100,
      lastRunAt: reconRunResult.data?.finished_at ?? null,
    };

    // ---------------------------------------------------------------------------
    // Retainage owed to subcontractors (AP). AR-side retainage held from us by
    // owners is not in the synced data, so we only report the AP side here.
    const retainageResult = await serviceDb.from("acumatica_subcontracts")
      .select("project_code, retainage_total")
      .neq("retainage_total", 0);
    const retainageByProject = new Map<string, number>();
    let apRetainageOwed = 0;
    for (const row of retainageResult.data ?? []) {
      const amount = Number(row.retainage_total ?? 0);
      if (!amount) continue;
      apRetainageOwed += amount;
      const code = row.project_code ?? "—";
      retainageByProject.set(code, (retainageByProject.get(code) ?? 0) + amount);
    }
    const retainage = {
      apOwedTotal: apRetainageOwed,
      apOwedCount: (retainageResult.data ?? []).filter(
        (r) => Number(r.retainage_total ?? 0) !== 0,
      ).length,
      byProject: [...retainageByProject.entries()]
        .map(([code, total]) => ({
          projectCode: code,
          projectName: projectDescMap.get(code)?.description ?? code,
          total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
    };

    const response: DashboardResponse = {
      arAging,
      apAging,
      cashPosition,
      revenueByProject,
      arByProject,
      apByProject,
      netMarginByProject,
      // The current Acumatica bill sync does not expose stable division/account
      // dimensions. Keep the response contract explicit until those fields are
      // available, so the client renders an honest empty state instead of
      // crashing on a missing nested object.
      costBreakdownSeries: EMPTY_COST_BREAKDOWN_SERIES,
      monthlyRevenueMargin,
      recentActivity: {
        payments: recentPayments,
        checks: recentChecks,
      },
      guardrailAlerts,
      leadership: {
        neededSopCount: sopBacklogRecords.filter(
          (record) => record.status === "needed",
        ).length,
        staleNeededSopCount: sopBacklogRecords.filter(
          (record) => record.status === "needed" && record.age_days >= 30,
        ).length,
        linkedSopCount: sopBacklogRecords.filter(
          (record) => record.linked_document_metadata_id,
        ).length,
        trailingFinanceSpend: financeSpendRollup.totals.includedSpend,
        financeSpendExceptionCount:
          financeSpendRollup.totals.uncertainBillCount,
      },
      reconciliation,
      retainage,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        // Allow CDN/edge caching for 60 seconds; revalidate in background for up to 5 minutes
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  },
);
