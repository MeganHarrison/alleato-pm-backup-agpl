---
name: create-page
description: >
  Alleato PM page creation skill with full design system enforcement.
  MUST be used whenever creating, scaffolding, or significantly rewriting any page.tsx
  file in this codebase. Covers page archetypes, mandatory imports, color tokens,
  spacing rules, anti-patterns, and browser verification. Use this for Type A (table),
  Type B (form), Type C (detail), Type D (dashboard), and custom hybrid pages.
  Also trigger for: "create a page", "build a page", "new page", "add a route",
  "build a UI for", "create the X page", "make a page that", "add a screen".
metadata:
  filePatterns:
    - "frontend/src/app/**/**/page.tsx"
    - "frontend/src/app/**/page.tsx"
priority: 85
---

# Alleato PM — Page Creation Protocol

> Every page in this codebase follows the same design language: **Linear meets Vercel Dashboard**.
> Clean, minimal, confident. Subtract, don't add. Every visual element must earn its place.

---

## BEFORE Writing Any Code — Required Steps

1. **Identify the page archetype** (A/B/C/D or custom split layout)
2. **Confirm the route parameter naming** — NEVER use `[id]`, always `[projectId]`, `[contractId]`, etc.
3. **Check if this is a `"use client"` page** — most pages with interactivity/hooks are; Server Components are the exception
4. **Look at one existing similar page** for reference patterns if uncertain

---

## Step 1: Choose the Archetype

| What you're building | Archetype | Component |
|----------------------|-----------|-----------|
| List of entities (contracts, RFIs, etc.) | A — Table | `UnifiedTablePage` |
| Create / edit form | B — Form | `ProjectFormPageLayout` |
| Single entity detail view | C — Detail | `PageHeader` + `PageContainer` + sections |
| Summary / overview / dashboard | D — Dashboard | `PageHeader` + `PageContainer` + `KpiRow` |
| Custom split layout (e.g. list + chat) | Custom | `PageHeader` + `PageContainer` + grid |

**For Type A table pages, also read the `alleato-table-page` skill.**

---

## Step 2: Copy the Exact Template

### Type A — Table Page

```tsx
"use client";

import { UnifiedTablePage, useUnifiedTableState } from "@/components/tables/unified";

export default function EntityPage({ params }: { params: { projectId: string } }) {
  const tableState = useUnifiedTableState({
    entityKey: "entity-name",
    // ... searchParams, pathname, router, defaults
  });

  return (
    <UnifiedTablePage
      header={{
        title: "Entities",
        description: "Manage project entities",
        actions: <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create</Button>,
        // ^^^ ONE primary action only. Export/filter/columns go in toolbar.
      }}
      toolbar={{ /* search, filters, column toggles, export — ALL here */ }}
      data={{ items, isLoading, isFetching }}
      table={{ columns, getRowId: (item) => item.id, onRowClick }}
      emptyState={{
        title: "No entities yet",
        description: "Create your first entity to get started",
        filteredDescription: "No entities match your current filters",
        isFiltered: Boolean(tableState.debouncedSearch),
        action: <Button onClick={onCreate}>Create Entity</Button>,
      }}
    />
  );
}
```

### Type B — Form Page

```tsx
"use client";

import { ProjectFormPageLayout } from "@/components/layout";
import { FormSection } from "@/components/forms";
import { Button } from "@/components/ui/button";

export default function CreateEntityPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();

  return (
    <ProjectFormPageLayout
      title="Create Entity"
      description="Enter the details below"
      onBack={() => router.back()}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <FormSection title="General Information">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* FormField components */}
          </div>
        </FormSection>

        <FormSection title="Additional Details">
          {/* more fields */}
        </FormSection>

        {/* Submit row — always bottom, always right-aligned, always border-t */}
        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Create Entity"}
          </Button>
        </div>
      </form>
    </ProjectFormPageLayout>
  );
}
```

### Type C — Detail Page

