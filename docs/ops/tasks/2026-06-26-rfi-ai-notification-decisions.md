# Task: RFI AI Notification Decisions

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-695 - https://linear.app/megankharrison/issue/AAI-695/record-rfi-opened-notification-ai-decisions
Parent: AAI-681

## Objective

Record AI notification decisions for RFI opened/distribution notifications when
email recipients can be mapped to app users, without changing or delaying the
existing email notification semantics.

## Attention Brief

Primary user: project team member assigned to or copied on an opened RFI.
Primary job: see the AI assistant has context about the RFI notification.
Primary decision: review the RFI and decide whether to answer, coordinate, or
monitor.
Tier 1: RFI title/body/action in the existing assistant widget.
Tier 2: project/RFI/user mapping and duplicate event key.
Tier 3: raw routing metadata.
Hide until requested: unmapped contact details and raw ledger results.
Remove: Teams/Outlook sends, separate writers, blocking delivery behavior.
Primary action: open the existing RFI or assistant notification.
Failure-loudly behavior: recipient mapping gaps and ledger failures warn with
compact structured metadata while email delivery continues.

## Scope Checklist

- [x] Existing RFI recipient resolution and AI decision ledger reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Centralized/shared abstraction used for cross-cutting behavior.
- [x] Legacy email notification semantics preserved.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows noise gate by adding no UI.

## Integration Checklist

- [x] RFI opened notification path records ledger decisions for mapped app users.
- [x] Unmapped recipients are skipped without guessing user IDs.
- [x] Ledger failures are visible and non-blocking.
- [x] Teams/Outlook sends are not added.

## Regression Guardrails

- [x] Focused unit test covers mapped users, unmapped recipients, and ledger failure warnings.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Targeted lint run.
- [x] Targeted automated test run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `frontend/src/lib/rfi/rfi-notify.ts` - resolve app-user mappings and record decisions after opened email attempts.
- `frontend/src/lib/rfi/rfi-notify.unit.test.ts` - focused RFI notification decision producer guardrails.
- `docs/ops/tasks/2026-06-26-rfi-ai-notification-decisions.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Feasibility | `frontend/src/types/database.types.ts` inspection | Pass | `people.auth_user_id` exists and is nullable; only non-null values are reliable app user IDs. |
| Targeted lint | `cd frontend && npx eslint src/lib/rfi/rfi-notify.ts src/lib/rfi/rfi-ai-notifications.ts src/lib/rfi/rfi-ai-notifications.unit.test.ts src/lib/rfi/rfi-notify.unit.test.ts` | Pass | Focused lint clean from the frontend package boundary. |
| Targeted tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/rfi/rfi-ai-notifications.unit.test.ts src/lib/rfi/rfi-notify.unit.test.ts` | Pass | 2 suites / 4 tests passed. |
| Changed-file guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Lint path check | `npx eslint frontend/src/lib/rfi/rfi-notify.ts frontend/src/lib/rfi/rfi-ai-notifications.ts frontend/src/lib/rfi/rfi-ai-notifications.unit.test.ts` | Failed | Root-level invocation cannot resolve `next/core-web-vitals`; reran from `frontend/` successfully. |

## Files Changed

- `docs/ops/tasks/2026-06-26-rfi-ai-notification-decisions.md` - task ledger and evidence.
- `frontend/src/lib/rfi/rfi-ai-notifications.ts` - shared non-blocking AI decision producer for opened RFI notifications.
- `frontend/src/lib/rfi/rfi-ai-notifications.unit.test.ts` - producer guardrails.
- `frontend/src/lib/rfi/rfi-notify.ts` - recipient app-user mapping and opened notification producer call.
- `frontend/src/lib/rfi/rfi-notify.unit.test.ts` - integration guardrail for schema-backed mapping statuses.

## Risks / Gaps

- Existing checkout has unrelated dirty files; final publish must stage only task-owned files.
- No full typecheck was run by request; focused lint/tests and changed-file guard passed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
