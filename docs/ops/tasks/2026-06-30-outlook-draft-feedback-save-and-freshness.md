# Task: Outlook draft feedback save and freshness

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-770 - https://linear.app/megankharrison/issue/AAI-770/make-outlook-draft-feedback-panel-inline-editable
Related Handoff: N/A

## Objective

Fix `/outlook-draft-feedback` so Brandon review responses persist on first click, the visible panel refreshes from the saved row, and the mailbox review surface makes reviewed vs unreviewed state easier to distinguish while polling often enough to feel live.

## Attention Brief

Primary user: Brandon or the workspace owner reviewing AI email decisions.
Primary job: Mark the AI decision as correct or incorrect, adjust the draft or project assignment, and see that saved state immediately.
Primary decision: What should the assistant learn from this email, and has that feedback actually been stored yet?
Tier 1: Review verdict, review outcome, draft body, saved status, reviewed-vs-unreviewed row state, and latest mailbox rows.
Tier 2: AI action, priority, category, owner, reason, and project assignment context.
Tier 3: Full email body and supporting rule/evidence context.
Hide until requested: None for this slice.
Remove: Ambiguous "saved" appearance caused by stale selected-row state and indistinguishable review badges.
Primary action: Save review feedback with immediate visible confirmation.
Failure-loudly behavior: Save failures keep local edits visible, return a specific API error, and do not silently revert the review panel to stale values.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Acceptance Criteria

- [x] First-time saves from the right feedback panel persist the selected action and priority instead of the stale row defaults.
- [x] After a successful save, the selected email panel reflects the latest saved assistant review without requiring the user to reselect the row.
- [x] `/outlook-draft-feedback` refreshes mailbox review rows automatically on a short interval suitable for near-real-time review visibility.
- [x] The inbox/list surface clearly differentiates reviewed rows, draft-reviewed rows, and untouched rows without adding dashboard noise.
- [x] Save failures keep unsaved edits visible and show a specific error toast/state.
- [x] The route remains sandbox-only for generated drafts; no accidental mailbox mutation path is introduced here.

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
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Root cause | Code inspection of `src/features/emails/project-emails-workspace.tsx`, `src/hooks/use-emails.ts`, `src/app/api/email-inbox/[emailId]/draft-reply/route.ts`, and `src/app/api/emails/route.ts` | Pass | First-save POST used stale `selectedEmail.assistant_action` / `assistant_priority` instead of current form state; selected email was held in local state and not reconciled after refetch; mailbox query had no polling; sandbox draft route only generates text and does not write Outlook drafts. |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/hooks/use-emails.ts' 'src/app/(main)/[projectId]/emails/emails-client.tsx' 'src/app/(main)/[projectId]/emails/emails-client.helpers.ts' 'src/features/emails/project-emails-workspace.tsx' 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts'` | Pass with existing warnings | No task-owned lint errors. Existing warnings remain in `project-emails-workspace.tsx` for a raw button, raw date input, and raw search input outside this slice. |
| Targeted tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts'` | Pass | 6 tests passed, including new guardrails for mailbox-review polling and selected-row reconciliation after refetch. |
| Browser/user-flow | `agent-browser open 'https://projects.alleatogroup.com/outlook-draft-feedback' && agent-browser wait --load networkidle && agent-browser get url` | Blocked/Deferred | Exact production route redirected to `https://projects.alleatogroup.com/access-denied?reason=admin-dashboard-allowlist` from this session, so live page interaction was not reachable for proof. |
| DB/provider read-back | Source read-back of `src/app/api/email-inbox/[emailId]/draft-reply/route.ts` and mailbox mutation guard references in `backend/src/services/agents/microsoft_executive_assistant/tools.py` | Pass | Verified the review route still uses sandbox draft generation only; no new Outlook-write path was added in this slice. Mailbox mutations remain guarded separately by `MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED`. |

## Files Expected To Change

- `docs/ops/tasks/2026-06-30-outlook-draft-feedback-save-and-freshness.md`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.helpers.ts`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/hooks/use-emails.ts`
- `frontend/src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts`

## Risks / Gaps

- Exact browser proof is blocked in this session by the production admin allowlist redirect on `/outlook-draft-feedback`.
- The route still does not create real Outlook drafts by design; if mailbox-write behavior is desired, that is a separate product/safety change from this persistence/freshness fix.
- Live mailbox freshness is now short-interval polling in the shared client, not a push subscription. If sub-15-second updates are required, that needs a dedicated realtime design.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
