# Alleato Design System

> **The single source of truth.** Read this before building any page or component.
> Style: Superhuman meets Linear. Minimal, high information density, premium feel.
>
> **Sub-references (read when linked):**
> - [tokens.md](./tokens.md): full token tables with dark mode hex values, animation tokens
> - [UI_GUIDE.md](./UI_GUIDE.md): exact copy-paste Tailwind class combos, Card Trap JSX
> - [DESIGN-PRINCIPLES.md](./DESIGN-PRINCIPLES.md): philosophy in depth, tonal elevation diagram
> - [patterns.md](./patterns.md): loading, error, empty state code patterns
> - [premium-patterns.md](./premium-patterns.md): 6 hierarchy techniques with CSS/JSX
> - [forms/form-page-archetype.md](./forms/form-page-archetype.md): three-tier form system (READ BEFORE ANY FORM)
> - [forms/FORM-SYSTEM.md](./forms/FORM-SYSTEM.md): RHF + Zod 4-layer implementation
> - [tables/table-system.md](./tables/table-system.md): UnifiedTablePage full spec, cell types, checklist

---

## 1. START HERE: Building a New Page

Every page in the app uses `PageShell`. There are no exceptions.

```tsx
import { PageShell } from "@/components/layout";

// Dashboard / overview pages with KPI cards
<PageShell variant="dashboard" title="Project Dashboard" actions={<Button>+ Add</Button>}>
  <KpiRow metrics={[...]} />
  <SectionCard title="Recent Activity">...</SectionCard>
</PageShell>

// Data table pages
<PageShell variant="table" title="Commitments" actions={<Button>+ New</Button>}>
  <UnifiedTablePage ... />
</PageShell>

// Create / edit forms
<PageShell variant="form" title="Create Contract" onBack={() => router.back()}>
  <Card><CardContent>...</CardContent></Card>
</PageShell>

// Record detail pages (tabs, line items)
<PageShell variant="detail" title="Contract #1042" statusBadge={<StatusBadge status="Draft" />}>
  <Tabs>...</Tabs>
</PageShell>

// Read-heavy / settings / document pages
<PageShell variant="content" title="Settings">
  <p>...</p>
</PageShell>
```

### PageShell variant reference

| Variant | Max width | Padding | Use for |
|---------|-----------|---------|---------|
| `dashboard` | full | standard | Home/overview, KPI cards, charts, summaries |
| `table` | full | tight | Data tables, UnifiedTablePage goes inside |
| `detail` | max-w-6xl | standard | Record detail pages with tabs |
| `form` | max-w-5xl | standard | Create/edit forms |
| `content` | max-w-4xl | standard | Settings, documents, read-heavy pages |

### PageShell props

```ts
variant:           PageShellVariant   // Required
title:             string             // Required
titleContent?:     ReactNode          // Override title with custom element
actions?:          ReactNode          // Buttons in header right side (PRIMARY ACTION ONLY)
statusBadge?:      ReactNode          // Status pill next to title (detail variant)
onBack?:           () => void         // Adds back arrow
backLabel?:        string             // Default: "Back"
showExportButton?: boolean
onExportCSV?:      () => void
onExportPDF?:      () => void
className?:        string
contentClassName?: string
```

**`actions` rule (critical):** The `actions` prop holds ONE thing only: the primary create/add button. Export, import, settings, column toggles, and bulk actions NEVER go in `actions`. They belong in the `UnifiedTablePage` toolbar.

---

## 2. Color Tokens

**Never use hex codes or raw Tailwind palette colors (`gray-200`, `blue-500`). Always use semantic tokens.**

```css
/* Backgrounds */
bg-background        /* Page background (#FBFAF8 light / #151518 dark) */
bg-card              /* Card/surface (#FFFFFF light / #1F1F24 dark) */
bg-muted             /* Subtle section background (#F4F2F0 light / #272730 dark) */
bg-muted/50          /* Very subtle tint */
bg-accent            /* Hover/interactive (#EDEDFA light / #2C2C35 dark) */
/* Page surface carries a 2% warm tint toward the brand hue so bg-card (true white) lifts cleanly from it. Never use pure #FFFFFF for the page background. */

/* Text */
text-foreground       /* Primary text */
text-muted-foreground /* Secondary/caption text */
text-primary          /* Brand color — actions and links only */

/* Borders */
border-border         /* Standard border */
border-border/50      /* Subtle border */

/* Primary / Brand */
bg-primary            /* Primary button background (#DB802D light / #F59A43 dark) */
text-primary-foreground /* White text on primary buttons */

/* Status — applied via StatusBadge / StatusDot / StatusText only */
bg-success-subtle text-success    /* Active / Approved */
bg-warning-subtle text-warning    /* Pending / Draft */
bg-danger-subtle text-danger      /* Error / Rejected / Overdue */
bg-info-subtle text-info          /* Info / In Progress */
bg-neutral-subtle text-neutral    /* Inactive / Archived */
```

**ESLint ERRORS (blocks build):** `design-system/no-hardcoded-colors`, `design-system/no-arbitrary-spacing`, `design-system/require-semantic-colors`

### Color substitution table

| Instead of | Use |
|---|---|
| `text-neutral-500`, `text-gray-500` | `text-muted-foreground` |
| `text-neutral-900`, `text-gray-900` | `text-foreground` |
| `border-neutral-200`, `border-gray-200` | `border-border` |
| `bg-white` | `bg-card` or `bg-background` |
| `bg-gray-50`, `bg-neutral-50` | `bg-muted` |
| `text-orange-500`, `text-brand` | `text-primary` |
| `bg-blue-500` | `bg-primary` |
| `ring-blue-500` | `ring-primary` |
| `bg-green-*`, `bg-emerald-*` for status | `<StatusBadge status={value} />` (never raw classes) |

### Dynamic class construction is BANNED

```tsx
// WRONG — Tailwind tree-shakes dynamic classes in production
className={`text-${color}-600`}

// CORRECT — static mapping
const colorMap = { approved: "text-green-600", draft: "text-yellow-600" };
className={colorMap[status]}
```

> Full dark mode token values with HSL: [tokens.md](./tokens.md)

---

## 3. Typography

