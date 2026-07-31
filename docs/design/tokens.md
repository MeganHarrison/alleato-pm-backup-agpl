# Design Tokens — Alleato Brand / Superhuman-Inspired v2

All styling uses these tokens. **No hex codes. No arbitrary values. No hardcoded colors.**

> **Philosophy:** Tonal elevation replaces borders. Background shift = visual separation.
> Pages sit on `bg-background` (#FFFFFF), and surfaces use `bg-card` (#FFFFFF true white).
> The ~3% lightness difference IS the border. Use actual borders sparingly.

## Colors

### Backgrounds

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `bg-background` | Page background | #FBFAF8 (warm paper) | #151518 |
| `bg-card` | Card surfaces, elevated content | #FFFFFF (true white) | #1F1F24 |
| `bg-muted` | Subtle background (hover, zebra rows) | #F4F2F0 | #272730 |
| `bg-muted/30` | Very subtle tint | — | — |
| `bg-accent` | Interactive hover, active sidebar item | #FDF2E8 (brand orange tint) | #462714 |
| `bg-popover` | Popover/dropdown/modal surfaces | #FFFFFF | #2C2C35 |
| `bg-primary` | Primary buttons, active states | #DB802D (brand orange) | #F59A43 |
| `bg-secondary` | Secondary buttons | #F1F1F4 | #272730 |
| `bg-destructive` | Delete/danger actions | #DC2626 | #DC2626 |

### Text

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `text-foreground` | Primary text (headings, body) | #101018 | #EBEBEB |
| `text-muted-foreground` | Secondary text (descriptions, labels) | #606161 (~38%) | #A6A6A6 (~65%) |
| `text-primary` | Links, active navigation, brand accent | #DB802D | #F59A43 |
| `text-destructive` | Error text, destructive actions | #DC2626 | — |
| `text-card-foreground` | Text on card surfaces | #101018 | #EBEBEB |
| `text-popover-foreground` | Text in popovers | #101018 | #EBEBEB |

### Borders

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| `border-border` | Default borders (use sparingly!) | #E6E6EC | #2E2E38 |
| `border-border/50` | Half-opacity for very subtle dividers | — | — |
| `border-input` | Form input borders | #E6E6EC | #2E2E38 |
| `border-ring` | Focus ring color | #DB802D | #F59A43 |

> **Border philosophy:** Most cards should NOT have borders. Use tonal elevation
> (`bg-card` on `bg-background`) instead. Only use borders for:
> - Form inputs (required for accessibility)
> - Table header/row dividers
> - Explicit structural separators (use `border-border/50`)

### Status Colors

Use these for status indicators, badges, and alerts. **Use `StatusBadge` component — don't map colors manually.**

| Token | Usage |
|-------|-------|
| `text-green-600` / `bg-green-50` | Success, approved, active |
| `text-yellow-600` / `bg-yellow-50` | Warning, pending, draft |
| `text-red-600` / `bg-red-50` | Error, rejected, overdue |
| `text-blue-600` / `bg-blue-50` | Info, in progress |

### Status tokens (semantic — use these going forward)

Status colors are NEVER used directly. Always via `<StatusBadge>`, `<StatusDot>`, or `<StatusText>`.

| Token | Light value | Dark value |
|---|---|---|
| `success` | `#16A34A` | `#22C55E` |
| `success-subtle` | `#F0FDF4` | `#14532D` |
| `warning` | `#CA8A04` | `#EAB308` |
| `warning-subtle` | `#FEFCE8` | `#422006` |
| `danger` | `#DC2626` | `#EF4444` |
| `danger-subtle` | `#FEF2F2` | `#450A0A` |
| `info` | `#2563EB` | `#3B82F6` |
| `info-subtle` | `#EFF6FF` | `#172554` |
| `neutral` | `#525252` | `#A3A3A3` |
| `neutral-subtle` | `#F5F5F5` | `#262626` |

### Banned Color Patterns

```
bg-white, bg-black                    → use bg-background, bg-card, text-foreground
text-gray-*, bg-gray-*, border-gray-* → use semantic tokens above
text-neutral-*, bg-neutral-*          → use semantic tokens above
bg-orange-*, text-orange-*            → use bg-primary, text-primary (Alleato brand orange)
#[hex], rgb(), rgba()                 → use Tailwind tokens
bg-[#...], text-[#...]               → use design system tokens
```

## Spacing

8px grid system. Every spacing value is a multiple of 8px (with 4px for tight situations).

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` / `space-y-1` | 4px | Icon-to-text gap |
| `gap-2` / `space-y-2` | 8px | Tight groups (label + input, badge + text) |
| `gap-3` / `space-y-3` | 12px | Compact lists |
| `gap-4` / `space-y-4` | 16px | Items within a section, default group spacing |
| `gap-6` / `space-y-6` | 24px | Form fields, related subsections |
| `gap-8` / `space-y-8` | 32px | Top-level page sections |

### Page Padding (handled by PageContainer)

| Breakpoint | Horizontal | Vertical |
|-----------|-----------|---------|
| Mobile | `px-4` (16px) | `py-4` (16px) |
| Tablet (`sm:`) | `px-6` (24px) | `py-6` (24px) |
| Desktop (`lg:`) | `px-8` (32px) | `py-6` (24px) |

### Banned Spacing Patterns

```
p-[10px], gap-[15px], m-[20px]  → use token values
p-5, p-7, p-9, p-10, p-11      → use 8px cadence (p-4, p-6, p-8, p-12)
```

## Typography

### Font Stack

- **Sans:** Inter (with OpenType features: `kern`, `liga`, `calt`)
- **Mono:** JetBrains Mono / SF Mono

### Font Sizes

| Token | Size | Usage |
|-------|------|-------|
| `text-2xs` | 10px | Micro labels, eyebrows |
| `text-xs` | 12px | Metadata, timestamps, fine print |
| `text-sm` | 14px | Secondary text, descriptions, table cells |
| `text-base` | 16px | Body text, form inputs |
| `text-lg` | 18px | Section headings (h2) |
| `text-xl` | 20px | Page sub-headings |
| `text-2xl` | 24px | Page titles (rare, mostly in PageHeader) |

### Font Weights

| Token | Usage |
|-------|-------|
| `font-light` | Large numbers (KPI values) |
| `font-normal` | Body text, descriptions |
| `font-medium` | Labels, table headers, navigation items |
| `font-semibold` | Section headings, emphasis |

**`font-bold` and `font-extrabold` are banned in body content.** Only used inside the PageHeader component.

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `tracking-tight` | −0.025em | Default headings |
| `tracking-heading` | −0.01em | Superhuman-style tight headings (h1-h6) |
| `tracking-wider` | 0.05em | Eyebrow labels |
| `tracking-widest-plus` | 0.2em | Uppercase micro labels |

### Banned Typography Patterns

```
text-[14px], text-[1.2rem]  → use text-sm, text-base, etc.
font-bold in page content   → use font-semibold max
```

## Borders & Radius

| Token | Usage |
|-------|-------|
| `border` | Default 1px border (use sparingly — prefer tonal shift) |
| `border-b` | Section dividers |
| `rounded-md` | Form inputs, buttons (default) |
| `rounded-lg` | Cards, modals |
| `rounded-full` | Avatars, badges, pills |

### Banned

```
border-2, border-4              → 1px borders only
rounded-sm, rounded (no suffix) → use rounded-md for inputs
shadow-lg, shadow-xl, shadow-2xl → banned. Use shadow-sm max.
```

## Shadows — Superhuman Minimal Policy

Only two shadow levels. No heavy shadows. Most elements have NO shadow.

| Token | Usage |
|-------|-------|
| `shadow-xs` | Form inputs, select triggers |
| `shadow-sm` | Cards (on hover), dropdowns, floating elements |
| (none) | Most elements — no shadow needed when using tonal elevation |

### Banned

```
shadow, shadow-md, shadow-lg, shadow-xl, shadow-2xl → too heavy
ring-* with glow effects                             → not our aesthetic
```

## Animations — Superhuman Timing System

### Transition Durations

| Token | Value | Usage |
|-------|-------|-------|
| `duration-0` | 0ms | Instant (keyboard nav highlight) |
| `duration-100` | 100ms | Fast (hover states, micro-interactions) |
| `duration-150` | 150ms | Normal (most transitions) |
| `duration-200` | 200ms | Spring (command palette, modals) |

### Easing Functions

| Token | Curve | Usage |
|-------|-------|-------|
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Smooth deceleration (panels, menus, slideovers) |
| `ease-out-quart` | `cubic-bezier(0.22, 1, 0.36, 1)` | Command palette, modal entrance, toasts (no overshoot) |

### Keyframe Animations

| Class | Effect | Usage |
|-------|--------|-------|
| `animate-spring-in` | Scale + fade in with overshoot | Command palette, modals |
| `animate-slide-out-right` | Slide right + fade out | Archive/done actions |
| `animate-row-fill` | Slide up + fade in | Row reflow after deletion |

## Interactive States

Every interactive element must implement all 5 states. No exceptions.

### The 5 States (all required)

| State | What Happens | Key Classes |
|-------|-------------|-------------|
| **Default** | Resting state — visible border, subtle shadow | `border-input shadow-xs bg-background` |
| **Hover** | Background shifts, shadow lifts slightly | `hover:bg-accent hover:text-accent-foreground` |
| **Focus** | Primary-colored ring appears around element | `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` |
| **Active** | Slight scale-down for tactile feedback | `active:scale-[0.98]` (buttons only) |
| **Disabled** | Faded, non-interactive | `disabled:opacity-50 disabled:pointer-events-none` |

### Button Interactive States (copy-paste ready)

**Primary Button** (brand CTA — max 1-2 per screen):

```
bg-primary text-primary-foreground shadow-xs
hover:bg-primary/90
focus-visible:ring-[3px] focus-visible:ring-ring/50
active:scale-[0.98]
disabled:opacity-50 disabled:pointer-events-none
```

**Secondary / Outline Button**:

```
border border-input bg-background text-foreground shadow-xs
hover:bg-accent hover:text-accent-foreground
focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
active:scale-[0.98]
disabled:opacity-50 disabled:pointer-events-none
```

**Ghost Button**:

```
text-muted-foreground
hover:bg-accent hover:text-accent-foreground
focus-visible:ring-[3px] focus-visible:ring-ring/50
disabled:opacity-50 disabled:pointer-events-none
```

**Destructive Button**:

```
bg-destructive text-destructive-foreground shadow-xs
hover:bg-destructive/90
focus-visible:ring-[3px] focus-visible:ring-ring/50
active:scale-[0.98]
disabled:opacity-50 disabled:pointer-events-none
```

### Link / Text Interactive States

```
text-muted-foreground
hover:text-foreground
transition-colors
```

For brand-accent hover (e.g., list item titles):

```
text-foreground
group-hover:text-primary
transition-colors
```

### Row / Card Interactive States

Entire-row hover (for list items, table rows):

```
group rounded-md transition-colors
hover:bg-muted
```

### Banned Interactive Patterns

```
hover:bg-gray-50, hover:bg-gray-100      → use hover:bg-accent or hover:bg-muted
hover:text-orange-600, hover:bg-orange-*  → use hover:text-primary or hover:bg-primary
focus:ring-orange-500                     → use focus-visible:ring-ring/50
focus:outline-none (alone)                → must ALSO have ring — focus needs visible indicator
ring-2 ring-offset-2                      → use ring-[3px] ring-ring/50 (matches shadcn)
```

### Component Consistency Matrix

All form-level interactive elements must match:

| Property | Input | SelectTrigger | Button (outline) |
|----------|-------|---------------|------------------|
| Border | `border-input` | `border-input` | `border-input` |
| Radius | `rounded-md` | `rounded-md` | `rounded-md` |
| Height | `h-9` | `h-9` | `h-9` |
| Shadow | `shadow-xs` | `shadow-xs` | `shadow-xs` |
| Focus ring | `ring-ring/50` | `ring-ring/50` | `ring-ring/50` |
| Padding | `px-3 py-2` | `px-3 py-2` | `px-3 py-2` |

**Any deviation from this matrix is a bug.**

### CSS Variable Reference (what the tokens resolve to)

These are defined in `globals.css` — never use the raw values, always use the Tailwind tokens above.

| Token | CSS Variable | Light Mode Value | Resolves To |
|-------|-------------|-----------------|-------------|
| `primary` | `--primary` | `29 71% 52%` | Alleato brand orange (#DB802D) |
| `ring` | `--ring` | `29 71% 52%` | Matches primary (#DB802D) |
| `background` | `--background` | `30 20% 98%` | Warm paper (#FBFAF8) |
| `card` | `--card` | `0 0% 100%` | True white (#FFFFFF) |
| `muted` | `--muted` | `30 18% 95%` | Warm neutral (#F4F2F0) |
| `accent` | `--accent` | `29 84% 95%` | Subtle orange tint (#FDF2E8) |
| `foreground` | `--foreground` | `240 20% 8%` | Brand black (#101018) |
| `muted-foreground` | `--muted-foreground` | `180 1% 38%` | Brand gray (#606161) |
| `destructive` | `--destructive` | `0 72% 51%` | Red (#DC2626) |
| `border` | `--border` | `240 5% 91%` | Cool border (#E6E6EC) |

### Dark Mode Reference

| Token | Dark Value | Resolves To |
|-------|-----------|-------------|
| `background` | `240 6% 9%` | #151518 (deepest) |
| `card` | `240 5% 13%` | #1F1F24 (mid-level) |
| `muted` | `240 5% 16%` | #272730 (near) |
| `popover` | `240 5% 18%` | #2C2C35 (closest/floating) |
| `foreground` | `0 0% 92%` | #EBEBEB (not pure white) |
| `muted-foreground` | `0 0% 65%` | #A6A6A6 |
| `primary` | `29 90% 61%` | #F59A43 (lighter for dark bg) |
| `border` | `240 5% 19%` | #2E2E38 |

> **Dark mode principle:** No pure black (#000) or pure white (#FFF).
> Closer surfaces are lighter, distant surfaces are darker (opposite of naive dark mode).
> This creates natural depth hierarchy through 5 shades of gray.

## CSS Spacing Variables

These CSS custom properties are set globally and consumed by layout components. Reference them when building custom layouts where Tailwind tokens alone don't cover the use case.

| Variable | Value | Used By |
|----------|-------|---------|
| `--page-padding` | `1.5rem` → `2rem` (lg) | `PageContainer` horizontal padding |
| `--section-gap` | `2rem` | Gap between top-level page sections |
| `--card-padding` | `1.5rem` | Internal padding of card surfaces |
| `--group-gap` | `1rem` | Gap between grouped items within a section |
| `--field-gap` | `1.5rem` | Gap between form fields |
| `--row-height` | `3.5rem` (standard) | Table row height (see density profiles) |
| `--cell-padding` | `0 0.75rem` | Table cell horizontal padding |
| `--cell-padding-y` | `0.75rem` | Table cell vertical padding |

### Spacing Level Names (Named Scale)

| Name | Value | Tailwind | Use For |
|------|-------|----------|---------|
| `micro` | 4px | `gap-1` | Icon-to-label gap |
| `tight` | 8px | `gap-2` | Badge + text, label + input |
| `compact` | 12px | `gap-3` | Compact list items |
| `base` | 16px | `gap-4` | Default item spacing within a section |
| `comfortable` | 24px | `gap-6` | Form field spacing |
| `section` | 32px | `gap-8` | Between page sections |
| `break` | 48px | `gap-12` | Major visual breaks |

### Density Profiles (Table Row Heights)

| Profile | Row Height | When To Use |
|---------|-----------|-------------|
| `compact` | 40px | Data-dense views, power users |
| `standard` | 53px | Default for all tables |
| `comfortable` | 64px | Cards-in-rows, rich content per row |

### Spacing Per Page Type

| Page Type | Outer Padding | Section Gap | Card Padding |
|-----------|--------------|-------------|-------------|
| Dashboard | `px-6 py-6` → `px-8` (lg) | `gap-8` | `p-6` |
| Table/List | `px-6 py-4` → `px-8` (lg) | `gap-4` | n/a |
| Form | constrained (672–896px) | `gap-6` | `p-6` |
| Detail | `px-6 py-6` → `px-8` (lg) | `gap-6` | `p-4` |
