# UI Audit Checklist

The running list of things to check on every page during a UI audit. Started from
Megan's live feedback; add a new item whenever a class of problem is found so the next
audit catches it automatically. Each item links to the binding rule (noise-gate log or a
gate doc) where one exists.

**How to use:** walk a page top to bottom against this list. Every unchecked box is a
finding. When a new class of problem surfaces in feedback, add a row here in the same turn.

---

## Tables & lists

- [ ] **No content stacked in a table cell.** One value, one line. A bold-label-over-gray-sublabel
      pair, or a two-line stack inside a cell, is a finding. Each attribute is its own column.
      → noise-gate log #2, #21
- [ ] **No duplicated data in a cell.** A datum appears once. Never render the same value twice
      (e.g. contract number over an identical contract title). De-dupe: only show a secondary
      field when it differs from the primary. → noise-gate log #7, #21
- [ ] **No value-less counts as headings** ("5 messages", item counts restating list length).
      → noise-gate log #7
- [ ] Column headers never wrap to two lines (`whitespace-nowrap` is baked into `DataTable`;
      shorten the label instead of widening). → CLAUDE.md
- [ ] Table uses `UnifiedTablePage` + `useUnifiedTableState`, not raw `<table>`/shadcn primitives.
      → docs/design/table-consistency.md, TABLE-PAGE-GATE.md
- [ ] Table has the standard feature set: search, filters, column visibility, row selection,
      row actions (⋯), bulk delete, empty state, pagination. → TABLE-PAGE-GATE.md
- [ ] Empty cells render nothing — no placeholder dash ("—"). → noise-gate log #4
- [ ] Search is `<ExpandingSearch>` (icon that expands), never a persistent open input.
      → CLAUDE.md / DESIGN-SYSTEM-GATE.md
- [ ] Tables are inline-editable by default (`enableInlineEditing`). → feedback rule

## Sections & layout

- [ ] No borders/cards/background fills around sections — separate with spacing only.
      No card-within-card. → noise-gate log #5, #6, #15
- [ ] Page uses `PageShell`/`PageScaffold` (named layout), not a hand-rolled `grid-cols-*`.
      → PAGE-LAYOUT-GATE.md
- [ ] Detail pages use horizontal label→value fields (`DetailField`/`EditableDetailField`),
      never stacked label-above-value; every create-form field appears on the detail page.
      → DETAIL-PAGE-GATE.md
- [ ] Section-heading actions use `<SectionAction>` (outline/sm), never a ghost button or plain text.
      → CLAUDE.md

## Noise & signal

- [ ] No decorative icons — an icon must be the *sole* affordance to earn its place.
      → noise-gate log #3, #10
- [ ] No permanent "About X" explainer boxes in a workflow — tooltip or docs link at most.
      → noise-gate log #16
- [ ] No explanatory subheading restating what a panel obviously does. → noise-gate log #11
- [ ] Secondary add action = bare plus icon, never a labeled/bordered button. → noise-gate log #1
- [ ] No tab/button/link to a placeholder or "coming soon". → noise-gate log #18
- [ ] Utility/media actions in a panel are icon buttons, not large labeled outline buttons.
      → noise-gate log #12
- [ ] Prefer composition over invention — no one-off component that only restyles familiar
      information. → noise-gate log #19

## Design tokens

- [ ] Semantic color tokens only — zero hex, zero `gray-*`/`blue-*`/`white`, zero arbitrary
      values (`p-[10px]`). → DESIGN-SYSTEM-GATE.md
- [ ] Shadows limited to `shadow-xs` (cards) / `shadow-sm` (dropdowns). → DESIGN-SYSTEM-GATE.md
- [ ] Type comes from the scale — no ad-hoc hero numbers outside `KpiBlock`/`KpiRow`.
      → noise-gate log #17

## Data correctness

- [ ] Every insight/number/risk links to its source record. → feedback rule
- [ ] Form dropdown values pre-fill correctly on edit (no FK-target vs dropdown-source mismatch).
      → FORM-FK-VALIDATION-GATE.md

## Responsive

- [ ] Grids collapse and tables scroll on mobile; tabs are responsive. → feedback rule
