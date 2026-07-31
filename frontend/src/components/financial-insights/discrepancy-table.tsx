"use client";

import { GitCompareArrows } from "lucide-react";
import { DataTable, EmptyState, KpiRow } from "@/components/ds";
import type { TableColumn } from "@/components/ds";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossReferenceLineItem {
  costCode: string;
  description: string;
  alleatoBudget: number;
  acumaticaActual: number;
  acumaticaCommitted: number;
  variance: number;
}

export interface CrossReferenceResult {
  project: {
    id: number;
    name: string;
    acumaticaProjectId: string;
  };
  summary: {
    alleatoTotal: number;
    acumaticaTotal: number;
    variance: number;
    variancePercent: number;
  };
  lineItems: CrossReferenceLineItem[];
}

// Internal row type for DataTable (requires id)
interface LineItemRow extends CrossReferenceLineItem {
  id: string;
}

export interface DiscrepancyTableProps {
  data: CrossReferenceResult | null;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  return percentFormatter.format(value / 100);
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columns: TableColumn<LineItemRow>[] = [
  {
    key: "costCode",
    header: "Cost Code",
    width: "w-32",
    primary: true,
    render: (row) => (
      <span className="font-mono text-sm font-medium text-foreground">
        {row.costCode}
      </span>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.description}</span>
    ),
  },
  {
    key: "alleatoBudget",
    header: "Alleato Budget",
    align: "right",
    width: "w-36",
    render: (row) => (
      <span className="tabular-nums text-sm text-foreground">
        {formatCurrency(row.alleatoBudget)}
      </span>
    ),
  },
  {
    key: "acumaticaActual",
    header: "Acumatica Actual",
    align: "right",
    width: "w-36",
    render: (row) => (
      <span className="tabular-nums text-sm text-foreground">
        {formatCurrency(row.acumaticaActual)}
      </span>
    ),
  },
  {
    key: "acumaticaCommitted",
    header: "Acumatica Committed",
    align: "right",
    width: "w-40",
    render: (row) => (
      <span className="tabular-nums text-sm text-foreground">
        {formatCurrency(row.acumaticaCommitted)}
      </span>
    ),
  },
  {
    key: "variance",
    header: "Variance",
    align: "right",
    width: "w-32",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums text-sm font-medium",
          row.variance < 0 ? "text-destructive" : "text-foreground"
        )}
      >
        {formatCurrency(row.variance)}
      </span>
    ),
  },
];

// ---------------------------------------------------------------------------
// DiscrepancyTable Component
// ---------------------------------------------------------------------------

export function DiscrepancyTable({ data, isLoading }: DiscrepancyTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={<GitCompareArrows className="h-6 w-6 text-muted-foreground" />}
        title="No discrepancy data available"
        description="Select a project and run a cross-reference check to compare Alleato and Acumatica budget data."
      />
    );
  }

  const { summary, lineItems } = data;

  const summaryMetrics = [
    {
      label: "Alleato Budget",
      value: formatCurrency(summary.alleatoTotal),
    },
    {
      label: "Acumatica Total",
      value: formatCurrency(summary.acumaticaTotal),
    },
    {
      label: "Variance",
      value: formatCurrency(summary.variance),
      delta:
        summary.variance !== 0
          ? {
              value: formatPercent(Math.abs(summary.variancePercent)),
              positive: summary.variance > 0,
            }
          : undefined,
    },
  ];

  const rows: LineItemRow[] = lineItems.map((item, index) => ({
    ...item,
    id: `${item.costCode}-${index}`,
  }));

  return (
    <div className="space-y-6">
      <KpiRow metrics={summaryMetrics} />
      <DataTable<LineItemRow>
        columns={columns}
        rows={rows}
        emptyMessage="No line items found for this project."
      />
    </div>
  );
}
