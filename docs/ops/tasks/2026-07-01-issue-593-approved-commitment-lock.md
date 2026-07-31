# Task: Approved commitment edit lock for GitHub issue 593

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-841 - https://linear.app/megankharrison/issue/AAI-841/status-is-approved-i-shouldnt-be-able-to-come-in-here-and-edit-items

## Objective

Ensure approved commitments cannot be edited until the user changes the status
away from Approved, then push the fix to `main` and close GitHub issue `#593`.

## Scope Checklist

- [x] Confirm the current `main` branch still exposes the bug and identify every bypass path.
- [x] Hide or disable commitment detail edit affordances when the record is Approved, while keeping the status control available.
- [x] Block the direct commitment `/edit` route with a loud approved-lock message.
- [x] Reject approved commitment non-status mutations in the commitment API.
- [x] Reject approved commitment SOV import attempts in the line-item import API.
- [x] Add regression tests for the approved-lock API guardrails.
- [x] Run focused verification and record command evidence.
- [x] Push the fix to `origin/main`.
- [x] Close GitHub issue `#593` with accurate evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| `main` state | `git rev-parse HEAD && git rev-parse origin/main` | Pass | Both resolved to `b395134a59755342a7b4eed957de044d0d81e6e2` before the fix work started. |
| Bug still present on `main` | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx`, `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx`, `frontend/src/app/api/commitments/[commitmentId]/route.ts`, `frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/route.ts` | Pass | Detail page still shows Edit, `/edit` still renders, and API/import routes do not enforce an approved lock. |
| Detail-page lock | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx` | Pass | Approved commitments now hide the header Edit action, keep status editable, and render other inline fields read-only. |
| Direct edit-route lock | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx` | Pass | Approved commitments now render a clear locked-state `ErrorState` instructing the user to move the record back to Draft first. |
| API mutation guardrail | `frontend/src/app/api/commitments/[commitmentId]/route.ts`, `frontend/src/app/api/commitments/[commitmentId]/__tests__/route.test.ts` | Pass | `PUT`/`PATCH` now reject non-status edits on approved commitments with `PRECONDITION_FAILED`; status-only updates still succeed. |
| SOV import guardrail | `frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/route.ts`, `frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/__tests__/route.test.ts` | Pass | Budget-line import now rejects approved commitments before any inserts run. |
| Focused lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx' 'src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx' 'src/app/api/commitments/[commitmentId]/route.ts' 'src/app/api/commitments/[commitmentId]/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/route.ts' 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/__tests__/route.test.ts' --no-warn-ignored` | Pass with warnings | No errors; warnings are pre-existing design-system and `no-explicit-any` debt outside this task’s delta. |
| Focused route tests | `./node_modules/.bin/jest --runInBand --runTestsByPath '/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/commitments/[commitmentId]/__tests__/route.test.ts' '/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/__tests__/route.test.ts'` | Pass | 4 tests passed, covering approved-lock mutation and import guardrails. |
| Live route access check | `agent-browser open 'https://projects.alleatogroup.com/876/commitments/a0d9d40d-37c5-4739-872e-e5412cbc785b' && agent-browser wait 5000 && agent-browser get title` | Blocked | Browser session redirected to `/auth/login`, so authenticated route proof was not available in this session. |
| Frontend typecheck | `./node_modules/.bin/tsc --noEmit --pretty false` | Blocked | The frontend typecheck OOMed the default Node heap after ~66s; a rerun with an 8 GB heap did not complete within the interactive budget and was stopped to keep the task moving. |
| Push to `main` | `npm run codex:finish -- --message "Lock approved commitment edits" --staged-only` | Pass | Published the task-owned files to `origin/main` at `b77c0a1ca4`. |
| Issue closeout | `gh issue view 593 --repo MeganHarrison/alleato-pm --json state,closed,closedAt,url` and `gh issue comment 593 --repo MeganHarrison/alleato-pm --body ...` | Pass | Issue `#593` is closed and now has an accurate closeout comment documenting commit `b77c0a1ca4`. |

## Risks / Gaps

- `docs/tasks/TASK-TEMPLATE.md` exists in this checkout, but the active task file convention in `docs/ops/tasks/` uses the local format already established in adjacent task files.
- The checkout contains unrelated dirty files. Finish flow must stage only task-owned files.
- Authenticated browser proof is still blocked by the current browser session redirecting to login.
- Full frontend typecheck remains expensive in this checkout and exceeded the interactive verification budget.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Final response includes what is done, what remains, and recommended next steps.
