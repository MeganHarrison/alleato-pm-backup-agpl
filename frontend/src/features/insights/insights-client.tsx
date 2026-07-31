"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import {
  CellDate,
  CellText,
} from "@/components/tables/unified/table-primitives";
import { InsightsBoardView } from "./insights-board-view";
import { InsightsSplitView } from "./insights-split-view";
import type { InsightRow } from "./insights-types";
import { SEVERITY_VARIANT_MAP, STATUS_VARIANT_MAP } from "./insights-types";

const INSIGHT_FILTERS = [
  {
    id: "type",
    label: "Type",
    type: "select" as const,
    options: [
      { value: "risk", label: "Risk" },
      { value: "blocker", label: "Blocker" },
      { value: "financial_exposure", label: "Financial Exposure" },
      { value: "schedule_risk", label: "Schedule Risk" },
      { value: "decision", label: "Decision" },
      { value: "change_management", label: "Change Management" },
      { value: "task", label: "Task" },
      { value: "open_question", label: "Open Question" },
      { value: "requirement", label: "Requirement" },
      { value: "process_issue", label: "Process Issue" },
      { value: "product_need", label: "Product Need" },
      { value: "project_update", label: "Project Update" },
    ],
  },
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { value: "open", label: "Open" },
      { value: "blocked", label: "Blocked" },
      { value: "needs_review", label: "Needs Review" },
      { value: "stale", label: "Stale" },
      { value: "resolved", label: "Resolved" },
    ],
  },
  {
    id: "severity",
    label: "Severity",
    type: "select" as const,
    options: [
      { value: "critical", label: "Critical" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
  },
];

const SEARCH_FIELDS: (keyof InsightRow)[] = [
  "title",
  "description",
  "project_name",
  "owner",
];

const TABLE_COLUMNS: TableColumn<InsightRow>[] = [
  {
    id: "title",
    label: "Title",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.title,
    render: (item) => <CellText value={item.title} />,
    csvValue: (item) => item.title,
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,
    sortable: false,
    render: (item) => (
      <CellText
        value={
          item.description?.length > 100
            ? `${item.description.slice(0, 100)}…`
            : item.description
        }
      />
    ),
    csvValue: (item) => item.description,
  },
  {
    id: "type",
    label: "Type",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.type,
    render: (item) => (
      <Badge variant="outline" className="capitalize">
        {item.type.replace(/_/g, " ")}
      </Badge>
    ),
    csvValue: (item) => item.type,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.status,
    render: (item) => (
      <Badge
        variant={
          (STATUS_VARIANT_MAP[item.status] as
            | "destructive"
            | "default"
            | "outline"
            | "secondary") ?? "outline"
        }
        className="capitalize"
      >
        {item.status.replace(/_/g, " ")}
      </Badge>
    ),
    csvValue: (item) => item.status,
  },
  {
    id: "severity",
    label: "Severity",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.severity,
    render: (item) => (
      <Badge
        variant={
          (SEVERITY_VARIANT_MAP[item.severity] as
            | "destructive"
            | "default"
            | "outline"
            | "secondary") ?? "outline"
        }
        className="capitalize"
      >
        {item.severity}
      </Badge>
    ),
    csvValue: (item) => item.severity,
  },
  {
    id: "owner",
    label: "Owner",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.owner,
    render: (item) => <CellText value={item.owner || null} />,
    csvValue: (item) => item.owner,
  },
  {
    id: "confidence",
    label: "Confidence",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.confidence,
    render: (item) => (
      <Badge variant="outline" className="capitalize">
        {item.confidence}
      </Badge>
    ),
    csvValue: (item) => item.confidence,
  },
  {
    id: "project_name",
    label: "Project",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.project_name,
    render: (item) => <CellText value={item.project_name || null} />,
    csvValue: (item) => item.project_name,
  },
  {
    id: "next_action",
    label: "Next Action",
    defaultVisible: false,
    sortable: false,
    render: (item) => <CellText value={item.next_action || null} />,
    csvValue: (item) => item.next_action,
  },
  {
    id: "why_it_matters",
    label: "Why It Matters",
    defaultVisible: false,
    sortable: false,
    render: (item) => <CellText value={item.why_it_matters || null} />,
    csvValue: (item) => item.why_it_matters,
  },
  {
    id: "created_at",
    label: "Created",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.created_at,
    render: (item) => <CellDate value={item.created_at} />,
    csvValue: (item) => item.created_at,
  },
];

const DEFAULT_VISIBLE = TABLE_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.id);

