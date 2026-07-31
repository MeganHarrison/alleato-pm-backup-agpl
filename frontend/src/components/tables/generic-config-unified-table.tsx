"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  EmbeddedUnifiedTablePage,
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
  type UnifiedTablePageProps,
} from "@/components/tables/unified";
import {
  CellDate,
  CellLink,
  CellNumber,
  CellStatus,
  CellText,
} from "@/components/tables/unified/table-primitives";
import { Badge } from "@/components/ui/badge";
import type {
  ColumnConfig as GenericColumnConfig,
  GenericTableConfig,
  RenderConfig,
} from "@/components/tables/generic-table-factory";

type GenericRow = Record<string, unknown> & { id?: string | number | null };

interface GenericConfigUnifiedTableProps<T extends GenericRow> {
  data: T[];
  config: GenericTableConfig;
  title: string;
  description?: string;
  /** Use when an enclosing tab or page header already supplies the table title. */
  hideHeader?: boolean;
  entityKey: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

interface GenericUnifiedTablePageProps<T>
  extends Omit<UnifiedTablePageProps<T>, "header"> {
  hideHeader: boolean;
  title: string;
  description?: UnifiedTablePageProps<T>["header"]["description"];
}

function GenericUnifiedTablePage<T>({
  hideHeader,
  title,
  description,
  ...props
}: GenericUnifiedTablePageProps<T>) {
  if (hideHeader) {
    return (
      <EmbeddedUnifiedTablePage<T>
        {...props}
        title={title}
        description={description}
      />
    );
  }

  return (
    <UnifiedTablePage<T>
      {...props}
      header={{ title, description }}
    />
  );
}

function toText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function truncate(value: unknown, maxLength: number): string {
  const text = toText(value);
  if (!text) return "-";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getNestedValue(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function renderConfiguredValue(
  value: unknown,
  renderConfig: RenderConfig,
  row?: GenericRow,
) {
  switch (renderConfig.type) {
    case "badge": {
      const label = toText(value) || "-";
      return (
        <Badge
          variant={
            renderConfig.variantMap?.[label] ??
            renderConfig.defaultVariant ??
            "outline"
          }
        >
          {label}
        </Badge>
      );
    }
    case "currency": {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) return <CellText value={null} />;
      const formatted = numberValue.toLocaleString(undefined, {
        minimumFractionDigits: renderConfig.showDecimals === false ? 0 : 2,
        maximumFractionDigits: renderConfig.showDecimals === false ? 0 : 2,
      });
      return <CellText value={`${renderConfig.prefix || "$"}${formatted}`} />;
    }
    case "truncate":
      return <CellText value={truncate(value, renderConfig.maxLength)} />;
    case "array": {
      if (!Array.isArray(value) || value.length === 0)
        return <CellText value={null} />;
      if (renderConfig.itemType === "badge") {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, index) => (
              <Badge
                key={`${toText(item)}-${index}`}
                variant="outline"
                className="text-xs"
              >
                {toText(item)}
              </Badge>
            ))}
          </div>
        );
      }
      return (
        <CellText
          value={value.map(toText).join(renderConfig.separator || ", ")}
        />
      );
    }
    case "json":
      return <CellText value={truncate(value, renderConfig.maxLength)} />;
    case "nested":
      return (
        <CellText
          value={
            toText(getNestedValue(value, renderConfig.path)) ||
            renderConfig.fallback ||
            "-"
          }
        />
      );
    case "pdf-page": {
      const page = toText(value);
      const baseUrl = row ? toText(row[renderConfig.urlField]) : "";
      return (
        <CellLink
          value={page}
          href={
            baseUrl && page
              ? `${baseUrl}#page=${encodeURIComponent(page)}`
              : null
          }
          external
        />
      );
    }
    default:
      return <CellText value={toText(value)} />;
  }
}

function renderColumnValue<T extends GenericRow>(
  row: T,
  column: GenericColumnConfig,
) {
  const value = row[column.id];
  if (column.renderConfig) {
    return renderConfiguredValue(value, column.renderConfig, row);
  }

  switch (column.type) {
    case "date":
      return <CellDate value={toText(value) || null} />;
    case "badge":
      return <CellStatus value={toText(value)} />;
    case "number":
      return (
        <CellNumber value={typeof value === "number" ? value : Number(value)} />
      );
    case "boolean":
      return <CellStatus value={value ? "Yes" : "No"} />;
    default:
      return <CellText value={toText(value)} />;
  }
}

function buildColumns<T extends GenericRow>(
  config: GenericTableConfig,
): TableColumn<T>[] {
  return config.columns.map((column) => ({
    id: column.id,
    label: column.label,
    defaultVisible: column.defaultVisible,
    sortable: column.sortable !== false,
    width: column.defaultWidth,
    sortValue: (row) => toText(row[column.id]),
    render: (row) => renderColumnValue(row, column),
    csvValue: (row) => toText(row[column.id]),
  }));
}

