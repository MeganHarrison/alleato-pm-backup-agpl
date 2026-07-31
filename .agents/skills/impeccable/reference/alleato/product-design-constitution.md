# Alleato Product Design Constitution

This document defines hard laws for Alleato product UI. These laws are constraints, not inspiration. If a design violates them, reject it before implementation is considered complete.

## Prime Directive

Alleato UI exists to help people understand work, make decisions, and take the next correct action. Functionality is not enough. A feature that is technically present but visually confusing is a failed feature.

## Laws

1. One purpose per surface.
   A surface may choose, inspect, edit, confirm, or navigate. It must not do all of those at once.

2. A popup is not a page.
   Dropdowns and popovers are temporary control surfaces. They must not become feeds, dashboards, reports, or document readers.

3. Content outweighs chrome.
   Controls, filters, subtitles, badges, helper text, dividers, and decorative icons must not compete with the user's work.

4. Metadata stays compressed until it is needed.
   Names, timestamps, authors, status, counts, source links, and history belong behind disclosure unless they directly support the current decision.

5. Reuse the established site pattern before inventing.
   If 90 percent of the site uses a compact dropdown style, the next dropdown must start from that pattern.

6. Every component has a complexity budget.
   A surface that exceeds its budget must be split into a larger surface such as a sheet or page.

7. Progressive disclosure is the default.
   Show the next action. Hide advanced options, history, feeds, filters, and global views until requested.

8. Every pixel must justify its existence.
   If removing an element does not make the user slower, less accurate, or less confident, remove it.

9. Redundant actions are design debt.
   The same action should not appear in both a dropdown and a sidebar unless the duplication is required for recovery or accessibility.

10. Good UI should feel inevitable.
    A user should be able to predict what the next surface contains before opening it.

11. The next action must be present.
    A surface that shows work but withholds the obvious next action is incomplete.

12. Review surfaces must be corrective.
    If a page exists to review, train, or judge quality, it must let the user approve, reject, edit, correct, comment, save, and move to the next item as appropriate.

13. Keyboard momentum is product quality.
    Repetitive entry must support Enter, Tab, Shift+Tab, arrow movement, Escape, and focus retention according to the task.

## Review Questions

Ask these before coding:

- What is the single job of this surface?
- Is this the smallest surface that can do the job?
- Which information is needed now?
- Which information belongs in a sheet, sidebar, or full page?
- Is there an existing Alleato pattern for this?
- What will the user misunderstand in five seconds?
- What should be removed before styling begins?
- What can the user do next?
- What can the user correct?
- How does the keyboard path work?

## Automatic Failure

Reject the design immediately when any of these are true:

- The surface has no single primary purpose.
- The surface mixes navigation, filtering, creation, and record review.
- The surface contains a list or feed when a sidebar/page already exists for that list.
- A dropdown scrolls.
- A dropdown contains tabs.
- A dropdown contains search or filters.
- A dropdown contains more than five interactive rows.
- A popup has more than two visual sections.
- The same information appears in a compact surface and a larger canonical surface.
- A new local component is created while an existing primitive can handle the job.
- A feedback/training page has no approve, reject, edit, comment, or save path.
- A repetitive-entry flow requires mouse interaction for every new row.
- A success state leaves the user stranded instead of advancing or preserving momentum.
