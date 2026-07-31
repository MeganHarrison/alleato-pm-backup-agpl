# Table System

Consolidated reference for all table pages.

---

## Why We Migrated Away From UnifiedTablePage

`UnifiedTablePage` was a monolith — one 1,200-line component that tried to do everything. The problems:

- Features were buried in deeply nested props, hard to override or extend
- Column filter config lived separately from column definitions, causing constant drift
- No URL-state persistence — filters/sort reset on navigation
- No column drag-and-drop reorder, pinning, or resize
- Density and column visibility weren't persisted across sessions
- Row count was on a separate line from the toolbar

We replaced it with a two-piece architecture: **`useDataTable`** (URL state) + **`AleatoDataTable`** (rendering). The gold standard implementation is the RFI table.

---

## New Architecture

```
Page (RSC)
└── *Table client component
    ├── useSearchParams()          ← reads URL state
    ├── useQuery()                 ← React Query data fetching
    ├── useDataTable()             ← TanStack table instance + URL sync
    └── AleatoDataTable            ← all rendering, toolbar, features
        ├── PageShell variant="table"
        ├── PageTabs variant="inline"  ← if tabs needed
        ├── Toolbar (search, filter, density, columns, export)
        ├── Filter panel (popover, all filterable columns)
        ├── Table (resizable, reorderable, pinnable columns)
        ├── Bulk action bar (appears on selection)
        └── Pagination
```

---

## Page Structure

```
┌─────────────────────────────────────────────────────────┐
│ Page Title                              [+ Create]      │  ← PageShell header
├─────────────────────────────────────────────────────────┤
│ [All] [Open] [Closed]                                   │  ← PageTabs variant="inline"
├─────────────────────────────────────────────────────────┤
│ 24 items  ···  🔍  [⚙][≡][↓]                           │  ← Toolbar (count left, icons right)
├─────────────────────────────────────────────────────────┤
│  ☐  #   Subject         Status    Due Date   Assignees  │
│  ─────────────────────────────────────────────────────  │
│  ☐  1   Lorem ipsum     Open      Jan 15     J. Smith   │
│  ☐  2   Dolor sit       Closed    Jan 22     A. Jones   │
├─────────────────────────────────────────────────────────┤
│  Rows per page [25 ▾]          ‹  1  2  3  …  12  ›    │
└─────────────────────────────────────────────────────────┘
```

---

## Gold Standard: RFI Table

**Files:**
- `frontend/src/app/(main)/[projectId]/rfis/page.tsx` — thin RSC shell
- `frontend/src/app/(main)/[projectId]/rfis/rfis-table.tsx` — client component
- `frontend/src/features/rfis/rfis-columns.tsx` — column definitions

### page.tsx (RSC shell)

```tsx
export const dynamic = "force-dynamic";
import * as React from "react";
import { RfisTable } from "./rfis-table";

export default async function RfisPage({ params }) {
  const { projectId } = await params;
  return (
    <React.Suspense fallback={null}>
      <RfisTable projectId={parseInt(projectId, 10)} />
    </React.Suspense>
  );
}
```

### rfis-table.tsx (client component)

```tsx
"use client";

export function RfisTable({ projectId }: { projectId: number }) {
  const router = useRouter();
  const searchParamsRaw = useSearchParams();
  const searchParams = searchParamsRaw ?? new URLSearchParams();

  // Read URL state
  const page = Number(searchParams.get("page") ?? "1");
  const perPage = Number(searchParams.get("perPage") ?? "25");
  const sort = searchParams.get("sort");
  const search = searchParams.get("search");

  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ["rfis", projectId, { page, perPage, sort, search }],
    queryFn: () => fetchRfis(projectId, { page, perPage, sort, search }),
    placeholderData: (prev) => prev,
  });

  // Build table instance
  const { table } = useDataTable({
    data: data?.data ?? [],
    columns,
    pageCount: data?.meta.totalPages ?? 1,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    initialState: {
      pagination: { pageIndex: 0, pageSize: 25 },
      columnVisibility: { /* hide low-priority columns by default */ },
    },
  });

  return (
    <PageShell variant="table" title="RFIs" description="..." actions={<Button>Create RFI</Button>}>
      <AleatoDataTable
        table={table}
        isLoading={isLoading}
        storageKey={`rfis-${projectId}`}
        tabs={tabs}               // optional — rendered as PageTabs variant="inline"
        searchValue={search ?? ""}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search RFIs…"
        onBulkDelete={handleBulkDelete}
      />
    </PageShell>
  );
}
```

### Column definitions

Every column must declare:
- `size` / `minSize` — required for resize to work correctly
- `enableColumnFilter: true` + `meta.variant` — required to appear in the filter panel
- `meta.label` — shown in column visibility menu and filter panel

