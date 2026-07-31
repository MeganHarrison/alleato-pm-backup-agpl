# Independent Review: Project Manager Commitment Permissions

Task ID: `PM-PERMISSIONS-20260729`

Decision: APPROVED

Reviewed at: 2026-07-30T01:54:12Z

## Reviewers

- `/root/billing_review`: frontend access resolver, project layout and guard,
  portfolio route, and regression tests.
- `/root/billing_db_review`: permission migration, commitment and SOV RLS,
  rollback behavior, and policy assertions.

## Findings Resolved Before Approval

1. Corrected the PostgREST embedded company-template filter to target the
   selected `template` relationship alias and its scope field.
2. Required an active `people` row before project-role or company-template
   access can authorize a project.
3. Required the portfolio identity lookup to inner-join an active person before
   company-wide access can return every project.
4. Replaced membership-only commitment SOV authorization with Commitments
   `read` for SELECT and `write` for INSERT, UPDATE, and DELETE, while preserving
   the separate prime-contract membership branch.

## Approval Evidence

- Focused Jest validation: 3 suites, 38 tests, all passing.
- Targeted ESLint: no findings.
- Production migration ledger: `20260730023000` and `20260730024500` applied.
- Production RLS readback: all 12 commitment parent/SOV policies enforce the
  module-permission helper.
- Authenticated Kebba-principal readback on Nexcom project 1144:
  Commitments read, write, and private visibility all `true`.
- Production-wide access audit: 2,826 of 2,826 eligible person/project pairs
  passed across 33 people and 91 projects, with no missing auth links.
- Active Project Manager audit: all 10 assignments across 7 people passed
  project access plus Commitments read and write.
- Latest-main reconciliation: focused validation passed 3 suites and 40 tests;
  the migration test now normalizes Windows line endings.
- Production deployment:
  canonical GitHub-main deployment `dpl_F9vpvyvhKcQnpWP4UeCkVtzZw3NP` is
  `READY` and owns `projects.alleatogroup.com`.
- Authenticated Andrew proof:
  BP-001 is visible as 1 row, Commitments shows 2 rows, and the Subcontract
  form opens with its Create Subcontract button and no permission error.

No database or frontend blocker remains. The temporary Andrew verification
session was revoked after the live checks.
