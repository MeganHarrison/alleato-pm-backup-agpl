# Task: Canonical Financial Workflow Verification

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-14
Task ID: QA-FINANCIAL-2026-07-14
Linear Issue: QA execution task; no product change requested.
Related Handoff: N/A — evidence is recorded in this task and the verification result.

## Objective

Verify the highest-risk financial user journey across the frontend, API, persistence, reload, calculations, and failure paths.

## Scope

- Project 876 financial workflow: budget, prime contract/SOV, commitment, change management, and invoicing.
- Explicit exclusion: unrelated staged or untracked worktree changes and destructive cleanup of existing project data.

## Source of Truth

- Canonical frontend journey: `AGENTS.md` Canonical User Journey Test Chain.
- Existing regression suites: `frontend/tests/e2e/project`, `frontend/tests/e2e/budget`, `frontend/tests/e2e/prime-contracts`, `frontend/tests/e2e/commitments`, `frontend/tests/e2e/change-events`, `frontend/tests/e2e/change-orders`, `frontend/tests/e2e/invoices`.
- Browser evidence sink: `tests/agent-browser-runs/2026-07-14-financial-workflow/`.

Verification contract: Required

## Acceptance Criteria

- [x] Every reachable journey step has a PASS, BLOCKED, or INCONCLUSIVE result with evidence.
- [x] Financial totals are reconciled against a database/API readback where a write is exercised. No write was exercised; no write claim is made.
- [x] Reload persistence and a safe negative-path attempt are recorded; negative validation remains unproven because the creation control was not actionable.
- [x] Independent evidence review is recorded before any PASS claim. Review approved the honesty of the INCONCLUSIVE disposition; no overall PASS is claimed.

## Integration and Verification

- [x] Authenticated browser journey is complete for read paths; write path is blocked.
- [x] Targeted regression test attempted; exact auth setup blocker recorded.
- [x] Evidence artifacts are recorded in `scripts/verification/fixtures/evidence/` and the browser evidence sink.
- [x] Unrelated worktree changes remain untouched.

## Failure-Loudly Contract

- Cause surfaced as: exact route, control, API response, or persisted value that diverges.
- Detection path: agent-browser snapshot/screenshot, browser console/network evidence, and readback command.
- Recovery path: stop at the first failing boundary; do not continue downstream and call the workflow passing.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: financial workflow QA has historically been split across page-level checks rather than one cross-layer journey.
- Detection gap: no single evidence packet proves that each downstream consumer receives the upstream financial record.
- Prevention: manifest-bound flow claims, database/readback evidence, reload proof, negative-path checks, and independent review.
- Guardrail evidence: pending this run.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope captured before the journey run. |
| Browser journey | `scripts/verification/fixtures/evidence/financial-workflow-summary.md` | INCONCLUSIVE | Change Events creation did not open; Change Orders exposed an orphan-looking PCO while Change Events showed zero rows. |
| Regression | `scripts/verification/fixtures/evidence/financial-workflow-regression.txt` | BLOCKED | Auth setup timed out navigating to `/tasks` after 60 seconds. |
| Contract result | `scripts/verification/fixtures/financial-workflow-result.json` | INCONCLUSIVE | Required evidence keys are present; no end-to-end PASS claim is made. |
| Independent review | `scripts/verification/fixtures/evidence/financial-workflow-independent-review.md` | APPROVED_FOR_INCONCLUSIVE | Independent reviewer approved the non-pass disposition, not a PASS claim. |

## Remaining Risk

- Change Events → Change Orders lineage is unresolved and may reflect stale/orphaned seeded data or a broken list/create query.
- The authenticated Playwright setup timed out on `/tasks`; this must be localized before regression coverage can be trusted.
- Database write/readback and required-field validation remain unproven because the creation control was not actionable.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action in the evidence summary.

## Deferred work

- Cause: Change Events creation did not become actionable and the downstream PCO lineage does not reconcile.
- Detection gap: route-level load checks do not prove cross-surface record lineage or creation affordances.
- Prevention: add an API/database-backed create-and-readback test and an orphan-lineage guard.
- Owner: financial workflow implementation owner.
- Next action: localize the Change Events route/API boundary and `/tasks` auth setup timeout, then rerun this manifest.
