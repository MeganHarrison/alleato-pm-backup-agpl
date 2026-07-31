# Page Creation Rules — Read Before Writing Any Page

Root [`DESIGN.md`](../../../../DESIGN.md) is the design source of truth.
[`docs/design/page-archetypes.md`](../../../../docs/design/page-archetypes.md)
defines positive recipes for ordinary pages.

## Step 1: Find the owner

Before writing JSX, locate the canonical route, page component, table
definition, form pattern, split workspace, detail pattern, and data hook that
already perform the job. Reuse that owner and adapt data or scope.

Do not copy JSX or create a page-local visual system. If the canonical owner
cannot support the workflow, document the exact interaction incompatibility
and improve a shared abstraction.

Normal project pages commonly use `ProjectPageHeader` and `PageContainer`.
Routes already owned by `PageShell` keep their existing variant. Do not migrate
a route between shell families as part of unrelated work.

## Step 2: Write the workflow brief

```text
Primary user:
Primary job:
Primary decision:
Tier 1 content:
Hidden until requested:
Remove:
Primary action:
Failure-loudly behavior:
Canonical owner:
```

Choose the matching page archetype before coding. Do not begin from a dashboard
template, a grid of cards, or a screenshot.

## Step 3: Put the work first

The normal page order is:

1. one title and at most one primary page action;
2. one compact search/filter/scope area when needed;
3. the primary table, list, form, document, timeline, or work queue;
4. contextual detail disclosed on selection;
5. loading, empty, partial, permission, and error recovery where work appears.

Do not insert KPI rows, summary strips, welcome panels, helper cards, or
secondary CTAs above the primary work surface.

## Step 4: Reuse shared primitives

Import the canonical implementation from `@/components/layout`,
`@/components/tables/unified`, `@/components/ui/split-page`,
`@/components/forms`, `@/components/ds`, or the owning domain feature.

Never write raw layout replicas such as:

```tsx
<div className="rounded-lg border bg-white p-6 shadow">
```

Use semantic tokens. Never use raw palette colors or local hex values.

## Step 5: Keep containment semantic

The page canvas and sections stay open.

Cards are allowed for:

- distinct previewable library or gallery records;
- distinct mobile records;
- localized bounded modules such as attachments or activity;
- transient surfaces.

Cards are not allowed for page sections, forms, metrics, toolbars, result-grid
wrappers, explanatory text, or other cards.

A resource tile is one clickable record. It uses a real preview when available,
a title, one descriptor, and one metadata line. Do not add decorative icon
pucks, badge stacks, or a repeated “Open” button.

## Step 6: Create engagement from real content

Alleato's product signature is operational context anchored to real project
artifacts: drawing crops, schedule bands, document previews, source excerpts,
cost-code hierarchies, and progress or risk attached to its owning record.

Do not fabricate 3D buildings, floor plans, generic construction imagery, or
decorative charts. When no useful artifact exists, rely on typography,
alignment, row rhythm, whitespace, and responsive interaction.

## Step 7: Finish the workflow

Every interactive element needs default, hover, active, focus, disabled,
loading, error, and permission behavior as applicable. Errors state cause and
recovery. Preserve entered data after failed saves. Verify keyboard, touch, and
responsive behavior.

## Step 8: Capture mandatory screenshot proof

No user-facing frontend change is complete without screenshots captured after
the final source change from the same revision being published.

- Capture at least one desktop screenshot of every affected route in the real
  app shell and the changed state.
- Also capture 375px or 390px mobile proof whenever layout, navigation, density,
  wrapping, breakpoints, or responsive components change.
- Capture additional changed states when relevant: empty, loading, error,
  validation, selected, expanded, menu, sheet, or dialog.
- Use the authenticated repository browser workflow for protected routes.
- Login pages, error pages, blank shells, component demos, stale screenshots,
  DOM snapshots, and videos without still screenshots do not count.
- Record artifact paths in the task or handoff and include or link the images
  in the completion response.

If valid screenshot proof cannot be captured, report `Blocked/Deferred`; never
report the UI complete.

Before closing, answer:

- Where are the final desktop and, when required, mobile screenshots?
- How does this fail loudly?
- What prevents the same design failure from recurring?
