# Task: Outlook draft feedback workflow tabs and categories

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-962 - https://linear.app/megankharrison/issue/AAI-962/redesign-outlook-draft-feedback-around-workflow-tabs-and-faster
Related Handoff: N/A

## Objective

Redesign `/outlook-draft-feedback` around the real review workflow so Brandon or the owner can quickly separate inbox-worthy emails from archived noise, focus on emails with AI drafts, and correct categories without drilling through a slow priority-first triage model.

## Attention Brief

Primary user: Brandon or the workspace owner reviewing AI email decisions.
Primary job: Quickly decide what needs review, what already has a draft, and what is safe to archive as no-action noise.
Primary decision: Should this email stay in the active inbox, move into draft review, or live in archived noise, and did the AI assign the right category?
Tier 1: Workflow tab, row status, presence of draft, active category, save path.
Tier 2: AI action, priority, project, owner, reason, and project assignment.
Tier 3: Full email body, detailed rule context, and notes.
Hide until requested: Deep review fields and full draft editing live in the right rail after selection.
Remove: Priority-first top-level tabs as the primary navigation model for this route.
Primary action: Review the right subset of emails quickly, then correct category or draft feedback with minimal friction.
Failure-loudly behavior: Misclassified items remain visible in a deterministic workflow tab, category saves return specific errors, and archived/no-action logic is expressed through explicit tab/filter rules instead of hidden rows.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Acceptance Criteria

- [x] `/outlook-draft-feedback` uses workflow tabs instead of priority tabs.
- [x] `Inbox` excludes emails the AI marked as ignore / no-action noise.
- [x] `Drafts` shows emails with an AI-generated or reviewer-saved draft body.
- [x] `Archived` shows emails the AI marked as ignorable/no-action, including noisy receipt/quarantine/spam-style messages when the AI classified them that way.
- [x] Marking an email `Not important` automatically syncs the AI classification to `ignore` / no-action so it leaves the default inbox and trains future triage.
- [x] Importance feedback controls appear directly below the From/To/Project metadata so training the AI happens before deeper review actions.
- [x] `Feedback Submitted` shows emails that already have saved review or importance feedback so the reviewer can revisit prior corrections.
- [x] Category correction is faster than opening the full review flow just to edit a label.
- [x] AI-provided category remains the default visible suggestion when present.
- [x] The route still uses the canonical shared emails workspace and does not introduce mailbox-write behavior.

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
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
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

## Files Expected To Change

- `docs/ops/tasks/2026-07-06-outlook-draft-feedback-workflow-tabs-and-categories.md`
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx`
- `frontend/src/features/emails/project-emails-workspace.tsx`
- `frontend/src/features/emails/mailbox-workflow-tabs.ts`
- `frontend/src/features/emails/mailbox-priority-tabs.ts`
- `frontend/src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts`
- `frontend/src/features/emails/__tests__/project-emails-workspace.test.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Root cause | Code inspection of `src/app/(main)/[projectId]/emails/emails-client.tsx`, `src/features/emails/project-emails-workspace.tsx`, and the mailbox-tab helper | Pass | The page used assistant priority as the primary top-level filter for Brandon review, while category correction lived deep inside the AI review form. That made the page good at urgency slicing, but poor at workflow review and fast categorization. |
| Static/type/lint | `cd frontend && pnpm eslint 'src/features/emails/project-emails-workspace.tsx' 'src/features/emails/email-importance-feedback-dialog.tsx' 'src/features/emails/mailbox-workflow-tabs.ts' 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts'` | Pass with existing warnings | No task-owned lint errors. Existing design-system warnings remain in `project-emails-workspace.tsx` for pre-existing raw button/date/search usage outside this slice. |
| Targeted tests | `cd frontend && pnpm jest --runInBand --runTestsByPath 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts'` | Pass | 1 suite, 8 tests passed. Covers workflow filter normalization, inbox/drafts/archived/feedback-submitted classification, and query-preserving tab generation. |
| Targeted tests | `cd frontend && pnpm jest 'src/features/emails/__tests__/project-emails-workspace.test.tsx' --runInBand` | Pass | Existing workspace contract tests still pass after the row/category display changes. |
| Browser/user-flow | `agent-browser --session-name alleato-test-3001 open http://localhost:3001/outlook-draft-feedback`; `cd frontend && PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm exec playwright test tests/auth.setup.ts --config=config/playwright/playwright.no-webserver.config.ts --project=setup` | Blocked/Deferred | Local browser verification is blocked by expired saved auth plus a failing auth refresh. The refresh run timed out loading `http://localhost:3001/tasks` inside `frontend/tests/auth.setup.ts`, so authenticated route proof still needs a healthy local auth bootstrap. |
| DB/provider read-back | Source read-back of `src/app/api/email-inbox/[emailId]/assistant-review/route.ts` and `src/app/api/email-inbox/reviewed/route.ts` | Pass | Verified the quick-category path still uses the existing review APIs and does not introduce mailbox mutation behavior. |

## Risks / Gaps

- Exact route-level browser proof may still be limited by owner/Brandon auth access on the protected route.
- Local auth refresh is currently unstable because `frontend/tests/auth.setup.ts` times out verifying `/tasks`, so frontend proof depends on restoring that bootstrap path.
- The archived tab can only be as good as the underlying AI action/category signals; broad spam heuristics are out of scope unless the review surface already has those labels.
- The quick category affordance improves correction speed, but it still persists through the existing review save path rather than a separate category-only API.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
