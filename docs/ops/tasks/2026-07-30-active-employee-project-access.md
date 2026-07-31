# Task: Active Employee Project Access

Status: Complete
Owner: SROOT-BILLPERIOD-0730
Created: 2026-07-30
Task ID: PM-EMPLOYEE-PROJECT-ACCESS-20260730
Linear Issue: Connector not used; the production incident was reported directly in this task.
Related Handoff: `docs/ops/handoffs/2026-07-30-SROOT-active-employee-project-access.md`

## Objective

An active authenticated employee with an active, access-bearing project directory
membership can read project-scoped rows protected by
`current_has_project_access`, including billing periods.

## Scope

- Replace the shared `current_has_project_access(bigint)` helper through a new
  forward-only migration.
- Verify the project boundary with transactional fixtures and Andrew Cannon's
  production session on project 1149.
- Do not broaden access to contacts, inactive people, inactive memberships,
  other projects, or permission templates with no access-bearing rule.
- Do not change billing-period UI or create/update/delete behavior.

## Source of Truth

- Canonical runtime/data owner: PM Supabase project `lgveqfnpkxvzbnnwuled`
- Existing shared primitive: `public.current_has_project_access(bigint)`
- Affected policy: `billing_periods` SELECT policy
- Affected route: `/1149/invoices?tab=billing-periods`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Andrew's authenticated production API response contains BP-001 for project 1149.
- [x] Andrew's rendered Billing Periods tab displays the July 2026 row.
- [x] Active `employee` and legacy `user` identities remain eligible for template-backed project access.
- [x] Contacts, inactive people, inactive memberships, other projects, and access-empty templates remain denied.
- [x] The helper remains `SECURITY DEFINER`, has a fixed search path, is executable by `authenticated` and `service_role`, and is not executable by `anon`.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails were identified before implementation.
- [x] Legacy or duplicate paths are explicitly excluded.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns the cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] The database permission contract is handled.

Owned files:

- `supabase/migrations/20260731010000_allow_active_employee_project_access.sql`
- `supabase/tests/active_employee_project_access.sql`
- `frontend/src/lib/__tests__/active-employee-project-access.test.ts`
- `docs/ops/tasks/2026-07-30-active-employee-project-access.md`
- `docs/ops/handoffs/2026-07-30-SROOT-active-employee-project-access.md`
- `docs/ops/tasks/2026-07-30-active-employee-project-access.verification-manifest.json`
- `docs/ops/tasks/2026-07-30-active-employee-project-access.verification-result.json`
- `tests/agent-browser-runs/2026-07-30-active-employee-project-access/andrew-billing-periods-desktop.png`

## Integration and Verification

- [x] Targeted static/unit checks pass.
- [x] Transactional database authorization tests pass.
- [x] Andrew-specific production API and browser readback pass.
- [x] Independent authorization review approves the release.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated worktree changes were excluded from all task-owned checks and publication.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a migration assertion or transactional authorization test
  fails when the helper omits either active employee eligibility or a negative
  access boundary.
- Detection path: focused Jest contract, production transaction, migration
  ledger readback, Andrew-authenticated API response, and rendered route.
- Recovery path: publish a new forward migration restoring the last verified
  helper definition; never edit the deployed migration.

## Incident Learning

- Failure fingerprint: `auth.project-access-source-drift`
- Root cause: `current_has_project_access` accepted only `person_type = 'user'`,
  while current internal employees are validly classified as `employee`.
- Detection gap: existing access tests exercised legacy `user` identities but
  did not cover an active employee through the database RLS helper.
- Prevention: treat `user` and `employee` as the internal authenticated identity
  set at the shared helper and retain direct RLS coverage for both positive and
  negative principal states.
- Guardrail evidence: `supabase/tests/active_employee_project_access.sql` and
  `frontend/src/lib/__tests__/active-employee-project-access.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production DB row | Service-role read of `billing_periods` for project 1149 | PASS | BP-001 exists for 2026-07-01 through 2026-07-31. |
| Andrew browser repro | `/1149/invoices?tab=billing-periods` | RED | Fresh API response was `200 {"data":[]}` and the page showed 0 rows. |
| Boundary localization | Andrew RPC `current_has_project_access(1149)` | RED | Returned `false`; the active employee has active Project Manager and Project Admin assignments. |
| Static regression before fix | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/__tests__/active-employee-project-access.test.ts` | RED | Four assertions failed because the corrective migration did not yet exist. |
| Database regression before fix | Production transaction running `supabase/tests/active_employee_project_access.sql` | RED | Failed loudly with `Active employee project access is false; employee identity support regressed`. |
| Candidate database authorization | Candidate migration plus pgTAP suite in a rolled-back production transaction | PASS | 13 assertions and 7 fail-loud checks passed without committing the candidate transaction. |
| Focused static verification | Focused Jest contract plus targeted ESLint | PASS | 4 of 4 assertions passed; ESLint reported no findings. |
| Existing access guardrails | Focused Jest paths for project access, auth guard, and project API | PASS | 4 suites and 42 tests passed. |
| Production migration | Migration ledger and `db:migrations:verify-applied` for `20260731010000` | PASS | `allow_active_employee_project_access` is applied. The earlier `003000` candidate was never applied after a remote version collision was detected. |
| Post-apply database authorization | Exact production pgTAP suite in a rolled-back transaction | PASS | 13 assertions and 7 fail-loud checks passed after deployment. |
| Andrew production access | Andrew-authenticated RPC and billing-period API | PASS | `current_has_project_access(1149)` returned `true`; the API returned BP-001. |
| Andrew rendered page | `tests/agent-browser-runs/2026-07-30-active-employee-project-access/andrew-billing-periods-desktop.png` | PASS | The Billing Periods tab displayed 1 row: BP-001, July 1-31, 2026, due July 31, status open. |
| Independent authorization review | `/root/pmrole_db_review` | APPROVED | Approved both access branches, identity and membership boundaries, fixed search path, grants, and fail-loud coverage. |

## Remaining Risk

- None identified for the requested read-access correction. The change only
  recognizes active internal `employee` identities that already hold an active,
  access-bearing membership or template; it does not grant access from a
  project role alone.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No task-owned work is deferred.
