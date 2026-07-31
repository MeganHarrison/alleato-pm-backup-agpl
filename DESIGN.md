---
name: Alleato
description: Quiet, precise construction technology with real project artifacts as the visual anchor.
colors:
  brand-orange: "#DC822E"
  brand-orange-hover: "#C26D24"
  action-slate: "#3B4C63"
  canvas: "#FFFFFF"
  foreground: "#18181B"
  surface-muted: "#F2F2F2"
  text-muted: "#606262"
  border: "#E6E6E6"
  success: "#047750"
  success-subtle: "#EDFDF5"
  warning: "#B86405"
  warning-subtle: "#FFFBEB"
  danger: "#B91D1D"
  danger-subtle: "#FEF1F1"
  info: "#3C83F6"
  dark-canvas: "#161618"
  dark-surface: "#1F1F23"
  dark-muted: "#27272B"
  dark-border: "#2E2E33"
  dark-foreground: "#EBEBEB"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
spacing:
  micro: "0.25rem"
  tight: "0.5rem"
  compact: "0.75rem"
  base: "1rem"
  comfortable: "1.5rem"
  section: "2rem"
  major: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-action:
    backgroundColor: "{colors.action-slate}"
    textColor: "{colors.canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  input-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 1rem"
    height: "2.75rem"
  menu-item:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.375rem 0.5rem"
    height: "2.25rem"
---

<!-- markdownlint-disable MD025 -->

# Design System: Alleato

## Overview

**Creative North Star: "The Operator's Workbench"**

Alleato is quiet, precise, and operator-grade. It supports construction teams working under time pressure, so the interface must make the current state, the next correct action, and the supporting evidence easy to find. Familiar patterns, stable density, and direct language build trust. Decoration does not.

Design serves execution. Every visible element must improve comprehension, decision quality, task speed, error prevention, source confidence, or recovery. Remove content before restyling it. Hide advanced controls and supporting metadata until requested. A visually plain workflow that is clear and complete is better than a polished surface that spends attention without helping the user act.

This file is the visual and interaction contract for product UI. `PRODUCT.md` defines product intent. The Alleato doctrine and noise gate under `.agents/skills/impeccable/reference/` define workflow and attention gates. Live primitives in `frontend/src/components/` own implementation details. When prose and a live shared primitive differ, inspect the primitive and update this file rather than creating a local override.

**Positive composition reference:** after this file, read
[`docs/design/page-archetypes.md`](./docs/design/page-archetypes.md) for the
approved structure of libraries, entity indexes, detail pages, forms,
operational overviews, and split workspaces. The noise gate says what to remove;
the archetypes define what a coherent page should contain.

**Last verified:** 2026-07-28 against `frontend/src/app/globals.css`, shared layout primitives, shared UI primitives, and the Alleato Impeccable reference pack.

**Key characteristics:**

- Quiet hierarchy with one primary focus per screen.
- High information density without visual crowding.
- Open page sections, compact metadata, and breathable task content.
- One restrained orange brand accent, with slate reserved for product actions where the shared primitive specifies it.
- Familiar, reusable patterns instead of feature-local layouts.
- Real project artifacts carry visual interest; decorative construction imagery does not.
- Explicit, actionable errors and quiet success feedback.

### Reuse gate

Before writing UI, locate the canonical route, page component, table definition, tab primitive, form pattern, detail pattern, or data hook that already performs the job. Reuse its owner and adapt data or scope. Do not copy JSX or recreate configuration. If reuse fails, document the exact incompatibility before proposing a shared abstraction.

For a normal project page, begin with the established owner for that route family. The current shared layout vocabulary includes:

- `ProjectPageHeader` and `PageContainer` from `@/components/layout` for normal project pages.
- `PageShell` from `@/components/layout` when the canonical route family already owns that shell. Supported variants are `dashboard`, `table`, `form`, `detail`, `detailWide`, `detailXWide`, and `content`.
- `UnifiedTablePage` from `@/components/tables/unified` for entity tables.
- `SplitPageFrame`, `SplitPage`, and `useSplitPage` from `@/components/ui/split-page` for list and detail work queues.
- `DetailPropertyBar` and `DetailPropertyItem` from `@/components/ui/detail-property-bar` for compact detail metadata.
- `FormSection` from `@/components/forms/FormSection` for grouped form decisions.
- `StatusBadge`, `EmptyState`, and other shared domain-neutral primitives from `@/components/ds`.

