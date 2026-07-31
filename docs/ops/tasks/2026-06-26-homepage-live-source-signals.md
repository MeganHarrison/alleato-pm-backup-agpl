# Task: Homepage Live Source Signals

Status: In Progress
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-710 - https://linear.app/megankharrison/issue/AAI-710/wire-live-source-signals-into-post-login-homepage
Related Handoff: N/A

## Objective

Continue the `/home` action dashboard by replacing placeholder source wiring with deterministic, source-backed homepage signals from existing tasks, projects, collaboration notifications, and AI approval notifications.

## Attention Brief

Primary user: Authenticated Alleato operator returning after login.
Primary job: See what live source already says needs attention and open the right queue.
Primary decision: Whether to handle tasks, AI approvals, unread notifications, or project continuation first.
Tier 1: Dated/open tasks, AI approvals, unread notifications.
Tier 2: Recent movement and resume projects.
Tier 3: Source contract gaps that are explicitly not live yet.
Hide until requested: Notification metadata, provider/debug status, full history, and source internals.
Remove: Pending rows that can be replaced by real collaboration notification data, fake AI brief claims, and extra explanation that does not change the user's next action.
Primary action: Open the highest-priority live source queue.
Failure-loudly behavior: Helper tests fail if unread notifications are not surfaced, AI approval priority regresses, or pending AI brief wording reads as live synthesis.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked and evidence is recorded. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing homepage implementation reviewed.
- [x] Existing notification/task/project source owners reviewed.
- [x] AI SDK guidance reviewed; no new AI SDK/model call is needed for this deterministic source-signal slice.
- [x] Impeccable/Alleato product noise gate reviewed.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [ ] Files/modules to change listed before edits.
- [ ] Homepage signal helper added for deterministic source ranking.
- [ ] Focused helper tests added.
- [ ] Homepage uses live unread notification source data.
- [ ] AI approval priority remains live and reviewable.
- [ ] AI brief synthesis remains explicitly pending until a real source contract exists.
- [ ] No KPI rows, decorative dashboard chrome, or fake intelligence claims added.

## Integration Checklist

- [ ] `/home` still renders under the authenticated main shell.
- [ ] Task/project/notification/approval rows link to canonical surfaces.
- [ ] Empty states remain actionable.
- [ ] Mobile and desktop layouts preserve hierarchy without horizontal overflow.

## Verification Checklist

- [ ] Targeted ESLint run.
- [ ] Focused unit tests run.
- [ ] Browser/user-flow verification run for `/home`.
- [ ] Desktop and mobile screenshot artifacts captured.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear issue | AAI-710 | Passed | Created before implementation. |
| Static/type/lint | Pending | Pending |  |
| Targeted tests | Pending | Pending |  |
| Browser/user-flow | Pending | Pending |  |
| End-to-end proof | Pending | Pending |  |

## Files To Change

- `frontend/src/app/(main)/home/page.tsx` - consume live notification signals and remove replaced pending row.
- `frontend/src/app/(main)/home/homepage-signals.ts` - deterministic source-signal helper.
- `frontend/src/app/(main)/home/__tests__/homepage-signals.test.ts` - helper guardrails.
- `frontend/src/app/(main)/home/__tests__/home-page-contract.test.ts` - source wording guardrail updates.
- `docs/ops/tasks/2026-06-26-homepage-live-source-signals.md` - task ledger and evidence.
- `docs/ops/evidence/homepage-live-source-signals/` - browser proof artifacts.

## Risks / Gaps

- Full AI brief synthesis remains intentionally out of scope until a real homepage brief API contract exists.
- Existing unrelated dirty files are present in the checkout and must not be staged or modified by this task.
- Full project typecheck/build should not run in the main thread unless required; use targeted checks and browser proof here.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
