"use client";

import Link from "next/link";
import { ArrowUpRight, CircleAlert } from "lucide-react";

import { Heading } from "@/components/ds";
import { BarChart, LineChart } from "@/components/ui/charts";
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

export function AccountingOverviewPreview() {
  const accounting = useAccountingDashboard();
  const wip = useWipPortfolio();
  const trend = (accounting.data?.monthlyRevenueMargin ?? []).map((point) => ({
    date: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
      new Date(`${point.month}-01T12:00:00`),
    ),
    Revenue: point.revenue,
    Cost: point.cost,
    "Net margin": point.netMargin,
  }));
  const reviewCount = accounting.data
    ? accounting.data.reconciliation.duplicateCount +
      accounting.data.reconciliation.onHoldCount +
      accounting.data.reconciliation.syncIssueCount
    : 0;
  const aging = accounting.data
    ? [
        accounting.data.arAging.current,
        accounting.data.arAging.days31to60,
        accounting.data.arAging.days61to90,
        accounting.data.arAging.days90plus,
      ].map((bucket) => ({ date: bucket.label, Outstanding: bucket.total }))
    : [];
  const projectHealth = (wip.data?.rows ?? [])
    .map((row) => ({
      date: row.projectCode,
      "Forecast profit": row.forecastGrossProfit,
      "Under / over billed": row.overUnderBilling,
    }))
    .slice(0, 8);

  return (
    <>
      <WorkspacePageIntro
        eyebrow="Accounting"
        title={
          accounting.data
            ? `${formatCurrency(accounting.data.cashPosition.netCashPosition, true)} net cash position. ${reviewCount} reconciliation items need review.`
            : "Loading the current financial position."
        }
        statusLabel={
          accounting.data?.generatedAt
            ? `Accounting generated ${formatDateTime(accounting.data.generatedAt)}`
            : "Live accounting sources"
        }
      >
        This executive read uses the same Acumatica-backed accounting and WIP
        APIs as the canonical reports. Open the detailed report before changing
        a financial record.
      </WorkspacePageIntro>

      <WorkspaceSection
        eyebrow="Financial movement"
        title="Revenue, cost, and margin by month"
        className="mt-10 pt-0"
        showTopDivider={false}
        action={<CanonicalLink href="/accounting">Open accounting</CanonicalLink>}
      >
        {accounting.isLoading ? (
          <WorkspaceSourceState source="Accounting dashboard" state="loading" />
        ) : accounting.isError ? (
          <WorkspaceSourceState
            source="Accounting dashboard"
            state="error"
            detail={sourceError(accounting.error, "Accounting dashboard")}
          />
        ) : trend.length > 0 ? (
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <LineChart
              data={trend}
              categories={["Revenue", "Cost", "Net margin"]}
              colors={["primary", "muted", "hsl(var(--foreground))"]}
              valueFormatter={(value) => formatCurrency(value, true)}
              yAxisWidth={58}
              height="300px"
            />
          </div>
        ) : (
          <WorkspaceSourceState source="Accounting trend" state="empty" />
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Portfolio exposure"
        title="Project health and cost variance"
        className="mt-12"
      >
        {wip.isLoading || accounting.isLoading ? (
          <WorkspaceSourceState source="Portfolio accounting" state="loading" />
        ) : wip.isError || accounting.isError ? (
          <WorkspaceSourceState
            source="Portfolio accounting"
            state="error"
            detail={sourceError(wip.error ?? accounting.error, "Portfolio accounting")}
          />
        ) : projectHealth.length ? (
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <BarChart
              data={projectHealth}
              categories={["Forecast profit", "Under / over billed"]}
              colors={["primary", "hsl(var(--chart-3))"]}
              valueFormatter={(value) => formatCurrency(value, true)}
              height="300px"
            />
          </div>
        ) : (
          <WorkspaceSourceState source="Portfolio accounting" state="empty" />
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Receivables"
        title="Accounts receivable aging"
        className="mt-12"
        action={<CanonicalLink href="/accounting/invoices">Open invoices</CanonicalLink>}
      >
        {aging.length ? (
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <BarChart
              data={aging}
              categories={["Outstanding"]}
              colors={["hsl(var(--chart-2))"]}
              valueFormatter={(value) => formatCurrency(value, true)}
              height="260px"
            />
          </div>
        ) : (
          <WorkspaceSourceState source="Accounts receivable aging" state="empty" />
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Needs attention"
        title="Accounting exceptions"
        className="mt-12"
      >
        {accounting.isError ? (
          <WorkspaceSourceState source="Accounting exceptions" state="error" detail={sourceError(accounting.error, "Accounting exceptions")} />
        ) : accounting.data ? (
          <div className="divide-y divide-border">
            {[
              [accounting.data.reconciliation.duplicateCount, "Duplicate reconciliation candidates", "/accounting/reconciliation"],
              [accounting.data.reconciliation.onHoldCount, "Bills on hold", "/accounting/reconciliation"],
              [accounting.data.reconciliation.syncIssueCount, "Accounting sync issues", "/accounting/reconciliation"],
            ].map(([count, label, href]) => (
              <Link key={label as string} href={href as string} className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm hover:text-primary">
                <span className="flex items-center gap-2"><CircleAlert className="size-4 text-status-warning" />{label}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <WorkspaceSourceState source="Accounting exceptions" state="empty" />
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Financial position"
        title="Reports that explain the current numbers"
        className="mt-12"
      >
        <div className="divide-y divide-border">
          <AccountingReportRow
            title="Cash flow"
            href="/ai-dashboard/accounting/cash-flow"
            canonicalHref="/accounting"
            summary="Receivables, payables, current-month cash movement, and the net position."
            signal={
              accounting.data
                ? formatCurrency(accounting.data.cashPosition.netCashPosition)
                : "Source unavailable"
            }
          />
          <AccountingReportRow
            title="Work in progress"
            href="/ai-dashboard/accounting/wip"
            canonicalHref="/accounting/wip"
            summary="Contract value, earned revenue, billing position, and over or under billing by project."
            signal={
              wip.data
                ? `${wip.data.summary.projectCount} project positions`
                : "Source unavailable"
            }
          />
          <AccountingReportRow
            title="Reconciliation"
            href="/ai-dashboard/accounting/reconciliation"
            canonicalHref="/accounting/reconciliation"
            summary="Duplicate candidates, held bills, sync differences, and dollars at risk."
            signal={
              accounting.data
                ? formatCurrency(accounting.data.reconciliation.dollarsAtRisk)
                : "Source unavailable"
            }
          />
          <AccountingReportRow
            title="Project performance"
            href="/accounting/projects"
            canonicalHref="/accounting/projects"
            summary="Project-level revenue, cost, margin, and collection position."
            signal={
              accounting.data
                ? `${accounting.data.monthlyRevenueMargin.length} monthly periods`
                : "Source unavailable"
            }
          />
        </div>
      </WorkspaceSection>
    </>
  );
}

function AccountingReportRow({
  title,
  href,
  canonicalHref,
  summary,
  signal,
}: {
  title: string;
  href: string;
  canonicalHref: string;
  summary: string;
  signal: string;
}) {
  return (
    <article className="grid gap-3 py-5 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(0,1.7fr)_minmax(9rem,0.6fr)] sm:items-center">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {title}
        <ArrowUpRight className="size-3.5" />
      </Link>
      <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
      <div className="sm:text-right">
        <p className="text-sm font-medium text-primary">{signal}</p>
        <Link
          href={canonicalHref}
          className="mt-1 inline-flex min-h-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Canonical report
        </Link>
      </div>
    </article>
  );
}
