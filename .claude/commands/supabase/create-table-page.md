---
description: "Generate a (tables) or (admin) page for a Supabase table using UnifiedTablePage"
allowed-tools: "Read, Write, Bash, Glob, Grep, Edit"
---

# Create Table Page

Generate a complete route page for a Supabase table using `UnifiedTablePage` with ALL standard features: selection checkboxes, row actions (vertical dots dropdown), delete, bulk delete, sorting, filtering, pagination, column visibility, and export.

## Input

The user provides: `$ARGUMENTS`

This should be either:
1. A table name (e.g., `support_articles`)
2. A table name + SQL schema (CREATE TABLE statement)
3. Optionally: route group `(admin)` or `(tables)` — defaults to `(admin)`

## Instructions

**DO NOT explore patterns. DO NOT search for examples. The template is below.**

### Step 1: Resolve the Schema

If the user provided a CREATE TABLE statement, parse columns from it directly. Skip to Step 2.

If only a table name was given:
1. First check `frontend/src/types/database.types.ts` for the table definition
2. If not found, regenerate types: `npm run db:types` (from frontend dir)
3. Read the Row type from `database.types.ts` for that table

### Step 2: Derive Names

From the table name (e.g., `support_articles`):
- **Route slug**: `support-articles` (replace underscores with hyphens)
- **Page title**: `Support Articles` (title case, spaces)
- **Client component name**: `SupportArticlesClient`
- **Function name**: `SupportArticlesPage` (PascalCase + Page)
- **Route group**: `(admin)` by default

### Step 3: Generate the Server Page

Create: `frontend/src/app/{route-group}/{route-slug}/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { __CLIENT_COMPONENT__ } from "./__route-slug__-client";

export default async function __PAGE_FUNCTION__() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("__TABLE_NAME__")
    .select("__COLUMNS__")  // explicit column list, no "*"
    .order("__SORT_COLUMN__", { ascending: true })
    .limit(50000);  // Supabase default is 1000 — always set an explicit limit

  return (
    <__CLIENT_COMPONENT__
      items={data ?? []}
      errorMessage={error?.message ?? null}
    />
  );
}
```

### Step 4: Generate the Client Component

Create: `frontend/src/app/{route-group}/{route-slug}/{route-slug}-client.tsx`

**MANDATORY features — every single one of these MUST be present:**

1. `selection` prop — checkboxes on every row
2. `table.rowActions` — vertical dots dropdown with View/Edit/Delete
3. `toolbar.onBulkDelete` — bulk delete when rows are selected
4. `toolbar.selectedCount` — wired to `tableState.selectedIds.length`
5. `sorting` prop — column header sorting
6. `pagination` prop — page/perPage controls
7. `toolbar.filters` — at least category/status if applicable
8. `toolbar.columns` + `visibleColumns` — column visibility toggle
9. `emptyState` — both default and filtered variants
10. `handleDelete` — Supabase delete + optimistic local state removal

Use this exact template:

