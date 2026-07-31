# Task: Complete the Training Resource Finder In-App Trigger

Status: Done
Owner: Codex S235
Created: 2026-07-26
Task ID: ALL-23
Linear Issue: ALL-23 — https://linear.app/alleato-group/issue/ALL-23
Related Handoff: `docs/ops/handoffs/2026-07-26-S235-training-resource-finder-trigger.md`

## Objective

Allow an authenticated app administrator to run the existing role/topic training
resource finder from the canonical Training review page and immediately review
the candidates it creates.

## Scope

- Add a backend admin endpoint that calls the canonical training finder with
  review-candidate writes enabled.
- Add one compact role/topic action to `/training/review`, using the existing
  reviewer gate, Select/Button primitives, and review queue.
- Add focused backend, boundary, action, and page tests plus production browser
  evidence.
- Preserve the accepted weekly Render cron and finder eligibility policy.
- Exclude learner-page controls, new finder logic, schema changes, and a second
  review queue.

## Source of Truth

- Canonical runtime/data owner: `backend/src/services/training/finder.py` and
  `create_training_review_candidate`
- Existing shared primitives/services:
  `frontend/src/lib/training/reviewer-access.ts`,
  `frontend/src/components/ui/select.tsx`,
  `frontend/src/components/ui/button.tsx`,
  `frontend/src/lib/guardrails/dependency.ts`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] An app admin can choose an active role and topic on `/training/review`.
- [x] Submitting the action calls the canonical finder with `dryRun=false`.
- [x] New eligible resources enter the existing `review` queue; learner content
  remains unchanged until a reviewer publishes it.
- [x] Non-admin callers fail before the backend finder runs.
- [x] Backend calls require the configured admin API key.
- [x] Completed, zero-result, partial, and failed runs surface specific outcomes.
- [x] The existing weekly finder and relevance tests remain green.
- [x] Production desktop and mobile proof covers the trigger and refreshed queue.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled.

Owned files:

- `backend/src/api/admin_endpoints.py`
- `backend/tests/test_training_resource_finder_admin_endpoint.py`
- `frontend/src/app/(main)/training/review/**`
- `frontend/src/lib/training/admin-finder.ts`
- `frontend/src/lib/training/__tests__/admin-finder.test.ts`
- This task, handoff, evidence, generated maps, and scoped orchestration closeout files.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review approves the implementation and evidence.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an inline review-page status with the backend operation's
  specific auth, configuration, provider, validation, partial-write, or request ID
  context.
- Detection path: focused tests, backend HTTP response, browser status region,
  Render logs, and review-queue readback.
- Recovery path: correct the selected role/topic or named configuration/provider
  failure, then retry from `/training/review`; already-created candidates remain
  review-only and deduplicated.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: ALL-23 was closed against an issue description that labeled the
  in-app trigger optional, while the approved project specification required both
  the weekly schedule and an admin-only trigger.
- Detection gap: final QA checked issue states and automatable tests but did not
  trace every approved specification acceptance item to a production user action.
- Prevention: bind ALL-23 and ALL-25 closeout to an authenticated production
  browser proof of the admin trigger and retain focused contract tests for both
  authorization layers.
- Guardrail evidence: verification contract, independent review, and exact
  production route evidence are required before the issue returns to Done.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Acceptance and failure contracts captured before edits. |
| Linear kickoff | ALL-23 kickoff comment | Pass | Issue reopened to In Progress for the specification gap. |
| Backend boundary | `pytest backend/tests/test_training_resource_finder_admin_endpoint.py backend/tests/test_training_resource_finder.py -q` | Pass | 19 tests cover auth, HTTP serialization, fixed caps, request IDs, finder policy, writes, and failure contracts. |
| Frontend boundary | Focused Jest suites for admin helper, reviewer access, form, action, and page | Pass | 5 suites / 17 tests. |
| Static checks | Targeted ESLint, `npm run check:routes`, `git diff --check`, `python3 -m py_compile` | Pass | No scoped failures. |
| Broader training Jest | `pnpm exec jest --runInBand --testPathPatterns='training'` | Partial | 24 suites / 103 tests passed; unrelated `task-training-service.test.ts` failed on the existing AI-package ESM transform boundary. |
| Full frontend typecheck | `npm run typecheck` | Unrelated failure | Existing errors remain in daily briefs, admin feedback/observability, AI assistant, executive, progress reports, submittals, and tasks; no S235 training path appeared. |
| Production deployment | Vercel `dpl_HUnTyqP6WRvXt82T6xMpGvybQT1S`; Render protected-route probe | Pass | Exact product commit `ad7a151539b3195b2b91d7dee106e144c61ce675`; Vercel Ready; Render returned 401 for an intentionally invalid key. |
| Authenticated production flow | `all-23-production-readback.json` | Pass | Queue moved 26 → 28; two Project Manager / Procurement candidates entered review; neither appeared on `/training`; controlled retry returned two duplicates and six ineligible results. |
| Responsive visual proof | `all-23-review-desktop-after.png`, `all-23-review-mobile-after.png` | Pass | Finder and queue usable at 1440×1000 and 375×812 with no horizontal overflow. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ... --require-pass` | Pass | Strict contract accepted the declared evidence. |
| Independent review | `all-23-independent-review.md` | Approved | No remaining P0–P2 product issues; deployment-transition artifact is not a release blocker. |

## Remaining Risk

- External search quality and provider availability; bounded by the existing
  eligibility policy, per-run caps, review-only writes, deduplication, explicit
  partial status, and human publication gate.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
