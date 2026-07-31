# UI Pattern Library Operating Model

Agents must not invent common UI patterns. They must reproduce approved patterns.

## Core Rule

For standard product surfaces, the design task is pattern matching, not creative layout generation.

When working in `alleato-pm`, inspect repo-local pattern assets before implementing:

- Root: `frontend/src/design-system`
- Dropdown screenshots: `frontend/src/design-system/dropdown-menus`
- Spacing and density tokens: `frontend/src/design-system/spacing.ts`

If the relevant pattern folder exists, treat it as the visual source of truth. Do not approximate from memory.

Bad prompt interpretation:

```text
User needs three comment actions.
Create a new dropdown layout that contains those actions.
```

Correct prompt interpretation:

```text
User needs three comment actions.
Find the blessed header action dropdown pattern.
Map each action into that pattern.
If an action does not fit, move it to a larger surface or stop and explain why.
```

## Pattern Selection

Before designing, choose one blessed pattern:

- Header action dropdown
- Compact row action menu
- Filter popover
- Discussion sidebar
- Detail page
- Table page
- Form page
- Dialog
- Empty state

If no blessed pattern exists, stop before implementation and create a small pattern proposal. Do not invent the pattern inside the feature code.

## Pattern Reproduction Requirements

When applying a pattern, preserve:

- Surface type
- Width range
- Row density
- Typography scale
- Icon treatment
- Dividers
- Hover state
- Action ordering
- Empty/error behavior
- Keyboard and focus behavior
- Next-action behavior

Changing any of these counts as design work and must be justified.

## Dropdown Pattern 014: Standard Header Dropdown

Purpose: contextual commands from a top-header icon.

Reference artifact: `assets/patterns/dropdown-014-standard.html`.

Use for:

- User/account actions.
- Admin/settings menus.
- Comment command menu.
- Compact tool menus.

Do not use for:

- Reading records.
- Browsing recent activity.
- Filtering lists.
- Searching.
- Editing multi-field forms.
- Global review workflows.

Required structure:

```text
Optional label, text-sm font-medium
Optional separator
2-5 DropdownMenuItem rows
Optional separator
Optional final navigation or state row
```

Required styling:

- Width: `w-48`, `w-52`, `w-56`, or at most `w-72` when labels need space.
- Padding: container `p-1` or `p-2`, not large panel padding.
- Row text: `text-sm`.
- Row padding: `px-2 py-1.5` or `px-2.5 py-2`.
- Row height: approximately 32px to 36px.
- Radius: match shared dropdown item radius.
- Shadow: subtle existing dropdown shadow only.
- Icons: `h-4 w-4` when used.
- Divider: one pixel separator only where grouping is needed.

Forbidden styling:

- `text-lg` or larger.
- `py-4`, `py-5`, or large row padding.
- `w-96` for ordinary command menus.
- Centered, settings-panel-like vertical spacing.
- Large switches.
- Card-like interior sections.
- Custom button rows when shared menu items work.

Boolean state:

- Prefer a dynamic command label: `Hide comments` / `Show comments`.
- Or use a checkmark row: `Comments visible`.
- Do not use a switch unless the menu is explicitly a settings surface.

Action ordering:

1. Creation or primary page action.
2. Open/inspect action.
3. Separator.
4. State toggle or secondary navigation.

## Pattern Proposal Format

If a new pattern is truly needed, propose it separately:

```text
Pattern name:
Surface:
Purpose:
Allowed content:
Forbidden content:
Width/density:
Interaction rules:
Accessibility:
Existing primitive:
Why no existing pattern fits:
```

Do not implement feature-specific local styling before this proposal is accepted.
