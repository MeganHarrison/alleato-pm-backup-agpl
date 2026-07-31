# Task: Project Manager Role Commitment Access

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: PM-ROLE-COMMITMENTS-20260730
Linear Issue: Not used; this is a direct production permission correction requested by Brandon.
Related Handoff: `docs/ops/handoffs/2026-07-30-SROOT-project-manager-role-commitments.md`

## Objective

An active employee assigned to a project's `Project Manager` role can read and
create Commitments on that project even when the attached permission template
does not independently grant the Commitments module.

## Scope

- Add Project Manager project-role membership as an explicit source of
  Commitments read and write authorization.
- Preserve explicit per-user module overrides ahead of the role grant.
- Do not grant Commitments admin or private-record visibility from the role.
- Do not change other project roles or permission modules.

## Source of Truth

- Canonical runtime/data owner:
  `public.current_has_project_module_permission` and commitment RLS policies.
- Existing shared primitives/services:
  `supabase/migrations/20260722173000_atomic_ai_prime_contract_sov_edits.sql`,
  `supabase/migrations/20260730023000_project_manager_commitments_and_access.sql`.
- Deprecated or parallel paths: None.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Active Project Manager role members receive Commitments read and write.
- [x] Explicit per-user module overrides retain precedence.
- [x] The role does not grant Commitments admin or private-record visibility.
- [x] Other project roles receive no new Commitments access.
- [x] Inactive people receive no access from stale role assignments.
- [x] Andrew Cannon can read SC-001 on project 1149 after production rollout.
- [x] Andrew's live Commitments write authorization returns true.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: migration contract exception or false live role permission.
- Detection path: focused Jest migration contract plus authenticated Andrew RPC/read.
- Recovery path: apply a forward migration restoring the previous helper body;
  do not edit the applied migration.

## Incident Learning

- Failure fingerprint: `auth.project-access-source-drift`
- Root cause: Project-role membership authorized the project shell but was absent
  from the database module-permission helper used by Commitments RLS.
- Detection gap: Existing coverage proved role-based project entry and
  template-based Commitments permissions separately, but not their combined RLS
  behavior.
- Prevention: Keep role-derived Commitments access in the shared database
  permission helper and verify it with a focused migration contract and live
  affected-principal readback.
- Guardrail evidence: Focused Jest contract, 19-case transactional production
  SQL suite with fail-loud assertions, affected-principal verification, and two
  independent approvals.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | High-risk acceptance and rollback gates recorded. |
| Live fault localization | PM App production readback | Confirmed red | Andrew is active and assigned Project Manager role; SC-001 exists, but his effective Commitments read/write are false. |
| Red regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/__tests__/project-manager-role-commitment-access.test.ts` | Expected fail | Four tests failed before the migration existed. |
| Focused Jest | Same command after implementation | Pass | 1 suite, 4 tests. |
| Targeted ESLint | `npm.cmd exec -- eslint src/lib/__tests__/project-manager-role-commitment-access.test.ts` | Pass | No findings. |
| Pre-apply database contract | Management API transaction containing migration plus SQL test and rollback | Pass | All fail-loud authorization assertions executed without persisting fixtures. |
| Independent review | `pmrole_code_review` and `pmrole_db_review` | Approved | Cross-module override gap was found, fixed, retested, and approved. |
| Production migration | Management API exact migration transaction | Pass | Version `20260731001500` applied and recorded atomically. |
| Migration ledger | `npm.cmd run db:migrations:verify-applied -- supabase/migrations/20260731001500_project_manager_role_commitment_access.sql` | Pass | Exact local/remote version confirmed. |
| Production SQL suite | Management API execution of `supabase/tests/project_manager_role_commitment_access.sql` | Pass | 19 checks plus fail-loud assertions; transaction rolled back. |
| Andrew principal readback | Temporary Andrew auth session against PM App PostgREST/RPC | Pass | Project 1149: read true, write true, admin false, one visible row, SC-001 visible. Temporary session locally revoked. |
| Supabase CLI test runner | `npm.cmd exec -- supabase test db --linked supabase/tests/project_manager_role_commitment_access.sql` | Environment blocked | Docker Desktop unavailable; the same SQL suite passed through the authenticated production database API. |

## Remaining Risk

- Andrew may need to refresh the Commitments page so the browser issues a new
  query. No frontend deployment is required.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