```tsx
{
  accessorKey: "status",
  size: 110,
  minSize: 80,
  header: "Status",
  cell: ({ row }) => <CellStatus value={row.getValue("status")} />,
  enableColumnFilter: true,
  meta: {
    label: "Status",
    variant: "select",
    options: STATUS_OPTIONS.map(s => ({ label: s.label, value: s.value })),
  },
},
```

**Filter variants:**

| `meta.variant` | Renders as | Use for |
|----------------|-----------|---------|
| `"text"` | Text input | Free-text fields (name, subject, notes) |
| `"select"` | Faceted filter (checkboxes) | Fixed option sets (status, type) |
| `"multiSelect"` | Same as select | Same |
| `"date"` | Date picker | Single date fields |
| `"dateRange"` | Date range picker | Created/updated/due date fields |

**Cell primitives** — always import from `@/components/tables/unified/table-primitives`:

| Import | Use for |
|--------|---------|
| `CellText` | Plain text (handles null with `—`) |
| `CellStatus` | Status strings → design system colors |
| `CellDate` | ISO date → formatted display |

**Never hand-roll** status colors, date formatting, or null display. Use the primitives.

---

## AleatoDataTable Props

```tsx
<AleatoDataTable
  table={table}              // TanStack table instance from useDataTable()
  isLoading={boolean}        // shows skeleton rows
  storageKey={string}        // unique per page — persists density + column order to localStorage

  // Tabs (optional)
  tabs={TabItem[]}           // renders PageTabs variant="inline" above toolbar

  // Search
  searchValue={string}
  onSearchChange={(val) => void}
  searchPlaceholder={string}

  // Bulk delete (optional — enables bulk action bar on row selection)
  onBulkDelete={(ids: string[]) => Promise<void>}
/>
```

**Features are ALL ON by default.** There is no per-feature flag — every `AleatoDataTable` gets:
- Column resize (drag right edge, double-click to reset)
- Column reorder (drag grip handle)
- Column pinning (right-click header → pin left / right / unpin)
- Column visibility (toolbar icon → dropdown with reset)
- Density control (toolbar icon → compact / default / relaxed, persisted to localStorage)
- Filter panel (toolbar icon → popover, all filterable columns)
- Sort (click any column header)
- Bulk selection + bulk delete (when `onBulkDelete` provided)
- Export (toolbar icon)
- Keyboard navigation (ArrowUp / ArrowDown)
- Expandable search (toolbar icon → expands inline)
- Row count on same line as toolbar

---

## Tabs

Use `PageTabs` with `variant="inline"` — this is what `AleatoDataTable` renders internally when you pass `tabs`. If you build a page without `AleatoDataTable` and need tabs, pass them the same way:

```tsx
// ✅ Correct
<PageTabs tabs={tabs} variant="inline" />

// ❌ Wrong — default variant uses larger padding and more bottom margin
<PageTabs tabs={tabs} />
```

Tab structure:
```tsx
const tabs = [
  { label: "All",    href: buildTabHref("all"),    count: allCount,    isActive: activeTab === "all" },
  { label: "Open",   href: buildTabHref("open"),   count: openCount,   isActive: activeTab === "open" },
  { label: "Closed", href: buildTabHref("closed"), count: closedCount, isActive: activeTab === "closed" },
];
```

---

## PageShell Variants (width reference)

| Variant | Content Width | Use for |
|---------|--------------|---------|
| `"table"` | Full-width | All data table pages |
| `"dashboard"` | `max-w-[1800px]` | Home / overview with KPI cards |
| `"detail"` | `max-w-6xl` | Record detail pages with tabs |
| `"detailWide"` | `max-w-screen-2xl` | Detail pages needing more canvas |
| `"form"` | `max-w-5xl` | Create / edit forms |
| `"content"` | `max-w-4xl` | Settings, docs, read-heavy pages |

---

## Row Actions Pattern

Every table row needs a three-dots menu (never a standalone icon button for edit/delete):

```tsx
function RowActions({ row, projectId }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/${projectId}/entity/${row.id}`)}>
          <Eye className="mr-2 h-4 w-4" /> View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/${projectId}/entity/${row.id}?mode=edit`)}>
          <SquarePen className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Migration Status

Pages migrated to `AleatoDataTable`:
- [x] RFIs ← **gold standard**

Pages still on `UnifiedTablePage` (to be migrated):
- [ ] Commitments
- [ ] Change Events
- [ ] Invoicing
- [ ] Submittals
- [ ] Direct Costs
- [ ] Prime Contracts
- [ ] Drawings
- [ ] Estimates
- [ ] Budget
- [ ] Tasks
- [ ] (and remaining pages)

---

## Deprecated — Never Use

```
UnifiedTablePage     → migrate to useDataTable + AleatoDataTable
DataTablePage        → deprecated
GenericDataTable     → deprecated
TableLayout          → use PageShell variant="table"
```

`UnifiedTablePage` will be deleted once all pages are migrated.