```css
/* Headings — always font-semibold, tracking-tight */
text-2xl font-semibold tracking-tight   /* Page title (via PageShell) */
text-xl font-semibold tracking-tight    /* Section title */
text-base font-semibold                 /* Card title */
text-sm font-medium                     /* Label, table header */

/* Body */
text-sm                                 /* Default body text */
text-xs text-muted-foreground           /* Caption, metadata */

/* Eyebrow / category labels */
text-[11px] font-semibold uppercase tracking-wider text-muted-foreground
/* Or use: <Eyebrow>SECTION NAME</Eyebrow> */
```

### The 4-Tier Text Hierarchy (mandatory)

Every section on screen must use at least 3 of these 4 tiers. If your component uses only 1–2 text styles, the hierarchy is broken.

| Tier | Classes | Use for |
|------|---------|---------|
| 1. Eyebrow | `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` | Section labels and fixed interface categories only |
| 2. Heading | `text-lg font-semibold tracking-tight text-foreground` | Section titles, primary data values |
| 3. Body | `text-sm text-muted-foreground` | Descriptions, supporting text, table cells |
| 4. Meta | `text-xs text-muted-foreground/60` | Timestamps, "last updated", footnotes |

### Context-specific sizes

| Context | Classes |
|---------|---------|
| KPI value (hero) | `text-3xl font-semibold tracking-tight tabular-nums` |
| KPI value (compact) | `text-lg font-semibold tracking-tight tabular-nums` |
| Table header | `text-xs font-medium tracking-normal text-foreground` |
| Monospace data (IDs, codes) | `font-mono text-sm tabular-nums` |
| Page title (in header) | `text-xl font-semibold tracking-tight` |

### OpenType features

Inter must be rendered with OpenType features enabled (set in `globals.css`):
```css
body {
  font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { letter-spacing: -0.01em; }
```

### Line height standards

- Body text / descriptions: `leading-relaxed` (1.625) or `leading-normal` (1.5)
- Headings / titles: `leading-tight` (1.25)
- Table cells: `leading-normal` (1.5)
- Never remove line-height on multi-line text. Tightening `leading` kills readability.

### Color contrast (WCAG AA minimum)

- Normal text: 4.5:1 contrast ratio against background
- Large text (18px+) / bold text (14px+ bold): 3:1
- The semantic tokens (`text-foreground` on `bg-background`, `text-muted-foreground` on `bg-card`) already satisfy this. Only check manually when using non-standard combinations.

### Banned

```
text-[14px], text-[1.2rem]   → use text-sm, text-base
font-bold in page content    → use font-semibold max
text-gray-*, text-neutral-*  → use semantic tokens
```

---

## 4. Spacing

Use Tailwind defaults on the 8px grid. No arbitrary values. Prefer multiples of 8; use 4px (gap-1) only for micro gaps.

### Named levels

| Level | Token | px | Use for |
|-------|-------|----|---------|
| micro | `gap-1` | 4px | Icon-to-text gap, badge internal padding |
| tight | `gap-2` | 8px | Related items (label + input, badge + text) |
| compact | `gap-3` | 12px | Compact lists, table cell padding |
| base | `gap-4` | 16px | Items within a section, standard group spacing |
| comfortable | `gap-6` | 24px | Form fields, related subsections, card internal padding |
| section | `gap-8` | 32px | Between related page sections |
| break | `gap-12` | 48px | Between major page sections |
| page | `px-8` | 32px | Page horizontal padding (desktop, via PageContainer) |

### Spacing by page type

| Page type | Internal card padding | Section gap | Usage |
|-----------|----------------------|-------------|-------|
| Dashboard | `p-6` (24px) | `gap-8` | KPI widgets, summary cards |
| Table | `p-4` (16px) | `gap-4` | Toolbar + table, tight to maximize data |
| Form | `p-6` (24px) | `gap-6` | Between form fields; `gap-8` between sections |
| Content | `p-8` (32px) | `gap-8` | Documents, settings, generous rhythm |

### Table row density options

| Density | Row height | Cell padding | When |
|---------|-----------|--------------|------|
| standard | 53px | `px-3 py-3` | Default for most pages |
| compact | 40px | `px-3 py-2` | High-density tables, log views |
| comfortable | 64px | `px-3 py-4` | Detail-heavy rows |

### CSS spacing variables (set by PageContainer)

```css
--page-padding    /* Container horizontal padding */
--section-gap     /* Gap between major sections */
--card-padding    /* Card internal padding */
--group-gap       /* Related items */
--field-gap       /* Form field spacing */
--row-height      /* Table row height */
--cell-padding    /* Table cell horizontal padding */
--cell-padding-y  /* Table cell vertical padding */
```

### Banned

```
p-[10px], gap-[15px], m-[20px]   → use token values
p-5, p-7, p-9, p-10, p-11        → not on 8px grid
```

---

## 5. Shadows

Only two allowed values. Most elements have NO shadow; tonal elevation does the work.

```
shadow-xs   /* Form inputs, select triggers — very subtle lift */
shadow-sm   /* Dropdowns, popovers, floating modals */
(none)      /* 90% of elements — the default */
```

**Never:** `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, glow effects.

---

## 6. Border Radius

```
rounded-md    /* Default — form inputs, buttons, small cards */
rounded-lg    /* Larger cards, modals, panels */
rounded-xl    /* Command palette, major overlays */
rounded-full  /* Avatars, status dots, pills, tags */
rounded-none  /* Tables, full-bleed elements */
```

**Never:** bare `rounded`, `rounded-sm`, arbitrary `rounded-[10px]`. Pick one scale and don't mix.

---

## 7. Borders

Borders create visual noise. **Every border must earn its place.**

### Hierarchy without borders

Default to borderless hierarchy first. Before adding a bordered wrapper, try these in order:

1. Increase section spacing (`space-y-8`, `gap-8`, `pt-8`) for major breaks.
2. Use the 4-tier text hierarchy: eyebrow, heading, body, meta.
3. Use alignment and indentation: icon column, content column, action column.
4. Use tonal elevation: `bg-card` on `bg-background`, or `bg-muted/50` for a recessed area.
5. Use internal row dividers: `divide-y divide-border/50` for items within one list.
6. Use quiet interaction states: `hover:bg-muted/50`, active text color, or a left accent for selected/important rows.

If those techniques solve the scan problem, do not add a border. Borders should clarify boundaries for controls and bounded data modules; they should not be the default way to show that one thing is separate from another.

Accordion, activity, navigation, and side-list layouts should look like structured rows on an open surface: icon, title, muted description, optional action, and subtle row separation. Do not turn each row or section into its own bordered tile.

### Use borders for:
- Form inputs (accessibility requirement)
- Table row dividers (`divide-y divide-border`)
- Table header bottom (`border-b border-border`)
- Explicit structural separators between distinct content zones
- The chat message input field (and nothing else in chat UI)

### Do NOT use borders for:
- Cards (use tonal elevation: `bg-card` on `bg-background`. The 3% lightness difference IS the separator.)
- Page sections (use spacing instead)
- Decorative containers
- Full-page experimental tools, onboarding pages, avatar pages, or AI pages
- Hover states (use `hover:bg-muted` instead)
- The sidebar nav (use background color shift)

### Route shell guardrail

Experimental pages are not exempt from the app shell. A general app page must live under the normal app route group and use `PageShell` so it inherits the standard top header, sidebar navigation, spacing, and scroll behavior. Do not put a non-chat page under a full-bleed chat route group just to make room for an experiment.

Avatar, onboarding, and AI utility pages should have one obvious primary action. Do not duplicate Start actions in both the page header and page body, and do not wrap the entire page experience in a decorative border.

### Tonal elevation system

```
bg-background  →  Page surface (base layer)
  └── bg-card  →  Card content (elevated)
       └── bg-muted  →  Hover / active state
            └── bg-accent  →  Selected / interactive highlight
