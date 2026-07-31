# Task: Email importance feedback state

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-704 - https://linear.app/megankharrison/issue/AAI-704/persist-and-surface-email-importance-feedback-on-global-emails-page
Related Handoff: N/A

## Objective

Make `/emails` show persisted importance feedback as a single current state instead of continuing to show separate important and not-important actions after feedback is recorded. Not-important feedback must remove the email from the default active feed.

## Scope Checklist

- [x] Existing `/emails` route, email workspace, and feedback API reviewed.
- [x] Source-of-truth owner chosen as `ai_feedback_events` plus `/api/emails` feed filtering.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Feedback clear/change path uses shared service/API, not local-only UI state.
- [x] Existing duplicate important/not-important controls collapse after feedback exists.
- [x] Not-important feedback is hidden from the default `/emails` feed.
- [x] UI follows Alleato noise gate with no new dashboard, wrappers, or helper panel.

## Integration Checklist

- [x] `/emails` reads feedback state for the active page.
- [x] Latest feedback event wins, including clear events.
- [x] The selected reading pane and row action menu use the same state contract.

## Regression Guardrails

- [x] Unit/API coverage added or updated for latest-state and hidden not-important behavior.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Focused lint run for touched files.
- [x] Targeted automated tests run.
- [x] Browser/user-flow verification run on `http://localhost:3001/emails`.
- [x] Evidence artifacts recorded below.

## Acceptance Criteria

- After an email is marked important, the action area shows one persisted state control labeled `Marked important`.
- Clicking the persisted state shows the saved reason, plus actions to mark not important or clear feedback.
- After an email is marked not important, it is removed from the default `/emails` active feed.
- Clearing feedback removes the persisted state and restores the normal important/not-important actions when the email is visible.
- Failures to load, save, clear, or hide feedback report the specific operation and leave the email visible.

## Failure-Loudly Behavior

Feedback state load failures call `reportNonCriticalFailure` with operation metadata. Save and clear failures use the shared form/error handling path. If the hide filter cannot prove latest not-important state, `/api/emails` returns the row rather than silently dropping possible work.

## Files To Change

- `frontend/src/lib/ai/services/email-importance-feedback-service.ts`
- `frontend/src/app/api/ai-assistant/email-importance-feedback/route.ts`
- `frontend/src/app/api/emails/route.ts`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/features/emails/emails-table-config.tsx`
- Focused tests under the touched API/service areas

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static lint | `cd frontend && npx eslint 'src/app/(main)/[projectId]/emails/emails-client.tsx' 'src/features/emails/project-emails-workspace.tsx' 'src/features/emails/emails-table-config.tsx' 'src/app/api/emails/route.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/ai-assistant/email-importance-feedback/route.ts' 'src/lib/ai/services/email-importance-feedback-service.ts' 'src/lib/ai/services/__tests__/email-importance-feedback-service.test.ts' --cache --cache-strategy content` | Pass with existing warnings | Warnings remain for pre-existing email table/workspace design-system debt: editable status opt-out, raw sort button, raw date input, raw search input. |
| Changed-file type guard | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt detected. |
| Targeted tests | `npm --prefix frontend run test:unit -- --runTestsByPath src/app/api/emails/__tests__/route.test.ts src/lib/ai/services/__tests__/email-importance-feedback-service.test.ts --runInBand` | Pass | 2 suites, 3 tests. |
| Browser/user-flow | `agent-browser open http://localhost:3001/emails`; selected top email; saved important feedback; reopened route; selected same row | Pass | Reading pane replaced `Mark important` and `Not important` with one `Marked important` control. |
| Feedback popover proof | `agent-browser click` on `Marked important` | Pass | Popover exposed `Not important` and `Clear` actions. |
| Not-important hide proof | Changed the same email to not important, then reopened `http://localhost:3001/emails` | Pass | Default list no longer showed `Kathie Mason...`; first visible row became `Bob Wright...`. |

## Files Changed

- `frontend/src/lib/ai/services/email-importance-feedback-service.ts` - added clear event support and latest-event semantics.
- `frontend/src/app/api/ai-assistant/email-importance-feedback/route.ts` - added authenticated `DELETE` clear endpoint.
- `frontend/src/app/api/emails/route.ts` - filters latest not-important feedback out of the default feed.
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx` - loads feedback state for merged `/emails`, passes it into mail/table surfaces, and refetches after not-important/clear changes.
- `frontend/src/features/emails/project-emails-workspace.tsx` - replaces duplicate feedback buttons with a single persisted state popover.
- `frontend/src/features/emails/emails-table-config.tsx` - collapses row menu feedback actions when feedback exists.
- `frontend/src/app/api/emails/__tests__/route.test.ts` - current `/api/emails` source contract and not-important hide coverage.
- `frontend/src/lib/ai/services/__tests__/email-importance-feedback-service.test.ts` - clear-event latest-state guardrail.
- `docs/ops/tasks/2026-06-26-email-importance-feedback-state.md` - task gate and evidence ledger.

## Risks / Gaps

- Full project typecheck was not run; the repo instruction delegates long project-wide typechecks by default. Changed-file type guard, focused lint, focused tests, and browser proof passed.
- The live browser verification intentionally recorded feedback for the top email visible during the run, then changed it to not important. That row is now hidden from the default `/emails` feed for the active user, which is the requested behavior.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
