# Task: Recruiting Batch Intake and Resume Review

Status: Complete
Owner: SROOT44
Created: 2026-07-30
Task ID: ALL-44
Linear Issue: ALL-44 https://linear.app/alleato-group/issue/ALL-44/m2-requisitions-and-applicant-intake
Related Handoff: `docs/ops/handoffs/2026-07-30-SROOT-recruiting-batch-intake.md`

## Objective

Allow a recruiting coordinator to upload a batch of resumes into a guarded
unassigned inbox, view each original resume, assign candidates to requisitions,
and record Not Qualified outcomes with an audit trail.

## Scope

- Private resume upload, viewing, batch status, unassigned intake, requisition assignment, and Not Qualified outcome.
- Approved synthetic files remain the only uploadable UAT files until malware-scanner readiness is verified.
- External email, scheduling, SMS, offer delivery, and AI hiring decisions are excluded.

## Source of Truth

- Canonical runtime/data owner: Supabase recruiting schema and `frontend/src/lib/recruiting/service.ts`
- Existing shared primitives/services: `ApplicantTrackerWorkspace`, recruiting production contracts, private recruiting-resumes storage
- Deprecated or parallel paths: local prototype workspace is not a production write path

Delivery lane: High-risk

Verification contract: Required

## Workflow Brief

Primary user: Recruiting coordinator
Primary job: Triage uploaded resumes and assign viable candidates to positions
Primary decision: Which requisition and pipeline outcome owns each candidate
Tier 1 content: Original resume, candidate identity, upload status, assigned position, outcome
Hidden until requested: Candidate detail and original document viewer
Remove: Duplicate summary widgets and decorative upload panels
Primary action: Upload resumes
Failure-loudly behavior: Each rejected file or assignment reports a specific cause and recovery action
Canonical owner: `frontend/src/features/recruiting/ApplicantTrackerWorkspace.tsx`

## Acceptance Criteria

- [x] Recruiters can select multiple approved resumes and see per-file results.
- [x] Unassigned uploads appear in a dedicated inbox before a requisition is chosen.
- [x] Recruiters can assign an inbox candidate to an open requisition exactly once.
- [x] Authorized recruiters can open the original resume through a short-lived signed URL.
- [x] Not Qualified is visible in pipeline actions and preserves reason, actor, and audit history.
- [x] Real files fail closed unless upload and scanner readiness settings are both verified.
- [x] Duplicate and partial batch failures do not silently discard successful items.
- [x] UAT records remain bounded, purgeable, and unable to reach offers or hiring.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared intake module owns upload validation and assignment invariants.
- [x] Errors are specific and actionable.
- [x] RLS, storage authorization, idempotency, and audit contracts are enforced.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Database smoke proves unassigned intake, assignment, and Not Qualified.
- [x] Authenticated desktop and mobile screenshots prove the final route.
- [x] Independent review is recorded.
- [x] Migration ledger and production release evidence are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Per-file validation, scanner-readiness, authorization, duplicate, and assignment errors
- Detection path: UI batch result rows, API request ID, database smoke, and audit event
- Recovery path: Correct the named file/permission/configuration and retry only the failed item

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Linear kickoff | ALL-44 comment fdb1a78b-2012-4c9a-a68b-79a062297573 | Passed | Scope and safety stop condition recorded. |
| Authenticated preflight | `tests/agent-browser-runs/2026-07-30T20-25-28-048Z-recruiting-batch-intake-auth-preflight/VERIFICATION_SUMMARY.md` | Passed | Required second retry succeeded before source changes. |
| Live migration | `npx supabase db query --linked --file supabase/migrations/20260730210000_recruiting_batch_intake.sql` | Passed | Exact task migration applied; ledger version repaired to applied. |
| Database smoke | `npx supabase db query --linked --file supabase/tests/recruiting_batch_intake.sql` | Passed | Transaction rolled back after unassigned, assignment, resume-link, Not Qualified, and forbidden-outcome checks. |
| Focused tests | Recruiting contracts, intake controls, storage recovery, command retry, and workspace component suites | Passed | 5 suites, 28 tests. |
| Desktop visual | `tests/agent-browser-runs/2026-07-30-recruiting-batch-intake-final/desktop-resume-inbox.png`, `desktop-not-qualified.png` | Passed | Per-file batch results, unassigned inbox, assignment, inline original viewer, and audited Not Qualified verified. |
| Mobile visual | `tests/agent-browser-runs/2026-07-30-recruiting-batch-intake-final/mobile-resume-inbox.png` | Passed | 390x844; no document-level horizontal overflow. |
| Final flow record | `tests/agent-browser-runs/2026-07-30-recruiting-batch-intake-final/VERIFICATION_SUMMARY.md`, `actions.log`, `database-readback.md`, `f63711c81e085fd67f5da6839961933d.webm` | Passed | Final-revision evidence includes RPC-only disposition and cleanup readback. |
| Independent verification | `docs/ops/tasks/2026-07-30-all-44-recruiting-batch-intake-independent-review.md`, verification manifest/result | Passed | No findings; strict contract validator passed for ALL-44. |
| Typecheck scope | Full frontend TypeScript invocation | Partial | Process exited 134 on existing repository-wide load; filtered output contained no recruiting-path errors. |

## Remaining Risk

- Real resume intake cannot be enabled until a malware scanner is configured and verified.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
