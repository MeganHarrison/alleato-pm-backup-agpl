# Alleato Product Noise Gate

Alleato is operational construction software. Design serves project execution, executive comprehension, financial accuracy, scheduling clarity, and source-backed decision-making.

For Alleato product surfaces, Impeccable must default to quiet, task-serving UI. Do not optimize for visual impressiveness. Optimize for comprehension, confidence, speed, and fewer mistakes.

## Non-Negotiable Principle

User attention is the most expensive resource in the product.

Every visible element spends attention. The burden of proof is on addition. A new element must improve at least one of these:

- Comprehension
- Decision quality
- Task completion speed
- Error prevention
- Source confidence
- Recovery from failure

If it does not, remove it.

## Required Attention Brief

Before implementing or approving any Alleato product UI, write this compact brief in working context:

```text
Primary user:
Primary job:
Primary decision:
Tier 1:
Tier 2:
Tier 3:
Hide until requested:
Remove:
Primary action:
Failure-loudly behavior:
```

Tiers mean:

- Tier 1: Mission critical. The user must notice this immediately.
- Tier 2: Important. Needed to decide or act in the current session.
- Tier 3: Useful. Helps confirm, compare, or inspect.
- Tier 4: Supporting. Useful after the main task is understood.
- Tier 5: Rarely needed. Metadata, history, secondary controls, and advanced settings.

Tier 3 through Tier 5 content must not compete visually with Tier 1 content.

## Pixel Economics

For every visible element, ask:

1. What user problem does this solve?
2. What decision does this support?
3. What action does this enable?
4. What information would be lost if removed?

If the answer is weak, remove or hide the element.

Decorative elements are guilty until proven useful.

## Actionability Gate

Alleato pages are not reports unless the user explicitly asks for read-only output. If the page surfaces a finding, task, risk, commitment, decision, meeting takeaway, missing field, or follow-up, the design must make the next useful action obvious and close at hand.

Before approving a design, answer:

1. What can the user complete, correct, assign, escalate, or inspect from this page?
2. Which surfaced records require follow-up today?
3. Can the user update the most common editable fields without leaving context?
4. Can the user open full details without losing their place?
5. Can the user create the next needed record from the page?
6. Can the user remove, delete, archive, or dismiss stale items when the workflow allows it?
7. Does every actionable row open a detail surface or link to the canonical record?

If a surfaced item has no action path, either add the action path or remove the item from the primary surface. Static insight is not enough when the user can reasonably act on it.

## Task And Action Item Standard

Any task, action item, commitment, follow-up, meeting takeaway, or "needs attention" item shown on an Alleato product page must be manageable from that page unless the user explicitly requests read-only review.

Required behavior:

- Status must be editable in place or in the task detail surface. Users must be able to mark a task complete without navigating away.
- Assignee must be editable in place or in the task detail surface.
- Clicking the task row or card must open a `Sheet` or `Dialog` with full task details, source context, comments or notes when available, and edit controls.
- The detail surface must include the canonical path: `View project tasks` for project-scoped tasks, or `View all tasks` for unscoped tasks.
- The page must include an `Add Task` action when tasks are part of the page's workflow.
- Delete, archive, or dismiss must be available from the detail surface or row action menu when allowed by the data model.
- Empty and error states must offer the next recovery action, not only state that data is missing.

Do not make task rows look interactive unless they are interactive. Do not ship task lists where status and ownership are locked behind another page.

## Meeting-Derived Intelligence

When a page surfaces information from meetings, email, documents, or AI extraction, convert findings into workflow:

- Meeting action items become manageable tasks with status, assignee, due date, source, add, delete or archive, and detail view.
- Risks and blockers expose owner, next action, severity, source link, and escalation path.
- Decisions expose source link, impacted project area, and follow-up action when one exists.
- Missing or low-confidence data exposes the direct fix path when possible.

If the backend or API cannot support the needed action, fail loudly in implementation notes with cause, detection gap, and prevention step. Add the smallest guardrail or follow-up needed. Do not silently ship a read-only UI that looks like it should be actionable.

## Redundant Descriptions And Subtitles

Page descriptions, section subtitles, card subtitles, helper text, and dialog descriptions are content. They spend attention and must earn their place like any other element. A subtitle that restates the title or states the obvious is pure noise — delete it.

Kill any description or subtitle that fails this test:

- It paraphrases the title. Title `Edit Subcontract` + description `Update subcontract details` says nothing new. Remove the description.
- It restates what the control already says. A `Save` dialog titled `Delete invoice?` does not need `Are you sure you want to delete this invoice?` as a body when a one-line consequence would do.
- It describes the obvious mechanics of the page instead of giving the user information they lack. `This page lets you edit the form below` is noise.
- It is a generic template subtitle (`Manage your X`, `View and edit X`, `X details`, `Update X`) with no project-, record-, or state-specific content.