Do not migrate a working route between layout owners as part of an unrelated feature. Improve the shared owner when the pattern itself is wrong.

### Product signature without 3D

Alleato does not require a 3D architectural model to feel
construction-specific or premium. Its product signature is **operational
context anchored to real project artifacts**.

Prefer the artifact that best supports the current decision: a drawing crop,
schedule band, document or resource preview, source excerpt, cost-code
hierarchy, or compact progress/risk rail attached to its owning record. The
artifact must help the user identify, compare, locate, verify, or act.

Never fabricate floor plans, isometric buildings, generic construction
photography, or data-free diagrams to create visual interest. When no useful
artifact exists, use disciplined typography, alignment, row rhythm,
whitespace, and interaction. An honest quiet surface is better than invented
decoration.

### Default page shape

```tsx
<>
  <ProjectPageHeader title="Commitments" actions={<Button>New commitment</Button>} />
  <PageContainer className="space-y-8">
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Open commitments</h2>
      </div>
      {/* Canonical table, form, list, timeline, or workflow */}
    </section>
  </PageContainer>
</>
```

Descriptions are omitted by default. A description earns space only when it adds a constraint, consequence, source, scope clarification, count, or non-obvious state that the title cannot carry.

### Attention and workflow brief

Before adding or approving product UI, identify:

```text
Primary user:
Primary job:
Primary decision:
Tier 1:
Tier 2:
Hide until requested:
Remove:
Primary action:
Next action after success:
Correction path:
Keyboard path:
Failure-loudly behavior:
Blessed pattern:
Complexity budget:
```

If the surface has more than one purpose, split it. If a blessed pattern exists, reproduce it. Do not make a workflow look complete when the user cannot perform its real action or correction path.

Choose the matching positive recipe in
[`docs/design/page-archetypes.md`](./docs/design/page-archetypes.md) before
writing JSX. Do not begin from a generic dashboard template or a blank grid of
cards.

### Responsive structure

- Use mobile-first layouts. Default styles target small screens, then enhance at `sm`, `md`, and `lg`.
- `PageContainer` owns gutters: `px-4` mobile, `px-6` tablet, `px-8` desktop.
- Interactive targets are at least 44 by 44 pixels on mobile. Shared controls may be denser on desktop.
- Tables must provide a deliberate small-screen experience. Use the canonical table owner's responsive mode or a semantically appropriate record list. Do not allow accidental horizontal page overflow.
- Use `Sheet` for mobile workflows that cannot fit a centered dialog.
- No hover-only action. Every hover affordance must also work by keyboard and touch.
- Reading content is limited to roughly 65 to 75 characters per line.
- Verify responsive layout at 375, 414, 768, 1024, and 1440 pixels when the task changes layout behavior.

## Colors

Alleato uses a restrained neutral palette with one warm orange brand accent. Color communicates action, selection, status, and recovery. It is never filler.

The frontmatter contains hex approximations for design tooling. Runtime code must use semantic CSS tokens from `frontend/src/app/globals.css`, such as `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, and status primitives. Do not paste frontmatter hex values into product components.

### Primary

- **Alleato Orange** (`#DC822E`, runtime `--primary`): primary brand action, current selection, and rare emphasis.
- **Alleato Orange Hover** (`#C26D24`): stronger interaction state for the brand action.
- **Action Slate** (`#3B4C63`, runtime `--action`): established product action hierarchy where the shared `Button` action variant is used.

### Neutral

- **Canvas White** (`#FFFFFF`, runtime `--background`): light-mode page and control canvas.
- **Carbon Ink** (`#18181B`, runtime `--foreground`): primary light-mode text.
- **Quiet Surface** (`#F2F2F2`, runtime `--muted`): hover, selected, and recessed support surfaces.
- **Muted Graphite** (`#606262`, runtime `--muted-foreground`): secondary text and metadata.
- **Hairline Gray** (`#E6E6E6`, runtime `--border`): controls, row dividers, and necessary structural boundaries.
- **Dark Canvas** (`#161618`) and **Dark Surface** (`#1F1F23`): dark-mode base and elevated surface.
- **Dark Muted** (`#27272B`) and **Dark Border** (`#2E2E33`): dark-mode interaction and boundary layers.

### Status