function rowMatchesSearch<T extends GenericRow>(
  row: T,
  searchFields: string[],
  searchTerm: string,
) {
  if (!searchTerm) return true;
  const lowerSearch = searchTerm.toLowerCase();
  return searchFields.some((field) =>
    toText(row[field]).toLowerCase().includes(lowerSearch),
  );
}

function rowMatchesFilters<T extends GenericRow>(
  row: T,
  config: GenericTableConfig,
  activeFilters: Record<string, FilterValue>,
) {
  if (!config.filters?.length) return true;
  return config.filters.every((filter) => {
    const activeValue = activeFilters[filter.id];
    if (
      activeValue === undefined ||
      activeValue === null ||
      activeValue === ""
    ) {
      return true;
    }
    return toText(row[filter.field]) === String(activeValue);
  });
}

function buildRowPath(rowClickPath: string, row: GenericRow): string | null {
  if (row.id === null || row.id === undefined) return null;
  return rowClickPath.replace("{id}", encodeURIComponent(String(row.id)));
}

function getStableRowId(row: GenericRow, index: number): string {
  const candidates = [
    row.id,
    row.table_id,
    row.figure_number,
    row.table_number,
    row.title,
  ];
  const match = candidates.find(
    (value) => value !== null && value !== undefined && value !== "",
  );
  return match ? String(match) : `row-${index}`;
}

export function GenericConfigUnifiedTable<T extends GenericRow>({
  data,
  config,
  title,
  description,
  hideHeader = false,
  entityKey,
  emptyTitle = "No records found",
  emptyDescription = "No records have been created yet.",
}: GenericConfigUnifiedTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultVisibleColumns = React.useMemo(
    () =>
      config.columns
        .filter((column) => column.defaultVisible)
        .map((column) => column.id),
    [config.columns],
  );
  const initialFilters = React.useMemo(
    () =>
      Object.fromEntries(
        (config.filters ?? []).map((filter) => [
          filter.id,
          searchParams?.get(filter.id) ?? undefined,
        ]),
      ),
    [config.filters, searchParams],
  );

  const tableState = useUnifiedTableState({
    entityKey,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: config.defaultSortColumn ?? null,
      sortDirection: config.defaultSortDirection ?? "asc",
      visibleColumns: defaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const activeFilters = tableState.activeFilters;
  const columns = React.useMemo(() => buildColumns<T>(config), [config]);
  const filteredRows = React.useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim();
    return data.filter(
      (row) =>
        rowMatchesSearch(row, config.searchFields, searchTerm) &&
        rowMatchesFilters(row, config, activeFilters),
    );
  }, [activeFilters, config, data, tableState.debouncedSearch]);

  const handleFilterChange = (filters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(filters);
    tableState.setPage(1);
    tableState.setSearchParams(
      Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [
          key,
          value === undefined || value === null || value === ""
            ? null
            : String(value),
        ]),
      ),
    );
  };

  const isFiltered =
    tableState.debouncedSearch.trim().length > 0 ||
    Object.values(activeFilters).some((value) => value !== undefined);

  return (
    <GenericUnifiedTablePage
      hideHeader={hideHeader}
      title={title}
      description={description}
      toolbar={{
        totalItems: data.length,
        filteredItems: filteredRows.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: `Search ${title.toLowerCase()}...`,
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table", "list"],
        filters: (config.filters ?? []).map((filter) => ({
          id: filter.id,
          label: filter.label,
          type: "select" as const,
          options: filter.options,
        })),
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange({}),
        columns: config.columns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: filteredRows,
        isLoading: false,
        error: null,
      }}
      table={{
        columns,
        getRowId: (row) => getStableRowId(row, data.indexOf(row)),
        onRowClick: config.rowClickPath
          ? (row) => {
              const path = buildRowPath(config.rowClickPath!, row);
              if (path) router.push(path);
            }
          : undefined,
        stickyHeader: true,
        density: "compact",
      }}
      pagination={{
        page: tableState.page,
        totalPages: Math.max(
          1,
          Math.ceil(filteredRows.length / tableState.perPage),
        ),
        perPage: tableState.perPage,
        clientSide: true,
        onPageChange: tableState.setPage,
        onPerPageChange: (value) => {
          tableState.setPerPage(Number(value));
          tableState.setPage(1);
        },
      }}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
        filteredDescription: `No ${title.toLowerCase()} match the current search or filters.`,
        isFiltered,
      }}
      features={{
        enableViews: true,
        enableColumnToggle: true,
        enableExport: true,
        enableFilters: Boolean(config.filters?.length),
        enablePagination: true,
        enableRowSelection: false,
        enableRowActions: false,
      }}
      layout={{ fullBleedTable: true }}
    />
  );
}