```

In dark mode, closer surfaces are lighter (mimics light from above):
```
#151518 (background) → #1F1F24 (card) → #272730 (muted) → #2C2C35 (popover/float)
```

### Border width

1px borders only (`border`, `border-t`, `border-b`, etc.). Never `border-2` or `border-4`.

---

## 8. Animation

### Timing tokens

| Token | Duration | Easing | Use for |
|-------|----------|--------|---------|
| instant | 0ms | none | Keyboard nav highlights, active states |
| fast | 100ms | `ease-out` | Hover states, focus rings, micro-interactions |
| normal | 150ms | `ease-out` | Panel open/close, row slide, most transitions |
| ease-out-quart | 200ms | `cubic-bezier(0.22, 1, 0.36, 1)` | Command palette, modal entrance, toasts |
| ease-out-expo | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Slideovers, page transitions |

No bounce, no elastic. Easing curves never overshoot past 1.

### What you may animate

- `transform` (translate, scale, rotate) and `opacity` only.
- Never `width`, `height`, `top`, `left`, `margin`, `padding`, or any property that triggers layout. They cause jank on busy table pages.
- Color, background, and border transitions are acceptable at 100–150ms but should never block input.

### Performance targets

| Interaction | Target |
|-------------|--------|
| Page navigation | < 100ms |
| Filter application | < 50ms |
| Row focus change | < 16ms (one frame) |
| Modal/panel open | < 100ms |
| Status update (optimistic) | < 50ms |
| Search results | < 100ms |

### Optimistic UI pattern

Every mutation follows this pattern. No spinners for common actions:

```typescript
async function updateStatus(id: string, newStatus: string) {
  // 1. Update UI immediately (optimistic)
  queryClient.setQueryData(['records', id], (old) => ({ ...old, status: newStatus }));

  // 2. Show undo toast
  showUndoToast(`Status changed to ${newStatus}`);

  // 3. Sync with server in background
  try {
    await supabase.from('records').update({ status: newStatus }).eq('id', id);
  } catch {
    // 4. Revert on failure
    queryClient.invalidateQueries(['records', id]);
    showErrorToast('Failed to update status');
  }
}
```

### Undo Toast

After every reversible action (status change, archive, delete):

```tsx
// Design: fixed bottom-center, inverted colors, 5s auto-dismiss, no close button
// bg-foreground text-background rounded-lg
// Shows keyboard shortcut: "Press Z to undo"
// Replaces confirmation dialogs for reversible actions
toast("Change order marked as approved", {
  action: { label: "Undo (Z)", onClick: handleUndo },
  duration: 5000,
});
```

### Reduced motion

Honor `prefers-reduced-motion: reduce` for every animation. PRODUCT.md commits to it; the implementation lives here.

```css
/* In globals.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

For JS-driven motion (Framer Motion), use the built-in hook:

```tsx
import { useReducedMotion } from "framer-motion";

function FadeIn({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.15 }}
    >
      {children}
    </motion.div>
  );
}
```

State-change feedback (focus rings, active states, undo toast appearance) is always allowed; it carries information, not decoration. Only suppress motion that is purely aesthetic.

---

## 9. Component Reference

### Status Display

```tsx
import { StatusBadge, StatusDot, StatusText } from "@/components/ds";

<StatusBadge status="Draft" />      // Colored pill — tables, detail pages
<StatusDot status="Approved" />     // Dot + label — compact table cells
<StatusText status="Not synced" />  // Plain muted text — low emphasis
```

Pass the status string. Colors are automatic. **Never manually map statuses to color classes.**

### Review and verification surfaces

- Use sentence case for table headers that contain source, extracted, or user-entered content. Uppercase is reserved for short fixed interface labels, never record data.
- A record with an existing decision loads that decision. An unreviewed record starts with no decision selected.
- Use native radio controls for mutually exclusive review outcomes. Do not use tabs or segmented navigation.
- Show notes only for corrective outcomes. Do not add confirmation, helper, or empty-state panels that repeat the selected decision.
- A successful automated check is one quiet inline fact. Reserve an alert surface for a failure that needs a recovery action.

### Metrics / KPIs

```tsx
import { KpiBlock, KpiRow } from "@/components/ds";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";

// Compact inline row (top of table pages)
<KpiRow metrics={[
  { label: "Total Budget", value: "$2.4M" },
  { label: "Committed", value: "$1.8M", trend: "+12%" },
]} />

// Rich cards (dashboard pages)
<MetricGrid>
  <MetricCard title="Revenue" value="$2.4M" change={{ value: 12, direction: "up" }} />
</MetricGrid>
```

Use `KpiRow` for table pages. Use `MetricCard` for dashboard pages.

### Data Tables

```tsx
import { DataTable } from "@/components/ds";

<DataTable
  columns={[
    { key: "name",   header: "Name",   render: (row) => row.name },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ]}
  rows={data}
  loading={isLoading}
  emptyState={<EmptyState title="No items" description="Create one to get started" />}
/>
```

For full-featured pages with search/filter/bulk actions, use `UnifiedTablePage`. See [tables/table-system.md](./tables/table-system.md).

### Table Row States

```
Focused row (keyboard):  bg-accent + 1px border-l border-primary (hairline, not stripe)
Hovered row:             bg-muted/50 (2–3% shift — subtle)
Selected row:            bg-accent + leading checkmark in selection column
Default:                 bg-card, text-foreground / text-muted-foreground
```

The focus indicator is the row tint, not the border. Hairline left border is supplementary, not the primary signal. Never use 2px+ side stripes; they read as decoration.

### Empty States

```tsx
import { EmptyState } from "@/components/ds";

<EmptyState
  icon={FileIcon}
  title="No contracts yet"
  description="Create your first contract to get started"
  action={<Button onClick={onCreate}>+ New Contract</Button>}
/>
```

### Cards

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ds";

<Card>
  <CardHeader><CardTitle>Section Title</CardTitle></CardHeader>
  <CardContent>...</CardContent>
</Card>
```

Shadow: `shadow-xs` only on card. `shadow-sm` only when floating. **No border on card.** Use `bg-card` on `bg-background` for separation.

### Section Headers

```tsx
import { SectionHeader } from "@/components/ds";
<SectionHeader title="Line Items" count={12} action={<Button size="sm">Add</Button>} />
```

### Buttons

```tsx
import { Button } from "@/components/ds";

<Button>Primary action</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="icon"><PlusIcon /></Button>
```

**Never write `<button className="...">`.** Always use `<Button>`.

### Form Inputs

```tsx
import { Input, Textarea, Select, Checkbox, Label } from "@/components/ds";

// Always pair with Label:
<div className="space-y-2">
  <Label htmlFor="name">Contract Name</Label>
  <Input id="name" placeholder="Enter name" />
</div>
```

**Radix Select gotcha:** `<Select>` does NOT allow empty string values. For optional selects, use `placeholder` on `SelectValue`. Do NOT add a "None" `SelectItem`.

### Overlays

```tsx
import { UnifiedModal } from "@/components/ui/unified-modal";
import { Slideover } from "@/components/ui/unified-slideover";

// Create/edit forms → UnifiedModal
<UnifiedModal open={open} onClose={() => setOpen(false)} title="Create Contract" size="md">
  <form>...</form>
</UnifiedModal>

// Detail panels, context views → Slideover
<Slideover open={open} onClose={() => setOpen(false)} title="Contract Details" size="lg">
  ...
</Slideover>
```

### Overlay decision matrix

| Component | When to use | Size |
|-----------|-------------|------|
| **Page form** (`PageShell variant="form"`) | **Default for create/edit.** Multi-section forms, anything 8+ fields, anything with line items. The operator sees the full task. | n/a |
| **Inline editing** (click-to-edit cell, expandable row) | **Default for single-field updates.** Status changes, name renames, quick attribute edits on detail pages. | n/a |
| `Slideover` (`unified-slideover`) | Detail panels and side-by-side workflows where the user references the table while editing. Filters that stay open. | `xs` / `sm` / `md` / `lg` / `xl` / `full` |
| `Modal` (`unified-modal`) | Create-from-context (creating a sub-record without leaving the parent), short forms (< 8 fields), focused confirmations with structure. | `xs` / `sm` / `md` / `lg` / `xl` |
| `Dialog` (base shadcn) | Destructive Yes/No confirmations only. Heading + one sentence + Cancel/Confirm. | Fixed `max-w-md` |
| `Sheet` (base shadcn) | Legacy. Do not use for new code. Prefer `Slideover`. | n/a |

**Rules:**
- A create/edit form that the user spends > 30 seconds on belongs on a page, not in a modal.
- Modal is the answer only when you can prove the user must NOT lose context with the page behind it.
- Inline editing (Linear / Notion pattern) is preferred for any single-attribute change. No "Edit" button, modal, save dance for a field rename.
- Destructive confirmations: prefer an undo toast (§8) over a confirmation modal. Confirmation is the right answer only when undo is impossible (hard delete, money movement).

```tsx
{/* Create/edit form — use Modal */}
<Modal open={open} onOpenChange={setOpen}>
  <ModalContent size="xl">
    <ModalHeader>
      <ModalTitle>Create Contract</ModalTitle>
    </ModalHeader>
    {/* form content */}
    <ModalFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button type="submit">Create</Button>
    </ModalFooter>
  </ModalContent>