- **Success Green** (`#047750`) with **Success Mist** (`#EDFDF5`): approved, complete, or healthy.
- **Warning Amber** (`#B86405`) with **Warning Mist** (`#FFFBEB`): pending, draft, or attention needed.
- **Danger Red** (`#B91D1D`) with **Danger Mist** (`#FEF1F1`): rejected, overdue, blocked, or failed.
- **Information Blue** (`#3C83F6`): informational state when a neutral treatment is insufficient.

Use shared status primitives. Do not manually map business statuses to raw color classes in feature code.

### Named rules

**The One Accent Rule.** Orange is rare and functional. It does not decorate headings, cards, icons, or empty states.

**The Semantic Token Rule.** Use semantic tokens, not raw Tailwind palette classes or hard-coded colors. Third-party brand colors are allowed only in their integration-specific owner.

**The Status Restraint Rule.** Prefer plain text or a status dot when a pill would add unnecessary weight. Color is never the only status cue.

**The Contrast Rule.** Meet WCAG AA: 4.5:1 for normal text and 3:1 for large or bold text. Preserve visible focus indicators.

## Typography

**Display Font:** Inter with the system sans-serif stack

**Body Font:** Inter with the system sans-serif stack

**Label/Mono Font:** JetBrains Mono with platform monospace fallbacks for identifiers and tabular data only

**Character:** Neutral, compact, and highly legible. One sans-serif family keeps the interface stable across dense tables, forms, and review workflows. Hierarchy comes from restrained changes in size, weight, spacing, and color.

### Hierarchy

- **Page headline** (`font-medium`, about `2rem`, `1.25` line height): page titles through the shared header owner.
- **Section title** (`text-lg font-semibold`, tight line height): primary content groups.
- **Component title** (`text-base font-semibold`): localized modules that truly need a title.
- **Body** (`text-sm`, `1.5` line height): default product copy, field values, and table content.
- **Label** (`text-sm font-medium`): field labels, column headers, and compact actions.
- **Metadata** (`text-xs text-muted-foreground`): timestamps, source details, and subordinate facts.
- **Interface eyebrow** (`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`): short fixed categories only. Never uppercase user content, extracted text, or long labels.
- **Monospace data** (`font-mono text-sm tabular-nums`): IDs, codes, aligned financial values, and technical output where fixed width improves scanning.

### Named rules

**The Three-Level Rule.** A surface needs a clear primary, secondary, and supporting level, but not every section must mechanically use every type tier. Remove copy before adding more styles.

**The Sentence Case Rule.** Use sentence case for headings, table headers, actions, statuses, and record content. Uppercase is reserved for short fixed interface categories.

**The Copy Economy Rule.** Do not restate a title in a subtitle, helper panel, dialog body, or empty state. Every sentence must add a constraint, consequence, source, recovery action, or information the user does not already have.

**The Readability Rule.** Body text is at least 14 pixels on mobile. Multi-line text keeps a readable line height. Use `font-semibold` as the maximum page-content weight unless a shared primitive specifies otherwise.

## Elevation

Alleato is flat by default. Hierarchy begins with content order, typography, spacing, alignment, muted text, and row dividers. Tonal surfaces come next. Borders, accent color, shadows, and motion are progressively more expensive and require a functional reason.

### Tonal layers

```text
background: page canvas
card: localized elevated content when semantically necessary
muted: hover, selection, or recessed support content
popover: transient floating surface
```

Page sections remain open on the canvas. A background fill, radius, or border does not turn an arbitrary group into a component.

### Shadow vocabulary

- **Subtle** (`0 1px 2px rgb(0 0 0 / 0.03)`): rare micro-elevation.
- **Small** (`0 1px 3px rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)`): dropdowns, popovers, and transient floating surfaces.
- **None:** page sections, tables, forms, static cards, and almost all content at rest.

Do not use medium, large, extra-large, glow, glass, or decorative shadows in product UI even if legacy tokens exist.

### Borders and radius

- Use one-pixel borders for controls, table dividers, and real structural boundaries.
- Do not use borders as page hierarchy or decoration.
- `rounded-md` is the control default. Shared buttons currently use `rounded-lg`. Larger radii are reserved for true localized or transient surfaces.
- Never use a colored side stripe as an accent.
- Never nest cards. Maximum visual container depth is the app shell plus one localized component.

### Motion

