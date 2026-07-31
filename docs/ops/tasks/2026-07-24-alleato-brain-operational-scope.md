# Task: Alleato Brain operational scope

Status: In Progress
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-PHASE1B
Linear Issue: ALL-11 (connector unavailable in this session; work remains linked by the existing issue ID)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAIN1B-alleato-brain-operational-scope.md`

## Objective

Add Business Area scope to meetings, tasks, files, and attribution rules, with fail-closed Finance authorization and an exact per-run migration ledger.

## Scope

- `supabase/migrations/20260724061000_add_business_area_operational_scope.sql`
- `scripts/database/verify-alleato-brain-operational-scope.mjs`
- Generated Supabase types and live PM APP schema readback
- Explicitly excludes Phase 2 content relabeling, branch-owner assignment, Finance membership assignment, routing activation, UI release, and cutover

## Source of Truth

- Canonical runtime/data owner: PM APP public schema
- Existing shared primitives/services: `business_areas`, `business_area_memberships`, `business_area_project_map`, `current_is_business_area_member`
- Deprecated or parallel paths: mapped legacy project scope remains comparison-only until cutover

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Meetings, tasks, files, and attribution rules have validated Business Area foreign keys and partial indexes.
- [x] Meetings and attribution rules accept null legacy project scope.
- [x] Every active attribution rule has exactly one typed target.
- [x] Operational tables enforce restricted Business Area access despite permissive legacy policies.
- [x] Migration runs and exact touched records have a durable, admin-only ledger.
- [x] Live readback and a rolled-back negative-path transaction pass.
- [x] Anonymous file reads are revoked and authenticated non-Finance visibility is preserved.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing Business Area authorization primitives are reused.
- [x] Errors are specific and actionable.
- [x] Database and permission contracts are applied and verified.

## Integration and Verification

- [x] Targeted self-test passes.
- [x] Live migration ledger and schema readback pass.
- [x] Rolled-back invalid/valid typed-target proof passes.
- [x] Generated Supabase types reflect the Phase 1B live schema.
- [x] Independent high-risk review approves the change.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `ALLEATO_BRAIN_OPERATIONAL_*` assertion naming the missing schema, policy, constraint, or invalid data count.
- Detection path: `ALLEATO_ENV_FILE=/home/friday/code/project-management/.env node scripts/database/verify-alleato-brain-operational-scope.mjs`
- Recovery path: repair only the named invariant, repeat the verifier and negative path, then re-check the exact migration ledger version.

## Incident Learning

- Failure fingerprint: `security.security-definer-anon-execute`
- Root cause: Legacy operational tables have inconsistent RLS posture, including a permissive public-read files policy.
- Detection gap: The original blueprint did not enumerate effective operational-table policies or model policy-subquery RLS composition before Phase 1B.
- Prevention: Remove anonymous file access, install authenticated restrictive Finance policies, and assert policy roles, commands, modes, ACLs, `WITH CHECK`, and rolled-back RLS behavior.
- Guardrail evidence: live schema readback and rolled-back typed-target negative path

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Live preflight | Supabase Management API schema/policy inventory | Pass | Found 347 meetings and 258 tasks on mapped projects; `files` had a public-read policy; tasks/rules had RLS disabled. |
| First independent review | `independent-review-initial.md` | Needs Rework | Caught an anonymous Finance bypass in the draft before live application; draft was not deployed. |
| Second independent review | `independent-review-second.md` | Needs Rework | Required exact ledger contracts, meeting/task RLS behavior, and removal of an unsupported Phase 2 rollback claim. |
| Third independent review | `independent-review-third.md` | Needs Rework | Required the remaining ledger columns/FK, full enum sets, ledger indexes, and run-header rollback preflight. |
| Final independent review | `independent-review.md` | Approved | Exact PostgreSQL constraint definitions and the complete authorization contract were approved. |
| Migration ledger | `20260724061000` | Pass | Local and Remote ledger entries match. |
| Live schema readback | `database-readback.json` | Pass | Exact schema, policy, ACL, and live data invariants passed. |
| Negative path | `negative-path.md` | Pass | Restricted access, anonymous denial, typed targets, and rollback passed. |
| Bounded typecheck | `regression-test.txt` | Deferred to routing phase | Exposed a project-only API caller that must handle nullable typed targets before routing activation; unrelated pre-existing errors also remain. |

## Remaining Risk

- Phase 2 is approval-gated on named branch owners, exact Finance membership, and owner confirmation of the task disposition. No membership or ownership is inferred.
- Meeting child records still inherit access through their meeting; the new restrictive meeting policy therefore remains the parent authorization boundary.
- Physical DDL reversal is intentionally not automated because it would weaken access controls; the reviewed dormant-schema and run-scoped rollback contract is recorded in `rollback-contract.md`.
- The generated nullable target contract surfaced a project-only attribution-rules API caller. Phase 1B excludes routing activation; Phase 3 must update that caller before any Business Area rule is activated.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] Deferred work has cause, detection gap, prevention step, owner, and next action.
