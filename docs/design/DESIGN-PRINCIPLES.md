# Alleato Design Principles

> Root [`DESIGN.md`](../../DESIGN.md) is authoritative. This document explains
> the reasoning behind that contract. Use
> [`page-archetypes.md`](page-archetypes.md) for positive page recipes.

## The aim

Alleato should feel like a precise construction operating system: calm,
credible, fast, and built for consequential work. It borrows the discipline of
Linear, the data clarity of Stripe, and the keyboard efficiency of Superhuman
without copying their page structures.

“Modern” does not mean more cards, larger radii, gradients, or animation.
Modern means the information architecture is obvious, the content is useful,
the system responds quickly, and recovery is clear.

## Five principles

### 1. Design the decision

Begin with the person, job, decision, evidence, and next action. A page is not a
collection of available data. It is an interface for completing a job.

The first viewport should make three things clear:

1. Where am I?
2. What needs my attention?
3. What can I do next?

### 2. Content carries the visual interest

Use real drawings, schedules, document previews, source excerpts, record
hierarchies, and progress attached to the record it explains. These artifacts
make Alleato construction-specific without requiring a 3D model.

Do not fabricate architectural imagery. When no useful artifact exists, let
typography, alignment, density, and interaction carry the design.

### 3. Subtract before styling

Every visible element spends attention. Remove duplicates, helper copy,
decorative icons, repeated actions, summary strips, and wrapper panels before
adjusting colors or spacing.

The removal test:

- If the element disappears, is a decision harder?
- Is an action slower?
- Is an error more likely?
- Is source confidence reduced?
- Is recovery less clear?

If every answer is no, remove it.

### 4. Use proven owners

Design consistency comes from shared ownership, not similar-looking local JSX.
Find and reuse the canonical page shell, table definition, split workspace,
form pattern, detail pattern, and data hook. Adapt data or scope at that owner.

Do not copy a component or rebuild its configuration. A new abstraction is
earned only by a real interaction incompatibility.

### 5. Fail visibly and recoverably

Loading, empty, partial, permission, stale, offline, and error states are part
of the design. Errors state the cause, affected work, and recovery action.
Entered data survives a failed save. Silent fallback and generic errors are
design failures.

## Positive composition

The normal page order is:

1. location and one clear title;
2. at most one primary page action;
3. one compact scope-control area when needed;
4. the primary table, list, form, document, timeline, or work queue;
5. context disclosed beside or beneath the selected work;
6. recovery in the location where the work would appear.

Do not place a welcome panel, KPI row, helper card, summary strip, or secondary
CTA between the title and the primary work.

## Hierarchy

Use hierarchy in this order:

1. content priority;
2. layout and alignment;
3. typography;
4. whitespace;
5. row rhythm and indentation;
6. subtle tonal elevation;
7. a divider or bounded surface only when a real boundary remains unclear.

Borders are not hierarchy. Cards are not sections. Color is not decoration.

## Visual language

- Warm white and quiet neutral surfaces.
- Near-black primary text and restrained muted text.
- Alleato orange for brand emphasis and the primary brand action.
- Slate only where the shared action primitive owns it.
- Semantic success, warning, danger, and information colors only for state.
- Inter for a neutral, legible product voice.
- Tabular numerals for values that must align or compare.
- Moderate radii controlled by shared primitives.
- No gradients, glassmorphism, glows, or heavy shadows.

## Cards and containment

Cards are allowed for:

- a distinct previewable resource in a library or gallery;
- a distinct mobile record;
- an attachment or activity module with its own interaction;
- a transient popover, sheet, dialog, or similar bounded surface.

Cards are not allowed for:

- page sections;
- the full page body;
- a search or filter toolbar;
- a single metric;
- explanatory text;
- a grid or list wrapper;
- another card.

A resource tile is one clickable record. It contains a real preview when one
exists, a title, one concise descriptor, and one metadata line. It does not
need a decorative icon puck, badge stack, or repeated “Open” button.

## Metrics

Metrics are evidence, not page structure. A metric earns prominence only when
monitoring it is the primary job, it changes a near-term decision, its source
and time range are clear, and it opens the underlying records.

Prefer the smallest useful expression: an inline value, progress rail, trend,
or table summary. Stat-card rows, KPI grids, and dashboards are prohibited
unless the user explicitly requests a monitoring workflow in which simultaneous
metrics are the primary work.

## Motion

Motion confirms state change and preserves orientation. Use fast deceleration
and opacity or transform transitions. Do not use bounce, elastic springs,
decorative entrance sequences, or motion that delays input. Respect reduced
motion.

## Responsive behavior

Responsive design recomposes the workflow:

- toolbars collapse into purposeful controls or sheets;
- split views become a list-to-detail route or bottom sheet;
- tables use their canonical responsive owner or a semantically appropriate
  record list;
- preview grids reduce columns without shrinking typography;
- actions remain reachable by keyboard, touch, and assistive technology.

Do not merely stack every desktop block into a long mobile page.

## Approval questions

Before approving a screen, ask:

- Can the primary job be named as a verb?
- Is the work surface visible without promotional clutter?
- Does every element improve a decision, action, confidence signal, or recovery?
- Is the page using a canonical owner?
- Is real content carrying the visual interest?
- Does the empty state differ from a filtered no-result state?
- Does mobile preserve the job?
- How does this fail loudly?
