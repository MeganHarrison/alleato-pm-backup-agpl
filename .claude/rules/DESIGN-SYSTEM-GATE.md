# Design System Gate

**Trigger:** Any time you are creating or editing a page or UI component.

## Step 0 — MANDATORY before any JSX

```bash
ls frontend/src/components/ds/
```

Read the output. If the component you are about to write is in that list — **use it instead**. Do not write a single line of JSX for a UI pattern that already exists as a component.

**Component lookup rule:** If you are about to write any of these patterns, use the component:

| Pattern you're about to hand-roll | Use this instead |
|-----------------------------------|-----------------|
| flex + icon + text with tinted bg | `<InfoAlert>` from `@/components/ds/InfoAlert` |
| "No X yet" / empty list state | `<EmptyState>` from `@/components/ds/empty-state` |
| Status-colored badge/pill | `<StatusBadge>` from `@/components/ds/status-badge` |
| Error/failed load state | `<ErrorState>` from `@/components/ds/error-state` |
| Label + value pair in detail view (read-only) | `<DetailField>` from `@/components/ds/DetailField` |
| Label + input pair in detail view (editable) | horizontal layout — label left, input right (see below) |
| Delete confirmation modal | `<ConfirmDeleteDialog>` from `@/components/ds/ConfirmDeleteDialog` |
| Save/cancel action bar | `<EditModeActions>` from `@/components/ds/EditModeActions` |
| KPI / metric number display | `<KpiBlock>` / `<KpiRow>` from `@/components/ds/kpi` |
| Search input in a page or detail view | `<ExpandingSearch>` from `@/components/ds` — **ESLint-enforced, no exceptions** |
| Date field in an RHF form | `<RHFDateField>` from `@/components/forms/fields` — **ESLint-enforced (Gate 23)**. Never `<Input type="date">`. |
| Button in a `SectionRuleHeading` actions slot | `<SectionAction>` from `@/components/layout` — enforces outline/sm styling |
| Two-column main + sidebar grid in a detail page | `<DetailLayout sidebar={...}>` from `@/components/layout` |
| Any multi-column page layout (1/2/3-col, sidebar) | `<PageScaffold layout="single\|sidebar\|two-column\|three-column">` from `@/components/layout` — **ESLint-enforced (Gate 26)**. Never hand-roll `grid-cols-*` in a `page.tsx`. See `PAGE-LAYOUT-GATE.md`. |

Usage for every component: `frontend/src/components/ds/GOLDEN-EXAMPLES.tsx`

## Building a page?

```tsx
import { PageShell } from "@/components/layout";
```

| Page type | Variant |
|-----------|---------|
| Home / overview with KPI cards | `dashboard` |
| Data table (UnifiedTablePage inside) | `table` |
| Create / edit form | `form` |
| Record detail with tabs | `detail` |
| Settings / docs / read-heavy | `content` |

**If you are arranging the page into columns yourself, use `PageScaffold` instead of `PageShell`** — it owns the width, header, AND the column layout (`layout="single|sidebar|two-column|three-column"`). Hand-rolling `grid-cols-*` in a `page.tsx` is blocked by ESLint Gate 26. `PageShell` stays correct when the body is one self-contained component that owns its own layout (table pages, forms). See `PAGE-LAYOUT-GATE.md`.

**Never:**
- `<PageContainer>` + manual `<h1>` on a new page (creates double header)
- `<PageLayout>` (deprecated)
- Full-width layout for form/detail/content pages

### Building a component?

1. Check `@/components/ds` first — most components already exist
2. Check `@/components/ui` for shadcn primitives
3. Only build something new if it doesn't exist anywhere

### Using colors?

Only semantic tokens:
```
bg-background  bg-card  bg-muted
text-foreground  text-muted-foreground
border-border
bg-primary  text-primary-foreground
```

Zero hex codes. Zero `gray-*`, `blue-*`, `white` classes. Zero arbitrary values like `p-[10px]`.

