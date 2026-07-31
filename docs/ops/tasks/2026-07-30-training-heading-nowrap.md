# Task: Keep Training Story Headings Readable

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: local-training-heading-nowrap
Linear Issue: N/A, single-session responsive correction
Related Handoff: N/A

## Objective

Use the available width for training story headings at tablet-sized viewports so the selected heading remains on one line.

## Scope

- Adjust the existing story heading rule in `hub-theme.module.css`.
- Preserve the established narrow-mobile wrapping and desktop story layout.

## Source of Truth

- Canonical runtime owner: `/training`
- Existing shared pattern: `.storyChapterTitle`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] “Your gaps pick themselves.” renders on one line at 686×794.
- [x] The 390px layout retains readable wrapping without horizontal overflow.
- [x] No new component, visual element, or breakpoint convention is introduced.

## Implementation Checklist

- [x] The existing story heading owner is reused.
- [x] The project-standard 640px breakpoint is used.
- [x] Unrelated dirty files remain untouched.

## Integration and Verification

- [x] `git diff --check` passes.
- [x] Authenticated route proof was captured from the exact source revision.
- [x] Desktop and mobile screenshots are recorded below.
- [x] The changed boundary has no horizontal page overflow.

## Failure-Loudly Contract

- Cause surfaced as: browser measurement reports heading height, line height, max width, viewport, and document scroll width.
- Detection path: authenticated `/training` screenshot and DOM measurement at 686px and 390px.
- Recovery path: restore the breakpoint-scoped width rule if the story layout owner changes.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: the desktop-oriented `18ch` title cap remained active at a 686px single-column viewport.
- Detection gap: the story heading had not been visually checked at the tablet breakpoint.
- Prevention: retain paired 686px and 390px screenshots for this responsive boundary.
- Guardrail evidence: the artifacts below and the project-standard breakpoint rule.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static | `git diff --check -- frontend/src/app/(main)/training/hub-theme.module.css` | Pass | No malformed CSS or whitespace errors. |
| 686px route | `2026-07-30-training-heading-nowrap.desktop.png` | Pass | Heading height `24.47px` equals one line height; max width is `none`; document width equals viewport width. |
| 390px route | `2026-07-30-training-heading-nowrap.mobile.png` | Pass | Existing narrow-mobile wrap remains readable; document width equals viewport width. |

## Remaining Risk

- None within the requested breakpoint behavior.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A where appropriate.
- [x] No work is deferred.
