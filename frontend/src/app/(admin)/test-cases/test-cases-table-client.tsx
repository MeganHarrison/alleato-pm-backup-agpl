"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { ChevronRight, Trash2 } from "lucide-react";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
  CellBadge,
  CellText,
  TableDateValue,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Database } from "@/types/database.types";

type BaseTestCaseRow = Database["public"]["Tables"]["test_cases"]["Row"];
type TestCaseRow = BaseTestCaseRow & { tool_name: string | null };

interface TestCasesTableClientProps {
  initialRows: TestCaseRow[];
}

interface TestCasePatchPayload {
  test_number?: string;
  category?: string;
  subcategory?: string | null;
  test_name?: string;
  priority?: string;
  test_type?: string;
  tool?: number | null;
  steps?: string | null;
  setup_steps?: string | null;
  context_note?: string | null;
  expected_result?: string | null;
  start_url?: string | null;
  source_url?: string | null;
  source_manifest_path?: string | null;
  source_article_id?: number | null;
  source_chunk_id?: number | null;
  procore_feature_id?: string | null;
}

type EditableColumnId =
  | "test_number"
  | "test_name"
  | "category"
  | "subcategory"
  | "priority"
  | "test_type"
  | "tool"
  | "start_url"
  | "source_url"
  | "context_note"
  | "setup_steps"
  | "steps"
  | "expected_result"
  | "source_manifest_path"
  | "source_article_id"
  | "source_chunk_id"
  | "procore_feature_id";

const PAGE_TITLE = "Test Cases";
const PAGE_DESCRIPTION = "Supabase test_cases records";

const COLUMN_CONFIG: ColumnConfig[] = [
  { id: "test_number", label: "Test #", alwaysVisible: true, defaultVisible: true },
  { id: "test_name", label: "Test Name", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "subcategory", label: "Subcategory", defaultVisible: true },
  { id: "priority", label: "Priority", defaultVisible: true },
  { id: "test_type", label: "Type", defaultVisible: true },
  { id: "tool", label: "Tool", defaultVisible: true },
  { id: "start_url", label: "Start URL", defaultVisible: false },
  { id: "source_url", label: "Source URL", defaultVisible: false },
  { id: "context_note", label: "Context Note", defaultVisible: false },
  { id: "setup_steps", label: "Setup Steps", defaultVisible: false },
  { id: "steps", label: "Steps", defaultVisible: false },
  { id: "expected_result", label: "Expected Result", defaultVisible: false },
  { id: "source_manifest_path", label: "Source Manifest", defaultVisible: false },
  { id: "source_article_id", label: "Source Article ID", defaultVisible: false },
  { id: "source_chunk_id", label: "Source Chunk ID", defaultVisible: false },
  { id: "procore_feature_id", label: "Procore Feature ID", defaultVisible: false },
  { id: "created_at", label: "Created At", defaultVisible: false },
  { id: "updated_at", label: "Updated At", defaultVisible: false },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMN_CONFIG
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

const EMPTY_FILTERS: Record<string, FilterValue> = {
  category: undefined,
  priority: undefined,
  test_type: undefined,
  tool: undefined,
};

// Converts nullable values into a normalized string for searching and sorting.
function toComparableText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// Returns true when two string arrays have identical values and order.
function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

// Normalizes select filter values to a string or undefined.
function toSelectedFilterValue(value: FilterValue): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

// Builds stable select options from table data for a filter dropdown.
function buildFilterOptions(rows: TestCaseRow[], selector: (row: TestCaseRow) => string | null): Array<{ label: string; value: string }> {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = selector(row)?.trim();
    if (value) values.add(value);
  });

  return Array.from(values)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }));
}

// Converts optional text inputs to nullable values for PATCH payloads.
function toNullableTextInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

