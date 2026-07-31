# Table Consistency Guardrail

All app-level table/list pages should use `UnifiedTablePage` from `@/components/tables/unified`.

## Standard

- Route table pages use `UnifiedTablePage`.
- Table state uses `useUnifiedTableState`.
- Table columns use `TableColumn` from the unified table barrel.
- Page code should not render raw `<table>` markup.
- Page code should not import shadcn table primitives directly from `@/components/ui/table`.
- Page code should not use legacy table builders such as `generic-table-factory`, `components/data-table`, or `simple-table-page`.
- Header colors, header density, row hover states, selection, sorting, pagination, column visibility, search, and filters should come from the unified table stack.

## Exceptions

Any intentional divergence must be annotated in the owning file:

```tsx
// @table-exception: This is a fixed-format financial entry grid that requires spreadsheet-style keyboard navigation and cannot use UnifiedTablePage.
```

The reason must be specific. Generic reasons such as "custom table" or "different styling" are not acceptable.

## Audit

Run:

```bash
cd frontend && npm run audit:table-layouts
```

To write the current debt report:

```bash
cd frontend && npm run audit:table-layouts -- --report=../docs/design/table-layout-audit.md
```

The audit fails on:

- `NON_STANDARD`: table-like UI without `UnifiedTablePage`.
- `MIXED`: `UnifiedTablePage` is present, but raw/custom table code is still present in the route.

The audit allows:

- `OK`: clean unified-table usage.
- `EXCEPTION`: non-standard table usage with a documented `@table-exception`.
- `UNKNOWN`: route candidate has no detected table surface and needs manual classification before migration planning.

The audit checks both route-level table pages and reusable source files under `src/app`, `src/components`, and `src/features`. This prevents stale wrappers or buried custom table components from passing just because the route file imports a unified table page.