- Motion communicates state, continuity, reveal, or feedback. It never decorates.
- Prefer 100 to 250 millisecond transitions with an exponential ease-out curve.
- Animate opacity and transforms. Do not animate layout properties.
- No bounce, elastic overshoot, orchestrated page-load sequences, or ambient motion.
- Respect `prefers-reduced-motion`.
- Common mutations should respond optimistically only when failure can restore state and explain recovery.

**The Flat-by-Default Rule.** If spacing, alignment, or a divider solves the hierarchy problem, do not add a container, border, fill, or shadow.

## Components

Shared primitives own shape, states, accessibility, and density. Consume their variants rather than recreating their classes.

### Page layout

- **Normal project page:** use the canonical route owner, commonly `ProjectPageHeader` plus `PageContainer`.
- **Existing shell family:** use `PageShell` with its owned variant. Do not invent a page-local shell.
- **Page action:** one primary action in the header. Search, filters, export, import, column settings, and bulk actions belong to the relevant toolbar.
- **Descriptions:** title-only is the default. Add a description only for non-obvious context.
- **Sections:** open content with `space-y-8` between major sections and `space-y-4` within a section.

### Buttons

- Use `Button` from `@/components/ui/button`.
- Shared variants are `default`, `action`, `destructive`, `outline`, `secondary`, `ghost`, and `link`.
- Default desktop height is 36 pixels. Shared sizes own icon scale and padding.
- Use a button for an application command. Use an anchor for email, phone, and URL destinations.
- Use direct labels such as `Save changes`, `Create commitment`, and `Archive`. Do not prefix text actions with a plus character.
- One surface has one primary action. Destructive actions appear last and require a clear consequence or recovery path.

### Inputs and forms

- Use shared form controls and the canonical form owner for the workflow.
- Group fields by user decision, not database shape.
- Put required and common decisions first. Hide rare fields behind disclosure.
- Detail pages align labels and values horizontally through the shared detail pattern. Do not stack label-above-input fields in detail headers.
- Errors identify the cause and the recovery action. Preserve entered data when saving fails.
- Repetitive entry supports the expected keyboard path: Enter, Shift+Enter, Tab, Shift+Tab, arrows where grid-like, and Escape for transient state.
- Editable line items must reuse the canonical owner for their workflow. If no shared owner exists, improve or introduce a shared abstraction rather than copying page-local line-item JSX.

### Tables and lists

- Use `UnifiedTablePage` for canonical entity tables. Reuse the table definition and adapter that already own the entity.
- Lead with columns that support identification, selection, and action. Hide low-value metadata.
- Use row density, alignment, typography, and dividers before cards.
- Search and filters must solve a real retrieval problem.
- Row actions use the compact shared dropdown pattern.
- Loading uses structural skeletons. Empty states explain the next useful action. Errors identify cause and recovery.

### List and detail workspaces

- Emails, tasks, comments, feedback inboxes, training queues, and other review workflows use `SplitPageFrame`, `SplitPage`, and `useSplitPage`.
- The list pane owns title, toolbar or tabs, search or filters, and scrollable rows.
- The detail pane owns the selected record, source context, and actions.
- Use `variant="three-column"` only for a true auxiliary source or feedback rail.
- Mobile behavior follows the shared split-page hook. Do not build a feature-local two-pane shell.

### Detail metadata

- Use `DetailPropertyBar` and `DetailPropertyItem`.
- Properties use icon plus value or action, not uppercase label grids.
- Empty properties are muted actions such as `Assign project` or `Set due date`.
- Inline controls stay compact and subordinate to the title.
- Long values truncate with an accessible recovery such as a title, tooltip, or full accessible label.

### Status and feedback

- Use shared `StatusBadge`, status dot, or plain status text based on required emphasis.
- Successful automated checks are one quiet inline fact.
- Alerts are reserved for failures or warnings that require recovery.
- Reversible actions should offer undo where the shared workflow supports reliable restoration.
- Never ship a silent fallback or generic error.

### Surface budgets

- **Dropdown:** 2 to 5 compact action rows, at most one heading, one divider, and two sections. No search, feed, cards, metrics, forms, or internal scroll.
- **Popover:** one compact inspection or control job, at most two sections and eight preview rows.
- **Sheet:** one focused list, detail, or form without losing page context.
- **Dialog:** one confirmation or one object edit, with one primary action and one cancel action.
- **Full page:** broad review, filtering, history, bulk actions, reporting, or multi-record management.
- **Tooltip:** one sentence and no actions.

If content exceeds a surface budget, promote it to the correct larger surface.

### Cards and metrics