### Using shadows?

Only `shadow-xs` (cards) or `shadow-sm` (dropdowns). Never `shadow-md` or larger.

### Adding spacing or styling near a shared component?

**Before adding `mt-*`, `mb-*`, `pt-*`, `pb-*`, or `space-y-*` at a callsite, ask: should this shared component own this spacing?**

If the same component is used in multiple places and always needs the same gap below/above it, put the spacing **inside the component** — not at every callsite. Callsite spacing drifts. Component-owned spacing is a single source of truth.

Examples:
- `SectionRuleHeading` should own the gap below itself — not every caller adding `mt-4` or `space-y-6`
- `PageTabs` should NOT own spacing between itself and page content it doesn't control

Rule: spacing that is *always the same* belongs in the component. Spacing that *varies by context* belongs at the callsite.

## Detail page field layout (MANDATORY)

Detail pages — both read-only and editable — always use **horizontal** label + value/input alignment. Never stack label above input on a detail page.

**Read-only fields:** use `<DetailField>` — it enforces horizontal layout automatically.

**Editable fields (inline editing on a detail page):**

```tsx
// Correct — label left, input right
<div className="flex items-center gap-4">
  <label className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    Field Name
  </label>
  <div className="flex-1">
    <Input ... />
  </div>
</div>
```

**Never on a detail page:**
```tsx
// Wrong — stacked layout belongs on create/edit FORM pages, not detail pages
<div className="space-y-2">
  <label>Field Name</label>
  <Input ... />
</div>
```

The rule: `PageShell variant="form"` → stacked fields are acceptable. `PageShell variant="detail"` → horizontal fields, always.

## Contact and communication actions

When a field value is an email address, phone number, or URL, render it as an icon-link — not a `<Button>`.

```tsx
// Correct — icon link, zero visual weight
<a href={`mailto:${email}`} className="text-foreground hover:text-primary">
  <Mail className="h-4 w-4" />
</a>

// Correct — text link for inline context
<a href={`mailto:${email}`} className="text-sm text-foreground hover:text-primary hover:underline">
  {email}
</a>

// Wrong — full button for a contact action is pure noise
<Button variant="outline" size="sm"><Mail className="h-4 w-4 mr-2" />Send Email</Button>
```

The same rule applies to phone (`tel:`), external links, and copy-to-clipboard actions on contact fields. Use an icon at `h-4 w-4` in `text-muted-foreground`. No label unless the icon is genuinely ambiguous. No `<Button>` wrapper.

## The design system docs

Full reference: `DESIGN.md` (repo root)

### Showing an empty state?

**ALWAYS** use `<EmptyState>` from `@/components/ds`. Never hand-roll one.

```tsx
import { EmptyState } from "@/components/ds";

<EmptyState
  icon={<SomeLucideIcon />}
  title="No items yet"
  description="Helpful description of what will appear here."
  action={<Button size="sm">Create Item</Button>}  {/* optional */}
/>
```

**Never:**
- `<div className="text-center py-8 text-muted-foreground">` with inline icon + text
- Emoji in a `rounded-full bg-muted` div as a placeholder icon
- `<p>No * yet</p>` rendered directly without `<EmptyState>`
- `opacity-50` on an icon to fake an empty state look

If the empty state needs a button, pass it via the `action` prop — never put the button only in the section header when the list is empty.

**Button placement rule:** When a list is empty, the create/add button must appear inside the `<EmptyState action={...}>`, not floating in the section header. Only show the header button when items exist.

## Why this gate exists

Every time an agent skips this gate, it produces:
- Double headers (PageContainer + h1 inside, plus the layout's own header)
- Full-width pages that should be constrained
- Articles and list items wrapped in cards
- Hardcoded colors that break dark mode
- Custom buttons instead of `<Button>`
- One-off components that duplicate existing ones
- Hand-rolled empty states that look completely different from each other