</Modal>

{/* Detail panel — use Slideover */}
<Slideover open={open} onOpenChange={setOpen}>
  <SlideoverContent size="lg">
    <SlideoverHeader>
      <SlideoverTitle>Contract Details</SlideoverTitle>
    </SlideoverHeader>
    {/* detail content */}
  </SlideoverContent>
</Slideover>

{/* Destructive confirmation — use Dialog */}
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete commitment?</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ds";

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="line-items">Line Items</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
</Tabs>
```

### Feedback / States

```tsx
import { Skeleton, Spinner, Progress, Alert, AlertTitle, AlertDescription } from "@/components/ds";

// Loading
<Skeleton className="h-4 w-48" />
<Spinner size="sm" />

// Alerts (informational content only — no card/border wrappers around alerts in chat UI)
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong.</AlertDescription>
</Alert>
```

---

## 10. Table System

See [tables/table-system.md](./tables/table-system.md) for the full spec including toolbar API, cell types, and accessibility checklist.

### Quick reference

```tsx
import { UnifiedTablePage } from "@/components/tables/unified";

<UnifiedTablePage
  header={{
    title: "Commitments",
    actions: <Button size="sm">+ New Commitment</Button>,  // ONE action only
  }}
  tabs={tabs}               // Optional tab navigation
  toolbar={{
    onSearch: ...,
    onExport: ...,          // Export belongs HERE, not in header.actions
    features: { enableExport: true, enableBulkDelete: true },
  }}
  data={{ items, isLoading, isFetching }}
  table={{ columns, getRowId, onRowClick }}
  sorting={{ ... }}
  emptyState={{ title, description, filteredDescription, isFiltered }}
/>
```

**Header `actions` rule (critical):** ONE thing only, the primary create/add button. Export, import, column toggles, and secondary actions NEVER go in header `actions`. They belong in `toolbar`.

### Reference implementations

- `commitments/page.tsx`: tabs, footer totals, row selection
- `change-events/page.tsx`: tabs, bulk delete, export
- `invoicing/page.tsx`: KpiRow as topContent
- `rfis/rfis-client.tsx`: standard implementation
- `direct-costs/cost-code-hierarchy-view.tsx`: hierarchical rows

---

## 11. Form System

See [forms/form-page-archetype.md](./forms/form-page-archetype.md) for the complete three-tier system with wireframes and full code templates. **Read it before writing any form.**

### Three-tier decision tree

```
How many fields?
  < 8 fields              → Tier 1: Simple Form
  8–20 fields, 2–4 sections → Tier 2: Standard Form
  20+ fields, 5+ sections → Tier 3: Complex Form

