# UI Implementation Guide for Claude Code
## Exact Tailwind Classes & React Patterns — No Interpretation Required

This document tells you EXACTLY which Tailwind classes to use. Do not freestyle. Do not improvise. Copy these patterns verbatim.

**Tech stack context**: Next.js App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui components. The accent color is Alleato brand orange (`hsl(29, 71%, 52%)` / #DB802D), mapped to `--primary` in globals.css. Background is white (#FFFFFF), and card/surface elements are also true white unless a localized component needs tonal separation.

---

## RULE 0: READ THIS BEFORE EVERY COMPONENT

Before writing ANY component, check this list:

1. Am I about to use `bg-card rounded-lg border border-border p-6` on every section? → **STOP.** Read the Hierarchy section below.
2. Am I about to use `grid grid-cols-3 gap-6` with identical children? → **STOP.** Use varied visual treatments.
3. Does my text use only ONE color? → **STOP.** Use the 4-tier text hierarchy.
4. Does my interactive element have hover AND focus-visible states? → If no, add them.

---

## 1. TEXT HIERARCHY — THE 4 TIERS

Use these EXACT class combinations. Never use `text-gray-600` alone — always use the correct tier.

### Tier 1: Eyebrow / Section Label
```
className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
```
Use for: Section headers (FINANCIAL, PROJECT, FILES), KPI labels, category markers, table column headers.

### Tier 2: Heading / Value
```
className="text-lg font-semibold tracking-tight text-foreground"
```
Use for: Section titles, page headings, primary data values.

For large KPI numbers specifically:
```
className="text-3xl font-semibold tracking-tight text-foreground"
```

### Tier 3: Body / Secondary
```
className="text-sm text-muted-foreground"
```
Use for: Descriptions, supporting text, table cell content, meeting summaries.

### Tier 4: Meta / Tertiary
```
className="text-xs text-muted-foreground/60"
```
Use for: Timestamps, attendee counts, "last updated" text, footnotes, placeholder text.

### RULE: Every section on screen must show AT LEAST 3 of these 4 tiers. If your component only uses 1-2 text styles, you have failed the hierarchy test.

---

## 2. THE CARD TRAP — WHAT TO USE INSTEAD

### RULE: Border is not hierarchy

Do not reach for `border rounded-lg p-4` just because a group needs structure. Hierarchy should usually come from spacing, typography, icon alignment, muted descriptions, row dividers, hover tint, and tonal elevation. A border is allowed only when the element is a real bounded object: input, table shell, modal, popover, attachment module, KPI tile, or mobile record card.

For accordion/list patterns like activity rows, settings rows, navigation lists, and side panels, use:

- a stable icon/action column
- title + muted description text
- `divide-y divide-border/50` between rows
- `py-3` or `py-4` row rhythm
- `hover:bg-muted/50` for interactivity

Do not wrap every row or every section in its own bordered card.

### ❌ NEVER DO THIS (The Card Trap):
```tsx
// WRONG — identical cards with borders for every section
<div className="grid grid-cols-4 gap-6">
  <div className="bg-card rounded-lg border border-border p-6">...</div>
  <div className="bg-card rounded-lg border border-border p-6">...</div>
  <div className="bg-card rounded-lg border border-border p-6">...</div>
  <div className="bg-card rounded-lg border border-border p-6">...</div>
</div>
// ALSO WRONG — bg-white instead of bg-card (never use bg-white)
```
```

### ✅ USE THESE 6 TECHNIQUES INSTEAD:

#### Technique 1: Bento Grid with Shared Border (for KPI rows)
```tsx
<div className="overflow-hidden rounded-lg border border-border bg-card divide-x divide-border">
  <div className="grid grid-cols-4">
    {/* Each cell gets NO individual border or rounded corners */}
    <div className="px-6 py-5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Total Budget
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground">$9.3M</span>
      </div>
      <span className="text-xs text-muted-foreground/60">Original contract value</span>
    </div>
    <div className="px-6 py-5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Committed
      </span>
      <div className="mt-1">
        <span className="text-2xl font-semibold tracking-tight text-foreground">—</span>
      </div>
      <span className="text-xs text-muted-foreground/60">No contracts yet</span>
    </div>
    {/* ... */}
  </div>
</div>
```
**Why**: One shared container. Interior divided by hairline borders. Feels unified, not fragmented.

#### Technique 2: Borderless Metric Blocks (for hero stats)
```tsx
<div className="grid grid-cols-4 gap-8">
  {/* No borders, no bg — just whitespace separation */}
  <div>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      Total Budget
    </span>
    <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">$9.3M</div>
    <span className="text-xs text-muted-foreground/60">Original contract value</span>
  </div>
</div>
```

#### Technique 3: Background Elevation (for nested sections)
```tsx
{/* Page bg = bg-background */}
{/* Raised section = bg-card (no border needed — the bg contrast IS the separation) */}
{/* Nested within card = bg-muted again */}

<div className="min-h-screen bg-background">
  <div className="bg-card px-6 py-5">
    {/* This section floats above the page by bg contrast alone */}
    <div className="rounded-md bg-muted/50 p-4">
      {/* Nested content recedes */}
    </div>
  </div>
</div>
```

#### Technique 4: Accent Left Bar (for callouts, alerts, important items)
```tsx
<div className="border-l-2 border-primary pl-4 py-2">
  <p className="text-sm font-medium text-foreground">Action required</p>
  <p className="text-xs text-muted-foreground">3 submittals awaiting review</p>
</div>
```

#### Technique 5: Separator Lines Within Groups (not between sections)
```tsx
{/* Use divide-y for items WITHIN a group */}
<div className="divide-y divide-border/50">
  <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-4">
    <Eye className="size-4 text-primary" />
    <div>
      <p className="text-sm font-medium text-foreground">Views</p>
      <p className="text-xs text-muted-foreground">Review saved and recently used views</p>
    </div>
    <Button variant="ghost" size="icon" aria-label="Open views">
      <Plus className="size-4" />
    </Button>
  </div>
  <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-4">
    <Bell className="size-4 text-primary" />
    <div>
      <p className="text-sm font-medium text-foreground">Alerts</p>
      <p className="text-xs text-muted-foreground">See information about project activity</p>
    </div>
    <Button variant="ghost" size="icon" aria-label="Open alerts">
      <Plus className="size-4" />
    </Button>
  </div>
</div>

{/* Use space/margin between SECTIONS — not borders */}
<div className="space-y-12">
  <section>Section A</section>
  <section>Section B</section>
</div>
```

#### Technique 6: Subtle Row Hover (for list items, table rows)
```tsx
<div className="group -mx-3 cursor-pointer rounded-md px-3 py-3 transition-colors hover:bg-muted">
  {/* Content */}
</div>
```

### WHEN CARDS ARE VALID:
- Entity cards in a grid (project cards, user cards) — use `bg-card rounded-lg p-6` (NO border — tonal elevation is the separator)
- Floating elements (dropdowns, dialogs) — use `bg-popover rounded-lg shadow-sm` (shadow only for floating)
- Isolated action items (pricing tiers) — use `bg-card rounded-lg p-6`

**Card styling has changed:** Cards no longer use `border border-border` by default. With the app background now white, use whitespace and localized component structure first; only add explicit borders when accessibility or a bounded component requires it (form inputs, table headers).

---

## 3. KPI / METRIC COMPONENTS — COMPLETE PATTERN

### ❌ WRONG (what Claude Code keeps producing):
```tsx
<div className="rounded-lg border p-4">
  <p className="text-sm text-muted-foreground">Revenue</p>
  <p className="text-2xl font-bold">$24,000</p>
</div>
```

### ✅ RIGHT — Full KPI Block:
```tsx
interface KpiBlockProps {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  context?: string;
}

function KpiBlock({ label, value, delta, context }: KpiBlockProps) {
  return (
    <div>
      {/* Tier 1: Eyebrow label */}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>

      {/* Tier 2: Value + optional delta */}
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
              delta.positive
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            )}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
      </div>

      {/* Tier 4: Context line */}
      {context && (
        <span className="mt-0.5 block text-xs text-muted-foreground/60">{context}</span>
      )}
    </div>
  );
}
```

### KPI Row (Bento style):
```tsx
function KpiRow({ metrics }: { metrics: KpiBlockProps[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-4 divide-x divide-border">
        {metrics.map((m, i) => (
          <div key={i} className="px-6 py-5">
            <KpiBlock {...m} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 4. DATA TABLES — PREMIUM STYLE

### ❌ WRONG:
```tsx
<table className="w-full">
  <thead>
    <tr className="border-b">
      <th className="text-left p-4 font-bold">Name</th>
```

### ✅ RIGHT:
```tsx
<table className="w-full">
  <thead>
    <tr className="border-b border-border">
      <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Name
      </th>
      <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Status
      </th>
      <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Amount
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-border">
    <tr className="group transition-colors hover:bg-muted/50">
      {/* First column — primary weight */}
      <td className="py-3 text-sm font-medium text-foreground">
        Westfield Collective
      </td>
      {/* Status — dot pattern, not badges for inline status */}
      <td className="py-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Active
        </span>
      </td>
      {/* Numbers — tabular/mono alignment */}
      <td className="py-3 text-right text-sm tabular-nums text-muted-foreground">
        $142,800
      </td>
    </tr>
  </tbody>
</table>
```

### Key table rules:
- Header text: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
- Body first column: `text-sm font-medium text-foreground` (heavier weight = primary identifier)
- Body other columns: `text-sm text-muted-foreground`
- Numbers: add `tabular-nums` for alignment
- Row dividers: `divide-y divide-border`
- Row hover: `hover:bg-muted/50` (whisper, not heavy)
- NO borders on individual cells. NO bold headers. NO `border-2`.

---

## 5. NAVIGATION SIDEBAR — RIGHT SIDEBAR PATTERN

The Aldo project home page uses a right sidebar with nav categories. Here is the correct pattern:

### ❌ WRONG:
```tsx
<div className="bg-white rounded-lg border p-4">
  <h3 className="font-bold text-gray-900 mb-2">FINANCIAL</h3>
  <a className="text-blue-600">Budget</a>
  <a className="text-blue-600">Prime Contracts</a>
</div>
```

### ✅ RIGHT:
```tsx
<nav className="space-y-6">
  {/* Section group */}
  <div>
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      Financial
    </h3>
    <div className="space-y-0.5">
      <a
        href="#"
        className="group flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span>Budget</span>
      </a>
      <a
        href="#"
        className="group flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span>Prime Contracts</span>
        {/* Count badge — only when there's a meaningful number */}
        <span className="text-xs tabular-nums text-muted-foreground/60">1</span>
      </a>
    </div>
  </div>

  {/* Next section group */}
  <div>
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      Project
    </h3>
    <div className="space-y-0.5">
      {/* Active state */}
      <a
        href="#"
        className="group flex items-center justify-between rounded-md bg-accent px-2 py-1.5 text-sm font-medium text-foreground"
      >
        <span>Meetings</span>
        <span className="text-xs tabular-nums text-muted-foreground">57</span>
      </a>
    </div>
  </div>
</nav>
```

### Key nav rules:
- Section labels: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
- Nav items: `text-sm text-muted-foreground` with `hover:bg-accent hover:text-foreground`
- Active item: `bg-accent font-medium text-foreground`
- Count badges: `text-xs tabular-nums text-muted-foreground/60`
- Item spacing: `space-y-0.5` within groups, `space-y-6` between groups
- Items get `rounded-md px-2 py-1.5` — compact, not chunky

---

## 6. MEETING LIST / ACTIVITY FEED — CORRECT PATTERN

### ❌ WRONG (flat, no hierarchy, no interactivity):
```tsx
<div className="border-b p-4">
  <h3 className="font-semibold">OAC- Westfield Collective</h3>
  <p className="text-gray-500 text-sm">Construction is nearing completion...</p>
  <span className="text-gray-400 text-xs">15 attendees</span>
</div>
```

### ✅ RIGHT:
```tsx
<div className="group -mx-2 cursor-pointer rounded-lg px-2 py-4 transition-colors hover:bg-muted">
  <div className="flex gap-4">
    {/* Date column — visual anchor */}
    <div className="w-12 flex-shrink-0 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Feb
      </div>
      <div className="text-xl font-semibold tracking-tight text-foreground">24</div>
    </div>

    {/* Content */}
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          OAC- Westfield Collective
        </h3>
        {/* Attendee avatars */}
        <div className="flex -space-x-1.5 flex-shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
            BC
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
            JD
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
            +12
          </div>
        </div>
      </div>

      {/* Summary — clamped to 2 lines */}
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
        Construction is nearing completion with key installations in plumbing,
        electrical, and wood trim starting soon...
      </p>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/60">
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" /* Users icon */ />
          15 attendees
        </span>
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" /* Clock icon */ />
          1 min read
        </span>
      </div>
    </div>
  </div>
</div>
```

### Key rules:
- Entire row is hoverable (`group` + `hover:bg-muted` on wrapper)
- Title gets accent on hover: `group-hover:text-primary`
- Date column uses 2-tier hierarchy: month eyebrow + large day number
- Summary is `line-clamp-2` — never show full paragraph in a list
- Meta items use Tier 4 text: `text-xs text-muted-foreground/60`
- Avatar stack: `flex -space-x-1.5` with `ring-2 ring-background`

---

## 7. PAGE HEADER — PROJECT HOME PATTERN

### ❌ WRONG:
```tsx
<div className="bg-white border-b p-6">
  <h1 className="text-2xl font-bold">Westfield Collective</h1>
  <button className="bg-primary text-white px-4 py-2 rounded">Setup Checklist</button>
</div>
```

### ✅ RIGHT:
```tsx
<div className="border-b border-border bg-background px-6 py-5">
  {/* Breadcrumb */}
  <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
    <a href="/projects" className="transition-colors hover:text-foreground">Projects</a>
    <span className="text-muted-foreground/40">›</span>
    <span className="font-medium text-foreground">Westfield Collective</span>
  </div>

  {/* Title row */}
  <div className="flex items-center justify-between">
    <div>
      <span className="text-xs text-muted-foreground/60">24-115</span>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Westfield Collective
      </h1>
    </div>
    <div className="flex items-center gap-3">
      <Button variant="outline">
        <PencilIcon className="h-3.5 w-3.5" />
        Edit Project
      </Button>
      <Button>
        Setup Checklist
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</div>
```

---

## 8. SPACING SYSTEM — MANDATORY VALUES

Use ONLY these spacing values. Tailwind maps:

| Value | Tailwind | Use for |
|-------|----------|---------|
| 4px | `p-1`, `gap-1` | Icon-to-label, badge padding |
| 8px | `p-2`, `gap-2` | Tight inline spacing |
| 12px | `p-3`, `gap-3` | Compact form internals |
| 16px | `p-4`, `gap-4` | Standard component padding |
| 20px | `p-5`, `gap-5` | Comfortable padding |
| 24px | `p-6`, `gap-6` | Card internal padding |
| 32px | `p-8`, `gap-8` | Between related groups |
| 48px | `py-12` | Between major page sections |
| 64px | `py-16` | Page top/bottom |

### NEVER USE: `p-[18px]`, `gap-[14px]`, `p-7`, `gap-[22px]` — these are off-grid.

### Section spacing pattern:
```tsx
{/* Between major sections on a page */}
<div className="space-y-12">
  <section>{/* KPI row */}</section>
  <section>{/* Meeting list */}</section>
  <section>{/* Data table */}</section>
</div>

{/* Between items within a section */}
<div className="space-y-4">
  <div>{/* Item */}</div>
  <div>{/* Item */}</div>
</div>

{/* Between related groups within a section */}
<div className="space-y-8">
  <div>{/* Group A */}</div>
  <div>{/* Group B */}</div>
</div>
```

---

## 9. BUTTON SYSTEM — USE SHADCN BUTTON COMPONENT

**ALWAYS use `<Button>` from `@/components/ui/button`.** Never build raw buttons with className strings.

```tsx
import { Button } from "@/components/ui/button";

// Primary (brand CTA — max 1-2 per screen):
<Button>Create Contract</Button>
<Button size="sm"><Plus className="h-4 w-4" /> New Item</Button>

// Secondary (outlined):
<Button variant="outline">Cancel</Button>
<Button variant="outline" size="sm"><Pencil className="h-4 w-4" /> Edit</Button>

// Ghost (text only):
<Button variant="ghost">View all</Button>

// Destructive:
<Button variant="destructive">Delete</Button>

// Icon-only:
<Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
```

### Interactive states (built into shadcn Button):

All 5 states are handled automatically by the Button component:

- **Default**: `bg-primary text-primary-foreground shadow-xs` (or variant equivalent)
- **Hover**: `hover:bg-primary/90` (or `hover:bg-accent` for outline/ghost)
- **Focus**: `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`
- **Active**: `active:scale-[0.98]` (subtle press feedback)
- **Disabled**: `disabled:opacity-50 disabled:pointer-events-none`

### RULES:

- **NEVER** write raw `<button className="...">` — use the shadcn Button component
- Primary buttons: max 1-2 per screen. If everything is brand orange, nothing stands out.
- Icon buttons: use `size="icon"` variant
- Every button needs all 5 interactive states (built into the component)

---

## 10. STATUS INDICATORS — USE SPARINGLY

### Dot + Label (inline, for tables and lists):

```tsx
<span className="inline-flex items-center gap-1.5 text-sm">
  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
  <span className="text-muted-foreground">Active</span>
</span>
```

### Badge (for counts, categories):

```tsx
<span className="inline-flex items-center rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600">
  Approved
</span>
```

### Color map (use ONLY these):

| State | Dot | Badge bg | Badge text |
|-------|-----|----------|------------|
| Active/Success | `bg-green-500` | `bg-green-50` | `text-green-600` |
| Warning/Pending | `bg-yellow-500` | `bg-yellow-50` | `text-yellow-600` |
| Error/Overdue | `bg-red-500` | `bg-red-50` | `text-red-600` |
| Info/Draft | `bg-blue-500` | `bg-blue-50` | `text-blue-600` |
| Neutral/Inactive | `bg-muted-foreground/40` | `bg-muted` | `text-muted-foreground` |

### RULE: Status colors on < 5% of total UI surface. If your page looks like a traffic light, you've overused them.

---

## 11. EMPTY STATES — NEVER JUST "NO DATA"

### ❌ WRONG:
```tsx
<p className="text-gray-500 text-center py-8">No data available.</p>
```

### ✅ RIGHT:
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
    <FileTextIcon className="h-6 w-6 text-muted-foreground" />
  </div>
  <h3 className="text-sm font-medium text-foreground">No contracts yet</h3>
  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
    Create your first prime contract to start tracking committed costs for this project.
  </p>
  <Button className="mt-4" size="sm">
    <PlusIcon className="h-4 w-4" />
    Create Contract
  </Button>
</div>
```

---

## 12. PAGE LAYOUT — THE MASTER TEMPLATE

### Project Home (content + right sidebar):

```tsx
<div className="flex min-h-screen bg-background">
  {/* Main content */}
  <div className="min-w-0 flex-1 px-6 py-6">
    <div className="max-w-4xl space-y-12">
      {/* Section 1: KPI Row */}
      <section>{/* Bento KPI row */}</section>

      {/* Section 2: Meetings */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Meetings</h2>
            <span className="text-sm text-muted-foreground/60">57</span>
          </div>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            View all
          </a>
        </div>
        <div className="divide-y divide-border">
          {/* Meeting items */}
        </div>
      </section>
    </div>
  </div>

  {/* Right sidebar — sticky */}
  <aside className="sticky top-0 hidden h-screen w-56 flex-shrink-0 overflow-y-auto border-l border-border bg-card p-5 lg:block">
    <nav className="space-y-6">
      {/* Nav sections */}
    </nav>
  </aside>
</div>
```

### Detail Page (full width with header):

```tsx
<div className="min-h-screen bg-background">
  {/* Sticky header */}
  <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm px-6 py-4">
    {/* breadcrumb + title + actions */}
  </div>

  {/* Content */}
  <div className="mx-auto max-w-5xl space-y-12 px-6 py-8">
    {/* Sections */}
  </div>
</div>
```

---

## 13. SHADOW SYSTEM

| Level | Tailwind | Use for |
|-------|----------|---------|
| None | (default) | Most elements — shadows used sparingly |
| xs | `shadow-xs` | Form inputs, select triggers |
| sm | `shadow-sm` | Cards, dropdowns |

### RULES:

- Page-level cards (KPI row, sidebar): `shadow-sm` or none
- Form inputs and buttons: `shadow-xs`
- NEVER `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl` — too heavy for this app
- NEVER apply shadow AND heavy border on same element. Pick one.

---

## 14. BORDER RADIUS SYSTEM

Use ONLY these values consistently:

| Tailwind | Use for |
|----------|---------|
| `rounded-md` | Buttons, inputs, nav items, cards (default for 90% of elements) |
| `rounded-lg` | Large cards, modals, panels, page-level containers |
| `rounded-full` | Avatars, badges, pills, status dots |

### RULES:

- Pick `rounded-md` as default for 90% of elements
- Only go to `rounded-lg` for page-level containers and modals
- NEVER use `rounded-sm` or bare `rounded` (no suffix) — see tokens.md banned patterns

---

## 15. ANTI-PATTERNS CHECKLIST — RUN BEFORE EVERY COMMIT

```
❌ grid-cols-N with identical bg-card rounded-lg border children
❌ More than 2 primary brand buttons on screen
❌ Text using only 1-2 colors/sizes across a section
❌ No hover state on clickable elements
❌ Centered text in a data-display UI (left-align everything)
❌ shadow-xl on anything
❌ Borders AND shadows on same element
❌ p-7, gap-[14px], or other off-grid spacing
❌ Status colors (red/green) used decoratively
❌ Empty state that says only "No data"
❌ Bold body text (font-bold on paragraphs)
❌ font-bold on table headers (use font-semibold + uppercase + tracking-wider)
❌ All same-size text in a component (no hierarchy)
❌ Missing transition-colors on hover elements
❌ Cards inside cards
```
