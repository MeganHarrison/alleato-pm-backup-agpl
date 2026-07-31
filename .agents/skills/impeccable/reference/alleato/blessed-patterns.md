# Blessed Patterns

Use these patterns as defaults. Do not invent a new layout until the existing pattern fails the user's job.

## Pattern A: Header Action Dropdown

Use for small menus opened from header icons.

Shape:

```text
Optional title
Optional divider
Icon + action row
Icon + action row
Optional checkmarked state row or dynamic-label row
Optional divider
Optional navigation row
```

Rules:

- Use existing dropdown/popover primitives.
- Match the density of existing site menus such as user, admin, table action, and row action menus.
- Use compact rows: `text-sm`, approximately 32px to 36px row height, `px-2`, `py-1.5` or `py-2`.
- Use one icon per row when actions differ by type, such as add, open, hide/show, archive, delete, external link, or settings.
- Use a checkmark or dynamic label for boolean state. Do not use a large switch in a command menu.
- Keep the menu content-sized.
- Close the menu after command execution.
- Use separators to group action priority, not extra spacing.

Do not include:

- Recent activity.
- Filters.
- Segmented controls.
- Feed previews.
- Long descriptions.
- Multiple subsections.
- Large switches.
- `text-lg`, `text-xl`, `py-4`, `py-5`, `gap-4`, or 48px-plus rows.
- Oversized `w-96` style widths for three short commands.

## Pattern B: Comment Header Control

Use for a comments icon in the top header.

The dropdown/popover may contain only:

- Title: `Comments`.
- Action: add comment on this page.
- Action: open page discussion/sidebar.
- State action: `Hide page comments` or `Show page comments`, using a checkmark, icon, or dynamic label instead of a switch.

Recommended shape:

```text
Comments
----------------
+ Add comment
Open discussion
----------------
Hide comments
```

If comments are visible, `Hide comments` is the command. If comments are hidden, use `Show comments`. Do not show a switch unless the user explicitly asks for settings-style controls.

The sidebar owns:

- Stacked page comments.
- Comment previews.
- Empty state.
- Link to full comments page with tooltip: listing of all comments throughout the site.

The full comments page owns:

- All site comments.
- Global filters.
- Search.
- Cross-page review.
- Long history.

Hard failures:

- Recent comments inside the header dropdown.
- Filters such as All, Mine, Mentions, Unresolved inside the header dropdown.
- A global comments list inside the header dropdown.
- A footer link plus a feed plus page actions in the same dropdown.
- A large switch inside the comments dropdown.
- Oversized rows that visually read as a settings page.
- Three equally weighted rows when the actions have different priority.

## Pattern C: Compact Action Menu

Use for row actions or toolbar overflow.

Shape:

```text
Action
Action
Optional separator
Destructive action
```

Rules:

- Use `DropdownMenuContent`.
- Prefer `DropdownMenuItem`.
- Keep labels direct: `Edit`, `Duplicate`, `Archive`.
- Put destructive action last.
- Keep rows compact; do not use large custom buttons for normal menu items.

## Pattern D: Filter Popover

Use only when the user is configuring a table filter.

Shape:

```text
Search or field selector
Option list
```

Rules:

- Use command/list patterns already present in table filters.
- Keep the filter connected to the table toolbar.
- Do not mix filter configuration with record previews.

## Pattern E: Discussion Sidebar

Use when the user needs to read or manage comments without losing page context.

Shape:

```text
Header: Discussion
Count or brief state
Comment list
Empty state when needed
Footer: View all site comments
```

Rules:

- One list.
- Plain stacked rows.
- Muted metadata.
- No metric cards.
- No duplicate header dropdown actions except the link to full comments page.

## Pattern F: Split-Page Work Queue

Use for emails, tasks, project tasks, project emails, comments, feedback inbox, AI training queues, and any list/detail review workflow.

Shape:

```text
SplitPageFrame
  SplitPage
    Left pane: title + toolbar/tabs + scrollable list
    Detail pane: selected item detail or empty state
    Optional auxiliary pane: source context or feedback/training panel
```

Rules:

- Use `SplitPageFrame` and `SplitPage` from `@/components/ui/split-page`.
- Keep list on the left and detail on the right for desktop.
- Use the same mobile list/detail behavior through `useSplitPage`.
- Use `variant="three-column"` for a true auxiliary rail.
- Keep only content-specific differences across emails, tasks, comments, and feedback inbox.
- Do not invent a new two-pane shell for each feature.

Hard failures:

- Custom flex two-pane layouts where `SplitPage` should be used.
- A review queue without a selected-item detail pane.
- A feedback inbox that behaves like a unique dashboard instead of a split review queue.
- Different toolbar/list/detail/empty-state structure across pages without documented reason.

## Pattern G: Detail Property Bar

Use for metadata/property rows on detail pages and selected-item detail panes.

Shape:

```text
Icon + property value/action
Icon + property value/action
Icon + muted empty action
Icon + source link
```

Rules:

- Use a shared property bar component and a shared property item component.
- Start from the meetings detail property row pattern when a compact detail header needs metadata.
- Use icon plus value/action, not uppercase field labels as the primary visual structure.
- Use compact inline controls for editable values such as status, priority, assignee, project, category, and due date.
- Use muted action text for empty values such as `Add category`, `Assign project`, `Set due date`, or `Unassigned`.
- Preserve truncation and accessible labels for long values.
- Keep the row visually subordinate to the title and primary content.

Hard failures:

- Feature-local property row components when two or more pages need the same pattern.
- A task, email, feedback, or document detail pane that visually diverges from the meetings property row without a documented reason.
- Uppercase metadata grids such as `STATUS`, `PRIORITY`, `ASSIGNEE`, `PROJECT`, `CATEGORY` when the expected pattern is icon plus value.
- Missing icons where the reference pattern uses icons as anchors.
- Bulky form-like property sections in a detail header.
