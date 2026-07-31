# Workflow Usability Gate

This reference prevents clean-looking UI that fails the user's actual job. Use it for forms, feedback pages, training/review queues, editable tables, creation flows, AI quality review, comments, agenda items, tasks, emails, categorization, and response workflows.

## Prime Rule

The user should always know the next useful action without having to think.

If a surface exists to review, train, correct, create, edit, or respond, it must include controls for that action. A read-only page for an action workflow is a failed product surface.

## Job Completion Test

Before designing or approving a workflow page, answer:

```text
What is the user trying to accomplish?
What must they inspect to decide?
What can they change?
What feedback can they leave?
What happens after save/submit?
What is the next item or next step?
How do they undo, correct, or recover?
Can they complete the common path without touching the mouse?
```

If any answer is missing, stop and add the missing affordance before visual polish.

## Required Workflow Actions

Each workflow type has minimum actions.

### Feedback or AI Training Page

Purpose: improve AI output quality through human judgment.

Must include:

- The AI output being judged.
- The source/input that produced it.
- Quality decision: approve, reject, needs edit, or equivalent.
- Editable correction field or inline edit path.
- Reason/comment field when rejecting or correcting.
- Save/submit action.
- Skip or defer action when the reviewer cannot decide.
- Next item action or automatic advance after save.
- Status/state showing reviewed versus unreviewed.
- Error state that preserves the user's entered feedback.

Automatic failure:

- The page only displays AI outputs.
- The user cannot edit the task, category, email response, or extracted value being trained.
- The user cannot explain what was wrong.
- There is no save/submit path.
- There is no next-item flow.

### Categorization Review

Must include:

- Current category.
- Confidence or source evidence if available.
- Change category control.
- Confirm correct action.
- Mark incorrect or needs review action.
- Optional note explaining the correction.

### Email or Response Quality Review

Must include:

- Original email/request.
- Draft or generated response.
- Edit response control.
- Approve/send/mark good action as appropriate.
- Reject/regenerate/mark bad action as appropriate.
- Feedback reason.
- Save as training example when relevant.

### Task Quality Review

Must include:

- Generated task title and details.
- Source context.
- Edit title/details/assignee/due date when those fields exist.
- Accept/reject action.
- Feedback reason for rejection or edits.
- Link to canonical task if one exists.

### Repetitive Creation Flow

Examples: agenda items, line items, task lists, checklist rows.

Must include:

- Fast add action.
- Keyboard add: Enter creates the next row when focus is in the last row or title field, unless the field is multiline text.
- Multiline rule: Shift+Enter inserts a line break when Enter is used to submit/add.
- Tab moves to the next logical input.
- Shift+Tab moves to the previous logical input.
- Arrow keys move between sibling rows or cells when the layout is grid-like.
- Escape cancels transient edit state or closes the active popup.
- Save preserves momentum: after adding, focus lands where the user can continue.
- Empty row handling: empty trailing rows do not create junk records.

Automatic failure:

- The user must click an Add button after every row.
- Focus disappears after save.
- The user cannot tab through inputs in logical order.
- Keyboard behavior conflicts with text entry.

## Next Action Defaults

After successful action:

- Single-item create: show the created item and keep the next edit/action visible.
- Batch/review queue: advance to the next unreviewed item.
- Repetitive entry: focus the next empty row.
- Modal create: close only if the next expected job is outside the modal; otherwise keep the user in flow.
- Inline edit: preserve scroll position and show the saved state without shifting layout.

## Power Moves

Prefer these when they fit the job:

- Inline edit over separate edit page for small corrections.
- One-click approve/reject with optional comment when the decision is simple.
- Bulk apply only after the single-item flow is clear.
- Keyboard shortcuts only when visible controls also exist.
- Optimistic UI only when failure recovery is clear and entered text is preserved.

## Fail Loudly

Do not silently omit workflow-critical actions because backend support is missing. If the API or data model cannot support the needed edit, feedback, or next-item flow:

- State the missing capability.
- Add the smallest visible disabled/error state or follow-up action.
- Do not make the page look complete.
