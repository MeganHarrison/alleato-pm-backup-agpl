# Alleato Design System Rules

This file is the authoritative checklist for `/design-audit`. Every rule here is derived from a real violation found in production. Each check must be run on every file in scope.

---

## Category 1: Component Consistency (CRITICAL)

These are the most common source of visual inconsistency. They cannot be caught by ESLint alone because they're structural, not syntactic.

### 1.1 Section Headings — ALWAYS `SectionRuleHeading`

**Rule:** Every section heading inside a page or tab must use `<SectionRuleHeading>` from `@/components/layout/spacing`. Raw HTML headings are never acceptable for section titles.

**Violations to flag:**
```tsx
// ❌ VIOLATION — raw h2/h3/h4 used as section heading
<h2 className="text-lg font-semibold">Details</h2>
<h3 className="text-xl font-semibold">Schedule of Values</h3>
<p className="font-semibold text-sm">Key Dates</p>
<div className="text-base font-semibold">Attachments</div>

// ✅ CORRECT
<SectionRuleHeading label="Details" />
```

**How to detect:** Grep for `<h2`, `<h3`, `<h4` inside component/tab files. Also grep for `font-semibold` on `<p>` or `<div>` that appear to be used as section titles.

**Severity:** HIGH — causes visual inconsistency across every page that uses the heading.

---

### 1.2 Empty States — ALWAYS `<EmptyState>`

**Rule:** Every zero-data state must use `<EmptyState>` from `@/components/ds`. Hand-rolled empty states are never acceptable.

**Violations to flag:**
```tsx
// ❌ VIOLATION — hand-rolled empty state
<div className="rounded-lg border border-border py-16 text-center">
  <SomeIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
  <p className="text-sm font-medium">No items yet</p>
  <p className="text-xs text-muted-foreground">Description here.</p>
</div>

// ❌ VIOLATION — raw text as empty state
<p className="text-muted-foreground text-sm">No data found.</p>
<p>Coming soon</p>

// ✅ CORRECT
<EmptyState
  icon={FileText}
  title="No items yet"
  description="Description here."
/>
```

**How to detect:** Grep for `py-16 text-center`, `No.*yet`, `Coming soon` in component files. Also look for patterns where `<p>` is the only child of a section when data is empty.

**Severity:** HIGH — inconsistent empty states degrade perceived quality.

---

### 1.3 Buttons — ALWAYS `<Button>` from `@/components/ui/button`

**Rule:** Never use raw `<button>` elements. Always use `<Button>` with a standard variant.

**Violations to flag:**
```tsx
// ❌ VIOLATION
<button className="bg-primary text-white px-4 py-2 rounded">Save</button>
<button className="border border-primary/30 bg-primary/15 text-primary ...">Add</button>

// ✅ CORRECT
<Button variant="default">Save</Button>
<Button variant="outline">Add</Button>
```

**Standard variants:** `default`, `outline`, `ghost`, `destructive`, `secondary`, `link`

**Severity:** HIGH — custom buttons violate the design system and are unmaintainable.

---

### 1.4 Status Display — ALWAYS `<StatusBadge>` or `<StatusDot>`

**Rule:** Never hand-roll status colors or badges. Always use `<StatusBadge status="..." />` or `<StatusDot status="..." />` from `@/components/ds`.

**Violations to flag:**
```tsx
// ❌ VIOLATION
<span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Active</span>
<Badge className="bg-yellow-500">Pending</Badge>

// ✅ CORRECT
<StatusBadge status="active" />
<StatusDot status="pending" label="Pending" />
```

**Severity:** HIGH — hardcoded status colors break dark mode and are impossible to update globally.

---

### 1.5 Tab Consistency — All Tabs on a Page Must Use the Same Patterns

**Rule:** Every tab on a detail page must use identical structural patterns. If one tab uses `SectionRuleHeading`, all tabs must. If one tab uses `EmptyState`, all tabs must. Spot the outlier by comparing tab files side by side.

