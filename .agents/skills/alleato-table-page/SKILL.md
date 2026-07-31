---
name: alleato-table-page
description: >
  Alleato PM table page pattern using UnifiedTablePage + useUnifiedTableState.
  Use when building or modifying any list/table page in the app. Covers imports,
  props, toolbar rules, header rules, config file pattern, and forbidden anti-patterns.
metadata:
  filePatterns:
    - "frontend/src/app/(main)/**/**/page.tsx"
    - "frontend/src/app/(main)/*/page.tsx"
    - "frontend/src/features/**/*table-config*"
    - "frontend/src/components/tables/**"
priority: 90
---

# Alleato Table Page Pattern

## Decision Checklist — answer BEFORE writing any JSX

For every new table page, answer these three questions. Skipping this is how you ship dead checkboxes, missing detail routes, and broken delete flows.

| Question | If "yes" you MUST wire | If "no" you MUST opt out |
|---|---|---|
| Can a row be deleted from this list? | `table.onDelete` **and** a `DELETE` API route. This is what makes both the row-level "⋯ → Delete" and the toolbar bulk-delete trash icon appear. | (do nothing — selection checkboxes will auto-hide; see "Selection requires a bulk action" below) |
| Can a row be edited from this list? | `table.onEdit` (or `onRowClick` to a detail page that has its own edit mode) | (do nothing) |
| Does a row open a detail page? | `table.onRowClick: (item) => router.push(...)` **and** create the matching `[entityId]/page.tsx` route | (do nothing) |
| Does this entity have status/type/owner filters? | `toolbar.filters` + URL-synced `activeFilters` via `useUnifiedTableState` | (do nothing — search alone covers most read-only tables) |

If the answer to "can be deleted" is yes, also confirm the DELETE API route updates the React Query cache (`queryClient.invalidateQueries`) so the row disappears after the bulk-delete confirmation.

---

## Selection requires a bulk action — the #1 mistake

`UnifiedTablePage` auto-hides selection checkboxes when there is no bulk action wired. Checkboxes appear only if one of these is true:

- `table.onDelete` is provided → bulk delete is auto-built (trash icon in toolbar opens a confirmation dialog)
- `toolbar.onBulkDelete` is provided → your custom bulk handler runs
- You explicitly pass `selection={{...}}` (URL-synced selection) or `features={{ enableRowSelection: true }}`

**What this prevents:** building a table with checkboxes that the user can click but that don't do anything — the bug pattern that produced this rule.

**If you need checkboxes for a custom bulk action other than delete** (e.g. "Approve selected", "Move to project"):

```tsx
<UnifiedTablePage
  features={{ enableRowSelection: true }}     // explicit opt-in
  toolbar={{
    ...,
    customActions: selectedIds.length > 0 ? (
      <Button onClick={handleApproveSelected}>Approve {selectedIds.length}</Button>
    ) : null,
  }}
  selection={{ selectedIds, onSelectAll, onSelectRow }}
/>
```

---

## Imports

```ts
// Main component + hook + types — always from the barrel
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
```

The barrel at `frontend/src/components/tables/unified/index.ts` re-exports everything.
Never import from `unified-table-page.tsx` or `table-toolbar.tsx` directly.

---

## useUnifiedTableState

Manages all table state: search, filters, pagination, sort, column visibility, selected rows, view mode.

```ts
const tableState = useUnifiedTableState({
  entityKey: "commitments",          // unique key for localStorage persistence
  searchParams,                       // from useSearchParams()
  pathname,                           // from usePathname()
  router,                             // from useRouter()
  defaults: {
    view: "table",                    // "table" | "card" | "list"
    allowedViews: ["table", "card", "list"],
    page: 1,
    perPage: 25,
    search: "",
    sortBy: "number",                 // column id to sort by default
    sortDirection: "asc",
    visibleColumns: myDefaultVisibleColumns,  // string[] of column ids
    filters: { status: undefined, type: undefined },
  },
});
```