```tsx
import { PageHeader, PageContainer } from "@/components/layout";
import { SectionHeader, DataTable, StatusBadge, KpiBlock } from "@/components/ds";

export default async function EntityDetailPage({ params }: { params: { projectId: string; entityId: string } }) {
  return (
    <>
      <PageHeader
        title="Entity Name"
        actions={<Button size="sm" variant="outline">Edit</Button>}
      />
      <PageContainer maxWidth="xl">
        <div className="space-y-10">
          <section>
            <SectionHeader title="Overview" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* KpiBlock or key-value pairs */}
            </div>
          </section>

          <section>
            <SectionHeader title="Line Items" count={items.length} />
            <DataTable columns={columns} rows={items} />
          </section>
        </div>
      </PageContainer>
    </>
  );
}
```

### Type D — Dashboard Page

```tsx
import { PageHeader, PageContainer } from "@/components/layout";
import { SectionHeader, KpiRow } from "@/components/ds";

export default function DashboardPage({ params }: { params: { projectId: string } }) {
  return (
    <>
      <PageHeader title="Overview" />
      <PageContainer>
        <div className="space-y-8">
          <KpiRow metrics={[
            { label: "Total Budget", value: "$1.2M" },
            { label: "Committed", value: "$890K" },
            { label: "Remaining", value: "$310K" },
          ]} />

          <section>
            <SectionHeader title="Recent Activity" action={{ label: "View All", href: "/" }} />
            {/* content */}
          </section>
        </div>
      </PageContainer>
    </>
  );
}
```

### Custom Split Layout (e.g., List + Chat Panel)

```tsx
import { PageHeader, PageContainer } from "@/components/layout";

export default function SplitPage({ params }: { params: { projectId: string } }) {
  return (
    <>
      <PageHeader title="Page Title" description="Optional subtitle" />
      <PageContainer>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left: main content */}
          <div className="space-y-6">
            {/* content */}
          </div>

          {/* Right: panel (no extra card/border wrapping — panel is its own container) */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)]">
            {/* panel content */}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
```

---

## Step 3: Mandatory Import Reference

Always import from these exact paths:

