# Handoff: Project Manager Role Commitment Access

Task ID: `PM-ROLE-COMMITMENTS-20260730`

Status: Complete

## Confirmed Fault

- Project 1149 is Aviata at Bradenton / 26-127.
- SC-001 exists, is non-private, and was created by Andrew Cannon.
- Andrew is active, his auth/person mapping is correct, and he has an active
  Project Manager project-role assignment.
- Andrew's directory permission template is Project Admin. It has no
  Commitments module rule, and he has no module override or company template.
- Commitment RLS calls `current_has_project_module_permission`, whose deployed
  implementation does not derive module permissions from project roles.

## Owned Paths

- `supabase/migrations/20260731001500_project_manager_role_commitment_access.sql`
- `frontend/src/lib/__tests__/project-manager-role-commitment-access.test.ts`
- `docs/ops/tasks/2026-07-30-project-manager-role-commitments.md`
- `docs/ops/handoffs/2026-07-30-SROOT-project-manager-role-commitments.md`
- Task verification manifest and result JSON.

## Decision

Grant Commitments read/write, but not admin, to active people assigned to the
exact normalized `Project Manager` project role. Explicit per-user module
overrides retain precedence so an intentional denial remains enforceable.

## Verification

- Focused Jest: 1 suite, 4 tests passed.
- Targeted ESLint: passed.
- Transactional production SQL suite: 19 cases and fail-loud assertions passed;
  all fixtures rolled back.
- Independent database and code reviews: approved after correcting the
  cross-module override eligibility guard.
- Migration `20260731001500`: applied and ledger-verified.
- Andrew principal on project 1149: Commitments read true, write true, admin
  false; SC-001 visible.
- No frontend deployment is required because the live database helper owns the
  changed authorization boundary.