// Validates and returns a required text input for PATCH payloads.
function toRequiredTextInput(value: string, fieldLabel: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldLabel} cannot be empty.`);
  }
  return normalized;
}

// Validates and converts optional integer input for PATCH payloads.
function toNullableIntegerInput(value: string, fieldLabel: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`${fieldLabel} must be a whole number.`);
  }
  return Number.parseInt(normalized, 10);
}

// Resolves tool edit input from either numeric id or exact tool name.
function toToolIdInput(value: string, toolNameToId: Map<string, number>): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^-?\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  const matchedToolId = toolNameToId.get(normalized.toLowerCase());
  if (matchedToolId == null) {
    throw new Error("Tool must be a valid tool ID or exact tool name.");
  }

  return matchedToolId;
}

// Builds a typed PATCH payload for an edited column value.
function buildPatchPayload(
  columnId: EditableColumnId,
  rawValue: string,
  toolNameToId: Map<string, number>,
): TestCasePatchPayload {
  switch (columnId) {
    case "test_number":
      return { test_number: toRequiredTextInput(rawValue, "Test #") };
    case "test_name":
      return { test_name: toRequiredTextInput(rawValue, "Test name") };
    case "category":
      return { category: toRequiredTextInput(rawValue, "Category") };
    case "subcategory":
      return { subcategory: toNullableTextInput(rawValue) };
    case "priority": {
      const normalized = toRequiredTextInput(rawValue, "Priority").toUpperCase();
      if (!["HIGH", "MEDIUM", "LOW"].includes(normalized)) {
        throw new Error("Priority must be HIGH, MEDIUM, or LOW.");
      }
      return { priority: normalized };
    }
    case "test_type":
      return { test_type: toRequiredTextInput(rawValue, "Type") };
    case "tool":
      return { tool: toToolIdInput(rawValue, toolNameToId) };
    case "start_url":
      return { start_url: toNullableTextInput(rawValue) };
    case "source_url":
      return { source_url: toNullableTextInput(rawValue) };
    case "context_note":
      return { context_note: toNullableTextInput(rawValue) };
    case "setup_steps":
      return { setup_steps: toNullableTextInput(rawValue) };
    case "steps":
      return { steps: toNullableTextInput(rawValue) };
    case "expected_result":
      return { expected_result: toNullableTextInput(rawValue) };
    case "source_manifest_path":
      return { source_manifest_path: toNullableTextInput(rawValue) };
    case "source_article_id":
      return { source_article_id: toNullableIntegerInput(rawValue, "Source article ID") };
    case "source_chunk_id":
      return { source_chunk_id: toNullableIntegerInput(rawValue, "Source chunk ID") };
    case "procore_feature_id":
      return { procore_feature_id: toNullableTextInput(rawValue) };
    default:
      return {};
  }
}

// Returns true when a row matches the current full-text search term.
function matchesSearch(row: TestCaseRow, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) return true;

  const haystack = [
    row.test_number,
    row.test_name,
    row.category,
    row.subcategory,
    row.priority,
    row.test_type,
    row.tool_name,
    row.start_url,
    row.source_url,
    row.context_note,
    row.setup_steps,
    row.steps,
    row.expected_result,
    row.source_manifest_path,
    row.procore_feature_id,
  ]
    .map((value) => toComparableText(value).toLowerCase())
    .join(" ");

  return haystack.includes(normalizedSearch);
}

// Returns true when a row satisfies all active select filters.
function matchesFilters(
  row: TestCaseRow,
  filters: { category?: string; priority?: string; test_type?: string; tool?: string },
): boolean {
  if (filters.category && row.category !== filters.category) return false;
  if (filters.priority && row.priority !== filters.priority) return false;
  if (filters.test_type && row.test_type !== filters.test_type) return false;
  if (filters.tool && row.tool_name !== filters.tool) return false;
  return true;
}

// Builds the table column definitions for the test_cases dataset.
function buildColumns(
  onEditField: (row: TestCaseRow, columnId: EditableColumnId, value: string) => Promise<void>,
  expandedIds: Set<string>,
  onToggleExpand: (id: string) => void,
): TableColumn<TestCaseRow>[] {
  const columnMap = Object.fromEntries(COLUMN_CONFIG.map((column) => [column.id, column]));
  const columnById = (id: string): ColumnConfig => columnMap[id] ?? { id, label: id };

  return [
    {
      ...columnById("test_number"),
      editable: true,
      editValue: (row) => row.test_number,
      onEdit: (row, value) => onEditField(row, "test_number", value),
      sortable: true,
      sortValue: (row) => row.test_number,
      render: (row) => {
        const isExpanded = expandedIds.has(String(row.id));
        return (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
              data-row-interactive="true"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand(String(row.id));
              }}
              aria-label={isExpanded ? "Collapse test case" : "Expand test case"}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            </Button>
            <CellText value={row.test_number} className="font-mono text-xs" />
          </div>
        );
      },
      csvValue: (row) => row.test_number,
    },
    {
      ...columnById("test_name"),
      editable: true,
      editValue: (row) => row.test_name,
      onEdit: (row, value) => onEditField(row, "test_name", value),
      sortable: true,
      sortValue: (row) => row.test_name,
      render: (row) => <CellText value={row.test_name} className="block max-w-lg truncate" />,
      csvValue: (row) => row.test_name,
    },
    {
      ...columnById("category"),
      editable: true,
      editValue: (row) => row.category,
      onEdit: (row, value) => onEditField(row, "category", value),
      sortable: true,
      sortValue: (row) => row.category,
      render: (row) => <CellBadge value={row.category} />,
      csvValue: (row) => row.category,
    },
    {
      ...columnById("subcategory"),
      editable: true,
      editValue: (row) => row.subcategory ?? "",
      onEdit: (row, value) => onEditField(row, "subcategory", value),
      sortable: true,
      sortValue: (row) => row.subcategory ?? "",
      render: (row) => <CellText value={row.subcategory} emptyLabel="-" className="block max-w-56 truncate" />,
      csvValue: (row) => row.subcategory ?? "",
    },
    {
      ...columnById("priority"),
      editable: true,
      editValue: (row) => row.priority,
      onEdit: (row, value) => onEditField(row, "priority", value),
      sortable: true,
      sortValue: (row) => row.priority,
      render: (row) => <CellBadge value={row.priority} />,
      csvValue: (row) => row.priority,
    },
    {
      ...columnById("test_type"),
      editable: true,
      editValue: (row) => row.test_type,
      onEdit: (row, value) => onEditField(row, "test_type", value),
      sortable: true,
      sortValue: (row) => row.test_type,
      render: (row) => <CellBadge value={row.test_type} />,
      csvValue: (row) => row.test_type,
    },
    {
      ...columnById("tool"),
      editable: true,
      editValue: (row) => row.tool_name ?? (row.tool === null ? "" : String(row.tool)),
      onEdit: (row, value) => onEditField(row, "tool", value),
      sortable: true,
      sortValue: (row) => row.tool_name ?? (row.tool === null ? "" : String(row.tool)),
      render: (row) => (
        <CellText
          value={row.tool_name ?? (row.tool === null ? null : `Tool #${row.tool}`)}
          emptyLabel="-"
          className="block max-w-56 truncate"
        />
      ),
      csvValue: (row) => row.tool_name ?? (row.tool === null ? "" : `Tool #${row.tool}`),
    },
    {
      ...columnById("start_url"),
      editable: true,
      editValue: (row) => row.start_url ?? "",
      onEdit: (row, value) => onEditField(row, "start_url", value),
      sortable: true,
      sortValue: (row) => row.start_url ?? "",
      render: (row) => <CellText value={row.start_url} emptyLabel="-" className="block max-w-sm truncate" />,
      csvValue: (row) => row.start_url ?? "",
    },
    {
      ...columnById("source_url"),
      editable: true,
      editValue: (row) => row.source_url ?? "",
      onEdit: (row, value) => onEditField(row, "source_url", value),
      sortable: true,
      sortValue: (row) => row.source_url ?? "",
      render: (row) => <CellText value={row.source_url} emptyLabel="-" className="block max-w-sm truncate" />,
      csvValue: (row) => row.source_url ?? "",
    },
    {
      ...columnById("context_note"),
      editable: true,
      editValue: (row) => row.context_note ?? "",
      onEdit: (row, value) => onEditField(row, "context_note", value),
      render: (row) => <CellText value={row.context_note} emptyLabel="-" className="block max-w-md truncate" />,
      csvValue: (row) => row.context_note ?? "",
    },
    {
      ...columnById("setup_steps"),
      editable: true,
      editValue: (row) => row.setup_steps ?? "",
      onEdit: (row, value) => onEditField(row, "setup_steps", value),
      render: (row) => <CellText value={row.setup_steps} emptyLabel="-" className="block max-w-md truncate" />,
      csvValue: (row) => row.setup_steps ?? "",
    },
    {
      ...columnById("steps"),
      editable: true,
      editValue: (row) => row.steps ?? "",
      onEdit: (row, value) => onEditField(row, "steps", value),
      render: (row) => <CellText value={row.steps} emptyLabel="-" className="block max-w-md truncate" />,
      csvValue: (row) => row.steps ?? "",
    },
    {
      ...columnById("expected_result"),
      editable: true,
      editValue: (row) => row.expected_result ?? "",
      onEdit: (row, value) => onEditField(row, "expected_result", value),
      render: (row) => <CellText value={row.expected_result} emptyLabel="-" className="block max-w-md truncate" />,
      csvValue: (row) => row.expected_result ?? "",
    },
    {
      ...columnById("source_manifest_path"),
      editable: true,
      editValue: (row) => row.source_manifest_path ?? "",
      onEdit: (row, value) => onEditField(row, "source_manifest_path", value),
      sortable: true,
      sortValue: (row) => row.source_manifest_path ?? "",
      render: (row) => <CellText value={row.source_manifest_path} emptyLabel="-" className="font-mono text-xs block max-w-sm truncate" />,
      csvValue: (row) => row.source_manifest_path ?? "",
    },
    {
      ...columnById("source_article_id"),
      editable: true,
      editValue: (row) => (row.source_article_id === null ? "" : String(row.source_article_id)),
      onEdit: (row, value) => onEditField(row, "source_article_id", value),
      sortable: true,
      sortValue: (row) => row.source_article_id ?? -1,
      render: (row) => <CellText value={row.source_article_id === null ? null : String(row.source_article_id)} emptyLabel="-" />,
      csvValue: (row) => (row.source_article_id === null ? "" : String(row.source_article_id)),
    },
    {
      ...columnById("source_chunk_id"),
      editable: true,
      editValue: (row) => (row.source_chunk_id === null ? "" : String(row.source_chunk_id)),
      onEdit: (row, value) => onEditField(row, "source_chunk_id", value),
      sortable: true,
      sortValue: (row) => row.source_chunk_id ?? -1,
      render: (row) => <CellText value={row.source_chunk_id === null ? null : String(row.source_chunk_id)} emptyLabel="-" />,
      csvValue: (row) => (row.source_chunk_id === null ? "" : String(row.source_chunk_id)),
    },
    {
      ...columnById("procore_feature_id"),
      editable: true,
      editValue: (row) => row.procore_feature_id ?? "",
      onEdit: (row, value) => onEditField(row, "procore_feature_id", value),
      sortable: true,
      sortValue: (row) => row.procore_feature_id ?? "",
      render: (row) => <CellText value={row.procore_feature_id} emptyLabel="-" className="font-mono text-xs" />,
      csvValue: (row) => row.procore_feature_id ?? "",
    },
    {
      ...columnById("created_at"),
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => <TableDateValue value={row.created_at} emptyLabel="-" />,
      csvValue: (row) => row.created_at,
    },
    {
      ...columnById("updated_at"),
      sortable: true,
      sortValue: (row) => new Date(row.updated_at).getTime(),
      render: (row) => <TableDateValue value={row.updated_at} emptyLabel="-" />,
      csvValue: (row) => row.updated_at,
    },
  ];
}