```tsx
"use client";

import * as React from "react";
import { useMemo } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CellText,
  TableDateValue,
  TruncatedCell,
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { createClient } from "@/lib/supabase/client";

// ── Types ───────────────────────────────────────────────────────────────────

interface __ITEM_TYPE__ {
  // All columns from the table Row type
}

interface __CLIENT_PROPS__ {
  items: __ITEM_TYPE__[];
  errorMessage: string | null;
}

// ── Column metadata ─────────────────────────────────────────────────────────
// RULES:
// - First column: alwaysVisible: true (the "name" / primary field)
// - id, created_at, updated_at: defaultVisible: false
// - Show 4-6 most useful columns by default
// - Status/category columns: use StatusBadge in render

const columns: ColumnConfig[] = [
  { id: "__primary__", label: "__Primary__", alwaysVisible: true },
  // ... more columns
];

const defaultVisibleColumns = columns
  .filter((c) => c.defaultVisible !== false)
  .map((c) => c.id);

// ── Table columns ───────────────────────────────────────────────────────────

function buildTableColumns(): TableColumn<__ITEM_TYPE__>[] {
  return [
    // Each column: { ...columns[N], render, csvValue, sortValue, sortable }
  ];
}

// ── Row actions (MANDATORY) ─────────────────────────────────────────────────

function renderRowActions(
  item: __ITEM_TYPE__,
  onDelete: (item: __ITEM_TYPE__) => void,
) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Add View/Edit items as appropriate */}
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Filters ─────────────────────────────────────────────────────────────────
// Derive filter options from data using useMemo inside the component

// ── Filter / sort helpers ───────────────────────────────────────────────────

const EMPTY_FILTERS: Record<string, FilterValue> = {};

function applyFilters(
  items: __ITEM_TYPE__[],
  search: string,
  filters: Record<string, FilterValue>,
): __ITEM_TYPE__[] {
  // Search across text fields, apply each filter
}

function sortItems(
  items: __ITEM_TYPE__[],
  sortBy: string,
  direction: "asc" | "desc",
): __ITEM_TYPE__[] {
  // Sort by the given column
}

// ── Page component ──────────────────────────────────────────────────────────

export function __CLIENT_COMPONENT__({
  items: initialItems,
  errorMessage,
}: __CLIENT_PROPS__) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Local state for optimistic deletes
  const [items, setItems] = React.useState(initialItems);

  // Derive filter options from data
  // const categories = useMemo(() => ..., [items]);

  // Derive active filters from URL — NOT from tableState.activeFilters
  const activeFilters = useMemo<Record<string, FilterValue>>(
    () => ({
      // Add one entry per filterable field:
      // status: searchParams.get("status") || undefined,
      // category: searchParams.get("category") || undefined,
    }),
    [searchParams],
  );

  const tableState = useUnifiedTableState({
    entityKey: "__route-slug__",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "__primary_column__",
      sortDirection: "asc",
      visibleColumns: defaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const tableColumns = useMemo(() => buildTableColumns(), []);

  const isFiltered =
    !!tableState.debouncedSearch;
    // || !!activeFilters.status || !!activeFilters.category;

  const filteredItems = useMemo(
    () => applyFilters(items, tableState.debouncedSearch, activeFilters),
    [items, tableState.debouncedSearch, activeFilters],
  );

  const sortedItems = useMemo(() => {
    const col = tableColumns.find((c) => c.id === tableState.sortBy);
    if (!col?.sortValue) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number")
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      return tableState.sortDirection === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filteredItems, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / tableState.perPage));

  const paginatedItems = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedItems.slice(start, start + tableState.perPage);
  }, [sortedItems, tableState.page, tableState.perPage]);

  const handleFilterChange = (nextFilters: Record<string, FilterValue>) => {
    tableState.setSearchParams({
      // status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  // ── Selection handlers (MANDATORY) ──────────────────────────────────────

  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = paginatedItems.map((item) => String(item.id));
        tableState.setSelectedIds(allIds);
      } else {
        tableState.setSelectedIds([]);
      }
    },
    [paginatedItems, tableState],
  );

  const handleSelectRow = React.useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        tableState.setSelectedIds([...tableState.selectedIds, id]);
      } else {
        tableState.setSelectedIds(
          tableState.selectedIds.filter((sid) => sid !== id),
        );
      }
    },
    [tableState],
  );

  // ── Delete handler (MANDATORY) ────────────────────────────────────────

  const handleDelete = React.useCallback(
    async (item: __ITEM_TYPE__) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("__TABLE_NAME__")
        .delete()
        .eq("id", item.id);

      if (error) {
        toast.error("Failed to delete", { description: error.message });
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      tableState.setSelectedIds(
        tableState.selectedIds.filter((sid) => sid !== String(item.id)),
      );
      toast.success("Deleted successfully");
    },
    [tableState],
  );

  // ── Bulk delete (MANDATORY) ───────────────────────────────────────────

  const handleBulkDelete = React.useCallback(async () => {
    const ids = tableState.selectedIds.map(Number);
    const supabase = createClient();
    const { error } = await supabase
      .from("__TABLE_NAME__")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Failed to delete", { description: error.message });
      return;
    }

    const idSet = new Set(ids);
    setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
    tableState.setSelectedIds([]);
    toast.success(`Deleted ${ids.length} item${ids.length === 1 ? "" : "s"}`);
  }, [tableState]);

  return (
    <UnifiedTablePage<__ITEM_TYPE__>
      header={{
        title: "__PAGE_TITLE__",
        description: `${items.length.toLocaleString()} items`,
      }}
      layout={{ fullBleedTable: true }}
      toolbar={{
        totalItems: items.length,
        filteredItems: filteredItems.length,
        selectedCount: tableState.selectedIds.length,  // NEVER hardcode 0
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters: tableFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onBulkDelete: handleBulkDelete,  // MANDATORY
      }}
      data={{
        items: paginatedItems,
        isLoading: false,
        isFetching: false,
        error: errorMessage ? new Error(errorMessage) : null,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => String(item.id),
        rowActions: (item) => renderRowActions(item, handleDelete),  // MANDATORY
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setPage(1);
        },
      }}
      selection={{  // MANDATORY — this gives you checkboxes
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No __items__ found",
        description: "No data available.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: (p) => {
          tableState.setPage(p);
          tableState.setSearchParams({ page: String(p) });
        },
        onPerPageChange: (pp) => {
          tableState.setPerPage(pp);
          tableState.setPage(1);
        },
      }}
    />
  );
}
```

### Step 5: Verify

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | grep -E "{route-slug}" | head -10
```

### MANDATORY CHECKLIST — Verify before finishing

- [ ] `selection` prop present with `selectedIds`, `onSelectAll`, `onSelectRow`
- [ ] `table.rowActions` present with `MoreHorizontal` dropdown
- [ ] `toolbar.selectedCount` = `tableState.selectedIds.length` (NOT hardcoded 0)
- [ ] `toolbar.onBulkDelete` present
- [ ] `handleDelete` removes from Supabase AND local state
- [ ] `handleBulkDelete` removes from Supabase AND local state
- [ ] `sorting` prop present
- [ ] `pagination` prop present
- [ ] `toolbar.columns` + `visibleColumns` present
- [ ] No TypeScript errors

### What NOT To Do

- DO NOT use `GenericDataTable` — it's deprecated, use `UnifiedTablePage`
- DO NOT hardcode `selectedCount: 0` — wire it to `tableState.selectedIds.length`
- DO NOT skip `selection` prop — every table needs checkboxes
- DO NOT skip `rowActions` — every table needs the vertical dots dropdown
- DO NOT skip `onBulkDelete` — every table needs bulk delete
- DO NOT use `*` in Supabase select — list columns explicitly
- DO NOT import `Database` type — define the interface inline from the types file
- DO NOT create hooks or services — server component queries directly, client uses `createClient` for mutations
