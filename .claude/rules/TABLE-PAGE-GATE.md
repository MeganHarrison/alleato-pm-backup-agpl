# Table Page Gate

**Trigger:** Any time you are creating or editing ANY page or component that renders a list, table, or data grid.

## Step 0 — MANDATORY before writing any table JSX

Invoke the `alleato-table-page` skill:

```
Skill("alleato-table-page")
```

No exceptions. Every table page in this repo uses `UnifiedTablePage`. If you build a table without invoking this skill first, you will get it wrong.

## What the skill covers

- Required imports from `@/components/tables/unified`
- `useUnifiedTableState` hook setup
- `UnifiedTablePage` props structure (all required sections)
- Column and filter config file pattern
- Forbidden patterns and their correct replacements

## Forbidden patterns

| Never | Always |
|-------|--------|
| `<Table>` / `<TableBody>` / `<TableRow>` from ui/table | `UnifiedTablePage` |
| Manual `useState` for search, sort, filter, pagination | `useUnifiedTableState` |
| Filters or column toggles in `header.actions` | Toolbar only |
| Missing row selection | Include `selection` + `onSelectAll` + `onSelectRow` |
| Missing row actions | Include `rowActions` (⋯ menu with edit + delete) |
| Missing bulk delete | Include `toolbar.onBulkDelete` |
| Missing empty state | Include `emptyState` with default + filtered descriptions |
| Missing pagination | Include `pagination` section |
| Inline column/filter config | Extract to `features/<tool>/<tool>-table-config.ts` |

## Reference implementation

- `frontend/src/app/(main)/[projectId]/commitments/page.tsx`
- `frontend/src/features/commitments/commitments-table-config.ts`

## Why this gate exists

A table was built using raw shadcn `<Table>` primitives instead of `UnifiedTablePage`, missing search, filters, column visibility, row selection, bulk delete, empty states, and pagination. Every table page in this app is built once with the same system — there is no acceptable reason to rebuild from scratch.
