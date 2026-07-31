# Task: Synchronize Project Team Roles with Product Access

Status: Blocked/Deferred — implementation is live; authenticated visual proof is blocked by unrelated production route allowlists.
Owner: Codex
Created: 2026-07-30
Task ID: project-role-membership-sync
Linear Issue: Not requested; local high-risk access-control repair.
Related Handoff: `docs/ops/handoffs/2026-07-30-SROOT-project-role-membership-sync.md`

## Objective

Assigning an authenticated internal person to a Project Team role automatically creates or reactivates their active project directory membership and visible product access.

## Scope

- Canonical database synchronization between `project_role_members` and `project_directory_memberships`.
- Repair existing internal role assignments that lack active directory memberships.
- Preserve explicitly configured permission templates and keep external contacts roster-only.

## Source of Truth

- Canonical runtime/data owner: `project_role_members` assignment trigger on the database boundary.
- Existing shared primitives/services: `project_roles`, `project_directory_memberships`, project role API route.
- Deprecated or parallel paths: page-local or admin-only manual access synchronization.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Assigning an authenticated employee/user to a project role results in an active directory membership for that project.
- [x] The membership uses an exact project-role template match, an explicitly reviewed project-leadership alias, or least-privilege Read Only fallback.
- [x] Existing explicit permission templates are never overwritten by role synchronization.
- [x] External contacts remain project-roster entries without automatic product access.
- [x] Existing missing internal memberships are repaired.
- [x] Failure-loudly behavior is defined.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared database abstraction owns cross-cutting behavior, including delayed auth links.
- [x] Errors are specific and actionable.
- [x] Database migrations are applied and ledger-verified.

## Integration and Verification

- [x] Targeted database lifecycle checks pass.
- [x] Database readback proves current and future synchronization.
- [ ] Authenticated UI reflects the repaired membership.
- [x] Database evidence artifacts are recorded.
- [ ] Current authenticated UI screenshot is blocked by production access gates.
- [x] Independent review completed.
- [x] Task-owned files are published to `origin/main` through the exact-file Git path; the high-risk task remains deferred only for authenticated visual proof.

## Failure-Loudly Contract

- Cause surfaced as: `PROJECT_ROLE_MEMBERSHIP_TEMPLATE_MISSING` or `PROJECT_ROLE_MEMBERSHIP_READ_ONLY_TEMPLATE_MISSING` if a required permission template is unavailable.
- Detection path: role assignment API response, migration ledger verification, and membership-vs-role readback query.
- Recovery path: restore the required project template, then reapply the role assignment or rerun the scoped repair.

## Incident Learning

- Failure fingerprint: `projects.bootstrap-role-trigger-membership-order` (related lifecycle/role-membership boundary).
- Root cause: Project role assignments persisted independently of the active directory membership that powers RLS and the User Management profile.
- Detection gap: role write verification checked only `project_role_members`, not the downstream project-access record.
- Prevention: database-owned role trigger, delayed-auth-link reconciliation triggers, auto-managed-template ownership, migration backfill, and a dual-table readback.
- Guardrail evidence: migration trigger and post-apply invariant query.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | production role-to-membership readback | Passed | Initially 37 role assignments lacked active memberships; the reported employee had two missing memberships. The repaired invariant is now 33 internal role assignments and 0 missing active memberships. |
| Migration ledger | `supabase_migrations.schema_migrations` | Passed | Versions `20260730224500`, `20260731003000`, `20260731003500`, `20260731004000`, `20260731004500`, and `20260731005000` are applied remotely. |
| Membership lifecycle | rollbacked live `psql` trigger tests | Passed | Creation, loss/restoration of internal status, manual-template preservation, last-role removal, cross-project role move, and roster-only external contacts all passed. |
| Reported assignment readback | production role-to-membership query | Passed | Nexcom Project Manager and Uniqlo Phillipsburg NJ Assistant Project Manager now both have the Project Manager permission template. |
| Authenticated UI screenshot | `verify:browser-auth` and `agent-browser` against production | Blocked | `/user-management` returns `access-denied?reason=admin-dashboard-allowlist`; `/1144/directory` returns `access-denied?reason=no-project-access`, including after a scoped temporary test membership that was removed. |
| Lifecycle completion | `20260731005000_complete_project_role_membership_lifecycle.sql` | Applied | Closes reviewer finding: auto-managed access deactivates when the last role is removed or moved; transaction-local sync context resets before manual administrator edits. |
| Independent review | focused migration-chain review | Passed | No remaining critical/high correctness or security issue. Non-blocking policy note: several remaining roles select the oldest assignment deterministically; explicit privilege precedence is a follow-up product-policy decision. |
| Standard migration verifier | `npm run db:migrations:verify-applied -- supabase/migrations/20260731005000_complete_project_role_membership_lifecycle.sql` | Blocked by unrelated debt | The verifier stops on pre-existing duplicate local version `20260729190000` in `authoritative_schedule_cascade_mutation` and `relax_training_growth_evidence`; direct remote ledger readback confirms this task's six versions are applied. |
| Supabase types | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Blocked | Current CLI credential lacks the Supabase type-generation endpoint privilege; no table/type shape changes are made. |

## Remaining Risk

- The database access contract is live and verified. High-risk visual acceptance remains blocked because the configured production test identity is denied by unrelated User Management and project-route access gates.
- Cause: route-level allowlists reject the available authenticated test identity. Detection gap: no visual-test account currently has both User Management and the repaired project route. Prevention: maintain a designated production-safe admin/project visual-test identity outside this feature's authorization changes.
- Smallest recovery action: use an existing identity already allowed through both gates, then capture final Project Directory and User Management screenshots at this published revision.
- Non-blocking policy follow-up: define a role-to-template precedence rule if multiple Project Team roles on one project must resolve to a particular template after one is removed.

## Final Status

- [ ] All required checklist items are complete (blocked only on authenticated visual proof).
- [x] Database evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred visual proof includes cause, detection gap, prevention step, owner, and next action.
