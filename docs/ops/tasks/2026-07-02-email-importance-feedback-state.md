# Task: Email Importance Feedback State

Status: Complete
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-887
Linear URL: https://linear.app/megankharrison/issue/AAI-887/make-email-importance-feedback-visible-reversible-and-filterable
Related Handoff: N/A

## Objective

Make `/emails` importance feedback visible, editable, reversible, and part of the default mailbox filtering behavior.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Attention Brief

Primary user: Alleato operator triaging inbox relevance.
Primary job: classify whether an email belongs in the active working inbox.
Primary decision: keep the email visible as important/default, or hide it as not important.
Tier 1: current importance state and reason.
Tier 2: edit reason and revert marking.
Tier 3: filter control to view not-important emails.
Hide until requested: reason edit form details.
Remove: silent action-only feedback controls.
Primary action: mark, edit, or revert importance feedback.
Failure-loudly behavior: save/load failures must surface a specific toast or inline error and keep the email visible.

## Acceptance Criteria

- [x] Marked emails show current importance state in the reading panel.
- [x] Users can see the saved reason and note for important/not-important markings.
- [x] Users can change the reason for an existing marking.
- [x] Users can revert/clear an accidental marking.
- [x] Emails marked `not_important` are removed from the default `/emails` list.
- [x] A filter allows users to view `not_important` emails again.
- [x] Feedback save/load failures are visible and actionable.

## Failure-Loudly Behavior

- API validation rejects invalid signals/actions.
- Feedback load errors raise the existing guarded API error instead of hiding state silently.
- Feedback save/revert errors show user-facing error toasts.
- If feedback state cannot be loaded, the default list must not silently hide emails.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing feedback event service reused; no one-off storage path.
- [x] Default list filtering uses the same feedback state as the visible detail panel.
- [x] Edit and revert paths are wired through the API.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

## Planned Files

- `docs/ops/tasks/2026-07-02-email-importance-feedback-state.md`
- `frontend/src/lib/ai/email-importance-feedback-types.ts`
- `frontend/src/lib/ai/services/email-importance-feedback-service.ts`
- `frontend/src/app/api/ai-assistant/email-importance-feedback/route.ts`
- `frontend/src/features/emails/email-importance-feedback-dialog.tsx`
- `frontend/src/features/emails/email-filter-popover.tsx`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.helpers.ts`
- `frontend/src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts`
- `frontend/src/app/api/ai-assistant/email-importance-feedback/__tests__/route.test.ts`
- `docs/architecture/PROJECT-MAP.md`

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters return typed, inspectable results.
- [x] Linear kickoff and milestone comments recorded.
- [x] No migration/provider change required, or read-back evidence recorded if that changes.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Template gate | `sed -n '1,240p' docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Template path referenced by AGENTS is missing; this file mirrors existing `docs/ops/tasks/*` shape. |
| Targeted unit/API tests | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts' src/app/api/ai-assistant/email-importance-feedback/__tests__/route.test.ts` | Pass | 2 suites, 10 tests. Covers default hide/show filter behavior and POST/DELETE feedback API paths. |
| Changed type-debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Targeted ESLint | `./node_modules/.bin/eslint ...task-owned files...` | Pass with warnings | No errors. Existing warnings in `project-emails-workspace.tsx`: raw button, raw date input, raw search input. |
| Changed ESLint debt gate | `npm run lint:changed:debt` | Fail unrelated | New debt detector reports `src/components/header/comments-sidebar-button.tsx:245 design-system/no-raw-button`, an unrelated dirty file outside this task. |
| Auth setup for browser verification | `BASE_URL=http://localhost:3001 npx playwright test tests/auth.setup.ts --config=config/playwright/playwright.config.ts --project=setup` | Pass | Fresh local auth state saved and verified against protected route. |
| Browser route access | `agent-browser --state frontend/tests/.auth/user.json open http://localhost:3001/emails` | Blocked/Deferred | Route loads authenticated app shell, then redirects to `/access-denied?reason=owner-only`; available test identity is not workspace owner. Artifact: `.codex-artifacts/email-importance-feedback/access-denied-owner-only.png`. |
| Sub-agent verify-feature run | Sub-agent `019f22dd-b05a-7d72-af7f-84fa6d00be73` | Blocked/Deferred | Created `verify-output/email-importance-feedback/success-criteria.md` and `verify-output/email-importance-feedback/login-snapshot.md`; `/emails` stayed inaccessible. Saved state redirected to login, direct UI login stayed on login with disabled `Signing in...`, console showed repeated `401 Unauthorized`. |
| Owner-session browser verification | In-app browser at `http://localhost:3001/emails` | Pass | Marked Douglas Franklin email not important, verified it left default inbox, used `importance=not_important` filter to recover it, verified reason/note/Edit/Revert, changed reason to `Routine internal`, reverted, confirmed default inbox restored. Artifacts: `verify-output/email-importance-feedback/screenshots/01-selected-email-controls.png` through `13-final-clean-state.png`. |
| Important feedback browser verification | In-app browser at `http://localhost:3001/emails` | Pass | Marked the same email important, verified visible `Marked important`, reason, note, Edit, opposite action, and Revert, then reverted back to an unmarked state. Artifacts: `verify-output/email-importance-feedback/screenshots/11-important-modal.png`, `12-important-state.png`, `13-final-clean-state.png`. |
| Project map gate | `npm run map:project` | Pass | Regenerated `docs/architecture/PROJECT-MAP.md` because the email feedback API route changed. |

## Resolved Blocker

Cause: the available local test identity authenticates but is not authorized for the owner-only `/emails` route.
Detection gap: saved auth state alone was not enough; browser proof required opening the exact route after auth setup.
Prevention step: keep `/emails` browser verification tied to an owner-authorized storage state or direct owner session before marking this task complete.
Resolution: continued verification in the already owner-authorized in-app browser session and captured the full mark important, mark not important, edit reason, filter, and revert workflow.

## Files Changed

- `docs/ops/tasks/2026-07-02-email-importance-feedback-state.md` - Task gate and evidence ledger.
- `frontend/src/lib/ai/email-importance-feedback-types.ts` - Shared cleared-signal marker.
- `frontend/src/lib/ai/services/email-importance-feedback-service.ts` - Append-only clear/revert event and latest-state handling.
- `frontend/src/app/api/ai-assistant/email-importance-feedback/route.ts` - DELETE clear/revert endpoint.
- `frontend/src/app/api/ai-assistant/email-importance-feedback/__tests__/route.test.ts` - API regression coverage.
- `frontend/src/app/(main)/[projectId]/emails/emails-client.helpers.ts` - Relevance filter normalization and visibility helper.
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx` - Default not-important exclusion and feedback map wiring.
- `frontend/src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts` - Default/filter visibility guardrails.
- `frontend/src/features/emails/email-filter-popover.tsx` - Relevance filter control.
- `frontend/src/features/emails/email-importance-feedback-dialog.tsx` - Edit-aware copy, feedback snapshot export, success feedback.
- `frontend/src/features/emails/project-emails-workspace.tsx` - Visible feedback state, edit, opposite marking, and revert controls.
- `docs/architecture/PROJECT-MAP.md` - Generated surface inventory refresh for changed email feedback API route.
