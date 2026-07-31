# Task: Outlook draft feedback inline edit

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-770 - https://linear.app/megankharrison/issue/AAI-770/make-outlook-draft-feedback-panel-inline-editable
Related Handoff: N/A

## Objective

Make `/outlook-draft-feedback` use the exact shared Emails page layout while making the right rail a Brandon training panel for AI categorization, draft feedback, rules/evidence, and project assignment correction.

## Attention Brief

Primary user: Brandon reviewing prior AI draft decisions.
Primary job: Review what the AI decided, correct the review outcome, feedback note, draft text, and project assignment without leaving the selected email.
Primary decision: What should the assistant learn or change for this email/draft?
Tier 1: AI categorization, rules/evidence, editable review outcome, feedback note, draft body, project assignment correctness, and save state.
Tier 2: Original email subject, sender, received date, current project assignment, assistant owner/risk/reason, and feedback-saved marker.
Tier 3: Full email body and Outlook link.
Hide until requested: None for this slice.
Remove: Inbox-specific draft feedback layout for this route and static-only feedback display in the right panel.
Primary action: Save feedback changes inline.
Failure-loudly behavior: Failed saves keep edits visible and show a specific error toast/state; the API returns auth/not-found/validation errors instead of silent success.

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

- [x] On `/outlook-draft-feedback`, selecting an email shows the shared Emails mail layout with a right rail for AI categorization, rules/evidence, draft body, feedback note/outcome, and project assignment feedback.
- [x] Saving writes to the canonical `outlook_email_assistant_reviews` row and refreshes the shared email feed without losing the selected email.
- [x] Empty draft or note values save as `null`, not placeholder text.
- [x] Save failures leave the unsaved edits visible and show a specific failure state.
- [x] Non-admin users can only edit their own mailbox review rows; admins can edit Brandon review rows.
- [x] Brandon can mark the project assignment correct or incorrect; incorrect feedback can set the corrected project or clear it to unassigned.
- [x] Feedback rows identify that feedback was provided.
- [x] `/outlook-draft-feedback` uses the same shared Emails mail layout as `/emails?view=mail`, not the inbox-specific training queue layout.
- [x] The panel remains quiet: no duplicate CTAs, no stat cards, no nested cards, no decorative helper panel.
- [x] Left email list and right feedback rails in mail view are collapsible and resizable with persisted widths.
- [x] List/table view right panel opens wider for feedback mode and uses the same AI training panel.
- [x] Right feedback panel uses tighter spacing and multi-column rows where width allows.
- [x] Mail rail rows are condensed with sender name and email on one line.
- [x] Emails with assistant drafts are visibly marked in mail/list/card rows.
- [x] AI priority is surfaced with a compact color dot in mail/list/card rows.
- [x] Rules Applied shows actual matched triage rules, with email excerpt moved under Evidence.

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

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint 'src/features/emails/project-emails-workspace.tsx' 'src/app/(main)/[projectId]/emails/emails-client.tsx' 'src/app/(admin)/outlook-draft-feedback/page.tsx' 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts' 'src/app/api/emails/route.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/email-inbox/reviewed/route.ts' 'src/app/api/email-inbox/reviewed/__tests__/route.test.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/route.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts' 'src/lib/email-assistant/brandon-review.ts' 'src/hooks/use-emails.ts'`; latest rules pass: `npx eslint 'src/lib/email-assistant/brandon-triage.ts' 'src/app/api/emails/route.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/hooks/use-emails.ts' 'src/features/emails/project-emails-workspace.tsx'`; `npm run typecheck:changed -- --files ...`; `git diff --check -- ...` | Pass | ESLint has no errors. Remaining warnings are existing shared/page-shell/table warnings: raw button/date/search inside `project-emails-workspace.tsx`, existing email status-column editability warning, and `require-page-shell` for the raw shared Emails route wrapper. No new `any` debt and no whitespace errors. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/email-inbox/reviewed/__tests__/route.test.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts'`; latest rules pass: `npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/emails/__tests__/route.test.ts' 'src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts'` | Pass | Latest rules pass: 2 suites, 6 tests passed. Tests cover shared Emails layout routing, Brandon mailbox scoping, non-admin mailbox blocking, assistant review metadata and rule labels on shared email rows, and route access contract. |
| Browser/user-flow     | `agent-browser open 'http://localhost:3001/outlook-draft-feedback?view=mail&page=1' && agent-browser snapshot -i`; `agent-browser open 'http://localhost:3001/outlook-draft-feedback?view=list&page=1' && agent-browser snapshot -i`; Playwright with `frontend/config/.auth/user.json` | Blocked/Deferred | agent-browser session redirects to `/access-denied?reason=owner-only` or `/auth/login?callbackUrl=...`; saved Playwright auth state redirected to login. Artifact from earlier blocked attempt: `.codex-artifacts/outlook-draft-feedback-inline-edit.png`. |
| DB/provider read-back | Checked `frontend/src/types/database.types.ts` after attempted Supabase type refresh | Partial | Checked-in types include `outlook_email_assistant_reviews.draft_body`, `reviewer_note`, `review_outcome`, `mailbox_user_id`, and `updated_at`. `npx supabase gen types ...` exited nonzero with only deprecated `[inbucket]` config warning and temporarily truncated the type file; restored the generated type file from `HEAD`. No schema or migration change was made. |
| End-to-end proof      | Same browser attempts as above | Blocked/Deferred | Cannot prove the visible right-panel save flow until a local browser session is authenticated as owner or `bclymer@alleatogroup.com`. API route behavior is covered by targeted tests. |