// TestCasesTableClient renders an admin UnifiedTablePage for Supabase test_cases rows.
export function TestCasesTableClient({ initialRows }: TestCasesTableClientProps) {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;
  const [rows, setRows] = React.useState<TestCaseRow[]>(initialRows);

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const toolNameToId = React.useMemo(() => {
    const byName = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.tool_name || row.tool == null) return;
      byName.set(row.tool_name.toLowerCase(), row.tool);
    });
    return byName;
  }, [rows]);

  const toolNameById = React.useMemo(() => {
    const byId = new Map<number, string>();
    rows.forEach((row) => {
      if (!row.tool_name || row.tool == null) return;
      byId.set(row.tool, row.tool_name);
    });
    return byId;
  }, [rows]);

  const tableState = useUnifiedTableState({
    entityKey: "admin-test-cases-v4",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "tool",
      sortDirection: "asc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: EMPTY_FILTERS,
    },
  });

  const {
    searchInput,
    debouncedSearch,
    currentView,
    activeFilters: tableFilters,
    page,
    perPage,
    sortBy,
    sortDirection,
    selectedIds,
    visibleColumns,
    setCurrentView,
    setSearchInput,
    setSearchParams,
    setActiveFilters,
    setPage,
    setPerPage,
    setSortBy,
    setSortDirection,
    setSelectedIds,
    setVisibleColumns,
  } = tableState;

  // Persists an inline edit to the API and merges the updated row into local table state.
  const handleInlineEdit = React.useCallback(
    async (row: TestCaseRow, columnId: EditableColumnId, value: string) => {
      const payload = buildPatchPayload(columnId, value, toolNameToId);
      if (Object.keys(payload).length === 0) return;

      const response = await apiFetch<{ case: Partial<BaseTestCaseRow> }>(
        `/api/testing/cases/${row.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      setRows((previousRows) =>
        previousRows.map((existingRow) =>
          existingRow.id === row.id
            ? {
                ...existingRow,
                ...response.case,
                tool_name:
                  columnId === "tool"
                    ? (() => {
                        const nextToolId = response.case.tool ?? payload.tool ?? existingRow.tool;
                        return nextToolId == null ? null : (toolNameById.get(nextToolId) ?? null);
                      })()
                    : existingRow.tool_name,
              }
            : existingRow,
        ),
      );
    },
    [toolNameById, toolNameToId],
  );

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const handleToggleExpand = React.useCallback((id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const tableColumns = React.useMemo(
    () => buildColumns(handleInlineEdit, expandedIds, handleToggleExpand),
    [handleInlineEdit, expandedIds, handleToggleExpand],
  );

  // Deletes a test case and synchronizes local table state.
  const handleDeleteRow = React.useCallback(
    async (row: TestCaseRow) => {
      try {
        await apiFetch<{ deleted: boolean }>(`/api/testing/cases/${row.id}`, {
          method: "DELETE",
        });

        setRows((previousRows) => previousRows.filter((existingRow) => existingRow.id !== row.id));
        setSelectedIds((previousIds) => previousIds.filter((id) => id !== row.id));
        toast.success("Test case deleted.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete test case.";
        toast.error(message);
      }
    },
    [setSelectedIds],
  );

  const filters = React.useMemo<FilterConfig[]>(
    () => [
      {
        id: "category",
        label: "Category",
        type: "select",
        options: buildFilterOptions(rows, (row) => row.category),
      },
      {
        id: "priority",
        label: "Priority",
        type: "select",
        options: buildFilterOptions(rows, (row) => row.priority),
      },
      {
        id: "test_type",
        label: "Test Type",
        type: "select",
        options: buildFilterOptions(rows, (row) => row.test_type),
      },
      {
        id: "tool",
        label: "Tool",
        type: "select",
        options: buildFilterOptions(rows, (row) => row.tool_name),
      },
    ],
    [rows],
  );

  const activeFilters = React.useMemo(
    () => ({
      category: toSelectedFilterValue(tableFilters.category),
      priority: toSelectedFilterValue(tableFilters.priority),
      test_type: toSelectedFilterValue(tableFilters.test_type),
      tool: toSelectedFilterValue(tableFilters.tool),
    }),
    [
      tableFilters.category,
      tableFilters.priority,
      tableFilters.test_type,
      tableFilters.tool,
    ],
  );

  const filteredRows = React.useMemo(
    () =>
      rows.filter(
        (row) => matchesSearch(row, debouncedSearch) && matchesFilters(row, activeFilters),
      ),
    [activeFilters, debouncedSearch, rows],
  );

  const sortedRows = React.useMemo(() => {
    if (!sortBy) return filteredRows;

    const column = tableColumns.find((candidate) => candidate.id === sortBy);
    if (!column?.sortValue) return filteredRows;

    return [...filteredRows].sort((left, right) => {
      const leftValue = column.sortValue?.(left);
      const rightValue = column.sortValue?.(right);

      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return sortDirection === "asc" ? -1 : 1;
      if (rightValue == null) return sortDirection === "asc" ? 1 : -1;

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }

      const comparison = toComparableText(leftValue).localeCompare(toComparableText(rightValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortBy, sortDirection, tableColumns]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage));

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      setSearchParams({ page: String(totalPages) });
    }
  }, [page, setPage, setSearchParams, totalPages]);

  const rowIds = React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);

  React.useEffect(() => {
    const rowIdSet = new Set(rowIds);
    setSelectedIds((previous) => {
      const next = previous.filter((id) => rowIdSet.has(id));
      return areStringArraysEqual(previous, next) ? previous : next;
    });
  }, [rowIds, setSelectedIds]);

  // Updates active table filters and resets paging after filter changes.
  const handleFilterChange = React.useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      setActiveFilters({
        category: toSelectedFilterValue(nextFilters.category),
        priority: toSelectedFilterValue(nextFilters.priority),
        test_type: toSelectedFilterValue(nextFilters.test_type),
        tool: toSelectedFilterValue(nextFilters.tool),
      });
      setPage(1);
      setSearchParams({ page: "1" });
    },
    [setActiveFilters, setPage, setSearchParams],
  );

  // Selects or deselects all rows currently visible under the active filters.
  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? sortedRows.map((row) => row.id) : []);
    },
    [setSelectedIds, sortedRows],
  );

  // Toggles selection state for a single table row id.
  const handleSelectRow = React.useCallback(
    (id: string, checked: boolean) => {
      setSelectedIds((previous) => {
        if (checked) {
          if (previous.includes(id)) return previous;
          return [...previous, id];
        }
        return previous.filter((existingId) => existingId !== id);
      });
    },
    [setSelectedIds],
  );

  const isFiltered = React.useMemo(
    () =>
      Boolean(debouncedSearch.trim()) ||
      Boolean(activeFilters.category) ||
      Boolean(activeFilters.priority) ||
      Boolean(activeFilters.test_type) ||
      Boolean(activeFilters.tool),
    [activeFilters, debouncedSearch],
  );

  // Renders one labeled detail block inside the expanded row panel.
  const renderDetail = React.useCallback((label: string, value: string | null) => {
    const trimmed = value?.trim() ?? "";
    const display = trimmed.length > 0 ? trimmed : "—";
    const isLink = /^https?:\/\//i.test(trimmed);
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {isLink ? (
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all text-xs text-primary underline-offset-2 hover:underline"
          >
            {trimmed}
          </a>
        ) : (
          <p className="whitespace-pre-wrap break-words text-xs text-foreground">{display}</p>
        )}
      </div>
    );
  }, []);

  // Renders inline expandable row (change-events pattern) with URL, Context, Setup Steps, Steps, Expected.
  const renderExpandedRow = React.useCallback(
    (
      row: TestCaseRow,
      colSpan: number,
      context?: { columns: Array<{ id: string; width?: number }>; hasSelection: boolean; hasActions: boolean },
    ): React.ReactNode | null => {
      if (!expandedIds.has(String(row.id))) return null;
      const leftPaddingPx = context?.hasSelection ? 56 : 16;
      return (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={colSpan} className="py-4 pr-4" style={{ paddingLeft: `${leftPaddingPx}px` }}>
            <div className="grid gap-4 md:grid-cols-2">
              {renderDetail("URL", row.start_url)}
              {renderDetail("Source URL", row.source_url)}
              {renderDetail("Context", row.context_note)}
              {renderDetail("Setup Steps", row.setup_steps)}
              {renderDetail("Steps", row.steps)}
              {renderDetail("Expected", row.expected_result)}
            </div>
          </TableCell>
        </TableRow>
      );
    },
    [expandedIds, renderDetail],
  );

  // Minimal per-row Delete action kept in the actions column.
  const renderRowActions = React.useCallback(
    (row: TestCaseRow) => (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          event.stopPropagation();
          void handleDeleteRow(row);
        }}
        data-row-interactive="true"
        aria-label="Delete test case"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    ),
    [handleDeleteRow],
  );

  return (
    <UnifiedTablePage<TestCaseRow>
      header={{
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
      }}
      toolbar={{
        totalItems: rows.length,
        filteredItems: sortedRows.length,
        selectedCount: selectedIds.length,
        searchValue: searchInput,
        onSearchChange: setSearchInput,
        searchPlaceholder: "Search test cases...",
        currentView,
        onViewChange: (view) => {
          setCurrentView(view);
          setSearchParams({ view });
        },
        filters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: COLUMN_CONFIG,
        visibleColumns,
        onColumnVisibilityChange: setVisibleColumns,
      }}
      data={{
        items: sortedRows,
        isLoading: false,
        error: null,
      }}
      table={{
        columns: tableColumns,
        getRowId: (row) => row.id,
        rowActions: renderRowActions,
        renderExpandedRow,
        stickyHeader: true,
      }}
      sorting={{
        sortBy,
        sortDirection,
        onSortChange: (nextSortBy, direction) => {
          setSortBy(nextSortBy);
          setSortDirection(direction);
          setSearchParams({ sort: nextSortBy, sort_dir: direction, page: "1" });
          setPage(1);
        },
      }}
      selection={{
        selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No test cases found",
        description: "Supabase test_cases is empty.",
        filteredDescription: "No test cases match your current search or filters.",
        isFiltered,
      }}
      pagination={{
        page,
        totalPages,
        perPage,
        onPageChange: (nextPage) => {
          setPage(nextPage);
          setSearchParams({ page: String(nextPage) });
        },
        onPerPageChange: (nextPerPage) => {
          const parsed = Number(nextPerPage);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          setPerPage(parsed);
          setPage(1);
          setSearchParams({ per_page: String(parsed), page: "1" });
        },
        clientSide: true,
      }}
      features={{
        enableInlineEditing: true,
      }}
    />
  );
}
