# Bad vs Good Examples

These examples are diagnostic patterns. Use them to reject designs that satisfy requirements by dumping everything into one surface.

## Failure: Dropdown Became A Page

Bad shape:

```text
Discussion
Long description
Tabs: All / Mine / Mentions / Unresolved
Add comment action
View page comments action
Divider
Recent comments heading
Comment preview
Comment preview
Comment preview
Comment preview
Divider
View all site comments
```

Why it fails:

- The dropdown has at least four jobs: filter, create, review recent activity, and navigate.
- It requires reading before acting.
- It duplicates the sidebar and full comments page.
- It makes global history compete with the page-level comment action.
- It violates the dropdown budget: too tall, too many sections, tabs, feed content, and multiple navigation paths.
- It optimizes for "all requested features are present" instead of "the user understands the next action."

Correct decomposition:

```text
Header comments dropdown:
Comments
Add comment on this page
Open page discussion
Hide comments or show comments

Page discussion sidebar:
Discussion
Stacked page comments
View all site comments link

Full comments page:
All site comments
Search
Filters
Cross-page review
```

Pass condition:

- The header dropdown is a command chooser.
- The sidebar is the page comment workspace.
- The full page is the global comment workspace.

## Failure: Principle-Only Cleanup

Bad instruction:

```text
Make this less cluttered and improve hierarchy.
```

Why it fails:

- It leaves the model free to restyle bad structure.
- It does not define what must be removed.
- It cannot be checked mechanically.

Better instruction:

```text
This is a dropdown. It may have one title, up to five interactive rows, one divider, no tabs, no feed, no search, no scrolling, and no record previews. Move comment lists to the sidebar and global filters to the comments page.
```

## Failure: Feature Dumping

Bad behavior:

```text
User asks for five capabilities.
Agent places all five in one component.
```

Correct behavior:

```text
Agent identifies which surface owns each capability.
Agent implements each capability in the smallest appropriate surface.
Agent rejects any surface with more than one primary job.
```

## Failure: Read-Only Feedback Training Page

Bad shape:

```text
AI task title
AI category
AI email response
Status
Timestamp
```

Why it fails:

- The page exists to train quality, but the reviewer cannot train anything.
- There is no edit or correction path.
- There is no approve/reject/needs-work decision.
- There is no comment explaining what was wrong.
- There is no save or next-item flow.

Correct shape:

```text
Source context
AI output being reviewed
Decision: approve / reject / needs edit
Editable correction fields
Feedback reason
Save feedback
Skip
Next unreviewed item
```

Pass condition:

- The reviewer can correct the AI output directly.
- The system captures what was wrong.
- The reviewer can move through multiple items without losing momentum.

## Failure: Repetitive Entry Without Keyboard Momentum

Bad behavior:

```text
User types agenda item.
User must click Add.
Focus leaves the input.
User clicks the next input manually.
```

Why it fails:

- It turns a high-frequency creation flow into mouse work.
- It interrupts thought.
- It makes bulk entry feel slow even if the UI is visually clean.

Correct behavior:

```text
Enter adds the agenda item and focuses the next empty row.
Tab advances to the next field.
Shift+Tab moves backward.
Arrow keys move between sibling rows when applicable.
Escape exits edit mode.
```

Pass condition:

- The user can add several items without touching the mouse.
- Focus always lands where the user is most likely to continue.

## Good Pattern: Compact Header Menu

Good shape:

```text
Comments
----------------
+ Add comment
Open discussion
----------------
Hide comments
```

Why it works:

- One purpose: choose a comments command.
- The primary action appears first.
- The discussion action is close to the primary action.
- The visibility state is separated and lower priority.
- No switch makes it feel like a settings page.
- Larger jobs are delegated to larger surfaces.

## Failure: De-Cluttered But Still Not A Menu

Bad shape:

```text
Add comment on this page

Hide page comments              [large switch]

Open page discussion
```

Why it still fails:

- It removed the feed and filters, but it still invents a new oversized menu pattern.
- The row density is closer to a mobile settings page than a desktop header menu.
- The switch is too visually heavy for a temporary command surface.
- The actions have no hierarchy; all three rows have equal weight.
- There are no visual anchors or grouping cues.
- The menu does not match established compact dropdowns used elsewhere in the site.

Correct shape:

```text
Comments
----------------
+ Add comment
Open discussion
----------------
Hide comments
```

Implementation guidance:

- Use the existing dropdown/menu row primitive.
- Use compact `text-sm` rows.
- Use icons only as small anchors, such as plus-comment, panel/open, and eye-off.
- Replace the switch with a command label or checkmark row.
- Use a divider to separate command actions from state visibility.
- Keep the menu width near the existing header menu pattern, not a wide settings panel.

Pass condition:

- The menu feels like the same family as the account, admin, table action, and row action menus.
- A user can scan the three commands in under two seconds.
- No row looks like a form control unless the menu is explicitly a settings menu.

## Good Pattern: Compact Header Menu, No Title Variant

Good shape:

```text
+ Add comment
Open discussion
----------------
Hide comments
```

Why it works:

- The trigger icon already supplies the comments context.
- The menu remains compact.
- The divider creates enough hierarchy without adding copy.

## Good Pattern: Full Review Page

Good shape:

```text
Page title
Search/filter toolbar
Data table or stacked list
Detail/side panel as needed
```

Why it works:

- The page can support filtering and review because it has enough space.
- Lists and metadata do not crowd a temporary popup.