Cards are permitted for distinct previewable records in a library or gallery,
distinct repeated records on mobile, localized bounded modules such as
attachments or activity, and transient surfaces. The entire record should be
the affordance; do not add a redundant action button to every tile. Cards are
not the default section wrapper, and a results grid never receives its own
wrapper card.

Stat cards, KPI rows, metric tiles, count summaries, and dashboards are prohibited by default. They are allowed only when the user explicitly needs to monitor many simultaneous variables and those metrics are the primary workflow. Existing metric components under `@/components/ds` do not grant permission to use them.

## Do's and Don'ts

### Do:

- **Do** start from the primary user job, decision, next action, correction path, and failure behavior.
- **Do** inspect and reuse the canonical route, shared primitive, blessed pattern, table definition, and data hook before editing.
- **Do** use semantic color and spacing tokens from the live theme.
- **Do** prefer open sections, typography, whitespace, alignment, muted text, and dividers.
- **Do** keep the main action obvious within five seconds.
- **Do** keep source evidence near important claims, extracted insights, and recommendations.
- **Do** make tasks, risks, findings, and review records actionable from their owning surface.
- **Do** preserve momentum after save, add, approve, reject, or correct.
- **Do** make failures specific, actionable, and recoverable.
- **Do** verify keyboard, responsive, empty, loading, error, disabled, and permission states.
- **Do** run the Alleato surface audit and capture mandatory final-route screenshots for every user-facing UI change.
- **Do** update this file when a shared visual contract or canonical pattern changes.

### Don't:

- **Don't** reproduce Procore-style clutter, overloaded chrome, gray-on-gray enterprise noise, or fragmented workflows.
- **Don't** use generic admin-template dashboards, stat-card rows, filler summaries, or interchangeable SaaS UI patterns.
- **Don't** use playful consumer styling, decorative illustrations, bright gamified feedback, or charm that competes with operator trust.
- **Don't** create one-off feature styling or copy an existing component's JSX or configuration.
- **Don't** use nested cards, page-level wrapper cards, bordered page shells, or decorative containers.
- **Don't** add helper panels, finder widgets, banners, insight strips, secondary summaries, decorative icons, badges, charts, or motion without a proven workflow need.
- **Don't** duplicate primary actions in the header and body.
- **Don't** restate a title in a description, subtitle, helper text, or dialog body.
- **Don't** use hard-coded product colors, raw Tailwind palette colors, mixed accent palettes, gradients, glassmorphism, glows, or heavy shadows.
- **Don't** use color alone to communicate status.
- **Don't** invent a dashboard unless monitoring simultaneous variables is the actual job.
- **Don't** put feeds, search, filters, tabs, forms, metrics, or recent records inside command dropdowns.
- **Don't** use a modal as the first solution. Prefer inline editing, progressive disclosure, a sheet, or the canonical full page when those better preserve context.
- **Don't** make read-only task, feedback, or review surfaces that look actionable but cannot update status, ownership, correction, or response.
- **Don't** use a custom two-pane layout where the shared split-page pattern fits.
- **Don't** use uppercase label grids where the shared detail property pattern fits.
- **Don't** ship silent failures, generic errors, stranded success states, or empty states with no recovery action.

### Final approval gate

#### Mandatory screenshot proof

Product UI is not complete without current screenshot evidence.

- Provide at least one desktop screenshot of every affected route after the
  final source change.
- Provide mobile proof at 375px or 390px whenever layout, navigation, density,
  wrapping, breakpoint behavior, or responsive components change.
- Capture the changed state, not merely the route, when the work concerns an
  empty, loading, error, selected, expanded, modal, menu, or validation state.
- Screenshots must show the real app shell and realistic data from the same
  revision being completed.
- Login screens, blank shells, error pages, component sandboxes, stale
  screenshots, DOM snapshots, and videos without still screenshots do not
  satisfy the gate.
- Store artifact paths with the task evidence and include or link the final
  screenshots in the completion response.

Missing valid screenshot proof means the UI remains `Blocked/Deferred`.

Before calling product UI complete, report:

```text
Screenshot proof: pass / missing
Desktop artifact:
Mobile artifact or N/A reason:
Noise gate: pass / needs revision
Top noise sources:
Removed or simplified:
Remaining risk:
Regression guardrail:
Failure-loudly behavior:
```

Ask two final questions: How does this fail loudly? What makes a recurring failure never happen again?
