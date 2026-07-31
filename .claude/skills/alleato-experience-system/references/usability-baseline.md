# Alleato Usability Baseline

This is the non-negotiable Design/UX 101 gate. It is intentionally more objective than visual taste.

## Task and hierarchy

- The page has one identifiable primary job and one primary action.
- Current location, record identity, status, and next step are clear.
- Related information is grouped by proximity and alignment before containers.
- Users are not forced to remember facts from another screen to make the current decision.
- Progressive disclosure hides secondary complexity, not essential state or risk.

## Semantics and accessibility

- Actions use buttons; navigation uses links.
- Controls have visible labels or an unambiguous accessible name.
- Icon-only controls have tooltips and accessible names.
- Heading levels and landmarks describe the page structure.
- Keyboard order follows visual order; focus is visible and never trapped unintentionally.
- Dialogs restore focus to their trigger and expose a clear close/cancel path.
- Color is not the only carrier of status or meaning.
- Reduced-motion preferences are honored.

## Forms and data entry

- Placeholders are examples, never the only label.
- Inputs use appropriate `name`, `type`, `autocomplete`, and `inputmode`.
- Required/optional expectations are explicit.
- Validation appears near the source and explains what happened and how to recover.
- Submission failures preserve user input and focus the first relevant error.
- Consequential changes have review, undo, or explicit confirmation proportional to risk.

## Feedback and recovery

- Every asynchronous action communicates progress and completion.
- Loading, empty, partial, stale, permission-denied, offline, error, and success states are designed.
- Errors are specific and actionable; generic “something went wrong” is a failure.
- Destructive actions prefer undo when safely possible; irreversible or high-cost actions require clear confirmation.
- Users can cancel, clear filters/selections, exit long flows, and recover drafts where loss would be costly.

## Content and interaction

- Labels use the user's domain language and consistent terminology.
- Button copy names the outcome, such as “Create commitment,” not “Submit.”
- Links make sense out of context.
- No action exists only on hover or through an undiscoverable gesture.
- Menus, tabs, lists, tables, and composite controls follow expected keyboard behavior.
- Filters, tabs, pagination, and other shareable view state use the URL when appropriate.

## Responsive and content resilience

- The layout works with long names, zero records, one record, large counts, missing optional data, and narrow widths.
- Text wraps without obscuring actions; long identifiers truncate only when the full value remains available.
- Tables recompose deliberately instead of becoming unusable horizontal miniatures.
- Touch target sizing responds to coarse pointers; dense desktop controls need not be artificially oversized.
- Safe areas, virtual keyboards, landscape, and zoom do not hide critical controls.

## Performance and perception

- Images declare dimensions and load appropriately.
- Large collections are paginated or virtualized when rendering volume harms interaction.
- Motion uses transform/opacity when feasible and explains state, causality, or spatial change.
- Skeletons resemble the eventual structure; progress copy sets expectations for long operations.

## Automatic rejection

Reject a design or implementation that:

- blocks the primary task;
- has nonfunctional controls or invented data presented as real;
- removes visible focus or requires a mouse;
- loses entered work on recoverable failure;
- hides critical status, risk, or destructive consequence;
- communicates state only by color;
- is unusable at the required viewport;
- duplicates the primary action or buries it among equal-weight actions;
- substitutes visual polish for error, permission, loading, and recovery behavior.

## Review scoring

Use Nielsen's ten heuristics as a diagnostic lens, but report concrete evidence and user impact. A numeric score is optional and must not obscure blockers. Severity:

- **P0:** task cannot be completed or data/safety is at immediate risk.
- **P1:** major confusion, inaccessible core action, likely error, or lost work.
- **P2:** meaningful friction with a viable workaround.
- **P3:** polish with little task impact.
