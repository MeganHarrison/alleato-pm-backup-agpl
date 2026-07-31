# Premium UI/UX Design System for Claude Code

**Stop Building Generic. Start Building Great.**

This document is your mandatory reference for every UI component, layout, and visual decision. Read it before touching a single line of CSS. Violating these rules produces amateur work. Following them produces Linear, Supabase, Vercel-quality output.

---

## THE CARDINAL SIN: THE CARD TRAP

**The problem**: Using `rounded-lg border bg-card p-6` for every single section is lazy design. It creates visual monotony — every section looks identical, users can't distinguish importance, and the UI feels like a Tailwind tutorial project from 2020.

**The rule**: Cards are ONE tool in the toolkit. Sections should be differentiated through multiple visual techniques. On any given screen, no more than **2–3 sections** should share the same visual treatment.

**The operating principle**: Border is never the first answer to hierarchy. Use text weight, muted supporting copy, spacing, icon columns, indentation, row rhythm, tonal elevation, and hover/active states before adding a box. A border should confirm a real boundary, not manufacture one.

---

## HIERARCHY TOOLKIT: 6 Ways to Separate Sections Without Identical Cards

### 1. SURFACE ELEVATION (not cards — actual depth layers)
```css
/* Layer 0 — Page background */
--surface-base: #0a0a0b;        /* or #fafafa light */

/* Layer 1 — Subtle section lift */
--surface-raised: #111113;      /* +1 stop brightness */

/* Layer 2 — Component / panel */
--surface-overlay: #18181b;     /* +2 stops */

/* Layer 3 — Floating / modal */
--surface-float: #27272a;       /* +3 stops — only for dropdowns, tooltips */
```
**Rule**: Adjacent sections at the same level should NOT have borders between them. Use background contrast instead. Borders are for interactive elements (inputs, tables), not layout separation.

### 2. TYPOGRAPHY HIERARCHY (the most underused tool)
Three levels, no more, no less:
```css
/* Section Label — eyebrow text, spaced, muted, small caps feel */
.section-label {
  font-size: 0.6875rem;    /* 11px */
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);  /* ~40% opacity */
}

/* Section Heading — clear, confident */
.section-heading {
  font-size: 1.125rem;    /* 18px */
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

/* Body / Data Text */
.body-text {
  font-size: 0.875rem;    /* 14px */
  font-weight: 400;
  line-height: 1.6;
  color: var(--text-secondary);  /* ~70% opacity */
}
```

**Key insight**: A section with a prominent eyebrow label, large metric, and muted supporting text communicates THREE levels of importance without any border or card.

### 3. WHITESPACE AS DIVIDERS (the Linear technique)
```css
/* Don't use <hr> or borders between sections */
/* Use space. Lots of it. */

.section + .section {
  margin-top: 3rem;   /* 48px — section break */
}

.subsection + .subsection {
  margin-top: 1.5rem;  /* 24px — group break */
}

.item + .item {
  margin-top: 0.75rem;  /* 12px — item break */
}
```

**Rule**: If you're using a border to separate things, ask yourself — would more whitespace accomplish the same thing? 90% of the time: yes.

For accordions, side lists, activity streams, and settings rows, the preferred pattern is an open list: consistent icon column, title + description stack, optional trailing action, `py-3`/`py-4` row rhythm, and `divide-y` only inside the list. Do not put a bordered tile around every item.

### 4. FULL-BLEED & BENTO GRID (break the column prison)
```css
/* The Bento approach — variable-sized cells, not identical cards */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto;
  gap: 1px;                    /* hairline gap — NOT padding gap */
  background: var(--border);   /* border is the gap color */
}

/* Hero metric — 4 columns wide, visually dominant */
.bento-hero {
  grid-column: span 4;
  background: var(--surface-raised);
  padding: 2rem;
}

/* Supporting content — 2 columns, smaller visual weight */
.bento-supporting {
  grid-column: span 2;
  background: var(--surface-raised);
  padding: 1.5rem;
}

/* Wide chart — spans full width */
.bento-full {
  grid-column: span 12;
  background: var(--surface-raised);
  padding: 1.5rem 2rem;
}
```

