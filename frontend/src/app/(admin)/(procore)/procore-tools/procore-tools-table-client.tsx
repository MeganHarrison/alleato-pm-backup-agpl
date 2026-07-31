"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { AppWindow, Building2, GraduationCap, MoreVertical } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";

export interface ProcoreToolRow {
  id?: number;
  name: string | null;
  slug: string | null;
  category: string | null;
  status: string | null;
  description: string | null;
  new_link?: string | null;
  procore_link?: string | null;
  prp_path?: string | null;
  tutorials?: string | null;
  action_buttons?: string | null;
  test_results?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ProcoreToolsTableClientProps {
  tools: ProcoreToolRow[];
}

const TOOL_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Tool", alwaysVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "slug", label: "Slug", defaultVisible: true },
  { id: "description", label: "Description", defaultVisible: false },
  { id: "links", label: "Links", defaultVisible: true },
  { id: "prp_path", label: "PRP Path", defaultVisible: false },
  { id: "action_buttons", label: "Actions", defaultVisible: false },
  { id: "test_results", label: "Test Results", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: false },
  { id: "updated_at", label: "Updated", defaultVisible: false },
];

const TOOL_FILTERS: FilterConfig[] = [
  {
    id: "category",
    label: "Category",
    type: "select",
    options: [
      { value: "Admin", label: "Admin" },
      { value: "Core Tools", label: "Core Tools" },
      { value: "Financial", label: "Financial" },
      { value: "Project Mgmt", label: "Project Mgmt" },
    ],
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "Not started", label: "Not Started" },
      { value: "Implementation", label: "Implementation" },
      { value: "Running Tests", label: "Running Tests" },
      { value: "Generating Tests", label: "Generating Tests" },
      { value: "Testing", label: "Testing" },
      { value: "Review", label: "Review" },
    ],
  },
];

const DEFAULT_VISIBLE_COLUMNS = TOOL_COLUMNS.filter(
  (column) => column.defaultVisible !== false,
).map((column) => column.id);

const EMPTY_FILTERS: Record<string, FilterValue> = {
  category: undefined,
  status: undefined,
};