**Key state fields:**
- `tableState.searchInput` / `tableState.setSearchInput` — raw search string (debounced internally)
- `tableState.debouncedSearch` — use this for API calls, not `searchInput`
- `tableState.page` / `tableState.setPage`
- `tableState.perPage` / `tableState.setPerPage`
- `tableState.sortBy` / `tableState.sortDirection`
- `tableState.visibleColumns` / `tableState.setVisibleColumns`
- `tableState.selectedIds` / `tableState.setSelectedIds`
- `tableState.currentView` / `tableState.setCurrentView`
- `tableState.activeFilters` / `tableState.setActiveFilters`
- `tableState.setSearchParams(obj)` — syncs state to URL query params

---

## What is automatic vs. what you must wire

The component handles most plumbing internally. Read this carefully — the word "automatic" only applies to the features below. Anything not listed here is **not** automatic.

**Truly automatic — works with zero configuration:**
- Search — debounced internally, filters the rows you pass in `data.items`
- Sorting — clicking column headers; works as long as columns define `sortable: true` + `sortValue`
- Pagination — defaults to 25 rows/page client-side
- Column visibility — persisted to localStorage by `header.title`
- View switcher — table / card / list
- Export — auto-built CSV from columns that define `csvValue`

**Automatic ONLY when you wire the prerequisite handler:**
| Feature | Prerequisite |
|---|---|
| Row "⋯ → Edit" menu item | `table.onEdit` |
| Row "⋯ → Delete" menu item + single-row confirm dialog | `table.onDelete` |
| Toolbar bulk-delete trash icon + bulk confirm dialog | `table.onDelete` (auto) OR `toolbar.onBulkDelete` (custom) |
| **Selection checkboxes** | one of: `table.onDelete`, `toolbar.onBulkDelete`, explicit `selection={...}`, or `features.enableRowSelection: true` |
| Filters | `toolbar.filters` + `toolbar.activeFilters` + `toolbar.onFilterChange` |
| URL-synced state (page, sort, search, filters, view) | `useUnifiedTableState` |

**Required props (no defaults):** `header`, `toolbar` (totalItems, filteredItems, searchValue, onSearchChange, currentView, onViewChange), `data`, `table.columns`, `table.getRowId`, `emptyState`.

**To disable a feature:**
```tsx
features={{ enablePagination: false, enableSorting: false, enableExport: false }}
```

**To add Edit to the default row actions menu:**
```tsx
table={{ onEdit: (item) => router.push(`.../${item.id}/edit`), onDelete: handleDelete }}
```
This renders a "⋯" menu with Edit + Delete (separator between them) automatically.

---

## Minimal viable table page

```tsx
<UnifiedTablePage
  header={{
    title: "Commitments",
    description: "Manage purchase orders and subcontracts",
    actions: <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create</Button>,
  }}
  toolbar={{
    totalItems: items.length,
    filteredItems: items.length,
    searchValue: tableState.searchInput,
    onSearchChange: tableState.setSearchInput,
    searchPlaceholder: "Search commitments...",
    currentView: tableState.currentView,
    onViewChange: tableState.setCurrentView,
  }}
  data={{ items, isLoading, error }}
  table={{
    columns: tableColumns,
    onEdit: (item) => router.push(`commitments/${item.id}/edit`),
    onDelete: handleDelete,   // bulk delete + single delete both auto-wired
    getRowId: (item) => String(item.id),
    onRowClick: (item) => router.push(`commitments/${item.id}`),
  }}
  emptyState={{
    title: "No commitments",
    description: "Create your first commitment to get started.",
    filteredDescription: "No commitments match your current filters.",
    isFiltered: Boolean(tableState.debouncedSearch),
    action: <Button onClick={handleCreate}>Create Commitment</Button>,
  }}
/>
```

In the example above: sorting, pagination (25/page), export, column visibility are automatic. Selection checkboxes + bulk delete appear because `table.onDelete` is wired. Drop `onDelete` and the checkboxes disappear (intentionally — see "Selection requires a bulk action").

---

## Full props example (when URL-synced state is needed)