**This is how Linear, Vercel, and Supabase build dashboards.** Not `grid grid-cols-3 gap-6` with identical cards.

### 5. HORIZONTAL RULES — USED SPARINGLY
```css
/* Only use dividers WITHIN a section, between list items */
/* NEVER between major sections */
.divider {
  height: 1px;
  background: var(--border);  /* ~8% opacity white or dark */
  margin: 0;  /* no vertical margin — let parent handle spacing */
}
```

### 6. ACCENT & INDICATOR BARS (Notion / Linear style)
```css
/* Left border accent — signals active state, importance, or category */
.accent-bar {
  border-left: 2px solid var(--accent);
  padding-left: 1rem;
}

/* Status indicator stripe at top of section */
.status-stripe {
  border-top: 2px solid var(--color-success);
}

/* Colored background for critical/alert sections only */
.alert-section {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
}
```

---

## THE 8PT SPATIAL SYSTEM — NON-NEGOTIABLE

Every spacing value must be a multiple of 4. Prefer multiples of 8.

```
4px  — micro: icon-to-label gap, badge padding
8px  — tight: inline element spacing
12px — compact: form field internal spacing
16px — base: standard component padding
24px — comfortable: card internal padding
32px — section: between related groups
48px — break: between major sections
64px — page: top/bottom page padding
80px — hero: large section vertical rhythm
```

**The rule**: `padding: 24px` on a card. `gap: 16px` between items inside it. `margin-bottom: 48px` before the next section. Never `padding: 18px` or `gap: 14px`. These are not in the system.

### Component Sizing Standards
```css
/* Heights — strict standards */
--height-xs: 24px;   /* Tags, badges */
--height-sm: 32px;   /* Secondary buttons, inputs compact */
--height-md: 36px;   /* Primary buttons, standard inputs */
--height-lg: 40px;   /* Large CTAs */
--height-xl: 48px;   /* Hero CTAs only */

/* Border radius — choose ONE scale per product */
/* Option A: Sharp/Professional (Linear, Vercel) */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;

/* Option B: Soft/Friendly (Notion, Slack) */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;

/* NEVER mix radius values randomly. Pick a scale and stick to it. */
```

---

## TYPOGRAPHY SYSTEM

### Type Scale (use exactly these values)
```css
--text-2xs: 0.625rem;   /* 10px — legal, timestamps only */
--text-xs:  0.75rem;    /* 12px — captions, labels */
--text-sm:  0.875rem;   /* 14px — body text, UI copy */
--text-md:  1rem;       /* 16px — readable body */
--text-lg:  1.125rem;   /* 18px — section headings */
--text-xl:  1.25rem;    /* 20px — page section titles */
--text-2xl: 1.5rem;     /* 24px — page titles */
--text-3xl: 1.875rem;   /* 30px — hero numbers, KPIs */
--text-4xl: 2.25rem;    /* 36px — hero headings */
```

### Font Weight Rules
```css
/* DON'T use every weight. Pick 3: */
--weight-normal:   400;   /* Body, descriptions */
--weight-medium:   500;   /* Labels, slightly emphasized */
--weight-semibold: 600;   /* Headings, metrics, buttons */

/* 700+ (bold) only for: huge KPI numbers, hero headlines */
/* NEVER bold regular body text */
```

### Line Height Rules
```css
/* Tight for headings (they're short) */
h1, h2, h3 { line-height: 1.2; letter-spacing: -0.02em; }

/* Comfortable for body (users read this) */
p, li, td { line-height: 1.6; }

/* Single-line for UI labels */
button, .label, .badge { line-height: 1; }
```

---

## COLOR SYSTEM — THE FOUR LAYERS

### Text Colors (dark mode example)
```css
--text-primary:    rgba(255, 255, 255, 0.95);  /* Main content */
--text-secondary:  rgba(255, 255, 255, 0.65);  /* Supporting text */
--text-tertiary:   rgba(255, 255, 255, 0.40);  /* Disabled, hints */
--text-disabled:   rgba(255, 255, 255, 0.25);  /* Truly inactive */
```

### Border Colors
```css
--border-default:  rgba(255, 255, 255, 0.08);  /* Subtle dividers */
--border-strong:   rgba(255, 255, 255, 0.15);  /* Inputs, interactive */
--border-focus:    var(--accent);               /* Focus ring */
```