**How to detect:** Find all tab components imported by a detail page, then check each one for the heading and empty state patterns. If any diverges, flag it.

**Severity:** HIGH — visual inconsistency between tabs is immediately obvious to users.

---

## Category 2: Spacing Ownership (CRITICAL)

### 2.1 Components Own Their Own Spacing

**Rule:** Before adding `mt-*`, `mb-*`, `pt-*`, `pb-*` adjacent to a shared component at a callsite, verify: does this shared component already own that spacing internally? If the same gap appears everywhere the component is used, it belongs inside the component.

**Violations to flag:**
```tsx
// ❌ VIOLATION — every caller manually adds mt-4 after SectionRuleHeading
<SectionRuleHeading label="Details" />
<dl className="mt-4 space-y-3">...</dl>  // mt-4 should be inside SectionRuleHeading

// ❌ VIOLATION — space-y-6 wrapper created just to space heading from content
<div className="space-y-6">
  <SectionRuleHeading label="Details" />
  <dl className="space-y-4">...</dl>
</div>
// → SectionRuleHeading owns mb-4; wrapper should be plain <div>

// ✅ CORRECT — component owns spacing, callsite is clean
<SectionRuleHeading label="Details" />
<dl className="space-y-4">...</dl>
```

**How to detect:** Grep for `space-y-6` wrapping `SectionRuleHeading`. Also look for `mt-4` or `mt-6` immediately following a `SectionRuleHeading`.

**Severity:** HIGH — callsite spacing drifts; one change to the component must be reflected in every caller manually.

---

### 2.2 Use Gaps and Stacks, Not Manual Margins

**Rule:** Spacing between sibling elements should be controlled by the parent container (`gap-*`, `space-y-*`), not by individual children adding `mt-*`/`mb-*`. Reserve `mt-*`/`mb-*` on children only for truly context-specific adjustments.

**Violations to flag:**
```tsx
// ❌ VIOLATION — children controlling their own spacing independently
<div>
  <Section className="mb-6" />
  <Section className="mb-4" />
  <Section className="mb-8" />
</div>

// ✅ CORRECT — parent controls the rhythm
<div className="space-y-6">
  <Section />
  <Section />
  <Section />
</div>
```

**Severity:** MEDIUM

---

## Category 3: Color Tokens (HIGH)

**Rule:** Zero hardcoded colors anywhere. Only semantic tokens.

| Use | Required Token | Banned |
|-----|---------------|--------|
| Page background | `bg-background` | `bg-white`, `bg-gray-50`, `bg-slate-50` |
| Card/surface | `bg-card` | `bg-white` |
| Muted surface | `bg-muted` | `bg-gray-100`, `bg-neutral-100` |
| Primary text | `text-foreground` | `text-gray-900`, `text-black` |
| Secondary text | `text-muted-foreground` | `text-gray-500`, `text-neutral-500` |
| Borders | `border-border` | `border-gray-200`, `border-neutral-200` |
| Primary accent | `text-primary` / `bg-primary` | `text-orange-500`, any hex |
| Destructive | `text-destructive` / `bg-destructive` | `text-red-500`, `bg-red-600` |
| Success | `text-green-*` only via `StatusBadge` | Never directly in components |

**How to detect:** ESLint rule `no-hardcoded-colors` catches most. Also grep for `text-gray-`, `text-neutral-`, `text-zinc-`, `bg-white`, `bg-gray-`, hex patterns `#[0-9a-f]{3,6}`.

**Severity:** HIGH (build-blocking via ESLint)

---

## Category 4: Typography (MEDIUM)

