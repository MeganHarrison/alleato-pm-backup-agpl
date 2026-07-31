"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/layout";
import { InfoAlert, StatusBadge } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type DirectCostRow = {
  id: number;
  referenceNbr: string;
  documentType: string | null;
  vendorId: string | null;
  vendorRef: string | null;
  date: string | null;
  month: string;
  status: string | null;
  description: string | null;
  amount: number;
  projectCode: string | null;
  category: string | null;
  categoryLabel: string | null;
  confidence: number;
  classificationSource: string;
  operatingArea: string;
  operatingAreaLabel: string;
  operatingAreaSource: string;
  flags: string[];
  sourceHref: string | null;
  needsReview: boolean;
};

type DirectCostResponse = {
  generatedAt: string;
  window: {
    startDate: string;
    endDate: string;
    months: string[];
  };
  totals: {
    includedSpend: number;
    includedBillCount: number;
    reviewCount: number;
  };
  areaTotals: Array<{
    area: string;
    areaLabel: string;
    total: number;
    billCount: number;
    reviewCount: number;
  }>;
  rows: DirectCostRow[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AccountingDirectCostsPage() {
  const [data, setData] = React.useState<DirectCostResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    apiFetch<DirectCostResponse>("/api/accounting/direct-costs")
      .then((result) => setData(result))
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load accounting direct costs.",
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedRows = React.useMemo(() => {
    const groups = new Map<string, { areaLabel: string; rows: DirectCostRow[] }>();
    for (const row of data?.rows ?? []) {
      const current = groups.get(row.operatingArea) ?? {
        areaLabel: row.operatingAreaLabel,
        rows: [],
      };
      current.rows.push(row);
      groups.set(row.operatingArea, current);
    }
    return (data?.areaTotals ?? []).map((area) => ({
      ...area,
      rows: groups.get(area.area)?.rows ?? [],
    }));
  }, [data]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageShell
        variant="table"
        title="Direct Costs"
        actions={
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Operating direct costs</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Classified Acumatica AP bills that count as company operating spend, not project-coded costs.
              Rows stay grouped by operating area so accounting can scan software, payroll, travel, executive,
              and office spend without a second taxonomy.
            </p>
            {data ? (
              <p className="text-xs text-muted-foreground">
                {data.window.startDate} through {data.window.endDate}, refreshed {formatDateTime(data.generatedAt)}.
              </p>
            ) : null}
          </section>

          {error ? (
            <InfoAlert variant="error" role="alert">
              {error}
            </InfoAlert>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-foreground">Area totals</h2>
              {data ? (
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.totals.includedSpend)} across {data.totals.includedBillCount} bills,
                  {` ${data.totals.reviewCount}`} marked for review
                </p>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Area</th>
                    <th className="px-4 py-3 text-right font-semibold">Spend</th>
                    <th className="px-4 py-3 text-right font-semibold">Bills</th>
                    <th className="px-4 py-3 text-right font-semibold">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                        Loading direct costs…
                      </td>
                    </tr>
                  ) : groupedRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                        No operating direct costs found for this window.
                      </td>
                    </tr>
                  ) : (
                    groupedRows.map((group) => (
                      <tr key={group.area}>
                        <td className="px-4 py-3 font-medium text-foreground">{group.areaLabel}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(group.total)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {group.billCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {group.reviewCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-foreground">Bills grouped by area</h2>
              <Link href="/accounting/bills" className="text-sm font-medium text-muted-foreground hover:text-primary">
                Open AP Bills
              </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-left font-semibold">Classifier</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                        Loading grouped bills…
                      </td>
                    </tr>
                  ) : groupedRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-muted-foreground" colSpan={7}>
                        No operating direct costs found for this window.
                      </td>
                    </tr>
                  ) : (
                    groupedRows.flatMap((group) => [
                      <tr key={`${group.area}-header`} className="bg-background">
                        <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={6}>
                          {group.areaLabel}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {formatCurrency(group.total)}
                        </td>
                      </tr>,
                      ...group.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3 text-foreground">{formatDate(row.date)}</td>
                          <td className="px-4 py-3">
                            {row.sourceHref ? (
                              <a
                                href={row.sourceHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs font-medium text-primary hover:underline"
                              >
                                {row.referenceNbr}
                                <ArrowRight className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground">{row.referenceNbr}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground">{row.vendorId ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="space-y-1">
                              <p className="text-sm text-foreground">{row.description ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.documentType ?? "Bill"}
                                {row.vendorRef ? `, vendor ref ${row.vendorRef}` : ""}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm text-foreground">{row.categoryLabel ?? "Unclassified"}</p>
                              <p className="text-xs text-muted-foreground">
                                {Math.round(row.confidence * 100)}% confidence, {row.classificationSource}
                              </p>
                              {row.needsReview ? (
                                <Badge variant="outline" className="text-[11px]">
                                  Review needed
                                </Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.status ? (
                              <StatusBadge status={row.status} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      )),
                    ])
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </PageShell>
    </div>
  );
}