### Surface Colors
Use the elevation system above. **Never** use pure black for backgrounds — it looks like a beginners' error. Use `#09090b` or `#0a0a0b`.

### Accent Usage Rules
```css
/* ONE primary accent color */
/* Use it for: active nav items, primary CTAs, focus rings, progress */
/* NOT for: decorative backgrounds, random highlights */

/* Status colors — use sparingly */
--color-success: #22c55e;   /* only for truly positive states */
--color-warning: #f59e0b;   /* alerts, degraded states */
--color-error:   #ef4444;   /* errors, destructive actions */
--color-info:    #3b82f6;   /* neutral info */

/* Rule: Status colors appear on <5% of total UI surface area */
```

---

## LAYOUT PATTERNS: HOW PREMIUM APPS STRUCTURE SCREENS

### Pattern 1: The Inverted Pyramid (Linear/Supabase style)
```
┌─────────────────────────────────────┐
│  PAGE TITLE + PRIMARY CTA          │  ← Large, prominent
│  [subtitle — muted, smaller]        │
├─────────────────────────────────────┤
│  [KPI ROW — 3-4 large numbers]      │  ← High visual weight
│   $2.4M          94%          12    │
│   Revenue        Uptime       Issues│
├──────────────┬──────────────────────┤
│  [WIDE CHART │  SECONDARY PANEL]    │  ← Supporting data
│  8 cols      │  4 cols              │
├─────────────────────────────────────┤
│  [DATA TABLE or LIST]               │  ← Detail layer
│  Full width, density mode           │
└─────────────────────────────────────┘
```

### Pattern 2: Master-Detail Split (Notion/Linear)
```
┌────────────┬────────────────────────┐
│  SIDEBAR   │  MAIN CONTENT          │
│  240px     │  flex-1                │
│            │                        │
│  • Nav     │  [Header bar]          │
│  • Filters │  [Content area]        │
│  • Tree    │                        │
└────────────┴────────────────────────┘
```

### Pattern 3: Settings Page (the most commonly butchered layout)
```
/* WRONG: Cards for every settings group */
/* RIGHT: */

.settings-layout {
  max-width: 640px;   /* Narrow — settings are read, not scanned */
}

.settings-section {
  padding: 2rem 0;
  border-bottom: 1px solid var(--border-default);
}

.settings-section:last-child {
  border-bottom: none;
}

/* Section title */
.settings-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  /* NO background, NO card, just good typography */
}
```

---

## KPI / METRIC COMPONENTS — DO IT RIGHT

```jsx
/* The wrong way: */
<div className="rounded-lg border p-4">
  <p className="text-sm text-muted-foreground">Revenue</p>
  <p className="text-2xl font-bold">$24,000</p>
</div>

/* The right way — visual hierarchy + context: */
<div className="metric-block">
  <span className="metric-label">Monthly Revenue</span>
  <div className="metric-row">
    <span className="metric-value">$24,000</span>
    <span className="metric-delta positive">+12.4%</span>
  </div>
  <span className="metric-compare">vs $21,380 last month</span>
</div>

/* CSS: */
.metric-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.metric-value {
  font-size: 2rem;       /* 32px — commands attention */
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.metric-delta {
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.metric-delta.positive {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.metric-compare {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 4px;
}
```

---

## DATA TABLES — PREMIUM STYLE

```css
/* Table structure */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

/* Header row — distinct but not heavy */
.data-table thead th {
  font-size: 0.6875rem;         /* 11px */
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 0 16px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-default);
  white-space: nowrap;
}

/* Data rows */
.data-table tbody td {
  padding: 10px 16px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-default);
  vertical-align: middle;
}

/* Row hover — subtle, not jarring */
.data-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

/* First column — primary identifier, more weight */
.data-table tbody td:first-child {
  color: var(--text-primary);
  font-weight: 500;
}
```

---

## NAVIGATION — THE SKELETON OF HIERARCHY