### 4.1 No Arbitrary Font Sizes
**Banned:** `text-[14px]`, `text-[13px]`, `text-[0.875rem]`
**Use:** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`

### 4.2 Font Weights — Three Only
**Allowed:** `font-normal` (400), `font-medium` (500), `font-semibold` (600)
**Banned:** `font-bold` except for hero KPI numbers. Never on body text, descriptions, table cells.

### 4.3 Page Titles Use `PageShell`, Not Raw `<h1>`
**Rule:** New pages must use `<PageShell>` — never a raw `<h1>` at the root of a page component.

---

## Category 5: Layout Structure (HIGH)

### 5.1 No Decorative Borders
**Rule:** Borders add visual clutter. Use whitespace, tonal backgrounds, and typography hierarchy instead.

**Violations:**
```tsx
// ❌ VIOLATION
<div className="border border-border rounded-lg p-6">
  <h3>Section Title</h3>
  <p>Content here</p>
</div>

// ✅ CORRECT — use bg-muted or just whitespace
<div className="bg-muted/40 rounded-lg p-6">
  ...
</div>
```

**Exception:** Tables, inputs, dialogs, and cards (entity grid items) may have borders.

### 5.2 No Nested Cards
**Rule:** Never place a card inside a card. Flatten to one level.

### 5.3 No Edit Icons — Use Three-Dot Menus
**Rule:** Never use Pencil/Edit icons for edit actions. Use `MoreVertical` (three-dot menu) with a dropdown.

### 5.4 Content Width Consistency
**Rule:** All tabs on the same detail page must use the same content container/max-width. Check that `FinancialMarkupTab`, `InvoicesTab`, and `PaymentsTab` all use the same wrapper.

---

## Category 6: Spacing Scale (MEDIUM)

**Rule:** Only the 8px grid. No off-grid values.

**Allowed:** `p-1` `p-2` `p-3` `p-4` `p-6` `p-8` `gap-1` `gap-2` `gap-3` `gap-4` `gap-6` `gap-8` `space-y-2` `space-y-4` `space-y-6` `space-y-8` `space-y-10` `space-y-16`

**Banned:** `p-5`, `p-7`, `gap-5`, `gap-7`, `p-[10px]`, `mt-[18px]`, any bracket notation for spacing

---

## Category 7: Shadows (LOW)

**Allowed:** `shadow-xs` (inputs), `shadow-sm` (dropdowns/popovers)
**Banned:** `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`

---

## Violation Schema

When outputting to `violations.json`, use this structure:

```json
{
  "violations": [
    {
      "file": "relative/path/to/file.tsx",
      "line": 42,
      "category": "component-consistency | spacing-ownership | color-tokens | typography | layout | spacing-scale | shadows",
      "severity": "critical | high | medium | low",
      "rule": "1.1 Section Headings | 1.2 Empty States | 1.3 Buttons | ...",
      "found": "<h3 className=\"text-lg font-semibold\">Details</h3>",
      "fix": "<SectionRuleHeading label=\"Details\" />"
    }
  ],
  "summary": {
    "total": 0,
    "by_severity": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
    "by_category": {},
    "top_files": []
  }
}
```

---

## Quick Grep Commands

Run these to find the most common violations fast:

```bash
# Raw heading tags used as section headings
grep -r "<h[234]" frontend/src/components frontend/src/app --include="*.tsx" -l

# Hand-rolled empty states
grep -r "py-16 text-center\|No.*yet\|Coming soon\|No data" frontend/src/components --include="*.tsx" -l

# Raw buttons
grep -r "<button " frontend/src/components frontend/src/app --include="*.tsx" -l

# Hardcoded colors
grep -r "text-gray-\|text-neutral-\|text-zinc-\|bg-white\|bg-gray-\|#[0-9a-fA-F]" frontend/src --include="*.tsx" -l

# Callsite spacing after SectionRuleHeading
grep -rA2 "SectionRuleHeading" frontend/src --include="*.tsx" | grep "mt-\|space-y-6"

# space-y-6 wrapping SectionRuleHeading
grep -r "space-y-6" frontend/src --include="*.tsx" -l
```
