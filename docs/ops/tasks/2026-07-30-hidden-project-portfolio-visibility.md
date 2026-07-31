# Task: Hide retained projects from employee portfolio

Status: Blocked/Deferred — runtime screenshot evidence
Owner: Megan Harrison
Created: 2026-07-30
Task ID: hidden-project-portfolio-visibility
Linear Issue: Not required — direct owner request, single session
Related Handoff: `docs/ops/handoffs/2026-07-30-S019fb0d0-hidden-project-portfolio-visibility.md`

## Objective

Keep the selected projects active and available to their retained AI/data links while removing them from the employee-facing portfolio; Megan alone can still see them there.

## Scope

- `GET /api/projects` portfolio visibility rule for `phase = 'Hidden'`.
- Restore the selected live records and set their phase to `Hidden`.
- Preserve `archived = false`, project IDs, memberships, linked documents, transcripts, insights, and AI retrieval scope.
- Exclude three named records from the restoration and phase update.

## Source of Truth

- Canonical runtime/data owner: `public.projects` and `frontend/src/app/api/projects/route.ts`.
- Existing shared primitives/services: `frontend/src/lib/auth/owner.ts`, `resolveVisibleProjectIdsForUser`.
- Exception workspace: the canonical checkout was unavailable for a safe publish because `main` had 10 local-only commits, 97 newer remote commits, and 199 unrelated dirty paths. This worktree starts from current `origin/main` and owns only this task's paths.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Eight selected projects are active, have no archive metadata, and use `phase = 'Hidden'`.
- [x] Champaign Ace Addition, Uturum Aut, and Vargo Greenwood Permitting remain unchanged.
- [x] The portfolio API excludes Hidden projects for every employee and Brandon's owner account.
- [x] Megan's owner account can still retrieve Hidden projects from the portfolio API.
- [x] Existing AI/data access is not gated by the portfolio-only visibility rule.
- [x] Failure-loudly behavior is defined.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting visibility behavior.
- [x] API tests cover hidden and allowed owner paths.
- [x] Database restoration has exact readback.

## Integration and Verification

- [x] Targeted route tests pass.
- [x] API response contract is checked for the owner and a non-owner identity.
- [ ] Current project-page screenshot is captured after publication. Blocked: every available saved owner browser session redirects to `/auth/login`.
- [x] Database, deployment, test, and independent-review evidence artifacts are recorded.
- [x] Visibility guard is published to `origin/main`; the evidence closeout follows in this task's exact-file commit.

## Failure-Loudly Contract

- Cause surfaced as: authenticated callers receive no Hidden projects unless their owner identity is explicitly allowed.
- Detection path: focused API contract tests and authenticated production API readback.
- Recovery path: remove the `Hidden` phase from the project record to return it to the normal portfolio; route tests prevent accidental broadening.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The canonical portfolio API filtered archived and development records but had no phase-based visibility boundary.
- Detection gap: Phase was assumed to hide a project even though the canonical API returned every active phase.
- Prevention: Add an explicit owner-only Hidden-phase API contract with regression tests.
- Guardrail evidence: `frontend/src/app/api/projects/__tests__/route.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Production `/api/projects` with expired saved auth state | Recorded | Endpoint correctly rejected expired authentication; database evidence and route contract identified the canonical visibility boundary. |
| API contract | `pnpm exec jest --runInBand --runTestsByPath src/app/api/projects/__tests__/route.test.ts` | Pass | 24 tests; employees and Brandon exclude Hidden, Megan retains access. |
| Static check | `pnpm exec eslint src/app/api/projects/route.ts src/app/api/projects/__tests__/route.test.ts src/lib/auth/owner.ts` | Pass | No targeted lint findings. |
| Production release | Vercel deployment `dpl_6TSPgDtkJexbka3N63BUAVSdCZoa` | Pass | Ready from `main` commit `a5ac6af1fc7bae67e5ba8e79be4cf551d6bba195`. |
| Database readback | `docs/ops/evidence/2026-07-30-hidden-project-portfolio-visibility/verification.md` | Pass | Exactly eight records are `Hidden`, active, and clear of archive metadata; exclusions match their preflight state. |
| Independent review | `docs/ops/evidence/2026-07-30-hidden-project-portfolio-visibility/independent-review.md` | Approved | Separate reviewer confirmed the portfolio-only rule and no AI/data-scope regression. |

## Remaining Risk

- The authenticated owner screenshot is deferred: current saved sessions redirect to `/auth/login`, and no safe credential-backed refresh is available in this session. The database and release outcomes are complete, but this High-risk task remains `Blocked/Deferred` until that final screenshot is captured.

## Final Status

- [ ] All required checklist items are complete. Deferred only for the authenticated screenshot.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work records cause, detection gap, prevention step, owner, and next action.
