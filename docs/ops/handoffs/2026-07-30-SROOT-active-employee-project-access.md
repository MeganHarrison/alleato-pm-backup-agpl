# Independent Review: Active Employee Project Access

Task ID: `PM-EMPLOYEE-PROJECT-ACCESS-20260730`

Decision: APPROVED

Reviewed at: 2026-07-31T00:00:54Z

## Reviewer

- `/root/pmrole_db_review`: shared authorization helper, identity and membership
  boundaries, database privileges, migration safety, and transactional tests.

## Root Cause and Resolution

`current_has_project_access(bigint)` accepted only the legacy
`people.person_type = 'user'` value. Andrew Cannon is an active authenticated
internal person correctly classified as `employee`, so the billing-period RLS
policy filtered out the row even though his project membership and permission
template were active.

Migration `20260731010000_allow_active_employee_project_access.sql` recognizes
active `user` and `employee` identities through the existing access-bearing
company-template or active project-membership branches. It continues to deny
contacts, inactive people, inactive memberships, other projects, and templates
without access-bearing rules.

## Approval Evidence

- Focused migration contract: 4 assertions passed; targeted ESLint passed.
- Existing access guardrails: 4 suites and 42 tests passed.
- Candidate and post-apply production transactions: 13 pgTAP assertions and
  7 fail-loud checks passed and were rolled back.
- Production migration ledger: version `20260731010000` applied.
- Andrew-authenticated production readback:
  `current_has_project_access(1149) = true`, the API returned BP-001, and the
  rendered Billing Periods tab displayed the July 2026 row.
- Browser artifact:
  `tests/agent-browser-runs/2026-07-30-active-employee-project-access/andrew-billing-periods-desktop.png`.

The production test session was logged out after verification. No authorization
or release blocker remains.