## Files Changed

- `docs/ops/tasks/2026-06-30-outlook-draft-feedback-inline-edit.md` - task done gate and evidence ledger.
- `frontend/src/features/emails/inbox/email-inbox-client.tsx` - earlier reviewed email right-panel inline editing retained for the legacy reviewed queue path.
- `frontend/src/features/emails/inbox/email-list-panel.tsx` - earlier feedback-saved row marker retained for the legacy reviewed queue path.
- `frontend/src/app/api/email-inbox/reviewed/route.ts` - reviewed rows include editable draft body and update support.
- `frontend/src/app/api/email-inbox/reviewed/__tests__/route.test.ts` - guard read/update behavior.
- `frontend/src/app/(admin)/outlook-draft-feedback/page.tsx` - route feedback page through the shared Emails layout.
- `frontend/src/app/(admin)/outlook-draft-feedback/__tests__/access-contract.test.ts` - fail if the page regresses to the inbox-specific layout.
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx` - support optional global mailbox scoping, enable the training rail for that route, and widen/rekey the list/table feedback side panel.
- `frontend/src/features/emails/project-emails-workspace.tsx` - shared Emails right rail now renders AI categorization, rules/evidence, editable draft, feedback, and project assignment training controls when feedback mode is enabled; mail view left and right columns are collapsible/resizable with persisted widths.
- `frontend/src/features/emails/emails-table-config.tsx` - list/card rows show priority dots, draft markers, and condensed sender name/email metadata.
- `frontend/src/hooks/use-emails.ts` - pass optional mailbox scope through the global Emails query and type assistant review metadata on email rows.
- `frontend/src/app/api/emails/route.ts` - enforce mailbox-scoped global email reads and enrich live Outlook rows with AI categorization plus latest assistant review feedback.
- `frontend/src/app/api/emails/__tests__/route.test.ts` - guard Brandon mailbox scope, non-admin cross-mailbox denial, and assistant review metadata enrichment.
- `frontend/src/lib/email-assistant/brandon-triage.ts` - expose explicit matched triage rule labels for the feedback panel.
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/route.ts` - new review creation records feedback markers and project assignment correction metadata.
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts` - guard new feedback creation and incorrect project correction metadata.
- `frontend/src/lib/email-assistant/brandon-review.ts` - shared schema for project assignment feedback on assistant reviews.

## Risks / Gaps

- Browser proof is blocked by unavailable owner/Brandon local auth. Detection gap: the current agent-browser session is authenticated as a disallowed user, and the saved Playwright auth state is stale. Prevention step: refresh a local owner or Brandon auth fixture before future exact-route visual checks.
- Latest browser automation still redirects to `/access-denied?reason=owner-only`; the user-visible in-app browser session appears separately authenticated and should refresh `http://localhost:3001/outlook-draft-feedback?view=mail&page=1` to pick up the shared Emails layout and training rail.
- Latest width-specific browser automation for `http://localhost:3001/outlook-draft-feedback?view=list&page=1` redirects to `/auth/login?callbackUrl=%2Foutlook-draft-feedback%3Fview%3Dlist%26page%3D1`, so exact visual proof of the wider/collapsible rails remains blocked by local auth.
- Targeted ESLint reports an existing warning in `frontend/src/features/emails/inbox/email-list-panel.tsx` about `ExpandingSearch`; this task did not introduce that search component.
- There are pre-existing unrelated dirty files in `frontend/src/features/knowledge/__tests__/knowledge-base-page.test.tsx` and `frontend/src/features/knowledge/knowledge-base-page.tsx`; they were not touched for this task.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
