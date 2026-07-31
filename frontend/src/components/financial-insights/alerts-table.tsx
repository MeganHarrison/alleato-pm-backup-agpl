"use client";

import { ShieldAlert, GitCompareArrows } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DataTable, EmptyState, StatusBadge } from "@/components/ds";
import type { TableColumn } from "@/components/ds";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinancialAlert {
  id: number;
  title: string;
  description: string;
  severity: string | null;
  insight_type: string | null;
  confidence_score: number | null;
  financial_impact: number | null;
  project_id: number | null;
  project_name: string | null;
  status: string | null;
  created_at: string | null;
}

export interface AlertsTableProps {
  alerts: FinancialAlert[];
  isLoading?: boolean;
  onCrossReference?: (projectId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function sortAlerts(alerts: FinancialAlert[]): FinancialAlert[] {
  return [...alerts].sort((a, b) => {
    const aSeverity = SEVERITY_ORDER[a.severity?.toLowerCase() ?? ""] ?? 99;
    const bSeverity = SEVERITY_ORDER[b.severity?.toLowerCase() ?? ""] ?? 99;
    if (aSeverity !== bSeverity) return aSeverity - bSeverity;
    // Secondary sort: financial impact descending
    return (b.financial_impact ?? 0) - (a.financial_impact ?? 0);
  });
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function getColumns(onCrossReference?: (projectId: number) => void): TableColumn<FinancialAlert>[] {
  const cols: TableColumn<FinancialAlert>[] = [
    {
      key: "severity",
      header: "Severity",
      width: "w-28",
      render: (row) =>
        row.severity ? (
          <StatusBadge status={row.severity} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "project_name",
      header: "Project",
      width: "w-48",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.project_name ?? "—"}
        </span>
      ),
    },
    {
      key: "title",
      header: "Alert",
      primary: true,
      render: (row) => (
        <span
          className="block font-medium text-foreground"
          title={row.description ?? undefined}
        >
          {row.title}
        </span>
      ),
    },
    {
      key: "financial_impact",
      header: "Financial Impact",
      align: "right",
      width: "w-36",
      render: (row) =>
        row.financial_impact != null ? (
          <span className="tabular-nums text-sm text-foreground">
            {currencyFormatter.format(row.financial_impact)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-28",
      render: (row) =>
        row.status ? (
          <StatusBadge status={row.status} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "created_at",
      header: "Created",
      align: "right",
      width: "w-32",
      render: (row) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {formatRelativeDate(row.created_at)}
        </span>
      ),
    },
  ];

  if (onCrossReference) {
    cols.push({
      key: "actions",
      header: "",
      width: "w-24",
      align: "right",
      render: (row) =>
        row.project_id ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCrossReference(row.project_id!);
            }}
            className="gap-1.5 text-xs"
          >
            <GitCompareArrows />
            Compare
          </Button>
        ) : null,
    });
  }

  return cols;
}

// ---------------------------------------------------------------------------
// AlertsTable Component
// ---------------------------------------------------------------------------

export function AlertsTable({ alerts, isLoading, onCrossReference }: AlertsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6 text-muted-foreground" />}
        title="No financial alerts found"
        description="Run a portfolio scan to detect issues."
      />
    );
  }

  const sorted = sortAlerts(alerts);
  const columns = getColumns(onCrossReference);

  return (
    <DataTable<FinancialAlert>
      columns={columns}
      rows={sorted}
    />
  );
}
