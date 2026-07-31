"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import type {
  CommitmentSovCleanupResponse,
  CommitmentSovCleanupRow,
} from "@/app/api/admin/commitment-sov-cleanup/route";

const REASON_LABELS: Record<CommitmentSovCleanupRow["reason"], string> = {
  ambiguous_typed_matches: "Ambiguous cost type",
  blank_code_nonzero_amount: "Blank code with amount",
  blank_code_zero_amount: "Blank code, zero amount",
  inactive_only_match: "Inactive match only",
  no_project_budget_code_match: "No project budget code",
  null_type_only_match: "Untyped match only",
  safe_typed_match_remaining: "Safe match remaining",
};

const TABLE_LABELS: Record<CommitmentSovCleanupRow["table"], string> = {
  purchase_order_sov_items: "Purchase order",
  subcontract_sov_items: "Subcontract",
};

function candidateLabels(row: CommitmentSovCleanupRow): string {
  const labels = row.typedCandidates.map((candidate) => candidate.label);
  if (labels.length > 0) return labels.join(", ");
  return row.otherCandidates.map((candidate) => candidate.label).join(", ");
}

function buildColumns(): TableColumn<CommitmentSovCleanupRow>[] {
  return [
    {
      id: "reason",
      label: "Reason",
      alwaysVisible: true,
      sortable: true,
      sortValue: (row) => row.reason,
      csvValue: (row) => row.reason,
      width: 190,
      render: (row) => (
        <span className="text-sm font-medium text-foreground">
          {REASON_LABELS[row.reason]}
        </span>
      ),
    },
    {
      id: "commitment",
      label: "Commitment",
      alwaysVisible: true,
      sortable: true,
      sortValue: (row) =>
        `${row.projectId}-${row.contractNumber ?? ""}-${row.parentTitle ?? ""}`,
      csvValue: (row) => row.commitmentHref,
      render: (row) => (
        <Link
          href={row.commitmentHref}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.contractNumber ?? row.parentTitle ?? row.parentId}
        </Link>
      ),
    },
    {
      id: "project",
      label: "Project",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.projectId,
      csvValue: (row) => String(row.projectId),
      width: 110,
      render: (row) => (
        <span className="text-sm tabular-nums text-foreground">{row.projectId}</span>
      ),
    },
    {
      id: "source",
      label: "Source",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => TABLE_LABELS[row.table],
      csvValue: (row) => TABLE_LABELS[row.table],
      width: 150,
      render: (row) => (
        <span className="text-sm text-foreground">{TABLE_LABELS[row.table]}</span>
      ),
    },
    {
      id: "budgetCode",
      label: "Legacy code",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.normalizedBudgetCode,
      csvValue: (row) => row.budgetCode ?? "",
      width: 140,
      render: (row) => (
        <span className="font-mono text-sm text-foreground">
          {row.budgetCode || "Blank"}
        </span>
      ),
    },
    {
      id: "amount",
      label: "Amount",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.amount ?? 0,
      csvValue: (row) => String(row.amount ?? 0),
      width: 140,
      render: (row) => (
        <span className="block text-right tabular-nums text-sm text-foreground">
          {formatCurrency(row.amount ?? 0)}
        </span>
      ),
    },
    {
      id: "description",
      label: "Description",
      defaultVisible: true,
      sortable: true,
      sortValue: (row) => row.description ?? "",
      csvValue: (row) => row.description ?? "",
      render: (row) => (
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {row.description || "—"}
        </span>
      ),
    },
    {
      id: "candidates",
      label: "Candidates",
      defaultVisible: true,
      csvValue: candidateLabels,
      render: (row) => {
        const labels = candidateLabels(row);
        return labels ? (
          <span className="line-clamp-2 text-sm text-muted-foreground" title={labels}>
            {labels}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/60">None</span>
        );
      },
    },
    {
      id: "action",
      label: "Required action",
      defaultVisible: true,
      csvValue: (row) => row.recommendedAction,
      render: (row) => (
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {row.recommendedAction}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: false,
      sortable: true,
      sortValue: (row) => row.parentStatus ?? "",
      csvValue: (row) => row.parentStatus ?? "",
      width: 120,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.parentStatus ?? "—"}
        </span>
      ),
    },
    {
      id: "rowId",
      label: "SOV row ID",
      defaultVisible: false,
      csvValue: (row) => row.id,
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
      ),
    },
  ];
}

function matchesSearch(row: CommitmentSovCleanupRow, search: string): boolean {
  if (!search) return true;
  const haystack = [
    row.reason,
    REASON_LABELS[row.reason],
    row.projectId,
    row.contractNumber,
    row.parentTitle,
    row.parentStatus,
    row.budgetCode,
    row.description,
    row.recommendedAction,
    candidateLabels(row),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export default function CommitmentSovCleanupPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CommitmentSovCleanupResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tableState = useUnifiedTableState({
    entityKey: "admin-commitment-sov-cleanup",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "reason",
      sortDirection: "asc",
      visibleColumns: [
        "reason",
        "commitment",
        "budgetCode",
        "amount",
        "description",
        "candidates",
        "action",
      ],
      filters: { table: undefined, reason: undefined },
    },
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch<CommitmentSovCleanupResponse>("/api/admin/commitment-sov-cleanup")
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError : new Error("Failed to load SOV cleanup rows."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.rows ?? [];
  const filteredRows = useMemo(() => {
    const tableFilter = tableState.activeFilters.table;
    const reasonFilter = tableState.activeFilters.reason;
    return rows.filter((row) => {
      if (typeof tableFilter === "string" && row.table !== tableFilter) return false;
      if (typeof reasonFilter === "string" && row.reason !== reasonFilter) return false;
      return matchesSearch(row, tableState.debouncedSearch);
    });
  }, [rows, tableState.activeFilters, tableState.debouncedSearch]);

  const handleFilterChange = (next: Record<string, FilterValue>) => {
    tableState.setActiveFilters(next);
  };

  return (
    <UnifiedTablePage
      header={{
        title: "Commitment SOV cleanup",
      }}
      toolbar={{
        totalItems: rows.length,
        filteredItems: filteredRows.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search code, project, commitment, reason...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table"],
        filters: [
          {
            id: "table",
            label: "Type",
            type: "select",
            options: [
              { value: "purchase_order_sov_items", label: "Purchase order" },
              { value: "subcontract_sov_items", label: "Subcontract" },
            ],
          },
          {
            id: "reason",
            label: "Reason",
            type: "select",
            options: Object.entries(REASON_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ],
        activeFilters: tableState.activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange({}),
        leftContent: data ? (
          <span className="text-sm text-muted-foreground">
            {data.summary.total} unresolved · {data.summary.byReason.ambiguous_typed_matches ?? 0} ambiguous ·{" "}
            {data.summary.byReason.no_project_budget_code_match ?? 0} missing budget code
          </span>
        ) : null,
      }}
      data={{
        items: filteredRows,
        isLoading,
        error,
      }}
      table={{
        columns: buildColumns(),
        getRowId: (row) => row.id,
        onRowClick: (row) => router.push(row.commitmentHref),
        density: "compact",
      }}
      features={{ enableRowSelection: false }}
      emptyState={{
        title: "No unresolved SOV rows",
        description: "Every commitment SOV row currently has a project budget-code FK.",
        filteredDescription: "No unresolved SOV rows match the current filters.",
        isFiltered:
          Boolean(tableState.debouncedSearch) ||
          Object.values(tableState.activeFilters).some(Boolean),
      }}
    />
  );
}
