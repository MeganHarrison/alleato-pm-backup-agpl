# Task: Email body formatting and layout regression

Status: In Progress
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-674 - https://linear.app/megankharrison/issue/AAI-674/fix-email-body-formatting-regression-on-global-emails-page
Related Handoff: N/A

## Objective

Restore readable formatting for the `/emails` mail reading pane and clean up the desktop mail layout so the list, header metadata, project assignment, and right-column actions behave like a restrained operational email client.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- `/emails` default Mail view uses the same email body normalization path as the shared detail sheet.
- Flattened request/list-style bodies split common request phrases and document/payment/tax item runs into readable paragraphs.
- Tests fail if a Form 1040-style flattened request collapses back into one paragraph.
- Left rail rows remain one-column except the sender/date row, and long sender, subject, email, and preview text truncate inside the sidebar instead of expanding the scroll area.
- Desktop layout uses the shared UI-library `SplitPage` primitive instead of a bespoke page grid.
- Split-pane layout remains full width and full height with no demo-style border or rounded outer shell.
- Existing third details column is retained on wide desktop as part of the split page detail side.
- Subject and received date share the top header row, with the date aligned right.
- Project assignment is editable in the top metadata block and uses metadata-sized typography.
- Right-column actions live below Details and remain quiet text/icon controls.
- No new decorative wrappers, cards, stats, banners, or helper panels are added.

## Failure-Loudly Behavior

Formatting regressions fail through focused `email-thread` unit tests that exercise flattened body examples. Left rail overflow fails visibly through the browser width check where row/viewport scroll width must stay equal to client width while text nodes use ellipsis.

## Files To Change

- `frontend/src/features/emails/email-thread.ts` - shared email body normalization heuristics.
- `frontend/src/features/emails/__tests__/email-thread.test.ts` - regression coverage for flattened request/list emails.
- `frontend/src/features/emails/project-emails-workspace.tsx` - mail list, reading header, details, and actions layout.
- `frontend/src/features/emails/email-view-switcher.tsx` - compact view selector.
- `docs/ops/tasks/2026-06-25-email-body-formatting-regression.md` - task gate and evidence ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `npx eslint src/features/emails/project-emails-workspace.tsx src/features/emails/email-view-switcher.tsx src/features/emails/email-thread.ts src/features/emails/__tests__/email-thread.test.ts --cache --cache-strategy content` from `frontend/` | Pass with existing warnings | Focused lint for touched files. Existing warnings remain in `project-emails-workspace.tsx` for raw SortPopover button, raw date input, and raw search input. |
| Targeted tests | `npm --prefix frontend run test:unit -- --runTestsByPath src/features/emails/__tests__/email-thread.test.ts --runInBand` | Pass | 14 email formatting tests passed. |
| Browser/user-flow | `agent-browser open http://localhost:3001/emails`; screenshot `tests/agent-browser-runs/2026-06-25-email-formatting-regression/emails-after-loaded.png` | Pass | Mail view renders selected Form 1040 request as paragraphs/label rows. |
| Left rail overflow proof | `agent-browser eval` row/viewport width check after opening `/emails` | Pass | Viewport client/scroll width 383/383, row client/scroll width 381/381, subject text client/scroll width 349/441 with ellipsis. |
| Visual proof | `tests/agent-browser-runs/2026-06-25-email-formatting-regression/emails-left-rail-truncate-fixed.png` | Pass | Left rail subject and preview truncate within fixed sidebar width; right-column actions sit below Details. |
| Split pane proof | `agent-browser set viewport 1728 931 && agent-browser open 'http://localhost:3001/emails?view=mail'` plus screenshot `tests/agent-browser-runs/2026-06-25-email-formatting-regression/emails-split-page-three-column-1728.png` | Pass | Shared `SplitPage` shell renders list, reading pane, and 320px third details column with no outer border/radius demo wrapper. |
| DB/provider read-back | N/A | N/A | No schema/provider change. |
| End-to-end proof | `agent-browser snapshot --compact --depth 6` and screenshot artifact | Pass | DOM included split paragraphs for `Client Information Address`, `Your Occupation`, `Date of Birth`, `Phone No`, tax document labels, and closing text. |

## Files Changed

- `frontend/src/features/emails/email-thread.ts` - added shared normalization for flattened request/list emails.
- `frontend/src/features/emails/__tests__/email-thread.test.ts` - added Form 1040-style flattened email regression.
- `frontend/src/features/emails/project-emails-workspace.tsx` - cleaned desktop mail list, header metadata, project assignment, body type scale, details panel, and action placement.
- `frontend/src/features/emails/project-emails-workspace.tsx` - moved the mail shell onto the shared `SplitPage` primitive while retaining the third desktop details column.
- `frontend/src/features/emails/email-view-switcher.tsx` - replaced view tabs with a compact icon dropdown.
- `docs/ops/tasks/2026-06-25-email-body-formatting-regression.md` - task gate and evidence.

## Risks / Gaps

- Linear issue was created after implementation because the Linear tools were not exposed until connector discovery during closeout. Prevention: run `tool_search` for Linear immediately when a task file is needed and no Linear tools are initially visible.
- Publish is blocked by unrelated dirty-checkout design-system warnings in `frontend/src/components/admin-feedback/ScreenshotAnnotator.tsx` when running `npm run codex:finish -- --message "Fix email body formatting" --files frontend/src/features/emails/email-thread.ts frontend/src/features/emails/__tests__/email-thread.test.ts`. Prevention: clear or isolate unrelated changed files before finish, or fix that owner file's lint debt in a separate task.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
