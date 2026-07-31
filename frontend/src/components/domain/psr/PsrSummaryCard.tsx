"use client";

import { KpiBlock } from "@/components/ds/kpi";
import { SectionRuleHeading } from "@/components/layout/spacing";
import type {
  PsrProjectInfo,
  PsrOpenItemCounts,
  PsrMonthlyBilling,
} from "@/types/psr.types";

interface PsrSummaryCardProps {
  projectInfo: PsrProjectInfo;
  openItems: PsrOpenItemCounts;
  monthlyBilling: PsrMonthlyBilling[];
  month: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function PsrSummaryCard({
  projectInfo,
  openItems,
  monthlyBilling,
}: PsrSummaryCardProps) {
  return (
    <div className="space-y-8">
      {/* PROJECT INFORMATION */}
      <section>
        <SectionRuleHeading label="Project Information" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <InfoField label="Project Start Date" value={formatDate(projectInfo.startDate)} />
          <InfoField label="Project Completion Date" value={formatDate(projectInfo.completionDate)} />
          <InfoField label="Original Budget" value={formatCurrency(projectInfo.contractBudget)} />
          <InfoField label="Current Budget" value={formatCurrency(projectInfo.currentBudget)} />
          <InfoField label="Current Projected Profit" value={formatCurrency(projectInfo.currentProjectedProfit)} />
          <InfoField label="Original Fee" value={formatCurrency(projectInfo.originalFee)} />
          <InfoField label="Current Fee" value={formatCurrency(projectInfo.currentFee)} />
          <InfoField label="Original Insurance" value={formatCurrency(projectInfo.originalInsurance)} />
          <InfoField label="Current Insurance" value={formatCurrency(projectInfo.currentInsurance)} />
          <InfoField label="Current Unallocated Costs" value={formatCurrency(projectInfo.currentUnallocatedCosts)} />
          <InfoField label="Current Owner Contingency" value={formatCurrency(projectInfo.currentOwnerContingency)} />
          <InfoField label="Remaining Buyout" value={formatCurrency(projectInfo.remainingBuyout)} />
          <InfoField label="Job to Date Cost" value={formatCurrency(projectInfo.jobToDateCost)} />
        </div>
      </section>

      {/* OPEN ITEMS */}
      <section>
        <SectionRuleHeading label="Open Items" />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          <KpiBlock label="Open RFIs" value={String(openItems.openRfis)} size="small" />
          <KpiBlock label="Open Submittals" value={String(openItems.openSubmittals)} size="small" />
          <KpiBlock label="Open CEs Not in PCO" value={String(openItems.openCEsNotInPCO)} size="small" />
          <KpiBlock label="Open PCCOs" value={String(openItems.openPCCOs)} size="small" />
          <KpiBlock label="Sub COs Not Funded" value={String(openItems.subCOsNotFunded)} size="small" />
          <KpiBlock label="Open PCOs" value={String(openItems.openPCOs)} size="small" />
        </div>
      </section>

      {/* MONTHLY BILLING */}
      {monthlyBilling.length > 0 && (
        <section>
          <SectionRuleHeading label="Monthly Billing" />
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground"></th>
                  {monthlyBilling.map((b) => (
                    <th
                      key={b.month}
                      className="px-4 py-2 text-right font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {b.monthLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <BillingRow
                  label="Owner Payments"
                  data={monthlyBilling}
                  getValue={(b) => formatCurrency(b.ownerPayments)}
                />
                <BillingRow
                  label="Owner Billing"
                  data={monthlyBilling}
                  getValue={(b) => formatCurrency(b.ownerBilling)}
                />
                <BillingRow
                  label="Sub Billing (invoices)"
                  data={monthlyBilling}
                  getValue={(b) => String(b.subBilling)}
                />
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function BillingRow({
  label,
  data,
  getValue,
}: {
  label: string;
  data: PsrMonthlyBilling[];
  getValue: (b: PsrMonthlyBilling) => string;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{label}</td>
      {data.map((b) => (
        <td key={b.month} className="px-4 py-2 text-right tabular-nums">
          {getValue(b)}
        </td>
      ))}
    </tr>
  );
}