const EMPTY_FILTERS: Record<string, FilterValue> = {
  type: undefined,
  status: undefined,
  severity: undefined,
};

function matchesSearch(item: InsightRow, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  return SEARCH_FIELDS.some((field) =>
    String(item[field] ?? "")
      .toLowerCase()
      .includes(lower),
  );
}

function matchesFilters(
  item: InsightRow,
  filters: Record<string, FilterValue>,
): boolean {
  if (
    filters.type !== undefined &&
    filters.type !== null &&
    filters.type !== ""
  ) {
    if (item.type !== String(filters.type)) return false;
  }
  if (
    filters.status !== undefined &&
    filters.status !== null &&
    filters.status !== ""
  ) {
    if (item.status !== String(filters.status)) return false;
  }
  if (
    filters.severity !== undefined &&
    filters.severity !== null &&
    filters.severity !== ""
  ) {
    if (item.severity !== String(filters.severity)) return false;
  }
  return true;
}

interface InsightsClientProps {
  data: InsightRow[];
  /** Override the page header. Defaults to the AI Insights heading. */
  header?: { title: string; description: string };
  /** Distinct table-state key so reused surfaces don't share URL/filter state. */
  entityKey?: string;
}

const DEFAULT_HEADER = {
  title: "AI Insights",
  description: "AI-generated insights from meetings and documents",
};

export function InsightsClient({
  data,
  header = DEFAULT_HEADER,
  entityKey = "ai-insights",
}: InsightsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tableState = useUnifiedTableState({
    entityKey,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "board", "split"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = tableState.activeFilters;

  const filteredItems = React.useMemo(() => {
    const term = tableState.debouncedSearch.trim();
    return data.filter(
      (item) => matchesSearch(item, term) && matchesFilters(item, activeFilters),
    );
  }, [data, tableState.debouncedSearch, activeFilters]);

  const handleFilterChange = (filters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(filters);
    tableState.setPage(1);
  };

  const isFiltered =
    tableState.debouncedSearch.trim().length > 0 ||
    Object.values(activeFilters).some(
      (v) => v !== undefined && v !== null && v !== "",
    );

  return (
    <UnifiedTablePage
      header={header}
      toolbar={{
        totalItems: data.length,
        filteredItems: filteredItems.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search insights...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "board", "split"],
        filters: INSIGHT_FILTERS,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: filteredItems,
        isLoading: false,
        error: null,
      }}
      table={{
        columns: TABLE_COLUMNS,
        getRowId: (item) => item.id,
        onRowClick: (item) => router.push(`/insights/${item.id}`),
        stickyHeader: true,
        density: "compact",
      }}
      views={{
        board: ({ items }) => (
          <InsightsBoardView items={items as InsightRow[]} />
        ),
        split: ({ items }) => (
          <InsightsSplitView items={items as InsightRow[]} />
        ),
      }}
      pagination={{
        page: tableState.page,
        totalPages: Math.max(1, Math.ceil(filteredItems.length / tableState.perPage)),
        perPage: tableState.perPage,
        clientSide: true,
        onPageChange: tableState.setPage,
        onPerPageChange: (value) => {
          tableState.setPerPage(Number(value));
          tableState.setPage(1);
        },
      }}
      emptyState={{
        title: "No AI insights found",
        description: "No AI-generated insights have been created yet.",
        filteredDescription: "No insights match the current search or filters.",
        isFiltered,
      }}
      features={{
        enableViews: true,
        enableColumnToggle: true,
        enableExport: true,
        enableFilters: true,
        enablePagination: true,
        enableRowSelection: false,
        enableRowActions: false,
      }}
      layout={{ fullBleedTable: true }}
    />
  );
}
