# Task: Feedback Inbox Publish Cleanup

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-896 - https://linear.app/megankharrison/issue/AAI-896/add-feedback-inbox-category-field-and-filter-support
Related Handoff: N/A

## Objective

Resolve the pre-existing git merge/index conflict on the feedback inbox page, separate the safe feedback-inbox publish slice from unrelated repo dirt, and publish only the task-owned inbox changes to `main`.

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
- [x] Git conflict/index state resolved without reverting unrelated user work.
- [ ] Safe feedback-inbox publish boundary isolated from unrelated staged/unstaged dirt.
- [x] Shared status semantics on `/feedback-inbox` match the route/API/constants/types contract.
- [ ] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI remains aligned with the existing feedback-inbox task files.

## Integration Checklist

- [ ] Existing feedback-inbox task slices (`AAI-895`, `AAI-896`) still compose into one canonical inbox workflow after the conflict resolution.
- [ ] The publish lane uses only task-owned files, not broad dirty-checkout state.
- [ ] Run/task/session ledger records every meaningful attempt.

## Regression Guardrails

- [x] Focused lint/test checks run on the feedback-inbox slice.
- [ ] Publish path fails loudly if unrelated conflicted files are still included.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification preserved from prior task evidence or rerun if semantics changed.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] `frontend/src/app/(admin)/feedback-inbox/page.tsx` is no longer `UU` in the git index.
- [ ] The resolved file keeps the persisted-status mapping for `in_review` -> `resolved` and `verified` -> `closed`.
- [ ] Active/open/in-progress filters exclude `in_review` items from active work queues.
- [ ] A scoped publish candidate can be staged without bundling unrelated meetings/commitments/comments work.
- [ ] If publish is attempted, it succeeds from a clean lane or records the exact blocker.

## Planned Files

- `docs/ops/tasks/2026-07-03-feedback-inbox-publish-cleanup.md`
- `frontend/src/app/(admin)/feedback-inbox/page.tsx`
- Any additional task-owned feedback inbox files required to make the staged slice internally consistent.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Initial repo audit | `git status --short`; `git diff --cached --name-status`; `git diff --name-status` | Pass | Confirmed one unresolved feedback-inbox file plus mixed unrelated staged and unstaged work across multiple features. |
| Conflict delta audit | `git show :2:...page.tsx`; `git show :3:...page.tsx`; `diff -u /tmp/feedback-ours.tsx /tmp/feedback-theirs.tsx` | Pass | Narrow conflict is only feedback status semantics and PATCH persistence mapping. |
| Task linkage | Existing task `docs/ops/tasks/2026-07-02-feedback-inbox-category-field.md` | Pass | Existing blocker already points at the same `UU` file and AAI-896 ownership. |
| Focused lint | `cd frontend && pnpm exec eslint 'src/app/(admin)/feedback-inbox/page.tsx' 'src/app/(admin)/feedback-inbox/constants.ts' 'src/app/(admin)/feedback-inbox/types.ts' 'src/app/api/admin/feedback/route.ts' 'src/app/api/admin/feedback/__tests__/route.test.ts'` | Pass | No lint errors across the page, contract constants/types, and route/test owner files. |
| Targeted route test | `cd frontend && pnpm exec jest 'src/app/api/admin/feedback/__tests__/route.test.ts' --runInBand` | Pass | 4 tests passed, including the category filter assertion and the admin-feedback GET/DELETE paths. |
| Merge resolution decision | Working copy of `frontend/src/app/(admin)/feedback-inbox/page.tsx` | Pass | Kept UI-only `in_review` / `verified` buckets mapped to persisted `resolved` / `closed`, and excluded `in_review` from active/open/in-progress queue filters. |

## Risks / Gaps

- The current checkout contains extensive unrelated dirt, so direct publish from this worktree may remain unsafe even after the feedback-inbox file is resolved.
- Browser verification for `/feedback-inbox` was previously blocked by local admin allowlist rules; this task should not claim new browser proof unless that blocker is removed.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