function toDisplayValue(value: string | null | undefined): string {
  return value?.trim() || "-";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function renderLinkIcon(
  value: string | null | undefined,
  label: string,
  icon: React.ComponentType<{ className?: string }>,
): ReactElement {
  if (!value?.trim()) {
    return <span className="text-muted-foreground">-</span>;
  }

  const Icon = icon;

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={(event) => event.stopPropagation()}
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

function categoryVariant(
  category: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  switch (category) {
    case "Admin":
      return "secondary";
    case "Core Tools":
      return "default";
    case "Financial":
      return "destructive";
    case "Project Mgmt":
      return "outline";
    default:
      return "outline";
  }
}

function statusVariant(
  status: string | null,
): "default" | "secondary" | "success" | "outline" {
  switch (status) {
    case "Implementation":
      return "default";
    case "Running Tests":
    case "Generating Tests":
    case "Testing":
      return "secondary";
    case "Review":
      return "success";
    default:
      return "outline";
  }
}

function buildToolColumns(): TableColumn<ProcoreToolRow>[] {
  return [
    {
      ...TOOL_COLUMNS[0],
      render: (item) => <span className="font-medium">{toDisplayValue(item.name)}</span>,
      sortValue: (item) => toDisplayValue(item.name),
    },
    {
      ...TOOL_COLUMNS[1],
      render: (item) => (
        <Badge variant={categoryVariant(item.category)}>
          {toDisplayValue(item.category)}
        </Badge>
      ),
      sortValue: (item) => toDisplayValue(item.category),
    },
    {
      ...TOOL_COLUMNS[2],
      render: (item) => (
        <Badge variant={statusVariant(item.status)}>{toDisplayValue(item.status)}</Badge>
      ),
      sortValue: (item) => toDisplayValue(item.status),
    },
    {
      ...TOOL_COLUMNS[3],
      render: (item) => <span>{toDisplayValue(item.slug)}</span>,
      sortValue: (item) => toDisplayValue(item.slug),
    },
    {
      ...TOOL_COLUMNS[4],
      render: (item) => <span>{toDisplayValue(item.description)}</span>,
      sortValue: (item) => toDisplayValue(item.description),
    },
    {
      ...TOOL_COLUMNS[5],
      render: (item) => {
        const hasAppLink = Boolean(item.new_link?.trim());
        const hasProcoreLink = Boolean(item.procore_link?.trim());
        const hasTutorialLink = Boolean(item.tutorials?.trim());

        if (!hasAppLink && !hasProcoreLink && !hasTutorialLink) {
          return <span className="text-muted-foreground">-</span>;
        }

        return (
          <div className="flex items-center gap-1">
            {hasAppLink
              ? renderLinkIcon(item.new_link, "Open Alleato page", AppWindow)
              : null}
            {hasProcoreLink
              ? renderLinkIcon(item.procore_link, "Open Procore page", Building2)
              : null}
            {hasTutorialLink
              ? renderLinkIcon(item.tutorials, "Open tutorial", GraduationCap)
              : null}
          </div>
        );
      },
      sortValue: (item) =>
        [
          toDisplayValue(item.new_link),
          toDisplayValue(item.procore_link),
          toDisplayValue(item.tutorials),
        ].join(" "),
    },
    {
      ...TOOL_COLUMNS[6],
      render: (item) => <span>{toDisplayValue(item.prp_path)}</span>,
      sortValue: (item) => toDisplayValue(item.prp_path),
    },
    {
      ...TOOL_COLUMNS[7],
      render: (item) => <span>{toDisplayValue(item.action_buttons)}</span>,
      sortValue: (item) => toDisplayValue(item.action_buttons),
    },
    {
      ...TOOL_COLUMNS[8],
      render: (item) => <span>{toDisplayValue(item.test_results)}</span>,
      sortValue: (item) => toDisplayValue(item.test_results),
    },
    {
      ...TOOL_COLUMNS[9],
      render: (item) => <span>{formatDate(item.created_at)}</span>,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
    {
      ...TOOL_COLUMNS[10],
      render: (item) => <span>{formatDate(item.updated_at)}</span>,
      sortValue: (item) => (item.updated_at ? new Date(item.updated_at).getTime() : 0),
    },
  ];
}

function matchesSearch(item: ProcoreToolRow, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return [item.name, item.description, item.slug, item.category, item.status]
    .map((value) => value?.toLowerCase() ?? "")
    .some((value) => value.includes(normalized));
}

function getToolRowId(item: ProcoreToolRow): string {
  if (item.id !== null && item.id !== undefined) return String(item.id);
  if (item.slug) return `slug:${item.slug}`;
  if (item.name) return `name:${item.name}`;
  return `tool:${toDisplayValue(item.category)}:${toDisplayValue(item.status)}`;
}

export function ProcoreToolsTableClient({
  tools,
}: ProcoreToolsTableClientProps): ReactElement {
  const pathname = usePathname()!;
  const rawSearchParams = useSearchParams()!;
  const searchParams = rawSearchParams ?? new URLSearchParams();
  const router = useRouter();

  const initialFilters: Record<string, FilterValue> = {
    category: searchParams.get("category") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "procore-tools",
    searchParams: rawSearchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "category",
      sortDirection: "asc",
      filters: initialFilters,
    },
  });

  React.useEffect(() => {
    if (tableState.visibleColumns.length === 0) {
      tableState.setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }
  }, [tableState.visibleColumns.length, tableState.setVisibleColumns]);

  React.useEffect(() => {
    tableState.setActiveFilters({
      category: searchParams.get("category") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
  }, [searchParams, tableState.setActiveFilters]);

  const activeFilters = tableState.activeFilters;
  const tableColumns = React.useMemo(() => buildToolColumns(), []);

  const filteredTools = React.useMemo(() => {
    return tools.filter((item) => {
      const categoryMatch =
        !activeFilters.category ||
        item.category === String(activeFilters.category);
      const statusMatch =
        !activeFilters.status || item.status === String(activeFilters.status);
      const searchMatch = matchesSearch(item, tableState.debouncedSearch);
      return categoryMatch && statusMatch && searchMatch;
    });
  }, [activeFilters.category, activeFilters.status, tableState.debouncedSearch, tools]);

  const handleFilterChange = (nextFilters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      category:
        typeof nextFilters.category === "string" ? nextFilters.category : null,
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      page: "1",
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(filteredTools.map(getToolRowId));
      return;
    }
    tableState.setSelectedIds([]);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((previous) => [...previous, id]);
      return;
    }
    tableState.setSelectedIds((previous) => previous.filter((itemId) => itemId !== id));
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.category) ||
    Boolean(activeFilters.status);

  return (
    <UnifiedTablePage
      header={{
        title: "Procore Tools",
        description: "Track all Procore tool modules and implementation status",
      }}
      toolbar={{
        totalItems: tools.length,
        filteredItems: filteredTools.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search procore tools...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: TOOL_FILTERS,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: TOOL_COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: filteredTools,
        isLoading: false,
      }}
      table={{
        columns: tableColumns,
        getRowId: getToolRowId,
        onRowClick: (item) => {
          if (item.slug) {
            router.push(`/procore-tools${item.slug}`);
          }
        },
        rowActions: () => (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical />
          </Button>
        ),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      views={{
        card: (item) => (
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="font-medium">{toDisplayValue(item.name)}</h3>
              <Badge variant={statusVariant(item.status)}>
                {toDisplayValue(item.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{toDisplayValue(item.slug)}</p>
            <div className="mt-4">
              <Badge variant={categoryVariant(item.category)}>
                {toDisplayValue(item.category)}
              </Badge>
            </div>
          </div>
        ),
        list: (item) => (
          <div className="flex items-center justify-between rounded-md px-4 py-2 hover:bg-muted/50">
            <div>
              <p className="text-sm font-medium">{toDisplayValue(item.name)}</p>
              <p className="text-xs text-muted-foreground">{toDisplayValue(item.slug)}</p>
            </div>
            <Badge variant={statusVariant(item.status)}>{toDisplayValue(item.status)}</Badge>
          </div>
        ),
      }}
      emptyState={{
        title: "No tools found",
        description: "No Procore tools are available yet.",
        filteredDescription: "No tools match your current search or filters.",
        isFiltered,
      }}
    />
  );
}
