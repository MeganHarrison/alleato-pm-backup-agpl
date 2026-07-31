# Handoff: Alleato Brain operational scope

Date: 2026-07-24
Session: SBRAIN1B
Task: ALL-11-PHASE1B
Delivery lane: High-risk
Status: In Progress

## Owned paths

- `supabase/migrations/20260724061000_add_business_area_operational_scope.sql`
- `scripts/database/verify-alleato-brain-operational-scope.mjs`
- `frontend/src/types/database.types.ts`
- `docs/ops/tasks/2026-07-24-alleato-brain-operational-scope.md`
- `docs/ops/evidence/2026-07-24-alleato-brain-operational-scope/`
- This handoff

## Acceptance contract

- Validated operational Business Area foreign keys and indexes
- Nullable legacy project target where required
- Exactly one typed target for active attribution rules
- Restrictive Finance authorization on meetings, tasks, and files
- Durable per-run and per-record migration ledger
- Live readback, negative path, migration ledger proof, and independent review

## Work completed

- Live type generation and schema preflight completed before database code.
- Existing RLS and mapped operational counts inspected.
- Migration, verifier, task, verification manifest, and handoff drafted.
- Initial independent review rejected the draft because a `PUBLIC` restrictive policy could not see RLS-hidden Business Area rows for anonymous callers.
- Anonymous file reads are now removed; the verifier contract is expanded to exact policy/ACL/index/constraint and transactional RLS behavior.
- A second review required exact ledger definitions and behavioral meeting/task RLS fixtures; both are now included, and the Phase 2 rollback overclaim was removed.
- A third review required the remaining ledger columns/FK, full allowed-value sets, both ledger indexes, and run-header rollback preflight; all are now explicit.
- The final exact-contract review approved the migration and verifier.
- Migration `20260724061000` was applied to PM APP and recorded in the remote ledger.
- Live schema, ACL, RLS, invariant, and rolled-back negative-path probes passed.
- Live Supabase types were regenerated; the unrelated legacy `prospects` type is retained as an explicit compatibility contract because the live generator omits it while active routes still compile against it.

## Current evidence

- Preflight observed 347 meetings, 258 tasks, and 57 attribution rules on mapped projects; mapped `public.files` rows are zero.
- `files` had a permissive public-read policy.
- `tasks` and `project_attribution_rules` had RLS disabled.
- The first draft was never applied; the live transactional dry run was rolled back before the review finding.
- Post-migration readback found zero invalid typed targets, zero orphan Business Area scopes, and zero mapped-scope mismatches.
- The negative authorization transaction passed and rolled back.

## Migration ledger evidence

`Supabase migration ledger check passed: 20260724061000`

## Blockers and deferred gates

- Phase 2 requires owner-provided branch owners, exact Finance membership, and confirmation of task disposition. This Phase 1B schema task does not invent those assignments.

## Next actions

1. Publish the live migration source, verifier, generated types, and evidence.
2. In Phase 3, update the attribution-rules API to handle Business Area-only rules and nullable project targets before routing activation.
