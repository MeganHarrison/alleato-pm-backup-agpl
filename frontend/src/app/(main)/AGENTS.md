# Page Creation Rules — READ BEFORE WRITING ANY PAGE

Every file in this directory is a Next.js page. Before writing ANY code, follow these rules exactly.

## Step 1: Use PageShell. Always.

```tsx
import { PageShell } from "@/components/layout";

// Pick ONE variant:
<PageShell variant="dashboard" title="...">   // Home/overview + KPI cards
<PageShell variant="table"     title="...">   // Data tables (UnifiedTablePage goes inside)
<PageShell variant="form"      title="..." onBack={() => router.back()}>  // Create/edit forms
<PageShell variant="detail"    title="...">   // Record detail pages with tabs
<PageShell variant="content"   title="...">   // Settings / docs / read-heavy pages
```

**Never write `<PageContainer>` + a manual `<h1>` on a new page.** That creates a double header.
**Never write `<PageLayout>`.** Deprecated.

## Step 2: Import components from @/components/ds

```tsx
import { Button, Card, CardContent, StatusBadge, DataTable, EmptyState } from "@/components/ds";
```

Never write raw `<button>`, `<div className="bg-white rounded shadow">`, or `<div className="border">` as layout.

## Step 3: Color tokens only

```
bg-background  bg-card  bg-muted          ← backgrounds
text-foreground  text-muted-foreground    ← text
border-border  border-border/50          ← borders
bg-primary  text-primary-foreground      ← brand
```

Never: `bg-white`, `bg-gray-100`, `text-gray-600`, `border-gray-200`, hex codes.

## Step 4: No cards around content that doesn't need structure

Articles, links, list items, chat messages — these are plain elements with dividers, NOT wrapped in `<Card>`.

Use `<Card>` for: form sections, KPI blocks, summary panels that have a title + content.
Do NOT use `<Card>` for: individual list items, articles, chat bubbles, navigation elements.

## Step 5: Do not box the page content

The page canvas should stay open by default.

- Do not wrap the main page content in a bordered, rounded, or filled container
- Do not add decorative `border`, `rounded-*`, or `bg-*` shells around `PageShell`, `PageContainer`, or the primary content column
- Use whitespace, spacing, headings, dividers, and internal component structure instead of framing the whole page
- Borders are only for bounded UI pieces that actually need containment: tables, inputs, modals, tiles, drawers, and similar subcomponents
- For histories, nav menus, and chat lists: default to plain rows in a sidebar/list, not boxed items or card grids
- If an action can be communicated clearly with a standard icon, prefer that over a labeled button row

## Full reference

`docs/design/README.md`