```tsx
// Layout
import { PageHeader, ProjectPageHeader, PageContainer, ProjectFormPageLayout } from "@/components/layout";

// Design system
import { StatusBadge, StatusDot, StatusText, KpiBlock, KpiRow,
         EmptyState, DataTable, SectionHeader, Eyebrow, AvatarStack } from "@/components/ds";

// Forms
import { FormSection } from "@/components/forms";

// Tables (Type A only)
import { UnifiedTablePage, useUnifiedTableState } from "@/components/tables/unified";

// Base primitives (only when ds/layout don't cover it)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

---

## Step 4: Apply Design Rules (Non-Negotiable)

### Colors — Semantic tokens ONLY

| Use | Token | Banned alternatives |
|-----|-------|---------------------|
| Primary text | `text-foreground` | `text-gray-900`, `text-black`, `text-neutral-900` |
| Secondary text | `text-muted-foreground` | `text-gray-500`, `text-neutral-500` |
| Page background | `bg-background` | `bg-white`, `bg-gray-50` |
| Card surface | `bg-card` | `bg-white` |
| Muted surface | `bg-muted` | `bg-gray-50`, `bg-gray-100` |
| Borders | `border-border` | `border-gray-200`, `border-neutral-200` |
| Primary accent | `text-primary` / `bg-primary` | `text-orange-500`, hardcoded hex |
| Destructive | `text-destructive` | `text-red-500` |

### Spacing — 8px grid only

Allowed: `p-1` `p-2` `p-3` `p-4` `p-6` `gap-2` `gap-3` `gap-4` `gap-6` `space-y-4` `space-y-6` `space-y-8` `space-y-10`

**BANNED:** `p-5`, `p-7`, `gap-5`, `gap-7`, anything with `[` brackets like `p-[18px]`

### Shadows — two options only

- `shadow-xs` — subtle lift on inputs
- `shadow-sm` — dropdowns, popovers, floating elements
- **BANNED:** `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`

### Border radius

- `rounded-md` — default for everything (buttons, inputs, cards, badges)
- `rounded-lg` — modals, sheets, large containers
- `rounded-full` — avatar circles, pill badges

### Typography weights

- `font-normal` (400), `font-medium` (500), `font-semibold` (600) only
- `font-bold` ONLY for hero KPI numbers
- **NEVER** bold body text, descriptions, or table cells

---

## Step 5: Actionability And Usability Gate

For Alleato product UI, use the `impeccable` skill as the authority for actionability, usability, and product noise decisions. Load and obey `.agents/skills/impeccable/reference/alleato-product-noise-gate.md`, especially its Actionability Gate, Task And Action Item Standard, and Meeting-Derived Intelligence sections.

If this page-creation protocol conflicts with Impeccable on product usability or design judgment, Impeccable wins.

---

## Step 6: Visual Noise Rules

Before finishing, run through this checklist:

- [ ] Can any border be replaced with `space-y-8` or `space-y-10`? → Remove it
- [ ] Is any `<Card>` just wrapping text or a toolbar? → Remove the card, render directly
- [ ] Are there nested cards (card inside card)? → Flatten to one level
- [ ] Are there decorative icons with no semantic meaning? → Remove them
- [ ] Are there multiple primary action buttons in the header? → Keep ONE, move rest to toolbar
- [ ] Is there any `shadow-md` or larger? → Reduce to `shadow-sm`
- [ ] Any hardcoded hex colors or `gray-*` classes? → Replace with semantic tokens
- [ ] Is the empty state using `EmptyState` component? → It must, never raw text

**The card rule:** Cards are justified for entity grids, floating elements (popovers/dialogs), KPI rows, and form containers. Cards are NOT justified for wrapping sections of a detail page, wrapping tables, wrapping toolbars, or wrapping individual paragraphs.

---

## Step 7: Mobile Checklist (Before Finishing)

Run through this before calling the page done:

- [ ] No horizontal scroll at 375px — zero tolerance
- [ ] Tables use card view on mobile (`views.card` prop)
- [ ] All buttons/links/row actions have ≥ 44×44px tap target
- [ ] ≥ 8px spacing between adjacent interactive elements
- [ ] Modals → `Sheet` on mobile (no centered dialogs on small screens)
- [ ] Search/filters collapse on mobile (not exposed raw in toolbar)
- [ ] Grids collapse to `grid-cols-1` on mobile
- [ ] No text smaller than `text-sm` (14px)
- [ ] No hover-only UI (every interaction tap-accessible)
- [ ] Reading text blocks use `max-w-[65ch]` if long-form content
- [ ] Page padding handled by `PageContainer` (don't add manual `px-*` to the root)

**Unit guide quick ref:**
- Spacing/font sizes → Tailwind classes (rem-based) ✓
- Borders → `border` (1px) ✓
- **Never** `px` for font sizes or spacing
- Long-form text areas → `max-w-[65ch]`

## Step 8: Verify in Browser

After writing the page, use agent-browser to verify at the five required viewports:

```bash
agent-browser open http://localhost:3000/<route>
agent-browser snapshot -i
```

Test at: **375px**, **414px**, **768px**, **1024px**, **1440px**

Check at each:
1. No horizontal scroll
2. No element overlap or text clipping
3. Header title visible
4. Touch targets reachable
5. Empty/loading states render correctly

---

## Quick Anti-Pattern Reference

| You're about to write... | Write this instead |
|--------------------------|-------------------|
| `<div className="bg-white p-5 border border-gray-200 rounded-lg">` | `<div className="bg-card p-6 rounded-lg">` or just whitespace |
| `<h2 className="text-lg font-bold">Section Name</h2>` | `<SectionHeader title="Section Name" />` |
| `<p>No data found.</p>` | `<EmptyState title="..." description="..." />` |
| `<div className="shadow-lg">` | `<div className="shadow-sm">` |
| `text-gray-500` | `text-muted-foreground` |
| `bg-gray-50` | `bg-muted` |
| `gap-5` or `p-7` | `gap-4` or `p-6` |
| `actions: <><Export /><Filter /><Create /></>` | `actions: <CreateButton />` — one action only |
| `<button className="...">Click me</button>` | `<Button variant="..." size="...">Click me</Button>` |
| Custom status pill with hardcoded colors | `<StatusBadge status={item.status} />` |
| `Coming Soon` text in a `<Card>` | `<EmptyState .../>` |
