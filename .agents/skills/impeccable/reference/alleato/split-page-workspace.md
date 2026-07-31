# Split-Page Workspace Pattern

Use this reference for list/detail workflows: emails, project emails, tasks, project tasks, comments, feedback inbox, review queues, approval queues, AI training queues, and any page where a user selects an item from a list and works in a detail pane.

## Prime Rule

These pages are the same layout family. The shell must be consistent; only the content changes.

Use the shared primitive:

```tsx
import { SplitPage, SplitPageFrame, useSplitPage } from "@/components/ui/split-page";
```

Default shell:

```tsx
<SplitPageFrame height="fill" className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
  <SplitPage
    variant="two-column"
    breakpoint="xl"
    defaultIsOpen={!selectedItem}
    className="min-h-0 flex-1"
  >
    <ListPane />
    <DetailPane />
  </SplitPage>
</SplitPageFrame>
```

Use `variant="three-column"` only when the third pane is a true auxiliary rail, such as AI feedback or source context. Do not fake a third column with local layout wrappers.

## Pages That Should Use This Pattern

Use this pattern for:

- Emails
- Project emails
- Tasks
- Project tasks
- Comments
- Feedback inbox
- AI training review queues
- Email categorization review
- Task extraction review
- Any review queue with selected item detail

If one of these pages uses a custom two-pane layout instead of `SplitPageFrame` and `SplitPage`, treat it as an inconsistency unless there is a documented technical blocker.

## Required Layout Contract

The list pane owns:

- Page/workspace title.
- Small toolbar actions such as search, filter, sort, view switcher, compose/create.
- Tabs or scope controls when needed.
- The scrollable list.
- Loading, empty, and error states for the list.

The detail pane owns:

- Selected item content.
- Primary detail actions.
- Edit/correction/feedback controls for the selected item.
- Empty state when no item is selected.

The optional auxiliary pane owns:

- Feedback/training panel.
- Source context.
- Metadata or evidence that supports the selected item.

Do not move selected-item detail controls into the list toolbar. Do not put list filters in the detail pane.

## Consistency Requirements

Across emails, tasks, project tasks, project emails, comments, and feedback inbox:

- Same `SplitPageFrame` height contract unless embedding requires a documented exception.
- Same desktop breakpoint family, defaulting to `xl` for dense workspaces.
- Same list-left/detail-right mental model.
- Same mobile behavior: list first, selecting an item closes the list, back returns to list through `useSplitPage().onOpen`.
- Same list pane structure: header, toolbar/tabs, scrollable rows.
- Same detail pane structure: empty state or selected item detail.
- Same row selection behavior and selected-row highlight treatment.
- Same scroll ownership: list scrolls inside list pane; detail scrolls inside detail pane.
- Same compact toolbar density.

Content may differ. Shell behavior should not.

## Required Interactions

- Selecting a list item updates the selected item and opens detail on mobile.
- Mobile detail has a back affordance that returns to the list.
- Empty detail state tells the user to select an item and should not add unrelated helper UI.
- Keyboard focus should remain in the workflow after selection, save, feedback submission, or next-item navigation.
- Review queues should support next-item movement after action.

## Feedback Inbox Specific Rule

Feedback inbox is a review queue. It should use the split-page pattern:

- Left pane: tabs/scope, filters/search, issue/request list.
- Detail pane: selected feedback item, screenshot/context, comments, status/actions, dispatch/triage controls.
- Optional auxiliary pane only if it holds source evidence, AI summary, or linked implementation context.

It should not be a unique dashboard, card grid, or bespoke page layout.

## Automatic Failure

Fail an implementation or audit when:

- A listed page uses custom `flex` pane layout instead of `SplitPage`.
- Each page invents its own left-pane width, toolbar composition, empty state, or mobile back behavior.
- The list pane and detail pane have different scroll ownership across pages.
- The selected-row state is visually different without reason.
- The page has no detail pane for the selected item.
- Feedback/training pages show items but do not let the user act on the selected item.
- The third pane is simulated locally instead of using `variant="three-column"`.

## Audit Output

When auditing split-page consistency, report:

```text
Route/file:
Expected pattern: SplitPage Workspace
Uses SplitPageFrame:
Uses SplitPage:
Variant:
List pane structure:
Detail pane structure:
Auxiliary pane:
Mobile behavior:
Inconsistencies:
Required fix:
```

