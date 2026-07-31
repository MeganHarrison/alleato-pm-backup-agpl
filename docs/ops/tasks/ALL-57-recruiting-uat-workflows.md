# Task: Enable Safe Recruiting UAT Workflows

Status: Ready to publish
Owner: SROOT57
Created: 2026-07-31
Task ID: ALL-57
Linear Issue: ALL-57 https://linear.app/alleato-group/issue/ALL-57/enable-safe-uat-workflows-for-guarded-recruiting-features
Related Handoff: `docs/ops/handoffs/2026-07-31-SROOT57-recruiting-uat-workflows.md`

## Objective

Make every currently guarded Applicant Tracker capability actionable in recruiter-only test mode without enabling external delivery or automated employment decisions.

## Scope

- Own the recruiting settings readiness UI, shared UAT action contracts, recruiter-authorized API route, audit persistence, focused tests, and browser evidence.
- Preserve production provider kill switches, Microsoft OAuth requirements, public anonymous intake restrictions, and human approval for employment decisions.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/features/recruiting/ApplicantTrackerWorkspace.tsx` and Supabase recruiting tables
- Existing shared primitives/services: `frontend/src/hooks/use-recruiting/use-production-recruiting-workspace.ts`, `frontend/src/lib/recruiting/production-contracts.ts`, `frontend/src/lib/recruiting/service.ts`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Workflow Brief

Primary user: Recruiting coordinator
Primary job: Exercise guarded recruiting capabilities before production provider approval
Primary decision: Confirm whether each workflow is usable and what should be adjusted
Tier 1 content: Feature readiness, run-test action, evidence-linked result, safety state
Hidden until requested: Technical provider and audit metadata
Remove: Guarded labels for safe UAT-capable features while test mode is active
Primary action: Run test
Failure-loudly behavior: State the missing prerequisite and the exact recovery action; never report a simulated delivery as sent
Canonical owner: Existing Settings readiness list in `ApplicantTrackerWorkspace`

## Acceptance Criteria

- [x] Resume extraction exposes an accurately labeled metadata workflow preview without claiming real file parsing.
- [x] SMS produces an opt-out-bearing no-send template preview and explicitly identifies unexercised consent/sender/quiet-hours checks.
- [x] Offer e-signature produces an auditable synthetic envelope preview without delivery.
- [x] Workflow automation produces an awaiting-human-approval proposal without mutating the pipeline.
- [x] Evidence-linked AI produces a neutral metadata summary and cannot recommend or decide an employment outcome.
- [x] Microsoft email/calendar remain real user-connect flows and are not falsely marked available.
- [x] Every UAT action is recruiter-authorized, bound to the exact synthetic application, auditable, expires with the UAT submission, and cannot contact a real candidate.
- [x] Failure-loudly behavior is observable end to end.
- [x] Relevant existing guardrails are preserved before implementation.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting UAT behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are handled.

Owned modules: recruiting feature UI, recruiting hook/contracts/API, recruiting-focused tests, one additive Supabase migration/test, generated database types, this task/handoff, and task evidence.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Database migration and ledger readback pass.
- [x] Authenticated desktop and mobile flows prove every UAT action.
- [x] Evidence artifacts are recorded.
- [x] Independent code/security review findings are resolved.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a specific API/UI error naming the missing synthetic intake, authorization, configuration, or persistence prerequisite
- Detection path: focused unit/API tests and authenticated `/recruiting?tab=settings` browser run
- Recovery path: upload an approved synthetic PDF, reconnect Microsoft 365 when applicable, or retry the named UAT action

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Auth preflight | `tests/agent-browser-runs/2026-07-31T18-42-34-646Z-all-57-auth-preflight-retry` | Pass | Authenticated recruiting route, screenshot, and session recording captured. |
| Focused tests | Jest and targeted TypeScript/ESLint | Pass | 3 suites, 15 tests; targeted compile and lint passed. |
| Database | Linked migration/query and pgTAP assertions | Pass | Migration ledger, constraints, trigger privileges, and expiry/role-aware RLS read back live. |
| Browser | `tests/agent-browser-runs/2026-07-31-recruiting-uat-workflows` | Pass | Five no-send previews ran; desktop and mobile controls verified; no Guarded labels. |
| Review | Independent code and security reviewers | Pass after remediation | Exact application binding, provenance, concurrency, access, and expiry findings resolved. |

## Remaining Risk

- Live provider delivery remains intentionally unavailable until separate provider credentials, consent, and compliance approval are verified.

## Final Status

- [x] All required checklist items are complete except publication readback.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