Has embedded tables (line items, SOV)?
  YES → Move up one tier minimum
  Line items on CREATE form? → Remove them. Tables belong on the detail/edit page.

Creation vs. edit?
  Creation: essential fields only. Defer optional fields to detail page.
  Edit: full field set for the tier.
```

### Tier quick reference

| Tier | Fields | Width | Layout | Action bar |
|------|--------|-------|--------|------------|
| 1. Simple | < 8 | 672px (`FormContainer maxWidth="md"`) | Single column | `border-t` at bottom |
| 2. Standard | 8–20 | 896px (`FormContainer maxWidth="lg"`) | 1–2 columns | Sticky bottom bar |
| 3. Complex | 20+ | 896px content + 192px sidebar TOC | 2–3 columns | Sticky top bar |

### Line items pattern

For editable line-item tables in forms (SOV, cost tables, invoice line items):
- Container: subtle bordered shell with muted table backdrop
- Header: `text-[11px] font-normal text-muted-foreground` for compact label typography
- Rows: compact vertical rhythm, consistent input heights
- Totals: dedicated footer row, right-aligned currency values
- Actions: "Add Line Item" button BELOW the table
- **Never use accordion for the primary line-items block in a form.** Accordion hides data. Keep line items always visible.

See [forms/FORM-SYSTEM.md](./forms/FORM-SYSTEM.md) for RHF + Zod implementation.

### Form rules

1. **Labels above inputs.** Never beside them on narrow screens.
2. **Required fields** marked with red asterisk (FormField handles this)
3. **Error messages** below the field in red (FormField handles this)
4. **Hint text** below the field in muted (FormField handles this)
5. **Placeholder text** should be example values, not instructions ("$10,000" not "Enter amount")
6. **Select defaults.** Use a placeholder like "Select type..." not a pre-selected value.
7. **Never wrap individual form fields in cards.** Let FormSection provide grouping.
8. **Date fields** use native date input or a date picker component, never a text input

---

## 12. Interaction Patterns (Keyboard-First)

Every table page supports keyboard navigation:

| Key | Action | Context |
|-----|--------|---------|
| `J` / `↓` | Focus next row | Table/list |
| `K` / `↑` | Focus previous row | Table/list |
| `Enter` | Open focused record in detail panel | Table/list |
| `Escape` | Close detail panel / close modal | Everywhere |
| `E` | Primary action (approve, mark done) | When row focused |
| `N` | Create new record | Table/list |
| `/` | Focus search input | Table/list |
| `Z` | Undo last action | After any reversible action |
| `Cmd+K` | Open command palette | Global |
| `G then B` | Go to Budget | Global |
| `G then C` | Go to Commitments | Global |
| `G then D` | Go to Directory | Global |
| `G then S` | Go to Schedule | Global |
| `G then H` | Go to Home | Global |

### Hover states

```tsx
{/* Row hover */}
className="transition-colors hover:bg-muted"

{/* Link hover */}
className="text-muted-foreground transition-colors hover:text-foreground"

{/* Button hover — handled by Button component variants */}
```

### Focus states

Every interactive element needs `focus-visible` styling. The shadcn components handle this. If building custom interactive elements:

```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

---

## 13. Loading / Error / Empty States

**Always handle all three states. Never skip error or empty.**

```tsx
const { data, isLoading, error } = useItems(projectId);

if (isLoading) return <PageSkeleton />;
if (error) return <ErrorState error={error.message} />;
if (!data?.length) return <EmptyState title="No items" description="..." />;
return <ItemsTable data={data} />;
```

### Loading skeleton

```tsx
function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="space-y-2 mt-8">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
```

### Error state

```tsx
function ErrorState({ error }: { error: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
```

### Toast

```tsx
import { toast } from "sonner";
toast.success("Changes saved");
toast.error("Failed to save changes");
```

Full patterns: [patterns.md](./patterns.md)

---

## 14. Visual Noise Rules

### Cards must earn their place

A `<Card>` is justified when it:
- Groups multiple related actions (a form section with 3+ fields)
- Represents a distinct interactive object (Kanban card)
- Contains content the user repeatedly references

A `<Card>` is NOT justified for:
- Wrapping a filter toolbar (use inline flex layout)
- A single paragraph of "coming soon" placeholder text (use `<EmptyState>`)
- Developer-internal metadata (bucket names, folder paths, internal IDs)
- A legend explaining the UI (if the UI needs a legend, simplify the UI)
- Repeating data already visible elsewhere on the page

**Replace 3-column stat card grids with `<KpiRow>` from `@/components/ds`.** Lighter weight, no border noise.

### Non-functional UI

**Never ship UI that does nothing:**
- A button with no `onClick` is worse than no button
- A dropdown with empty items must be removed or implemented
- Placeholder tabs showing no content must be hidden or implemented

### Decorative icons & avatars (banned in front of titles and names)

A leading icon or avatar in front of a title, heading, or name is decoration. It adds visual noise, fights with typography for prominence, and reads as cheap.

