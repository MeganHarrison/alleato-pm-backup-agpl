# Handoff: 2026-07-22 - ALL-5 Schedule Phase 4C

## Intake Block

1) Session ID: S219
2) Task ID: ALL-5
3) Linear issue: ALL-5 - Build Phase 4A schedule resources, assignments, and allocation
4) Linear URL: https://linear.app/alleato-group/issue/ALL-5/build-phase-4a-schedule-resources-assignments-and-allocation
5) Current status: Published to `origin/main` at feature tip `e9dab24e3` - implementation, three live migrations, focused checks, rollback probes, and independent code/database/React reviews completed with no release blockers; authenticated E2E remains environment-blocked.
6) Files changed: enterprise/hourly scheduling engine and services; seven guarded APIs; canonical schedule UI; Gantt split rendering; generated types; three migrations; tests and evidence.
7) Commands/outcomes: seven Jest suites/33 tests passed; focused Phase 4C type graph has no task-owned errors; focused lint has no task-owned errors; changed-route and unsafe-pattern checks passed; linked Supabase readback and rollback-only mutation probes passed. Fresh full-tree TypeScript remains baseline-blocked outside this scope.
8) Evidence artifacts: `rollback-probes.sql`, `hardening-readback.sql`, `release-boundary-readback.sql`, and `trusted-boundary-rollback-probe.sql` under `docs/ops/evidence/2026-07-22-schedule-enterprise-hourly-splits-leveling/`.
9) Top findings: browser-authored leveling was replaced with an authoritative server snapshot and service-only persistence boundary; shared-person revisions are row-locked across projects; dependency lead/lag uses project working time; task state is derived from segments; undo is version guarded; event references are tenant-bound; enterprise calendars are app-admin managed.
10) Next action: run authenticated desktop/mobile smoke coverage when a configured local or deployed runtime is available.
11) Handoff path: `docs/ops/handoffs/2026-07-22-S219-schedule-enterprise-hourly-splits-leveling.md`
12) Migration ledger evidence: linked ledger contains `20260722205432`, `20260723001040`, and `20260723013000`; release-boundary readback returned direct-create revoked, wrapper granted, migration applied, and three event project FKs.

## Verification Contract

- Test-first RED/GREEN checkpoints for enterprise reservations, hourly intervals, segment gaps, atomic apply, stale conflict, and compensating undo.
- Supabase migration generation/application, generated-type agreement, explicit grants/RLS, fixed-search-path functions, immutable audit rows, and negative/concurrency probes.
- Focused application checks plus authenticated desktop/mobile browser proof on the canonical schedule route.
- Independent code, database, and React review before publication.