A description earns its place only when it adds information the title cannot: a constraint, a consequence, a scope clarification, a non-obvious source, a count, or a state. `Editing the signed subcontract — changes require re-approval` earns its place. `Update subcontract details` does not.

Default for create/edit/detail headers: title only, no description, unless the description carries real, non-obvious information. When in doubt, remove the subtitle and let the title and form stand alone.

During audit, treat every `description`, `subtitle`, `subheading`, and dialog body string as a removal candidate. For each, name the specific information it adds beyond the title. If you cannot, remove it.

## Default Alleato Page Shape

Normal project pages should use the established app shell and shared layout primitives:

```tsx
<>
  <ProjectPageHeader title="..." description="..." actions={...} />
  <PageContainer className="space-y-8">
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Section title</h2>
      </div>
      {/* table, form, list, timeline, or workflow */}
    </section>
  </PageContainer>
</>
```

Page sections should usually be open on the canvas. Use typography, spacing, alignment, muted text, row dividers, and tables before cards, borders, shadows, backgrounds, badges, icons, or motion.

## Progressive Disclosure Default

Show only what users need now.

Reveal what users may need next.

Hide everything else.

Do not expose advanced filters, metadata, historical detail, helper panels, duplicate summaries, or secondary actions unless they directly improve the current task.

## Visual Silence Rules

Prefer hierarchy tools in this order:

1. Content order
2. Typography
3. Spacing
4. Alignment
5. Muted text
6. Dividers
7. Subtle tonal surfaces
8. Borders
9. Icons
10. Accent color
11. Shadows
12. Motion

Use the lowest sufficient tool. Do not jump to containers or decoration.

## Hard Bans For Alleato Product UI

- No nested cards.
- No decorative wrapper cards around whole page sections.
- No page-level bordered shells around normal content.
- No unsolicited helper panels, finder widgets, banners, insight strips, or secondary summaries.
- No decorative icons.
- No badges when plain text, order, or grouping is clearer.
- No gradient backgrounds for operational software screens.
- No heavy shadows, glows, glassmorphism, or bokeh/orb backgrounds.
- No mixed accent palettes.
- No emojis in production UI.
- No duplicate primary CTAs.
- No stat cards, stats-card rows, KPI-card rows, metric tiles, count summary cards, or top-of-page numeric summary cards. This is a hard Alleato product rule: do not use prime page real estate for aggregate counts unless the user explicitly requests a monitoring dashboard and those cards are the primary workflow.
- No descriptions or subtitles that restate the title, paraphrase it, or state the obvious. Title-only headers are the default.
- No dashboards unless monitoring many simultaneous variables is the actual task.
- No motion unless it clarifies state, continuity, reveal, or feedback.
- No one-off visual overrides when a shared primitive owns the problem.
- No `<Button>` for email, phone, or URL contact actions — use an icon-link (`<a href="mailto:...">`) or a plain text link. A button with a mail icon adds five times the visual weight of an icon-link for the same action.
- No stacked label-above-input layout on detail pages (`PageShell variant="detail"`). Labels and their inputs/values must be horizontally aligned — label fixed-width on the left, value or input stretches on the right.

## Cards

Cards are allowed only when semantically necessary:

- Distinct repeated records in mobile list views.
- Localized modules such as attachments, comments, or activity feed.
- Modal or popover surfaces.

If a section can be expressed as open content with headings, rows, dividers, or a table, do not use a card.

## Tables, Forms, And Line Items

- Lead with columns that support selection and action.
- Hide low-value metadata behind details or secondary views.
- Use row density, typography, alignment, and dividers before cards.
- Search and filters must serve a real retrieval task.
- Forms group fields by user decision, not database shape.
- Show required or common fields first. Put rare fields behind disclosure.
- Errors identify cause and recovery.
- Editable line-item UIs must follow `frontend/src/components/direct-costs/LineItemsManager.tsx` unless the shared pattern itself is being improved.

## Executive And Project Intelligence Surfaces

Run the 15-second executive test:

```text
If Brandon looked at this for 15 seconds, what one thing would he remember?
```

The answer must be specific. If the answer is "the dashboard" or a list of many things, simplify.

For source-backed intelligence, the design should prioritize:

- The claim or decision.
- Why it matters now.
- The linked source evidence.
- The recommended action.

Do not bury evidence under decorative summaries.

## Reduction Pass

After the first implementation:

1. Remove 30 percent of visual elements.
2. Re-evaluate task completion.
3. Remove another 10 percent if usability is unchanged or improved.

Elements include borders, icons, badges, helper text, panels, labels, shadows, fills, dividers, repeated CTAs, charts, and decorative copy.

## Final Gate

Before presenting product UI as complete, return:

```text
Noise gate: pass / needs revision
Top noise sources:
Removed or simplified:
Remaining risk:
Regression guardrail:
```

If the gate fails, fix the UI before reporting completion unless the user explicitly requested audit-only feedback.
