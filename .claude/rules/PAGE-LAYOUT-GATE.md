# Page Layout Gate

**Trigger:** Any time you are creating or editing a `page.tsx` (or any top-level page
component) and need to lay out its content — one column, two columns, three columns, or a
main + sidebar split.

## The rule

The page-level layout is a **fixed, named choice**. You do not hand-roll it.

Use `<PageScaffold layout=...>` from `@/components/layout`. It owns the page width, the
header, AND the content columns. There is no free-form `children` grid to dump a
`grid-cols-3` into — you pick one layout from the menu and the component renders the
columns, gaps, and responsive stacking.

```tsx
import { PageScaffold } from "@/components/layout";

// One column (default for most pages)
<PageScaffold layout="single" title="About">
  <SectionRuleHeading label="Overview" />
  …
</PageScaffold>

// Main + right sidebar (300–380px, stacks on mobile)
<PageScaffold layout="sidebar" title="Contract #1042" sidebar={<FinancialSidebar />}>
  <DetailPanel>…</DetailPanel>
</PageScaffold>

// Two balanced columns
<PageScaffold layout="two-column" title="Comparison" left={<PanelA />} right={<PanelB />} />

// Master list: list | list | preview
<PageScaffold
  layout="three-column"
  title="Deep Research Archive"
  left={<WorkspaceList />}
  center={<FileList />}
  right={<FilePreview />}
/>
```

| Layout | Use it for | Region props |
|--------|-----------|--------------|
| `single` | most pages — a vertical stack of sections | `children` |
| `sidebar` | record/detail pages with a metadata sidebar | `children` (main) + `sidebar` |
| `two-column` | two side-by-side panels of similar weight | `left` + `right` |
| `three-column` | browse-and-preview / master–detail screens | `left` + `center` + `right` |

Width is picked per layout automatically (single→content, sidebar→detail,
two/three-column→detailWide). Override with `variant` only when a page genuinely needs a
different width. Header props (`title`, `eyebrow`, `description`, `actions`, `statusBadge`,
`breadcrumbs`, `tabs`) pass straight through to the shared `PageHeader`.

Section headings inside a column use `SectionRuleHeading` / `SectionAction` from
`@/components/layout` — never a raw `<h2>`.

## Forbidden

| Never | Always |
|-------|--------|
| `<div className="grid lg:grid-cols-3">` at the top of a page | `<PageScaffold layout="three-column" …>` |
| `<div className="grid lg:grid-cols-2">` to split a page | `layout="two-column"` |
| Hand-rolled `xl:grid-cols-[1fr_300px]` sidebar | `layout="sidebar"` |
| `<PageShell>` + a hand-rolled content grid | `PageScaffold` |
| Raw `<h2>` for a section title | `SectionRuleHeading` |
| A grid of repeated KPI/metric cards inline | `<KpiRow>` / `<KpiBlock>` from `@/components/ds` |

`PageShell` is still correct for pages whose body is itself a single self-contained
component that owns its own layout — table pages (`UnifiedTablePage`) and forms. For
everything where *you* are arranging the columns, use `PageScaffold`.

## Enforced by

ESLint rule **`design-system/no-raw-page-grid`** (Gate 26): blocks multi-column grids
(`grid-cols-2`/`-3`/…/`-[...]`, any breakpoint) in `src/app/**/page.tsx`. WARN globally
(the ~73 pre-existing pages are tracked debt) and **ERROR on changed files** via
lint-staged — so any page you touch must move to `PageScaffold`. `grid-cols-1` is allowed.

## Why this gate exists

`PageShell` controlled width + header but left the content region wide open, so every
agent re-invented the column structure — different breakpoints, gaps, ratios, and random
"why is this two columns?" layouts, plus hand-rolled `<h2>` section headers that drifted
page to page. Forcing every page to pick from a fixed menu of named layouts removes that
freedom and makes the layout decision a one-liner the design system owns.