```tsx
<UnifiedTablePage
  header={{
    title: "Commitments",
    description: "Manage purchase orders and subcontracts",
    actions: <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create</Button>,
  }}
  tabs={tabs}           // optional — TabItem[]
  toolbar={{
    totalItems,
    filteredItems: totalItems,
    // selectedCount is optional — omit it and the component derives it internally
    searchValue: tableState.searchInput,
    onSearchChange: tableState.setSearchInput,
    searchPlaceholder: "Search commitments...",
    currentView: tableState.currentView,
    onViewChange: (view) => {
      tableState.setCurrentView(view);
      tableState.setSearchParams({ view });
    },
    filters: myFilters,
    activeFilters,
    onFilterChange: handleFilterChange,
    onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
    customActions: <SomeIconButton />,
  }}
  data={{
    items: sortedItems,
    isLoading,
    isFetching,
    error: resolvedError,
  }}
  table={{
    columns: tableColumns,
    onEdit: (item) => router.push(`${item.id}/edit`),
    onDelete: handleDelete,
    getRowId: (item) => String(item.id),
    onRowClick: handleRowClick,
    activeRowId: null,
    stickyHeader: true,
  }}
  emptyState={{
    title: "No commitments",
    description: "Create your first commitment to get started.",
    filteredDescription: "No commitments match your current filters.",
    isFiltered: Boolean(tableState.debouncedSearch) || hasActiveFilters,
    action: <Button onClick={handleCreate}>Create Commitment</Button>,
  }}
  layout={{ fullBleedTable: true }}
/>
```

---

## TableColumn Definition

```ts
export type TableColumn<T> = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
  render: (item: T) => ReactNode;
  csvValue?: (item: T) => string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | null | undefined;
  width?: number;           // preferred pixel width
};
```

**Column config pattern** — separate columns config file is the standard:

```ts
// features/commitments/commitments-table-config.ts
export const commitmentColumns: ColumnConfig[] = [
  { id: "number", label: "#", alwaysVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "amount", label: "Amount", defaultVisible: true },
];

export const commitmentDefaultVisibleColumns = commitmentColumns
  .filter((c) => c.defaultVisible || c.alwaysVisible)
  .map((c) => c.id);

export function buildCommitmentTableColumns(projectId: string): TableColumn<CommitmentListItem>[] {
  return [
    { id: "number", label: "#", alwaysVisible: true, sortable: true,
      sortValue: (item) => item.number,
      render: (item) => <span>{item.number}</span> },
    // ...
  ];
}
```

---

## FilterConfig

```ts
export const commitmentFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",         // "select" | "multiSelect" | "dateRange" | "text" | "boolean" | "date" | "number"
    options: [
      { value: "draft", label: "Draft" },
      { value: "approved", label: "Approved" },
    ],
  },
  {
    id: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "subcontract", label: "Subcontract" },
      { value: "purchase_order", label: "Purchase Order" },
    ],
  },
];
```

---

## Tabs Pattern

```ts
// NO counts in tab labels — never add count prop
const tabs = [
  {
    label: "All",
    href: `/${projectId}/commitments`,
    isActive: !activeFilters.type,
  },
  {
    label: "Subcontracts",
    href: `/${projectId}/commitments?type=subcontract`,
    isActive: activeFilters.type === "subcontract",
  },
  {
    label: "Recycle Bin",
    href: `/${projectId}/commitments/recycle-bin`,
  },
];
```

**`activeFilters` must be derived from `searchParams` via `useMemo`, NOT from `tableState.activeFilters`:**

```ts
const activeFilters = useMemo<Record<string, FilterValue>>(
  () => ({
    type: searchParams.get("type") || undefined,
    status: searchParams.get("status") || undefined,
  }),
  [searchParams],
);
```

---

## Delete Pattern

**Single delete** — provide `table.onDelete`. The component renders a built-in "⋯" menu with Delete and a confirmation dialog automatically. No separate AlertDialog state needed in the page.

