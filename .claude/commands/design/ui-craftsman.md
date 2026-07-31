---
description: Use when building or modifying ANY UI component, page, or layout in Alleato PM. Enforces the design system, prevents visual noise, and ensures clean minimalist output. MUST be invoked before writing JSX.
argument-hint: What you're building (e.g., "commitments detail page", "new contract form")
---

# UI Craftsman

You are building UI for Alleato PM, a construction project management platform styled after Linear and Vercel Dashboard — clean, minimal, confident. Your job is to produce UI that looks like a senior designer built it, not like an AI tutorial project.

**THE CORE PRINCIPLE: Subtract, don't add.** Every border, card, shadow, icon, and badge must earn its place. When in doubt, leave it out.

## STEP 0: Read the Design System (MANDATORY — DO NOT SKIP)

Before writing a single line of JSX, read the design bible:

```
frontend/src/design-system/DESIGN-SYSTEM.md
```

This is non-negotiable. If you write UI without reading this file first, the output will be wrong. Read it now.

## STEP 1: Identify the Page Archetype

Every page is exactly ONE of these four types. No hybrids. No improvising.

| Type | When | Layout Component |
|------|------|-----------------|
| **A: Table Page** | List of entities (commitments, RFIs, contracts) | `UnifiedTablePage` |
| **B: Form Page** | Create/edit entity | `ProjectFormPageLayout` + `FormSection` |
| **C: Detail Page** | View single entity | `PageHeader` + `PageContainer` + `SectionHeader` sections |
| **D: Dashboard** | Overview/summary | `PageHeader` + `PageContainer` + `KpiRow` + sections |

Pick one. Build exactly that pattern. Do not invent new page structures.

## STEP 2: Build with Design System Components ONLY

Import from these locations. Do NOT create one-off components.

```tsx
// Layout
import { PageHeader, PageContainer, FormContainer, ProjectFormPageLayout, PageToolbar, PageTabs } from "@/components/layout";

// Design system
import { StatusBadge, StatusDot, KpiRow, EmptyState, DataTable, SectionHeader, Eyebrow, AvatarStack } from "@/components/ds";

// Forms
import { FormField, FormSection } from "@/components/forms";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { RichTextField } from "@/components/forms/RichTextField";

// Tables
import { UnifiedTablePage } from "@/components/tables/unified/unified-table-page";

// Base primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// ... other shadcn primitives from @/components/ui/
```

## STEP 3: Apply Token Rules

**Colors:** Semantic tokens ONLY.
- Text: `text-foreground`, `text-muted-foreground`, `text-destructive`
- Backgrounds: `bg-background`, `bg-card`, `bg-muted`
- Borders: `border-border`
- NEVER: `text-gray-*`, `bg-gray-*`, `bg-white`, `text-black`, hex codes

**Spacing:** 8px grid ONLY.
- `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px), `p-8` (32px)
- NEVER: `p-5`, `p-7`, `gap-5`, `gap-7`, arbitrary values like `p-[18px]`

**Shadows:** `shadow-xs` and `shadow-sm` ONLY. NEVER `shadow-md` or larger.

**Radius:** `rounded-md` default. `rounded-lg` for modals/sheets. `rounded-full` for avatars/pills.

**Font weight:** 400, 500, 600 only. 700 ONLY for hero KPI numbers. NEVER bold body text.

## STEP 4: Mobile Responsiveness (MANDATORY)

Every page must work on mobile (< 640px). This is not optional.

**Tables → Cards on mobile:**
```tsx
<UnifiedTablePage
  toolbar={{
    currentView: isMobile ? "card" : "table",
    enabledViews: ["table", "card"],
  }}
  views={{
    card: (item) => (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {/* Row 1: Primary identifier + status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          <StatusBadge status={item.status} />
        </div>
        {/* Row 2: Key fields in 2-col grid (max 4-6 fields) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="block text-foreground">{formatCurrency(item.amount)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Date</span>
            <span className="block text-foreground">{formatDate(item.date)}</span>
          </div>
        </div>
      </div>
    ),
  }}
/>
```

**Key responsive rules:**
- Grid columns collapse: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Touch targets: minimum 44x44px on mobile
- No horizontal scroll — restructure content to fit
- No hover-only actions — must also work via tap/menu
- Modals become full-screen sheets on mobile
- Font size never below 12px on mobile
- Toolbars collapse into filter sheet/dropdown on mobile
- Page padding: `px-4` on mobile (not cramped, not wasted)

**Mobile detection:**
```tsx
import { useMediaQuery } from "@/hooks/use-media-query";
const isMobile = useMediaQuery("(max-width: 639px)");
```

## STEP 5: Visual Noise Audit (RUN THIS BEFORE FINISHING)

Go through every element you built and ask:

| Question | If YES → |
|----------|----------|
| Is there a `<Card>` wrapper that's just containing a section? | Remove it. Use whitespace. |
| Is there a border between major page sections? | Remove it. Use `space-y-8` or `space-y-10`. |
| Is there an icon that's purely decorative? | Remove it. |
| Is there a badge/label that repeats visible information? | Remove it. |
| Is there a shadow larger than `shadow-sm`? | Reduce to `shadow-sm` or remove. |
| Is there `font-bold` on body text? | Change to `font-medium` or `font-semibold`. |
| Is there a "Coming soon" card? | Replace with `EmptyState` component. |
| Is there a button with no handler? | Remove it entirely. |
| Are there multiple actions in the page header? | Keep ONE primary action. Move rest to toolbar. |
| Is a card nested inside another card? | Flatten the hierarchy. |
| Would this section still communicate clearly without its border/card? | Then remove the border/card. |

**If you find ANY of these issues, fix them before claiming completion.**

## HARD RULES — VIOLATIONS BLOCK COMPLETION

1. **NEVER use `bg-gray-*`, `text-gray-*`, `bg-white`, `border-gray-*`** → semantic tokens only
2. **NEVER use arbitrary spacing** (`p-5`, `gap-7`, `p-[14px]`) → 8px grid only
3. **NEVER use `shadow-md` or larger** → `shadow-sm` max
4. **NEVER create one-off components** that duplicate `ui/` or `ds/` components
5. **NEVER ship non-functional UI** (buttons without handlers, empty dropdowns)
6. **NEVER use generic `[id]` route params** → `[projectId]`, `[contractId]`, etc.
7. **NEVER build a table page without a mobile card view**
8. **NEVER nest cards inside cards**
9. **NEVER wrap individual form fields in cards** (use `FormSection`)
10. **NEVER use status colors for decoration** (status colors are for status only)

## WHAT GOOD LOOKS LIKE

**Good:** Lots of whitespace. 3 levels of text hierarchy (eyebrow → heading → body). Muted secondary text. One accent color used sparingly. Tables with subtle row dividers. Forms with clear section grouping.

**Bad:** Borders around everything. Cards wrapping every section. Bold text everywhere. Multiple accent colors competing for attention. Decorative icons. Shadows on flat elements. Status colors used as backgrounds.

**Think Linear. Think Vercel Dashboard. Think "a senior designer who loves whitespace built this."**
