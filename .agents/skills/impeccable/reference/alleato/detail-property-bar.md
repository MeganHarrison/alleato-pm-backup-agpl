# Detail Property Bar Pattern

Use this reference for metadata/property rows on detail pages and selected-item detail panes, including meetings, tasks, emails, project emails, feedback items, documents, and AI review records.

## Prime Rule

Detail metadata is a shared pattern. If two surfaces show object properties in a detail header, they must use the same property bar and property item primitive.

The implementation should provide shared components such as:

```tsx
<DetailPropertyBar>
  <DetailPropertyItem icon={Calendar}>Wednesday, July 1, 2026 · 3:30 PM</DetailPropertyItem>
  <DetailPropertyItem icon={FolderOpen}>Alleato Internal Ops</DetailPropertyItem>
  <DetailPropertyItem icon={Tag} muted>Add category</DetailPropertyItem>
  <DetailPropertyItem icon={ExternalLink} href={sourceUrl}>View in Fireflies</DetailPropertyItem>
</DetailPropertyBar>
```

Names may differ to match the codebase, but the component boundary must exist:

- one shared container for the property row;
- one shared atom for a property item;
- support for static text, links, buttons, selects, menus, and empty-state actions;
- shared spacing, typography, icon sizing, truncation, hover, disabled, and focus treatment.

Do not recreate this row inside each page.

## Visual Contract

Default item shape:

```text
icon  value/action
```

Rules:

- Use the same density as the meetings detail property row unless a documented surface constraint requires otherwise.
- Use icons as the visual anchors for common properties: date, project, category, assignee, source, status, priority, created date, training feedback.
- Keep labels out of the primary visual treatment. The user should read the value, not scan a field-name grid.
- Empty values are muted actions: `Add category`, `Assign project`, `Set due date`, `Unassigned`.
- Links are icon plus direct label: `View in Fireflies`, `Open source`, `View email`.
- Editable properties use compact inline controls inside the item, not a separate labeled form grid.
- Wrap responsively with consistent gaps. Do not create uneven rows with page-local widths.
- Preserve truncation for long projects, sources, people, and titles.
- Keyboard focus must be visible for clickable/editable items.

## Component Contract

The shared property item should support:

- `icon`
- `children` or `value`
- `href` for links
- `onClick` for actions
- `muted` for empty/secondary values
- `disabled`
- `aria-label` when the visible text is abbreviated
- `title` or tooltip only when truncation needs recovery
- `className` only for legitimate layout exceptions

Avoid props that encode page-specific entities such as `taskStatus`, `meetingCategory`, or `emailSender`. Domain-specific behavior belongs in children; the visual shell belongs in the property item.

## Required Reuse

Use this pattern for:

- meeting detail header metadata;
- task detail header metadata;
- email detail header metadata;
- project email detail metadata;
- feedback inbox selected-item metadata;
- document metadata sheets when compact header properties are needed.

When a page already has a good local implementation, extract it into the shared primitive first, then migrate sibling pages to it. Do not make a second local copy.

## Automatic Failure

Fail an implementation or audit when:

- A second page recreates a detail property row locally.
- A page asked to match the meetings property row uses uppercase text labels such as `STATUS`, `PRIORITY`, `ASSIGNEE`, `PROJECT`, or `CATEGORY` as the main visual structure.
- A property row omits icons when the reference row uses icons.
- Editable properties are turned into a bulky form grid instead of compact inline controls.
- The detail header metadata layout differs across meetings, tasks, emails, and feedback items without a documented reason.
- A local property item component exists inside a feature file when the same pattern is needed elsewhere.

## Audit Output

When auditing detail-property consistency, report:

```text
Route/file:
Expected pattern: Detail Property Bar
Reference surface:
Uses shared property bar:
Uses shared property item:
Icon plus value treatment:
Editable property treatment:
Empty value treatment:
Inconsistencies:
Required fix:
```