### Sidebar (the Linear approach)
```css
.sidebar {
  width: 240px;
  background: var(--surface-base);
  border-right: 1px solid var(--border-default);
  padding: 16px 8px;
}

/* Nav section labels — NOT menu items */
.nav-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 0 8px;
  margin-bottom: 4px;
  margin-top: 24px;
}

/* Nav items */
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s;
}

.nav-item:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(255,255,255,0.08);
  color: var(--text-primary);
  font-weight: 500;
}
```

---

## THE DENSITY SPECTRUM

Different screens require different density. Don't apply one setting everywhere.

| Screen Type | Padding | Font Size | Line Height |
|------------|---------|-----------|-------------|
| Dashboard overview | 24–32px | 14px body | 1.4 |
| Data table | 8–12px row | 13px | 1 |
| Settings page | 16–24px | 14px | 1.6 |
| Detail/empty state | 48–64px | 16px | 1.7 |
| Command palette | 8–10px | 13px | 1 |

---

## SHADOW SYSTEM (USE IT)

```css
/* Most AI-generated UIs use zero shadows. This is why they look flat. */

--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.1);
--shadow-md:  0 4px 6px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-lg:  0 10px 15px rgba(0, 0, 0, 0.2), 0 4px 6px rgba(0, 0, 0, 0.15);
--shadow-xl:  0 20px 25px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.1);

/* Usage rules:
   sm  → input fields, small interactive elements
   md  → dropdowns, popovers, active cards
   lg  → modals, command palettes
   xl  → never on dark backgrounds (too heavy) — light themes only */
```

---

## INTERACTIVE STATES — ALL OF THEM, EVERY TIME

```css
/* Every interactive element needs ALL of these: */
.interactive {
  /* Default */
  background: var(--surface-raised);
  color: var(--text-primary);
  
  /* Hover — visible but not jarring */
  &:hover {
    background: var(--surface-overlay);
  }
  
  /* Active/pressed */
  &:active {
    transform: scale(0.98);
    opacity: 0.9;
  }
  
  /* Focus — keyboard users exist */
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  
  /* Disabled — clearly inactive */
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}
```

---

## WHAT TO DO INSTEAD OF CARDS

When you feel the urge to wrap something in a card, ask:

| If you're grouping... | Use instead |
|----------------------|-------------|
| Stats / KPIs | Borderless metric blocks with whitespace |
| A settings section | Section heading + form fields, separated by `border-bottom` |
| A list of items | Table or list with row hover states |
| Related content | Background color change + padding |
| Important callout | Accent-bordered left bar + tinted background |
| Navigation groups | Sidebar section label + indent |

**Cards are valid for:**
- Individual entities in a grid (project cards, user cards)
- Floating UI elements (popovers, command palette)
- Isolated actionable items (pricing tiers, feature highlights)
- Content where the "boundary" communicates the entity scope

---

## ANTI-PATTERNS — NEVER DO THESE

```
❌ grid-cols-3 gap-4 with identical cards for every section
❌ Using `shadow-xl` on everything
❌ Putting a card inside a card
❌ <hr> between every section
❌ Centering all text (use left-align for data UIs)
❌ Purple gradient on white/light backgrounds (it's 2020)
❌ Icon + label + value all the same color
❌ All caps for anything longer than 3 words
❌ Fixed pixel widths for flexible content
❌ Padding that isn't on the 4px/8px grid
❌ More than 2 font families
❌ Mixing different border-radius values without a system
❌ Borders AND shadows on the same element
❌ Status colors (red/green/yellow) for decoration
❌ Empty states that just say "No data" with no action
```

---

## CHECKLIST BEFORE SHIPPING ANY SCREEN

- [ ] Does every section have a unique visual treatment? (No two identical cards in a row)
- [ ] Are all spacing values on the 8pt grid?
- [ ] Are there at least 3 levels of text hierarchy visible?
- [ ] Do all interactive elements have hover + focus states?
- [ ] Is the most important information visually dominant?
- [ ] Have I used whitespace instead of borders where possible?
- [ ] Is the font size 13–14px for data, 18+ for section headings?
- [ ] Do metric/KPI components have context (delta, comparison)?
- [ ] Is the color palette restrained? (1 accent, 2–3 grays, status colors only where semantically correct)
- [ ] Does the layout guide the eye from primary → secondary → detail?

---

*This is the standard. Build to it.*
