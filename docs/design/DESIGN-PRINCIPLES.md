# Design Principles

## Philosophy: Subtract, Don't Add

Alleato PM looks like **Linear meets Vercel Dashboard** — clean, minimal, confident. The #1 rule: **if you're about to add a visual element, ask whether removing something else would accomplish the same goal.** Borders, shadows, cards, icons, badges — every one must earn its place. When in doubt, leave it out.

**The visual noise test:** After building a screen, mentally remove every border, card wrapper, and decorative element one at a time. If the layout still communicates the same information without it — delete it permanently.

## Three Principles for Flow

1. **Next action obvious.** The most likely action is always the most visually prominent element. No hunting.
2. **Immediate feedback.** Every interaction produces an instant response — spring animations, optimistic updates, inline confirmation.
3. **Minimize distraction.** No borders where tonal shift works. No shadows where the content speaks. No chrome that doesn't serve the user.

## The Gold Standard Products

| Product | What We Take |
|---------|-------------|
| **Superhuman** | Keyboard-first, zero-distraction, tonal elevation, spring animations |
| **Linear** | Information density, clean tables, crisp typography |
| **Stripe Dashboard** | Data hierarchy, metric presentation, professional feel |
| **Airtable** | Dense tables, row-level interactions |

## Hard Constraints

These are non-negotiable. Every page, every component, every PR.

| Rule | Why |
|------|-----|
| Never nest cards (`Card` inside `Card`) | Creates visual noise, breaks hierarchy |
| Never wrap page sections in decorative cards | Cards are for grouped data, not scaffolding |
| Max 2 visual container levels (page shell + section) | Prevents nesting hell |
| **No shadows beyond `shadow-sm`** | We use tonal elevation, not shadow depth |
| **No borders on cards** — use tonal shift (`bg-card` on `bg-background`) | The 3% lightness difference IS the visual separator |
| 1px borders only (when borders are needed) | Thick borders add visual weight we don't want |
| One accent color per page | Prevents visual chaos |
| No custom className overrides on primitives | Breaks consistency at the source |
| No raw HTML elements in pages | Always use design system components |
| No inline styles (`style={{}}`) | Use Tailwind tokens only |
| No hardcoded colors (hex, rgb, gray-*, neutral-*) | Use semantic CSS variables |

## Border Reduction Protocol

Borders create visual noise. Every border must earn its place.

### Use borders for:
- Form inputs (accessibility requirement)
- Table header/row dividers (structural clarity)
- Explicit separators between distinct content zones
- The chat input field (and nothing else in chat UI)

### Do NOT use borders for:
- Cards (use tonal elevation: `bg-card` on `bg-background`)
- Page sections (use spacing instead)
- Decorative containers
- Hover states (use background color shift: `hover:bg-muted`)

### Tonal Elevation System

Instead of borders, we use background color shifts to create hierarchy:

```
bg-background (#F6F6F8)  →  Page surface (lowest)
  └── bg-card (#FFFFFF)  →  Card content (elevated)
       └── bg-muted (#F1F1F4)  →  Hover / active state
            └── bg-accent (#EDEDFA)  →  Selected / interactive
```

In dark mode, the hierarchy inverts — closer surfaces are lighter:

```
bg-background (#151518)  →  Page surface (deepest)
  └── bg-card (#1F1F24)  →  Card content (lighter)
       └── bg-muted (#272730)  →  Hover / active state
            └── bg-popover (#2C2C35)  →  Floating / closest
```

## Key Design Concepts

### Information Density

Amount of meaningful data visible per screen.

**Goal:** High density, Low noise

Tables should occupy the primary viewport. Maximize visible rows. Avoid unnecessary containers.

### Visual Weight

Heavy elements include: cards, shadows, borders, padding, colors, backgrounds. Too many heavy elements = cognitive fatigue.

**RULE:** Minimize heavy UI elements. Avoid shadows, thick borders, large cards, decorative containers.

### Signal vs Noise

Signal = useful data. Noise = decorative clutter.

Examples of noise: unnecessary icons, extra cards, empty rows, excessive spacing, labels that repeat column names.

Empty-state-specific noise to remove:
- Do not show computed summary metrics that are guaranteed to be zero or placeholder-only in an empty state (example: showing `Total invoiced: $0.00` above a "No invoices yet" state).
- In empty states, keep only what helps the user move forward: a clear title, a short explanation, and a primary action.

### Progressive Disclosure

Don't show everything at once.

**Pattern:** Overview → drill down → detail view

Use expandable rows, drawers, detail pages. Not modals stacked on modals.

### Scanability

Users should understand the page in 3 seconds.

Achieved with alignment, consistent spacing, predictable layout.

### Every Pixel Earns Its Place

Before adding an element ask:
1. Does this communicate information?
2. Does this improve readability?
3. Does this improve interaction?

If not, remove it.

## Visual Rhythm

All spacing follows an 8px cadence:

| Token | Value | Use |
|-------|-------|-----|
| `space-y-2` / `gap-2` | 8px | Tight groups (label + input) |
| `space-y-4` / `gap-4` | 16px | Items within a section |
| `space-y-6` / `gap-6` | 24px | Related sections |
| `space-y-8` / `gap-8` | 32px | Top-level page sections |

- Default section spacing: `space-y-8`
- Default group spacing: `space-y-4`
- Typography caps at `font-semibold` (no `font-bold` or `font-extrabold` in body content)

## Card Usage Policy

Cards are containers for grouped data. They are NOT page scaffolding.

**Allowed:**
- KPI metric tiles
- Compact mobile record tiles
- Isolated side modules (e.g., project checklist)
- Summary blocks within a dashboard

**Not allowed:**
- Wrapping entire page sections
- Nesting cards inside cards
- Using as form section wrappers (use `<section>` with `border-b` instead)
- Generic visual wrappers with no semantic purpose

## Responsive Baseline

- Design mobile-first (375px minimum)
- Breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- All interactive elements must have visible keyboard focus states
- Touch targets minimum 44px on mobile

## Animation Philosophy

Animation serves function, not decoration:

- **Entrance animations** confirm that content appeared in response to user action (spring-in)
- **Exit animations** confirm that content was dismissed/completed (slide-out-right)
- **Transition animations** reduce cognitive load during state changes (row-fill)
- **Hover animations** provide haptic-like feedback that elements are interactive

Timing: fast enough to feel instant (100-200ms), slow enough to be perceived (not 0ms).