```tsx
table={{ onDelete: (item) => deleteItem(item.id) }}
```

**Edit + Delete** — provide both. The built-in "⋯" menu shows Edit first, then a separator, then Delete.

```tsx
table={{
  onEdit: (item) => router.push(`${item.id}/edit`),
  onDelete: (item) => deleteItem(item.id),
}}
```

**Bulk delete** — automatic when `table.onDelete` is provided. Selecting rows and clicking the trash icon in the toolbar shows a "Delete N items?" confirmation dialog before deleting. No manual `toolbar.onBulkDelete` wiring needed.

**Custom bulk delete** — override with `toolbar.onBulkDelete` to handle confirmation yourself:
```tsx
toolbar={{ onBulkDelete: selectedIds.length > 0 ? () => setMyBulkDeleteOpen(true) : undefined }}
```

---

## File Organization

| File | Location |
|------|----------|
| Page component | `frontend/src/app/(main)/[projectId]/<tool>/page.tsx` |
| Table config | `frontend/src/features/<tool>/<tool>-table-config.ts` |
| Hook | `frontend/src/hooks/use-<tool>-query.ts` |
| API route | `frontend/src/app/api/projects/[projectId]/<tool>/route.ts` |
| Domain components | `frontend/src/components/domain/<tool>/` |

---

## MANDATORY RULES

### Header actions = ONLY the primary Create/Add button
```tsx
// CORRECT
actions: <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create</Button>

// WRONG — filters, export, column toggles do NOT belong here
actions: <><FilterButton /><ExportButton /><CreateButton /></>
```

Toolbar (`toolbar.customActions`) is where extra icon buttons go (e.g., ERP sync, refresh).

### NEVER use these deprecated patterns
- `DataTablePage` — legacy, replaced by `UnifiedTablePage`
- `ProjectToolPage` — deprecated wrapper
- `PageHeader` from `@/components/design-system` — use `header` prop of `UnifiedTablePage`
- Generic `[id]` route params — always use `[projectId]`, `[contractId]`, etc.

### Standard features are automatic — do NOT wire them manually unless you need URL-sync
Search, column visibility (persisted to localStorage), pagination (25/page), export (CSV from `csvValue` columns), and sorting are all ON by default. You only need to wire these manually when you want URL-sync via `useUnifiedTableState`.

**Selection and delete are NOT in this list.** They require `table.onDelete` (or an explicit `selection`/`features.enableRowSelection` opt-in). See "Selection requires a bulk action" above. If you ship checkboxes that don't do anything, you have failed the Decision Checklist.

### Edit and Delete via `table.onEdit` / `table.onDelete` — no `rowActions` boilerplate
Providing `table.onEdit` and/or `table.onDelete` auto-builds the "⋯" menu. Only use `table.rowActions` when you need custom menu items beyond Edit/Delete.

### Page is "use client"
All table pages are client components — they use hooks, router, and interactive state.

### Sorting is automatic — no `sorting` prop needed
Define `sortable: true` and `sortValue` on columns. The component handles sort state internally. Column headers are clickable, sort arrows appear, ascending/descending works out of the box.

```ts
{ id: "amount", label: "Amount", sortable: true, sortValue: (item) => item.amount, render: ... }
```

Pass the `sorting` prop only when you need sort state in the URL (via `useUnifiedTableState`).

### Pagination is automatic — no `pagination` prop needed
Defaults to 25 rows/page with client-side slicing. Pass `pagination` prop only when integrating server-side pagination or URL-synced page state.

---

## Quick Reference

| What | Value |
|------|-------|
| Barrel import | `@/components/tables/unified` |
| Main component | `UnifiedTablePage` |
| State hook | `useUnifiedTableState` |
| Column type | `TableColumn<T>` |
| Filter type | `FilterConfig` |
| Filter value type | `FilterValue` |
| Column config type | `ColumnConfig` |
| Good example | `frontend/src/app/(main)/[projectId]/commitments/page.tsx` |
| Table config example | `frontend/src/features/commitments/commitments-table-config.ts` |
