# Table/Page Pattern Enforcement

Apply the standard Alleato table page pattern to a page. Use when building or fixing any page that displays data in a table, list, or grid.

## Arguments: $ARGUMENTS

$ARGUMENTS = page file path or feature name (optional — if omitted, applies to whatever page is currently being worked on)

## RULES — NO EXCEPTIONS

Read the pattern reference at `memory/table-page-patterns.md` in the auto-memory directory BEFORE making any changes. Follow it exactly.

### Header Actions

The `ProjectPageHeader` `actions` prop gets ONLY the primary create/add button. Nothing else.

- NO filter buttons in the header
- NO column visibility in the header
- NO export/import in the header
- NO share buttons anywhere
- NO refresh buttons in the header

### Toolbar

Every table page gets a `TableToolbar` from `@/components/tables/unified/table-toolbar`.

The toolbar provides:
- Expandable search
- Filter popover (with badge count)
- Column visibility dropdown
- Export icon button
- Bulk delete icon (when applicable)

If the page uses `UnifiedTablePage`, this is automatic via the `toolbar` prop.
If the page has custom views (like Schedule), use `TableToolbar` directly.

### Page Structure

```
ProjectPageHeader (title + description + create button)
PageContainer
  ├── [Optional tabs]
  ├── TableToolbar
  ├── [Optional bulk action bar]
  ├── Table/view content
  └── [Optional pagination]
```

### Button Component

- `gap-1.5` globally — DO NOT CHANGE `button.tsx`
- Icon size in buttons: `h-4 w-4` (no `mr-2` needed, gap handles spacing)
- Import from `@/components/ui/button`

### Imports

```tsx
// Header + container
import { PageContainer, ProjectPageHeader } from "@/components/layout";

// Toolbar (if not using UnifiedTablePage)
import { TableToolbar, type FilterConfig, type ColumnConfig } from "@/components/tables/unified/table-toolbar";

// Primary action button
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
```

## Steps

1. Read the target page file
2. Check if it uses `UnifiedTablePage` — if yes, ensure `header.actions` only has the create button and `toolbar` has filters/columns/export
3. If it doesn't use `UnifiedTablePage`, ensure it uses `ProjectPageHeader` + `TableToolbar` following the exact pattern above
4. Remove any filters, column toggles, export/import/share/refresh from header actions
5. Clean up unused imports
6. Verify no lint errors
