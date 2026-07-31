# Surface Complexity Budgets

Use these budgets as pass/fail gates. A surface that exceeds its budget must be decomposed into smaller surfaces or promoted to a larger surface.

## Dropdown Menu

Purpose: choose one command, toggle one small setting, or navigate to a small set of destinations.

Budget:

- Width: 12rem to 20rem. Default to existing site widths such as `w-48`, `w-56`, or `w-72`.
- Height: content-sized. No dropdown should need internal scrolling.
- Row height: approximately 32px to 36px for desktop command menus.
- Row padding: compact, usually `px-2 py-1.5` or `px-2.5 py-2`.
- Text size: `text-sm` for normal menu rows.
- Interactive rows: 2 to 5.
- Headings: 0 to 1.
- Sections: 1 to 2.
- Dividers: 0 to 1.
- Font sizes: 1 to 2.
- Primary action: 0 to 1.
- Description copy: 0 to 1 short sentence only when it prevents misuse.
- Boolean controls: dynamic labels or checkmark rows by default. A switch is allowed only when the menu is explicitly a settings surface.

Forbidden:

- Tabs or segmented filters.
- Search fields.
- Activity feeds.
- Recent comments or recent records lists.
- Cards.
- Tables.
- Forms, except a single checkbox/switch row.
- Pagination.
- Charts or metrics.
- Long descriptions.
- Multiple competing CTAs.
- Internal scroll.
- Large switch controls in command menus.
- `text-lg`, `text-xl`, `py-4`, `py-5`, or 48px-plus rows.
- Wide settings-panel treatment for a menu with only a few commands.

Promotion rule:

- If the user needs to read multiple records, use a sheet or page.
- If the user needs to filter, use a sheet, table toolbar, or page.
- If the user needs to compose text, use the native composer, a focused dialog, or a sheet.
- If the user needs global history, use the full page.

## Popover

Purpose: compact inspection or lightweight control near a trigger.

Budget:

- Width: 18rem to 24rem.
- Max height: 24rem only for preview lists.
- Preview rows: up to 8 only when the popover's job is previewing recent items.
- Headings: 1.
- Sections: up to 2.
- Footer link: 0 to 1.

Forbidden:

- Multi-tab dashboards.
- Nested cards.
- Multiple independent modules.
- Filters plus a feed plus creation.
- More than one footer/navigation link.

Promotion rule:

- If the preview list needs filtering, bulk actions, full text, or more than eight rows, move it to a sheet or page.

## Sidebar or Sheet

Purpose: focused workflow panel, detail inspection, or list review without losing page context.

Budget:

- One header.
- One primary list or form.
- Optional footer link to canonical page.
- Search or filters only if they support the main workflow.
- Empty state must give the next useful action or explain the absence briefly.

Allowed:

- Stacked comments.
- Record detail.
- Small forms.
- Source context.
- Footer link to the full page.

Forbidden:

- Page-level dashboards.
- Multiple unrelated lists.
- Top-of-panel metric cards unless the panel is specifically for monitoring.

## Full Page

Purpose: canonical workspace for broad review, filtering, reporting, or multi-record management.

Use a page when the user needs:

- Global search or filters.
- Full history.
- Bulk actions.
- Large tables.
- Reporting.
- Cross-project review.
- Multiple sections with different jobs.

## Dialog

Purpose: confirm, create, edit, or resolve one focused object.

Budget:

- One title.
- One consequence or state explanation if needed.
- One form or confirmation body.
- One primary action and one cancel/secondary action.

Forbidden:

- Long record lists.
- Nested navigation.
- Multiple unrelated actions.

## Tooltip

Purpose: explain a single control or destination.

Budget:

- One sentence.
- No actions.
- No paragraphs.
