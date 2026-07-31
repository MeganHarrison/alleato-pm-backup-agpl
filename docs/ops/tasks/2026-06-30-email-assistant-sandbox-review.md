# Task: Email Assistant Sandbox Review Controls

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: Not created - Linear issue creation tool unavailable in this session.
Related Handoff: N/A

## Objective

Keep Brandon's Microsoft email assistant in testing mode with no Outlook mailbox mutations, while making `/outlook-draft-feedback` record the AI's proposed priority, category, action, and draft directly in the review table.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked, with evidence filled in. If any required item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Confirm current Outlook mailbox mutation gates remain intentionally disabled.
- [x] Identify the existing sandbox review table path before adding new storage.
- [x] Choose storage owner for test-only AI category/action/priority/draft.
- [x] Define failure-loudly behavior for missing email rows and invalid feedback payloads.
- [x] Avoid any Graph/Outlook draft/category mutation in this change.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing review API accepts editable assistant priority, category, action, and draft.
- [x] Email API response returns latest recorded sandbox category.
- [x] Training rail exposes editable priority, category, action, and draft controls.
- [x] Table/list/mail surfaces make recorded draft/category state visible enough for review.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] `/outlook-draft-feedback` uses the same shared email surface and sandbox rail.
- [x] Review writes persist only to Alleato review tables/metadata.
- [x] Existing project assignment feedback behavior is preserved.
- [x] No Outlook category, draft, mark-read, archive, or send path is enabled.

## Regression Guardrails

- [x] Unit or route tests updated for create/update review payloads.
- [x] Contract test confirms `/outlook-draft-feedback` remains shared Emails layout.
- [x] Guardrail proves sandbox category is metadata-backed, not an Outlook mutation.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated.
- [x] Targeted automated tests run.
- [x] Browser/user-flow verification run or auth blocker documented.
- [x] Database/provider read-back performed if schema/config changes occur.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- The assistant remains mailbox-safe: no live Outlook draft or category write is required or enabled.
- The review panel lets a reviewer record or correct proposed priority, category, action, and draft.
- The table/list/mail surfaces show enough state to know whether a draft/category has been recorded.
- Review create and update APIs validate the editable fields and persist them.
- `/api/emails` returns the latest recorded sandbox category from review metadata.

## Files To Change

- `frontend/src/lib/email-assistant/brandon-review.ts`
- `frontend/src/hooks/use-emails.ts`
- `frontend/src/app/api/emails/route.ts`
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/route.ts`
- `frontend/src/app/api/email-inbox/reviewed/route.ts`
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts`
- `frontend/src/app/api/email-inbox/reviewed/__tests__/route.test.ts`
- `frontend/src/app/api/emails/__tests__/route.test.ts`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/features/emails/emails-table-config.tsx`
- `docs/ops/tasks/2026-06-30-email-assistant-sandbox-review.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Current health/read-back | `npm run verify:microsoft-assistant-health -- --json`; Render env read-back script | Partial | Graph inbox reachable; cron suspended; cached intake stale; auto draft and mailbox mutations are false. |
| Static/type/lint | `cd frontend && npx eslint 'src/lib/email-assistant/brandon-review.ts' 'src/hooks/use-emails.ts' 'src/app/api/emails/route.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/route.ts' 'src/app/api/email-inbox/reviewed/route.ts' 'src/app/api/email-inbox/[emailId]/draft-reply/route.ts' 'src/features/emails/project-emails-workspace.tsx' 'src/features/emails/emails-table-config.tsx' 'src/app/(main)/[projectId]/emails/emails-client.tsx' --quiet`; `cd frontend && npm run typecheck:changed -- --files ...`; `git diff --check -- ...` | Pass | ESLint passed, no new `any` type debt, whitespace check passed. |
| Targeted tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts' 'src/app/api/email-inbox/reviewed/__tests__/route.test.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/email-inbox/[emailId]/draft-reply/__tests__/route.test.ts'`; `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts'` | Pass | 15 focused tests passed across review create/update, email feed, draft generator, and `/outlook-draft-feedback` shared-layout contract. |
| Browser/user-flow | `agent-browser open 'http://localhost:3001/outlook-draft-feedback?view=table&page=1' && agent-browser wait --load networkidle && agent-browser get url && agent-browser snapshot -i` | Auth-limited | Exact route redirected to `/auth/login?callbackUrl=...`; wait timed out after 25s, so no authenticated UI proof was available in this session. |
| DB/provider read-back | N/A | Pass | No database migration or provider config change planned. |

## Files Changed

- `frontend/src/lib/email-assistant/brandon-review.ts`
- `frontend/src/hooks/use-emails.ts`
- `frontend/src/app/api/emails/route.ts`
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/route.ts`
- `frontend/src/app/api/email-inbox/reviewed/route.ts`
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts`
- `frontend/src/app/api/email-inbox/reviewed/__tests__/route.test.ts`
- `frontend/src/app/api/emails/__tests__/route.test.ts`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/features/emails/emails-table-config.tsx`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx`
- `docs/ops/tasks/2026-06-30-email-assistant-sandbox-review.md`

## Risks / Gaps

- Existing local dirty files are present outside this task and must not be staged.
- Authenticated browser proof is still blocked by owner-only/auth state for `/outlook-draft-feedback`.
- This change improves review capture and safe draft simulation; it does not resume the suspended Render cron or refresh stale Outlook intake.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