**Never:**
- Icon-in-a-tinted-circle next to a page title, sheet title, section heading, or modal title (e.g. a `Building2` puck next to a company name)
- Avatar circles in front of contact / person names in dense lists, sidebars, sheets, or detail panels
- Decorative icons in table-cell name columns (the column header already tells the user what they're looking at)
- Building / file / folder icons in front of entity names — the page context already says what the entity is

**Acceptable uses for icons and avatars:**
- Icons inside buttons where the icon clarifies the action ("+ Add", "Download")
- Avatars in the top app bar (user identity) and in true comment / activity feeds where multiple people are speaking
- Icons in empty-state hero illustrations (single, large, low-contrast)
- Status icons next to a status badge where the icon carries information (e.g. checkmark, warning)

Rule of thumb: if removing the icon or avatar makes the layout calmer without losing meaning, remove it. The name itself is the affordance.

### Prefer composition over invention (component proliferation)

**Every new component introduced into the product creates design debt.** A new
component must solve a genuinely new *interaction* problem — not simply present
familiar information in a different visual style. When each screen invents its
own visual language, the product stops feeling like one application.

Before introducing ANY new UI element, ask: can this be built from existing
primitives?
- Existing typography scale
- Existing property row / `DetailField`
- Existing badges
- Existing table (`InlineTable` / `UnifiedTablePage`)
- Existing spacing and dividers
- Existing `KpiBlock` / `KpiRow`

If yes — do not invent. If a new component is introduced, the PR must justify
why an existing component could not be used.

### No card-within-card

Inside a panel, sheet, or page section, content renders as **plain typography
separated by spacing**. A bordered container is earned only by interaction (a
form region, a clickable group). **Borders define interactive boundaries;
spacing separates content.** A bordered box holding one static number, or a
paragraph, is banned.

### Never permanently display once-needed information

No "About X" boxes or explainer paragraphs inside workflow surfaces. Users need
a definition at most once; after that it is permanent noise pushing real data
below the fold. If a definition is genuinely needed, use a `?` tooltip or a
docs link. **Data always outranks explanation** (progressive disclosure).

### Drilldown/detail summary = one caption+value line

A drilldown panel's summary is a single line — muted caption on the left
(context: cost code, count), `text-sm font-semibold tabular-nums` value on the
right. Never a hero `text-2xl` stat. Hero metrics exist only via
`KpiBlock`/`KpiRow` on dashboard surfaces. Reference: `SidebarStats` in
`frontend/src/components/budget/modals/BaseSidebar.tsx`.

---

## 14a. MetricCard vs KpiBlock: When to Use Each

Two components display KPIs. They serve different contexts:

| Component | When to use | Features |
|-----------|-------------|----------|
| `KpiBlock` / `KpiRow` (from `@/components/ds`) | Simple metrics in a horizontal row at the top of a detail or dashboard page. No interactivity. | Label, value, optional delta |
| `MetricCard` (from `@/components/ui/metric-card`) | Richer metric cards that can be linked, have trend lines, multi-size variants, or need an action button. | `href`, `size`, `change` with trend icon, `action`, `subtitle` |
| `SummaryCardGrid` (from `@/components/ui/summary-card-grid`) | Grid of summary cards at the top of table pages, when cards need change indicators. Auto-sizes columns. | `cols`, `change.direction`, `icon`, `onClick` |

```tsx
{/* Simple, quick row — use KpiRow */}
<KpiRow metrics={[
  { label: "Total Value", value: "$1.2M" },
  { label: "Open Items", value: 14 },
]} />

{/* Richer card with trend and link — use MetricCard */}
<MetricCard
  label="Total Budget"
  value={1250000}
  format="currency"
  size="md"
  href="/budget"
  change={{ value: 5.2, type: "positive", label: "vs last month" }}
/>

{/* Grid of cards at top of a table page — use SummaryCardGrid */}
<SummaryCardGrid cards={[
  { id: "total", label: "Total Value", value: "$125,000" },
  { id: "pending", label: "Pending", value: 5, change: { value: 12, direction: "up" } },
]} />
```

---

## 14b. SectionCard: Collapsible Section Pattern

Use `SectionCard` for collapsible grouped content on detail/dashboard pages (e.g., project home sections like "Prime Contracts", "Team", "Recent Activity").

**Do NOT use** `SectionCard` inside form pages. Use `FormSection` there instead.

```tsx
import { SectionCard } from "@/components/ui/section-card";

{/* Basic collapsible section */}
<SectionCard
  title="Prime Contracts"
  addHref={`/${projectId}/prime-contracts/new`}
  viewAllHref={`/${projectId}/prime-contracts`}
  defaultOpen={true}
>
  <SectionCard.Item
    title="Contract #1042 — General Works"
    subtitle="Acme Construction"
    meta="$450,000"
    badge={<StatusBadge status="Approved" />}
    href={`/${projectId}/prime-contracts/1`}
  />
  <SectionCard.Item title="Contract #1043" meta="$120,000" />
  <SectionCard.Empty
    message="No contracts yet"
    actionLabel="Create contract"
    actionHref={`/${projectId}/prime-contracts/new`}
  />
</SectionCard>

{/* Custom header actions */}
<SectionCard
  title="Team"
  headerActions={<Button size="sm" variant="ghost">Manage</Button>}
>
  {/* content */}
</SectionCard>
```

**SectionCard props:**
- `title`: eyebrow-style heading (uppercase, brand color by default)
- `addHref` / `onAdd`: shows `+` icon button in header
- `viewAllHref`: shows "View All" link in header
- `defaultOpen` / `open` / `onOpenChange`: collapse control
- `hideCollapse`: removes the chevron toggle
- `headerActions`: replaces default add/view-all with custom content
- `brandTitle`: use brand color for title (default `true`)

**SectionCard.Badge variants:** `default` | `brand` | `success` | `warning` | `error`

---

## 15. Anti-Patterns (rejected in review)

### Visual anti-references

Patterns and products the design explicitly rejects. If a screen could be mistaken for any of these, it has failed:

- **Procore.** Cluttered enterprise SaaS: gray-on-gray toolbars, dense chrome, dated forms, modal-heavy workflows. Every choice should be a quiet rejection of how Procore feels.
- **Generic admin templates** (Material Dashboard, TailAdmin, Bootstrap admin). Bland card grids, identical KPI boxes, "Welcome back" greetings.
- **Consumer-friendly / playful.** Bright illustrations, gamification, mascots, cartoon empty states. Personality comes from precision, not whimsy.
- **Heavy chrome / skeuomorphic.** Drop shadows beyond `shadow-sm`, decorative gradients, glassmorphism, bevels, trend-chasing visual flourishes.

| Never do this | Do this instead |
|---|---|
| `<div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">` | `<Card>` |
| `<button className="bg-blue-500 text-white px-4 py-2 rounded">` | `<Button>` |
| `<h1 className="text-2xl font-bold text-gray-900">` | `<PageShell title="...">` |
| `import { PageContainer, ProjectPageHeader }` on a new page | `import { PageShell }` |
| `bg-gray-200`, `text-gray-600`, `border-gray-200` | `bg-muted`, `text-muted-foreground`, `border-border` |
| `shadow-md`, `shadow-lg` | `shadow-xs`, `shadow-sm` |
| `rounded`, `rounded-sm` | `rounded-md` |
| `p-[10px]`, `gap-[14px]` | `p-2.5`, `gap-3` |
| Manually mapping status → color | `<StatusBadge status={row.status} />` |
| Creating custom `MyButton.tsx` | Use `<Button>` from ds |
| `bg-orange-500` for brand | `bg-primary` |
| Dynamic class construction `className={\`text-${color}-600\`}` | Static color map object |
| `import { DataTablePage }` | Deprecated. Use `UnifiedTablePage` |
| `import { GenericDataTable }` | Deprecated |
| `import { TableLayout }` | Deprecated |
| `import { AppShell }` from `@/components/layouts` | Deprecated |
| Accordion for primary line-items table | Always-visible table |
| Bot icon (`Bot` from lucide) in chat UI | Brand initial "A" in a circle |
| `<User>` icon for user messages | Styled bubble or initials |
| Borders around chat content sections | No border. Render text directly |
| Using `Sheet` for new create/edit forms | Use `Modal` with appropriate `size` prop |
| Using `Dialog` for a form with many fields | Use `Modal size="xl"` instead |
| Plain `<input type="number">` for financial fields | Use `NumberInput` (formats, selects on focus) |
| Inline spinner with `<Loader2 className="animate-spin">` | `<Spinner />` component |
| Building a combobox from scratch | `Command` inside `Popover` |
| Tables on mobile without card view | Always provide `views.card` |
| Hover-only actions | Must also work via tap/menu on mobile |
| Horizontal scroll on mobile | Restructure content to fit |
| Non-functional buttons/controls | Remove them entirely |
| Raw `<h2>`, `<h3>` tags | `SectionHeader` or appropriate component |
| `text-xs` for body content | `text-sm` minimum for readable text |

---

## 15a. Voice & Copy

The voice inside the app is operator-to-operator. No marketing register, ever.

### Human-readable entity labels

- Primary user-facing labels must use the canonical human name for projects, companies, vendors, users, and other entities.
- Never use a database ID, external ID, numeric project code, UUID, or source-system key as the primary label or as a missing-name fallback.
- When a canonical name is unavailable, use an explicit human-safe state such as `Unnamed project`, `Unknown vendor`, or `Unassigned`. Keep the identifier available only in explicit admin/developer diagnostics or subordinate technical detail when the workflow requires it.
- Compact chart and table labels may truncate a human name for space, but the full human name must remain recoverable through tooltip, title, accessible label, or detail view.

**Banned in user-facing strings:**
- Em dashes (` — `). Use commas, colons, parentheses, or periods.
- Exclamation points outside of error/success toasts that genuinely warrant urgency.
- "Welcome back!" / "Great job!" / "You're all set!". Consumer-app warmth has no home here.
- Restated headings ("Settings: Manage your settings"). Every word earns its place.
- Sentences that start with "Let's" or "Hey there".

**Length budgets:**

| Surface | Max length |
|---------|-----------|
| Button label | 3 words |
| Toast (success) | 60 chars |
| Toast (error) | One full sentence |
| Empty state title | 6 words |
| Empty state description | One sentence, < 100 chars |
| Tooltip | 80 chars |

**Tone:**

- Direct. "Save" not "Click here to save your changes".
- Confident. The tool knows what it is.
- Specific. "3 line items updated" beats "Changes saved".
- Quiet on success. Loud only on failure.

---

## 16. Import Rules

```ts
// Correct
import { PageShell } from "@/components/layout";
import { StatusBadge, KpiRow, DataTable, Button, Card, EmptyState } from "@/components/ds";
import { Input, Textarea } from "@/components/ds";
import { UnifiedModal } from "@/components/ui/unified-modal";
import { Slideover } from "@/components/ui/unified-slideover";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { UnifiedTablePage } from "@/components/tables/unified";

// Also correct for component files (not page files)
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Never — these are deleted
import { GlobalHeader } from "@/components/layout";
import { CompanyHeader } from "@/components/layout";
import { PageToolbar } from "@/components/layout";
import { DataTablePage } from "...";
import { GenericDataTable } from "...";
```

### Extended component import catalog

```tsx
// Data Display (premium KPI & metric components)
import { MetricCard, MetricGrid, MetricSummary } from "@/components/ui/metric-card";
import { SummaryCardGrid } from "@/components/ui/summary-card-grid";
import { SectionCard } from "@/components/ui/section-card";
// SectionCard.Item, SectionCard.Empty, SectionCard.Badge

// Overlays
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from "@/components/ui/unified-modal";
import { Slideover, SlideoverContent, SlideoverHeader, SlideoverTitle } from "@/components/ui/unified-slideover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";

// Form Inputs (extended)
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

// Feedback & Status
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Navigation & Disclosure
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Search & Comboboxes
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Avatars
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";

// Base Primitives (shadcn)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
```

---

## 17. Mobile Responsiveness

### Breakpoint strategy

```
Mobile:  < 640px  (default styles, no prefix)
Tablet:  640px+   (sm:)
Desktop: 1024px+  (lg:)
Wide:    1280px+  (xl:)
```

**Every component must work on mobile. This is not optional.**

### Tables on mobile

Tables MUST switch to a card layout on mobile. `UnifiedTablePage` handles this via the `views.card` prop:

```tsx
<UnifiedTablePage
  toolbar={{
    currentView: isMobile ? "card" : "table",
    enabledViews: ["table", "card"],
  }}
  views={{
    card: (item) => (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{item.name}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Amount</span>
            <span className="block font-medium">{formatCurrency(item.amount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Date</span>
            <span className="block">{formatDate(item.date)}</span>
          </div>
        </div>
      </div>
    ),
  }}
/>
```

### Mobile card rules
- Max 4-6 fields visible (show only the most important data)
- Primary identifier and status always on the first row
- Currency/numbers right-aligned within their grid cell
- Truncate long text with `truncate` class
- Cards separated by `space-y-3` (not borders between cards)
- No hover states on mobile cards (tap targets only)

### Responsive layout rules

```tsx
{/* Grid columns collapse on mobile */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

{/* Form fields stack on mobile */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

{/* Side-by-side becomes stacked */}
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

{/* Page padding reduces on mobile — PageContainer handles: px-4 sm:px-6 lg:px-8 */}
```

### Mobile-specific rules

1. **Touch targets:** Minimum 44x44px for all interactive elements on mobile
2. **No hover-dependent UI:** Anything revealed on hover must also be accessible via tap/menu
3. **No horizontal scroll:** Content must fit within viewport width. If a table can't fit, switch to card view
4. **Bottom-anchored actions:** Primary action buttons should be easily reachable (near bottom of viewport)
5. **Collapsible sections:** Long detail pages should use collapsible sections on mobile
6. **Font sizes:** Never smaller than 12px on mobile. Body text should be 14px minimum
7. **Padding:** Use `px-4` on mobile (not `px-2`, too cramped; not `px-6`, wastes space)
8. **Modals on mobile:** Use full-screen sheets (`Sheet`) instead of centered dialogs on small screens
9. **Toolbars:** Search and filters should collapse into a filter sheet/dropdown on mobile

### Mobile detection pattern

```tsx
import { useMediaQuery } from "@/hooks/use-media-query";

function MyPage() {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isTablet = useMediaQuery("(max-width: 1023px)");

  return (
    <UnifiedTablePage
      toolbar={{
        currentView: isMobile ? "card" : "table",
      }}
      views={{
        card: isMobile ? (item) => <MobileCard item={item} /> : undefined,
      }}
    />
  );
}
```

### Unit selection guide

| Unit | Use for | Never use for |
|------|---------|---------------|
| `rem` | Font sizes, spacing, layout dimensions | Component-relative sizing |
| `em` | Padding/margin *relative to the component's own font size* | Global layout |
| `%` | Widths relative to parent container | Font sizes |
| `px` | Borders (1px), box-shadows, hairlines | Font sizes, spacing, widths |
| `vw`/`vh` | Full-bleed hero sections, viewport-height panels | Body text, spacing |
| `ch` | Text content max-width (`max-w-[65ch]`) | Anything non-text |

**NEVER use `px` for font sizes or spacing.** It ignores the user's browser font-size preference.

### Overflow-safe responsive grids

```tsx
{/* ❌ Can overflow: min-width set but no viewport guard */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

{/* ✅ Overflow-safe: min(300px, 100%) prevents items wider than viewport */}
<div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))" }}>
```

### Fluid typography with clamp()

For headings and display text that should scale smoothly across viewports without hard breakpoints:

```css
/* In globals.css or a utility class — for display headings only */
font-size: clamp(1.25rem, 1rem + 1.5vw, 2rem); /* 20px → 32px */
font-size: clamp(1rem, 0.9rem + 0.5vw, 1.125rem); /* 16px → 18px */
```

**Do not apply clamp to body text.** `text-sm` / `text-base` are intentionally fixed for readability predictability.

### Test viewports (required)

Before shipping any responsive UI, verify at these five widths:

| Width | Device |
|-------|--------|
| **375px** | iPhone SE / small Android |
| **414px** | iPhone Pro Max |
| **768px** | iPad portrait |
| **1024px** | Laptop |
| **1440px** | Desktop |

**Issues to check at each viewport:**
- No horizontal scroll (zero tolerance)
- No text overflow or clipping
- No element overlap
- Touch targets ≥ 44×44px with ≥ 8px gap between them
- Font size ≥ 14px for all readable text
- Primary actions reachable without scrolling excessively

### Mobile pre-ship checklist

- [ ] No horizontal scroll at 375px
- [ ] Tables switch to card view on mobile
- [ ] All touch targets ≥ 44×44px (buttons, links, row actions)
- [ ] ≥ 8px spacing between adjacent interactive elements
- [ ] Modals replaced with `Sheet` on mobile (no tiny centered dialogs)
- [ ] Search/filters collapsed into sheet/dropdown (not exposed in toolbar)
- [ ] Reading content has `max-w-[65ch]` or equivalent max-width
- [ ] No hover-only UI (all interactions accessible via tap/menu)
- [ ] Text never smaller than `text-sm` (14px)
- [ ] Grids collapse to single column on mobile (`grid-cols-1`)
- [ ] Page padding is `px-4` on mobile (handled by `PageContainer`)

---

## 18. Decision Flowchart

**"What component should I use?"**

```
Need to display a list of entities?
  → UnifiedTablePage

Need a create/edit form?
  → PageShell variant="form" + FormSection

Need to show details of one entity?
  → PageShell variant="detail" + Tabs + SectionHeader sections

Need a dashboard/overview?
  → PageShell variant="dashboard" + KpiRow + sections

Need to show status?
  → StatusBadge (in badges/tags)
  → StatusDot (in table cells, minimal)
  → StatusText (plain text, no color)

Need metrics/KPIs?
  → Simple row at top of page: KpiRow / KpiBlock
  → Rich cards with trends/links: MetricCard / MetricGrid
  → Grid of cards at top of table page: SummaryCardGrid

Need a collapsible grouped section on a detail/dashboard page?
  → SectionCard (compound: SectionCard.Item, SectionCard.Empty, SectionCard.Badge)

Need an empty state?
  → EmptyState component (with icon, title, description, action)

Need a section title?
  → SectionHeader (with optional count and action)

Need a label above grouped content?
  → Eyebrow component

Need to wrap form content?
  → FormSection (with title + description, handles borders)

Need a modal / dialog?
  → Create/edit form or complex content: Modal (unified-modal) with size prop
  → Side panel / detail preview: Slideover (unified-slideover)
  → Simple Yes/No confirmation: Dialog (base shadcn)

Need a number/currency input?
  → NumberInput (auto-selects on focus, formats on blur, currency prop)

Need a loading indicator?
  → Inline: Spinner component
  → Page skeleton: Skeleton (pulse placeholders)
  → Progress bar: Progress

Need a searchable select / combobox?
  → Command inside Popover

Need collapsible content sections?
  → Accordion (for FAQs, detail rows)
  → SectionCard (for dashboard/detail page sections)

Need avatars?
  → Stacked initials: AvatarStack (from @/components/ds)
  → Full-featured: Avatar + AvatarImage + AvatarFallback (from @/components/ui/avatar)
  → With badge: AvatarBadge
  → Multiple avatars: AvatarGroup + AvatarGroupCount
```

---

## 19. Enforcement

**ESLint errors that block the build:**
- `design-system/no-hardcoded-colors`
- `design-system/no-arbitrary-spacing`
- `design-system/require-semantic-colors`

**Claude Code design commands:**
- `/design:design-check`: validate a single file
- `/design:design-audit`: audit the full codebase
- `/design:design-fix-loop`: autonomous fix loop
- `/design:design-verify`: verify fixes still hold
- `/design:design-report`: generate compliance report

**Before merging any PR that touches UI:**
1. Run `cd frontend && npm run quality`
2. Run `npm run check:routes` if routes changed
3. Run `/design:design-check` on changed files
4. No new violations in `.claude/design-audit/violations.json`
