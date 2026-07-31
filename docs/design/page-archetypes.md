# Alleato Page Composition

> Positive recipes for composing ordinary product pages. Read this after
> [root `DESIGN.md`](../../DESIGN.md) and before creating or redesigning a page.
> These recipes define hierarchy and behavior; they do not authorize copying
> JSX or bypassing the canonical shared page owner.

## Why this document exists

The noise gate prevents bad additions, but subtraction alone does not produce a
coherent page. Agents must begin with a proven information architecture and a
small set of shared primitives. The result should look designed because the
content, hierarchy, rhythm, and interaction are deliberate—not because the page
contains more visual treatments.

## Required pre-design brief

Write these seven lines before editing UI:

```text
Primary user:
Primary job:
Primary decision:
Tier 1 content:
Hidden until requested:
Primary action:
Failure-loudly behavior:
```

Then identify:

```text
Canonical route/page owner:
Canonical data hook or table definition:
Shared primitives being reused:
Exact incompatibility, if reuse is not possible:
```

Do not design until these answers are specific. “View the dashboard” and “manage
resources” are not jobs. “Find the current fall-protection procedure and open
the approved version” is a job.

## The product signature without 3D

Alleato does not depend on a 3D architectural model to feel spatial,
construction-specific, or premium. Its signature is **operational context
anchored to real project artifacts**.

Use the most relevant real artifact as the visual and structural anchor:

- a drawing or plan crop;
- a schedule band or milestone sequence;
- a document, specification, or training-resource preview;
- a cost-code or scope hierarchy;
- a source excerpt from a meeting, email, RFI, or submittal;
- a compact progress or risk rail attached to the record it describes.

This is “content as interface.” The artifact must help identify, compare,
locate, verify, or act on information. Never add fake floor plans, decorative
isometric buildings, generic construction photography, or data-free diagrams
to imitate a BIM product.

When no useful artifact exists, use excellent typography, alignment, row
rhythm, and whitespace. An honest quiet surface is better than invented visual
interest.

## Shared composition grammar

Every standard page follows this order:

1. **Location and purpose** — normal app navigation plus one clear page title.
2. **Primary action** — at most one page-level action, in the header.
3. **Scope controls** — search, filters, tabs, view choice, or date scope in one
   compact toolbar only when the workflow needs them.
4. **Primary work surface** — the table, list, form, document, timeline, or
   record detail receives most of the viewport.
5. **Context on demand** — previews and secondary details open beside, beneath,
   or over the work surface without repeating its content.
6. **Recovery** — loading, empty, partial, error, and permission states appear
   where the work would have appeared and explain the next valid action.

Do not insert a summary strip, welcome panel, helper card, KPI row, or secondary
CTA between the page title and the primary work surface.

## Archetype: resource or knowledge library

### Use when

People need to browse, search, filter, compare, and open a collection of
documents, videos, guides, templates, or reference material.

### Composition

```text
Canonical page shell
├── title + optional one-sentence scope
├── one primary action, only if the user can add resources
├── compact search/filter toolbar
├── optional category navigation, when categories materially reduce search
└── results
    ├── result count or sort control, only when useful
    ├── open grid for visual resources OR structured list for text-heavy records
    └── inline pagination/load-more behavior
```

### Result presentation

A resource is a distinct clickable record, so localized tiles are allowed.
The page itself and result groups remain open on the canvas.

Each result shows only:

- a real preview image or a quiet type treatment when a preview does not exist;
- title;
- one concise descriptor;
- one metadata line such as type, duration, discipline, or updated date;
- status only when it changes whether the resource should be trusted or used.

The entire result is the affordance. Do not add a redundant “View,” “Open,” or
arrow button to every result. Do not add icon pucks, badge stacks, author
avatars, engagement counts, decorative gradients, or a card around the result
grid.

Use a list instead of a grid when comparison, version, owner, approval status,
or date is more important than recognition by preview. A view toggle is earned
only when both modes solve proven jobs.

### Filtering

- Use one search input.
- Keep common filters visible only when they are used frequently.
- Put infrequent filters in one filter popover or sheet.
- Show active filters as removable values; do not duplicate them in a summary
  sentence.
- A zero-result state preserves the current query and offers “Clear filters.”
- An unseeded library has a different empty state from a filtered no-match.

### Responsive behavior

- Desktop: three or four restrained result columns only when previews matter.
- Tablet: two columns.
- Mobile: one column or a compact media row; filters move to a sheet.
- Preserve readable titles and metadata. Do not shrink desktop cards.

## Archetype: entity index

Use `UnifiedTablePage` and its canonical column definition. The table is the
page, not an object inside a decorative section.

```text
PageShell variant="table"
├── compact table toolbar
└── UnifiedTablePage
```

No metrics above the table. Counts belong in the title, tab label, filter, or
toolbar when they change a decision. Row preview belongs in a shared slideover
or detail route.

## Archetype: record detail

```text
PageShell variant="detail"
├── identity, status, and one primary action
├── tabs only for distinct work modes
└── open sections
    ├── plain section heading
    ├── fields, rows, inline table, activity, or attachments
    └── contextual action
```

Do not wrap every section in a card. Use a localized bounded component only
when its interaction requires containment, such as attachments, an inline
table, or an editable line-item module.

## Archetype: create or edit form

```text
PageShell variant="form"
└── FormSection sequence
    ├── section title
    ├── optional short instruction when the input cannot explain itself
    └── responsive field grid
```

The form is not placed inside a page-level card. Use the canonical form
primitives, validation, sticky action treatment, and the relevant form-system
reference.

## Archetype: overview or monitoring surface

Overview does not automatically mean dashboard.

Start with the next operational decision and use an open list, table, timeline,
or work queue. A metric is allowed only when:

1. monitoring the value is the primary job;
2. the value changes a near-term decision;
3. its source and time range are clear;
4. selecting it opens the underlying records; and
5. it is not repeated elsewhere on the page.

If those tests pass, use the smallest appropriate presentation: inline value,
progress rail, trend line, or table summary. Metric-card grids remain an
explicit exception for true monitoring dashboards requested by the user.

## Archetype: responsive split workspace

Use when selecting a row or item requires sustained contextual work.

```text
Desktop:  navigation/list pane | detail/work pane
Mobile:   list route → detail route or bottom sheet
```

Keep selection state visible. The detail pane must not restate the entire row.
Actions live with the detail they affect. Do not render two independent page
headers inside the split.

## Engagement without decoration

Make a page engaging through:

- decisive hierarchy;
- useful real previews;
- selected and hover states that reveal interactivity;
- responsive transitions between list and detail;
- compact progress or risk encoding attached to the relevant record;
- strong empty and error recovery;
- fast perceived response and optimistic feedback;
- deliberate density and consistent alignment.

Do not use animation, gradients, illustrations, large icons, or cards to make
an unresolved information architecture feel finished.

## Pre-ship composition check

- Are final same-revision screenshots attached for every affected route?
- Is there 375px or 390px mobile proof when responsive behavior changed?
- Can the primary user identify the page’s purpose and first action in three
  seconds?
- Does the primary work surface begin without promotional or summary clutter?
- Is every visible element tied to a decision, action, confidence signal, or
  recovery path?
- Is real project content carrying the visual interest?
- Are cards limited to distinct records or truly bounded interactive modules?
- Are empty, error, partial, and permission states explicit?
- Does mobile recompose the workflow rather than merely stack desktop blocks?
- How does this fail loudly?
