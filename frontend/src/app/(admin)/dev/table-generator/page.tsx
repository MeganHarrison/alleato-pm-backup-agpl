"use client";

/**
 * TABLE PAGE GENERATOR (DEV ONLY)
 *
 * Generates two files for a new table page:
 * 1. Feature table config: features/{entity}/{entity}-table-config.tsx
 * 2. Page component: app/(tables)/{entity}/page.tsx
 *
 * Uses the current UnifiedTablePage + useUnifiedTableState architecture.
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Loader2,
  AlertCircle,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FormLayout } from "@/components/layouts";
import { PageShell } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Column {
  name: string;
  type: "text" | "date" | "badge" | "number" | "email";
  isSystemField: boolean;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
  searchable?: boolean;
}

interface FilterOption {
  field: string;
  label: string;
  options: { value: string; label: string }[];
}

function normalizeColumnType(type: string): Column["type"] {
  switch (type) {
    case "date":
    case "badge":
    case "number":
    case "email":
      return type;
    default:
      return "text";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(str: string): string {
  return str
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function toTitleCase(str: string): string {
  return str
    .split(/[_\-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/[_\s]+/g, "-").toLowerCase();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function columnRenderSnippet(col: Column): string {
  switch (col.type) {
    case "badge":
      return `      render: (item) => (
        <StatusBadge status={item.${col.name} ?? "—"} />
      ),
      sortValue: (item) => item.${col.name} ?? "",
      sortable: true,`;
    case "date":
      return `      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.${col.name} ? format(new Date(item.${col.name}), "MMM d, yyyy") : "—"}
        </span>
      ),
      sortValue: (item) => item.${col.name} ?? "",
      sortable: true,`;
    case "number":
      return `      render: (item) => (
        <span className="text-sm tabular-nums">
          {item.${col.name} != null ? item.${col.name}.toLocaleString() : "—"}
        </span>
      ),
      sortValue: (item) => item.${col.name} ?? 0,
      sortable: true,`;
    case "email":
      return `      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.${col.name} || "—"}</span>
      ),
      sortValue: (item) => item.${col.name} ?? "",
      sortable: true,`;
    default:
      return `      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.${col.name} || "—"}</span>
      ),
      sortValue: (item) => item.${col.name} ?? "",
      sortable: true,`;
  }
}

// ---------------------------------------------------------------------------
// Code Generation
// ---------------------------------------------------------------------------

function generateConfigCode(
  tableName: string,
  entityKey: string,
  columns: Column[],
  searchFields: string[],
  filters: FilterOption[],
): string {
  const Pascal = toPascalCase(entityKey);
  const camel = toCamelCase(entityKey);
  const visibleCols = columns.filter((c) => c.defaultVisible);
  const alwaysVisibleCol = visibleCols[0];
  const hasBadge = visibleCols.some((c) => c.type === "badge");
  const hasDate = visibleCols.some((c) => c.type === "date");

  const imports: string[] = [];
  if (hasDate) imports.push(`import { format } from "date-fns";`);
  if (hasBadge) imports.push(`import { StatusBadge } from "@/components/ds";`);
  imports.push(
    `import { Eye, MoreVertical } from "lucide-react";`,
    `import { Button } from "@/components/ui/button";`,
    `import {`,
    `  DropdownMenu,`,
    `  DropdownMenuContent,`,
    `  DropdownMenuItem,`,
    `  DropdownMenuTrigger,`,
    `} from "@/components/ui/dropdown-menu";`,
    `import type { TableColumn, FilterConfig, ColumnConfig } from "@/components/tables/unified";`,
  );

  // --- Column config array ---
  const colConfigLines = visibleCols
    .map((col) => {
      const parts = [`    { id: "${col.name}", label: "${toTitleCase(col.name)}"`];
      if (col === alwaysVisibleCol) parts.push(`, alwaysVisible: true`);
      else parts.push(`, defaultVisible: true`);
      parts.push(` },`);
      return parts.join("");
    })
    .join("\n");

  // --- Filter config ---
  const filterLines =
    filters.length > 0
      ? filters
          .map((f) => {
            const opts = f.options
              .filter((o) => o.value && o.label)
              .map((o) => `      { value: "${o.value}", label: "${o.label}" },`)
              .join("\n");
            return `  {
    id: "${f.field}",
    label: "${f.label}",
    type: "select" as const,
    options: [
${opts}
    ],
  },`;
          })
          .join("\n")
      : "";

  // --- buildColumns function ---
  const buildColEntries = visibleCols
    .map((col, i) => {
      return `    {
      ...${camel}Columns[${i}],
${columnRenderSnippet(col)}
    },`;
    })
    .join("\n");

  // --- Search fields in filter logic ---
  const searchFilterLines = searchFields
    .map((f) => `        (item.${f} ?? "").toLowerCase().includes(searchTerm)`)
    .join(" ||\n");

  // --- Card view ---
  const primaryCol = alwaysVisibleCol?.name ?? "id";
  const secondaryCol = visibleCols.find((c) => c.type === "badge")?.name;
  const cardSecondary = secondaryCol
    ? `\n          <StatusBadge status={item.${secondaryCol} ?? "—"} />`
    : "";

  // --- Row actions ---
  const rowActionsCode = `export function render${Pascal}RowActions(
  item: ${Pascal}Row,
  onView: (item: ${Pascal}Row) => void,
) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(item)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`;

  return `${imports.join("\n")}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ${Pascal}Row {
${columns.map((c) => `  ${c.name}: ${c.type === "number" ? "number | null" : "string | null"};`).join("\n")}
}

// ---------------------------------------------------------------------------
// Column / Filter / Defaults
// ---------------------------------------------------------------------------

export const ${camel}Columns: ColumnConfig[] = [
${colConfigLines}
];

export const ${camel}Filters: FilterConfig[] = [${filterLines ? `\n${filterLines}\n` : ""}];

export const ${camel}DefaultVisibleColumns: string[] = ${camel}Columns
  .filter((c) => c.defaultVisible !== false)
  .map((c) => c.id);

// ---------------------------------------------------------------------------
// Table columns (render / sort)
// ---------------------------------------------------------------------------

export function build${Pascal}TableColumns(): TableColumn<${Pascal}Row>[] {
  return [
${buildColEntries}
  ];
}

// ---------------------------------------------------------------------------
// Card / List views
// ---------------------------------------------------------------------------

export function render${Pascal}Card(
  item: ${Pascal}Row,
  onView: (item: ${Pascal}Row) => void,
) {
  return (
    <button
      type="button"
      onClick={() => onView(item)}
      className="w-full rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
    >
      <p className="font-medium">{item.${primaryCol} || "Untitled"}</p>${cardSecondary}
    </button>
  );
}

export function render${Pascal}List(
  item: ${Pascal}Row,
  onView: (item: ${Pascal}Row) => void,
) {
  return (
    <button
      type="button"
      onClick={() => onView(item)}
      className="flex w-full items-center justify-between rounded-md px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <span className="font-medium">{item.${primaryCol} || "Untitled"}</span>${secondaryCol ? `\n      <StatusBadge status={item.${secondaryCol} ?? "—"} />` : ""}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

${rowActionsCode}
`;
}

function generatePageCode(
  tableName: string,
  entityKey: string,
  supabaseTable: string,
  columns: Column[],
  searchFields: string[],
  filters: FilterOption[],
): string {
  const Pascal = toPascalCase(entityKey);
  const camel = toCamelCase(entityKey);
  const kebab = toKebabCase(entityKey);
  const filterKeys = filters.map((f) => f.field);

  const filterStateType =
    filterKeys.length > 0
      ? `type ${Pascal}FilterState = Record<string, FilterValue>;\n\nconst EMPTY_FILTERS: ${Pascal}FilterState = {\n${filterKeys.map((k) => `  ${k}: undefined,`).join("\n")}\n};\n`
      : `const EMPTY_FILTERS: Record<string, FilterValue> = {};\n`;

  const searchFilterBody =
    searchFields.length > 0
      ? searchFields
          .map((f) => `        (item.${f} ?? "").toLowerCase().includes(searchTerm)`)
          .join(" ||\n")
      : `        false`;

  const filterGuards = filterKeys
    .map(
      (k) =>
        `      if (activeFilters.${k} && typeof activeFilters.${k} === "string" && (item.${k} ?? "").toLowerCase() !== (activeFilters.${k} as string).toLowerCase()) return false;`,
    )
    .join("\n");

  const filterDeps = filterKeys.map((k) => `activeFilters.${k}`).join(", ");

  return `"use client";

import * as React from "react";

import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  type ${Pascal}Row,
  build${Pascal}TableColumns,
  ${camel}Columns,
  ${camel}DefaultVisibleColumns,
  ${camel}Filters,
  render${Pascal}Card,
  render${Pascal}List,
  render${Pascal}RowActions,
} from "@/features/${kebab}/${kebab}-table-config";

${filterStateType}
export default function ${Pascal}Page() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;

  const [data, setData] = React.useState<${Pascal}Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const tableState = useUnifiedTableState({
    entityKey: "${entityKey}",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: ${camel}DefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const { activeFilters } = tableState;

  // ── Data fetching ──────────────────────────────────────────────
  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with your API endpoint
      const resp = await fetch("/api/${entityKey}", { cache: "no-store" });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result?.error || "Failed to load");
      setData((result.data || []) as ${Pascal}Row[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Table columns ──────────────────────────────────────────────
  const tableColumns = React.useMemo(() => build${Pascal}TableColumns(), []);

  // ── Filtering ──────────────────────────────────────────────────
  const filteredData = React.useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();

    return data.filter((item) => {
${filterGuards}
      if (!searchTerm) return true;
      return (
${searchFilterBody}
      );
    });
  }, [${filterDeps ? `${filterDeps}, ` : ""}data, tableState.debouncedSearch]);

  const totalItems = data.length;
  const filteredItems = filteredData.length;
  const isFiltered =
    tableState.debouncedSearch.trim().length > 0 ||
    Object.values(activeFilters).some((v) => v !== undefined);

  const handleFilterChange = (filters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(filters);
    tableState.setPage(1);
  };

  const handleView = (item: ${Pascal}Row) => {
    toast.info(\`Viewing: \${item.${columns[0]?.name ?? "id"} || item.id}\`);
  };

  const handleExport = () => {
    const headers = [${columns
      .filter((c) => c.defaultVisible)
      .map((c) => `"${toTitleCase(c.name)}"`)
      .join(", ")}];
    const rows = filteredData.map((d) => [
${columns
  .filter((c) => c.defaultVisible)
  .map((c) => {
    if (c.type === "date") return `      d.${c.name} ? format(new Date(d.${c.name}), "yyyy-MM-dd") : "",`;
    return `      d.${c.name} || "",`;
  })
  .join("\n")}
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => \`"\${cell}"\`).join(","))
      .join("\\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = \`${entityKey}-\${format(new Date(), "yyyy-MM-dd")}.csv\`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <UnifiedTablePage
      header={{
        title: "${tableName}",
        description: "Manage ${tableName.toLowerCase()}",
      }}
      toolbar={{
        totalItems,
        filteredItems,
        selectedCount: 0,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search ${tableName.toLowerCase()}...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "card", "list"],
        filters: ${camel}Filters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: ${camel}Columns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
      }}
      data={{
        items: filteredData,
        isLoading,
        isFetching: false,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.id ?? "",
        onRowClick: handleView,
        rowActions: (item) => render${Pascal}RowActions(item, handleView),
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
      views={{
        card: (item) => render${Pascal}Card(item, handleView),
        list: (item) => render${Pascal}List(item, handleView),
      }}
      emptyState={{
        title: "No ${tableName.toLowerCase()} found",
        description: "Get started by adding your first record.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      features={{
        enableExport: true,
        enableBulkDelete: false,
        enableRowSelection: false,
      }}
    />
  );
}
`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TableGeneratorPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [tableName, setTableName] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const [entityKey, setEntityKey] = useState("");
  const [searchFields, setSearchFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const [generatedConfigCode, setGeneratedConfigCode] = useState("");
  const [generatedPageCode, setGeneratedPageCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingTables, setIsFetchingTables] = useState(true);
  const [activeTab, setActiveTab] = useState<"config" | "page">("config");

  useEffect(() => {
    void fetchTables();
  }, []);

  const fetchTables = async () => {
    setIsFetchingTables(true);
    try {
      const data = await apiFetch<{ tables?: string[] }>("/api/dev/schema");
      setTables(data.tables || []);
    } catch (err) {
      toast.error("Could not fetch tables", {
        description: getErrorMessage(err),
      });
    } finally {
      setIsFetchingTables(false);
    }
  };

  const fetchColumns = async (table: string) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        columns: Array<{ name: string; type: string; isSystemField: boolean }>;
        note?: string;
      }>("/api/dev/schema", {
        method: "POST",
        body: JSON.stringify({ tableName: table }),
      });

      const cols: Column[] = data.columns.map(
        (col: { name: string; type: string; isSystemField: boolean }) => ({
          ...col,
          type: normalizeColumnType(col.type),
          defaultVisible:
            !col.isSystemField && col.name !== "updated_at" && col.name !== "id",
          alwaysVisible: col.name === "name" || col.name === "title",
          searchable: normalizeColumnType(col.type) === "text" && !col.isSystemField,
        }),
      );

      setColumns(cols);

      const textFields = cols
        .filter((c) => c.searchable)
        .map((c) => c.name);
      setSearchFields(textFields.slice(0, 4));

      const formatted = toTitleCase(table);
      setTableName(formatted);
      setTableDescription(`Manage ${formatted.toLowerCase()}`);
      setEntityKey(table.replace(/_/g, "-"));

      if (data.note) {
        toast.warning(data.note);
      } else {
        toast.success(`Loaded ${cols.length} columns from ${table}`);
      }
    } catch (err) {
      toast.error("Could not fetch columns", {
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableSelect = (table: string) => {
    setSelectedTable(table);
    setSearchQuery("");
    setOpen(false);
    void fetchColumns(table);
  };

  const filteredTables = useMemo(() => {
    if (!searchQuery) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter((t) => t.toLowerCase().includes(query));
  }, [tables, searchQuery]);

  const toggleColumn = (name: string, field: keyof Column) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.name === name ? { ...col, [field]: !col[field] } : col,
      ),
    );
  };

  const toggleSearchField = (field: string) => {
    setSearchFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { field: "", label: "", options: [{ value: "", label: "" }] },
    ]);
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<FilterOption>) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    );
  };

  const addFilterOption = (filterIndex: number) => {
    setFilters((prev) =>
      prev.map((f, i) =>
        i === filterIndex
          ? { ...f, options: [...f.options, { value: "", label: "" }] }
          : f,
      ),
    );
  };

  const updateFilterOption = (
    filterIndex: number,
    optionIndex: number,
    key: "value" | "label",
    value: string,
  ) => {
    setFilters((prev) =>
      prev.map((f, i) =>
        i === filterIndex
          ? {
              ...f,
              options: f.options.map((opt, j) =>
                j === optionIndex ? { ...opt, [key]: value } : opt,
              ),
            }
          : f,
      ),
    );
  };

  const handleGenerate = () => {
    if (!selectedTable) {
      toast.error("Please select a table first");
      return;
    }

    const configCode = generateConfigCode(
      tableName,
      entityKey,
      columns,
      searchFields,
      filters,
    );
    const pageCode = generatePageCode(
      tableName,
      entityKey,
      selectedTable,
      columns,
      searchFields,
      filters,
    );

    setGeneratedConfigCode(configCode);
    setGeneratedPageCode(pageCode);
    setActiveTab("config");
    toast.success("Code generated! Two files ready to copy.");
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied to clipboard!");
    } catch (err) {
      toast.error("Could not copy generated code", {
        description: getErrorMessage(err),
      });
    }
  };

  const downloadFile = (code: string, filename: string) => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File downloaded!");
  };

  if (process.env.NODE_ENV === "production") {
    return (
      <PageShell variant="content" title="Table Page Generator">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Available</AlertTitle>
          <AlertDescription>
            This tool is only available in development environments.
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const kebab = toKebabCase(entityKey);

  return (
    <PageShell
      variant="form"
      title="Table Page Generator"
      description="Generate UnifiedTablePage + feature config from your Supabase schema"
      breadcrumbs={[
        { label: "Dev", href: "/dev" },
        { label: "Table Generator" },
      ]}
    >
      <FormLayout>
        {/* Step 1: Select Table */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">1. Select Table</h2>
            <p className="text-sm text-muted-foreground">
              Choose a Supabase table
              {!isFetchingTables && tables.length > 0 && (
                <span className="ml-2">({tables.length} tables found)</span>
              )}
            </p>
          </div>

          {isFetchingTables ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading tables...</span>
            </div>
          ) : (
            <>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {selectedTable || "Select a table..."}
                    <ChevronsUpDown className="shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search tables..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No table found.</CommandEmpty>
                      <CommandGroup>
                        {filteredTables.map((table) => (
                          <CommandItem
                            key={table}
                            value={table}
                            onSelect={() => handleTableSelect(table)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTable === table
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {table}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {tables.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No tables found</AlertTitle>
                  <AlertDescription>
                    Check your Supabase connection and RLS policies.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void fetchTables()}
                disabled={isFetchingTables}
                className="w-full"
              >
                Refresh Table List
              </Button>
            </>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {selectedTable && !isLoading && (
          <>
            {/* Step 2: Basic Config */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">2. Basic Configuration</h2>
                <p className="text-sm text-muted-foreground">
                  Set the page title and entity key
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tableName">Page Title</Label>
                  <Input
                    id="tableName"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="e.g., Risks"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entityKey">Entity Key</Label>
                  <Input
                    id="entityKey"
                    value={entityKey}
                    onChange={(e) => setEntityKey(e.target.value)}
                    placeholder="e.g., risks"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for file names, URL params, localStorage keys
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Configure Columns */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">3. Configure Columns</h2>
                <p className="text-sm text-muted-foreground">
                  Select visible columns
                </p>
              </div>

              <div className="space-y-2">
                {columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-4 rounded-md border border-border p-3"
                  >
                    <Checkbox
                      checked={col.defaultVisible}
                      onCheckedChange={() =>
                        toggleColumn(col.name, "defaultVisible")
                      }
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{col.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {col.type}
                        {col.isSystemField ? " (system)" : ""}
                      </p>
                    </div>
                    {col.defaultVisible && !col.isSystemField && (
                      <label className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={col.alwaysVisible || false}
                          onCheckedChange={() =>
                            toggleColumn(col.name, "alwaysVisible")
                          }
                        />
                        Always visible
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4: Search Fields */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">4. Search Fields</h2>
                <p className="text-sm text-muted-foreground">
                  Which fields are searchable
                </p>
              </div>

              <div className="space-y-2">
                {columns
                  .filter((c) => c.type === "text" && !c.isSystemField)
                  .map((col) => (
                    <label
                      key={col.name}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={searchFields.includes(col.name)}
                        onCheckedChange={() => toggleSearchField(col.name)}
                      />
                      {col.name}
                    </label>
                  ))}
              </div>
            </div>

            {/* Step 5: Filters */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">5. Filters (Optional)</h2>
                <p className="text-sm text-muted-foreground">
                  Add dropdown filters for enum/badge fields
                </p>
              </div>

              <div className="space-y-4">
                {filters.map((filter, idx) => (
                  <div
                    key={idx}
                    className="space-y-4 rounded-md border border-border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Filter {idx + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFilter(idx)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Field</Label>
                        <Select
                          value={filter.field}
                          onValueChange={(v) => updateFilter(idx, { field: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {columns
                              .filter((c) => c.type === "badge")
                              .map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input
                          value={filter.label}
                          onChange={(e) =>
                            updateFilter(idx, { label: e.target.value })
                          }
                          placeholder="e.g., Status"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Options</Label>
                      {filter.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex gap-2">
                          <Input
                            placeholder="value"
                            value={opt.value}
                            onChange={(e) =>
                              updateFilterOption(
                                idx,
                                optIdx,
                                "value",
                                e.target.value,
                              )
                            }
                          />
                          <Input
                            placeholder="label"
                            value={opt.label}
                            onChange={(e) =>
                              updateFilterOption(
                                idx,
                                optIdx,
                                "label",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addFilterOption(idx)}
                      >
                        Add Option
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addFilter}>
                  Add Filter
                </Button>
              </div>
            </div>

            {/* Generate */}
            <div className="flex justify-end pt-4">
              <Button size="lg" onClick={handleGenerate}>
                Generate Code
              </Button>
            </div>

            {/* Generated Output */}
            {generatedConfigCode && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Generated Code</h2>
                  <p className="text-sm text-muted-foreground">
                    Two files to create:
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    <li>
                      1.{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        frontend/src/features/{kebab}/{kebab}-table-config.tsx
                      </code>
                    </li>
                    <li>
                      2.{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        frontend/src/app/(tables)/{entityKey}/page.tsx
                      </code>
                    </li>
                  </ul>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-border">
                  <Button
                    variant="ghost"
                    onClick={() => setActiveTab("config")}
                    className={cn(
                      "rounded-none px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeTab === "config"
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Table Config
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setActiveTab("page")}
                    className={cn(
                      "rounded-none px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeTab === "page"
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Page Component
                  </Button>
                </div>

                <div className="relative">
                  <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed" style={{ maxHeight: "32rem" }}>
                    <code>
                      {activeTab === "config"
                        ? generatedConfigCode
                        : generatedPageCode}
                    </code>
                  </pre>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      void copyToClipboard(
                        activeTab === "config"
                          ? generatedConfigCode
                          : generatedPageCode,
                      )
                    }
                  >
                    <Copy />
                    Copy {activeTab === "config" ? "Config" : "Page"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      downloadFile(
                        activeTab === "config"
                          ? generatedConfigCode
                          : generatedPageCode,
                        activeTab === "config"
                          ? `${kebab}-table-config.tsx`
                          : "page.tsx",
                      )
                    }
                  >
                    <Download />
                    Download {activeTab === "config" ? "Config" : "Page"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </FormLayout>
    </PageShell>
  );
}
