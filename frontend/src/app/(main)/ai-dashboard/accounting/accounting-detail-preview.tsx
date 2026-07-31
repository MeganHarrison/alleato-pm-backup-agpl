"use client";

import { BarChart } from "@/components/ui/charts";
import {
  formatCurrency,
  formatDateTime,
  sourceError,
  useAccountingDashboard,
  useWipPortfolio,
} from "../live-data";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
  WorkspaceSourceState,
} from "../workspace-primitives";

export type AccountingDetailKey = "cash-flow" | "wip" | "reconciliation";

const reportConfig = {
  "cash-flow": {
    eyebrow: "Accounting · Cash flow",
    canonicalHref: "/accounting",
    canonicalLabel: "Open accounting dashboard",
  },
  wip: {
    eyebrow: "Accounting · WIP",
    canonicalHref: "/accounting/wip",
    canonicalLabel: "Open canonical WIP report",
  },
  reconciliation: {
    eyebrow: "Accounting · Reconciliation",
    canonicalHref: "/accounting/reconciliation",
    canonicalLabel: "Open canonical reconciliation",
  },
} satisfies Record<
  AccountingDetailKey,
  { eyebrow: string; canonicalHref: string; canonicalLabel: string }
>;

export function AccountingDetailPreview({ report }: { report: AccountingDetailKey }) {
  const accounting = useAccountingDashboard();
  const wip = useWipPortfolio();
  const config = reportConfig[report];
  const relevantQuery = report === "wip" ? wip : accounting;

  const title = getTitle(report, accounting.data, wip.data);
  const rows = getRows(report, accounting.data, wip.data);
  const chart = getChart(report, accounting.data, wip.data);
  const generatedAt =
    report === "wip" ? wip.data?.generatedAt : accounting.data?.generatedAt;

  return (
    <>
      <WorkspacePageIntro
        eyebrow={config.eyebrow}
        title={title}
        statusLabel={
          generatedAt
            ? `Generated ${formatDateTime(generatedAt)}`
            : "Live accounting source"
        }
      >
        This readout comes from the same accounting API as the canonical report.
        Use the linked report to inspect records and complete accounting work.
      </WorkspacePageIntro>

      <WorkspaceSection
        eyebrow="Current distribution"
        title={chart.title}
        className="mt-10 pt-0"
        showTopDivider={false}
        action={
          <CanonicalLink href={config.canonicalHref}>
            {config.canonicalLabel}
          </CanonicalLink>
        }
      >
        {relevantQuery.isLoading ? (
          <WorkspaceSourceState source={config.eyebrow} state="loading" />
        ) : relevantQuery.isError ? (
          <WorkspaceSourceState
            source={config.eyebrow}
            state="error"
            detail={sourceError(relevantQuery.error, config.eyebrow)}
          />
        ) : chart.data.length > 0 ? (
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <BarChart
              data={chart.data}
              categories={[chart.category]}
              colors={["primary"]}
              valueFormatter={chart.currency ? (value) => formatCurrency(value, true) : undefined}
              yAxisWidth={chart.currency ? 58 : 38}
              height="280px"
            />
          </div>
        ) : (
          <WorkspaceSourceState source={config.eyebrow} state="empty" />
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Review"
        title="Records shaping the current position"
        className="mt-12"
      >
        {relevantQuery.isLoading ? null : relevantQuery.isError ? null : rows.length > 0 ? (
          <div className="divide-y divide-border">
            {rows.map(([label, value, context]) => (
              <div
                key={label}
                className="grid gap-2 py-5 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(8rem,0.45fr)_minmax(0,1.5fr)] sm:items-start"
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-sm font-medium text-primary sm:text-right">
                  {value}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground sm:pl-6">
                  {context}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <WorkspaceSourceState source={config.eyebrow} state="empty" />
        )}
      </WorkspaceSection>
    </>
  );
}

function getTitle(
  report: AccountingDetailKey,
  accounting: ReturnType<typeof useAccountingDashboard>["data"],
  wip: ReturnType<typeof useWipPortfolio>["data"],
) {
  if (report === "cash-flow") {
    return accounting
      ? `${formatCurrency(accounting.cashPosition.netCashPosition, true)} net cash position, with ${formatCurrency(accounting.cashPosition.totalArOutstanding, true)} in outstanding AR.`
      : "Loading the current cash position.";
  }
  if (report === "wip") {
    return wip
      ? `${wip.summary.projectCount} project positions account for ${formatCurrency(wip.summary.contractValue, true)} in contract value.`
      : "Loading the current work-in-progress position.";
  }
  return accounting
    ? `${formatCurrency(accounting.reconciliation.dollarsAtRisk, true)} is tied to ${accounting.reconciliation.duplicateCount + accounting.reconciliation.onHoldCount + accounting.reconciliation.syncIssueCount} reconciliation items.`
    : "Loading the latest reconciliation position.";
}

function getRows(
  report: AccountingDetailKey,
  accounting: ReturnType<typeof useAccountingDashboard>["data"],
  wip: ReturnType<typeof useWipPortfolio>["data"],
): string[][] {
  if (report === "cash-flow" && accounting) {
    return [
      ["Net cash position", formatCurrency(accounting.cashPosition.netCashPosition), "Outstanding receivables less outstanding payables."],
      ["AR outstanding", formatCurrency(accounting.cashPosition.totalArOutstanding), `${accounting.arAging.totalOutstanding ? "Open AR aging total from Acumatica." : "No outstanding AR was returned."}`],
      ["AP outstanding", formatCurrency(accounting.cashPosition.totalApOutstanding), "Open AP aging total from Acumatica."],
      ["Payments received this month", formatCurrency(accounting.cashPosition.paymentsReceivedThisMonth), "Current-month customer cash receipts."],
      ["Checks issued this month", formatCurrency(accounting.cashPosition.checksIssuedThisMonth), "Current-month vendor disbursements."],
    ];
  }
  if (report === "wip" && wip) {
    return wip.rows
      .slice()
      .sort((a, b) => Math.abs(b.overUnderBilling) - Math.abs(a.overUnderBilling))
      .slice(0, 10)
      .map((row) => [
        row.projectDescription || row.projectCode,
        formatCurrency(row.overUnderBilling),
        `${row.wipPosition === "balanced" ? "Balanced" : row.wipPosition === "overbilled" ? "Over billed" : "Under billed"}; ${formatCurrency(row.earnedRevenue)} earned versus ${formatCurrency(row.billedToDate)} billed.`,
      ]);
  }
  if (report === "reconciliation" && accounting) {
    return [
      ["Dollars at risk", formatCurrency(accounting.reconciliation.dollarsAtRisk), "Value associated with reconciliation exceptions."],
      ["Possible duplicates", String(accounting.reconciliation.duplicateCount), "Candidate duplicate bills requiring source review."],
      ["Bills on hold", String(accounting.reconciliation.onHoldCount), "Held items requiring disposition before payment."],
      ["Sync differences", String(accounting.reconciliation.syncIssueCount), "Records whose connected-system states do not agree."],
      ["Last reconciliation run", formatDateTime(accounting.reconciliation.lastRunAt), "Timestamp supplied by the reconciliation owner."],
    ];
  }
  return [];
}

function getChart(
  report: AccountingDetailKey,
  accounting: ReturnType<typeof useAccountingDashboard>["data"],
  wip: ReturnType<typeof useWipPortfolio>["data"],
) {
  if (report === "cash-flow") {
    const buckets = accounting?.arAging;
    return {
      title: "Outstanding AR by aging bucket",
      category: "Outstanding AR",
      currency: true,
      data: buckets
        ? [buckets.current, buckets.days31to60, buckets.days61to90, buckets.days90plus].map((bucket) => ({ date: bucket.label.replace(" days", ""), "Outstanding AR": bucket.total }))
        : [],
    };
  }
  if (report === "wip") {
    const counts = { overbilled: 0, underbilled: 0, balanced: 0 };
    for (const row of wip?.rows ?? []) counts[row.wipPosition] += 1;
    return {
      title: "Projects by WIP position",
      category: "Projects",
      currency: false,
      data: [
        { date: "Over billed", Projects: counts.overbilled },
        { date: "Under billed", Projects: counts.underbilled },
        { date: "Balanced", Projects: counts.balanced },
      ],
    };
  }
  return {
    title: "Open items by reconciliation class",
    category: "Items",
    currency: false,
    data: accounting
      ? [
          { date: "Duplicates", Items: accounting.reconciliation.duplicateCount },
          { date: "On hold", Items: accounting.reconciliation.onHoldCount },
          { date: "Sync issues", Items: accounting.reconciliation.syncIssueCount },
        ]
      : [],
  };
}
