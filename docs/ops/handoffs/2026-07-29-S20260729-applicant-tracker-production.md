# Applicant Tracker Production Handoff

Status: Production Active - UAT Pending
Session: S20260729-ATSBUILD
Linear parent: ALL-42
Updated: 2026-07-29

## Objective

Execute the approved Applicant Tracker production roadmap through all milestone
boundaries, keeping external providers disabled until their live configuration
and consent requirements are verified.

## Ownership

- `frontend/src/app/(main)/recruiting/**`
- `frontend/src/features/recruiting/**`
- `frontend/src/hooks/use-recruiting/**`
- `frontend/src/lib/recruiting/**`
- `frontend/src/app/api/recruiting/**`
- `frontend/tests/e2e/recruiting-production.spec.ts`
- recruiting migrations and pgTAP test listed in the active checkout lease
- this handoff and the ALL-42 task file

## Current State

- Competitive research completed.
- Implementation roadmap approved by Brandon.
- Linear project renamed to `Applicant Tracker`.
- Milestones M0-M8 and issues ALL-42 through ALL-50 created.
- M0 defaults recorded in the task file.
- Production recruiting schemas, RLS policies, private-file policies, workflow
  contracts, governance tables, and guarded APIs are implemented locally.
- `/recruiting` now uses the all-phases workspace. Development defaults to an
  explicitly labeled synthetic preview; production defaults to shared data.
- External provider delivery, destructive retention, public uploads, and
  employment AI remain disabled until persisted verification gates pass.
- Independent review found high-risk authorization/integrity defects; all were
  corrected, and both the code and security re-reviews returned PASS.
- All three foundation migrations and the forward-only offer RLS hotfix are
  applied to PM APP and present in the remote migration ledger.
- Brandon is provisioned as `recruiting_admin`; Jazmin is provisioned as
  `recruiter`.
- Canonical production desktop and mobile E2E pass against shared data without
  creating applicant records.

## Confirmed Constraints

- Current worktree contains extensive unrelated CRM, scheduling, and WebViewer
  changes. Do not stage, format, revert, or regenerate broad paths.
- Recruiting paths were clean at claim time.
- Shared permission/navigation files already contain unrelated modifications and
  are not in this session's lease. Recruiting authorization must remain
  recruiting-owned until those owners release the shared files or integration
  can be performed without overlap.
- Microsoft Graph helpers exist, but recruiting sender/organizer ownership and
  live send reconciliation require recruiting-specific persistence.
- SMS, e-signature, job-board, and AI integrations must fail closed when
  unconfigured.

## Remaining Release Actions

1. Collect Jazmin's UAT feedback and acceptance.
2. Apply and verify provider credentials, permissions, callbacks, sender
   ownership, and consent before enabling any external integration.

## Evidence Log

| Time | Action | Result |
| --- | --- | --- |
| 2026-07-29 | Checkout lease | Acquired for exact recruiting-owned paths |
| 2026-07-29 | Linear project/milestones/issues | Created and sequenced |
| 2026-07-29 | Focused recruiting Jest | 3 suites, 8 tests passed |
| 2026-07-29 | Focused recruiting ESLint | Passed with no errors |
| 2026-07-29 | Independent code review | Four high and three medium findings returned |
| 2026-07-29 | High-risk review corrections | Approval RLS, audited state changes, transactional idempotency, and aggregate links corrected |
| 2026-07-29 | Final code and security re-review | PASS; no remaining critical or high blockers |
| 2026-07-29 | Focused recruiting Jest | 2 suites, 6 tests passed after final hardening |
| 2026-07-29 | Focused recruiting ESLint | No errors; one feature-owned page-shell warning |
| 2026-07-29 | Changed-type guard | No new `any` debt |
| 2026-07-29 | SQLFluff migration parse | All three migrations parsed with large-file parsing enabled |
| 2026-07-29 | Authenticated Playwright E2E | 3 tests passed across desktop and mobile |
| 2026-07-29 | Final screenshots | `tests/agent-browser-runs/2026-07-29-applicant-tracker-release/` |
| 2026-07-29 | Production migration activation | Exact versions `20260729130000`, `20260729131000`, and `20260729132000` applied and ledger-verified |
| 2026-07-29 | Remote pgTAP | 61/61 passed after fixture correction |
| 2026-07-29 | Offer RLS production diagnosis | Authenticated offer read exposed policy recursion before any applicant records existed |
| 2026-07-29 | Forward-only offer RLS hotfix | `20260729182500` applied, ledger-verified, and independently approved by code and security reviewers |
| 2026-07-29 | Role provisioning | Brandon `recruiting_admin`; Jazmin `recruiter`; unauthorized-user readback returned no recruiting settings |
| 2026-07-29 | Canonical production E2E | 2/2 passed at `https://projects.alleatogroup.com/recruiting`; desktop/mobile screenshots captured |
| 2026-07-29 | Generated database types | Regenerated from live PM APP after all recruiting migrations |
