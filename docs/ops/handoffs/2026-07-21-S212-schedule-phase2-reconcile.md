# Handoff: 2026-07-21 - Schedule Phase 2 Reconciliation

## Intake Block

1) Session ID: S212
2) Task ID: LOCAL-2026-07-21-SCHEDULE-PHASE2-RECONCILE
3) Linear issue: Unavailable; no Linear read/write tool is exposed in this session.
4) Linear URL: Unavailable
5) Task file: `docs/ops/tasks/2026-07-21-schedule-phase2-reconcile.md`
6) Current status: Pending Review; implementation, database reconciliation, exact-file publication, exact-revision deployment, independent review, and authenticated browser proof are complete.
7) Files changed: canonical calendar API/type/page/dialog/tests; dependency API/service/editor/tests; impact-preview tests; immutable applied migration source; guarded forward cleanup and dependency-boundary migrations; Windows type generator; generated database types/FK map; task/control-plane docs.
8) Commands run: Supabase migration preflight/apply/ledger/readback; latest-main fetch; clean canonical checkout bootstrap; S212/S212B/S212C path-scoped writer claims; focused RED/GREEN Jest; live typegen/check; changed-file type/security/route/lint guards; independent security/failure-mode review and remediation.
9) Evidence artifacts: verification manifest/result, approved independent re-review, and authenticated production screenshot are complete.
10) Top findings: current main already owns the canonical project calendar, impact preview, audit, and revision paths; dependency calculations already supported all four negative-lead relationship types; the live dependency table needed project-scoped RLS, bounded lag, and cycle enforcement; failed calendar loads needed a fail-closed edit state.
11) Recommended next action: leader acceptance, then begin the next scheduling slice from the canonical calendar and governed dependency boundary.
12) Migration ledger evidence: `20260721210000`, forward cleanup `20260722020000`, and boundary hardening `20260722021500` are applied and recorded; canonical calendar row count remains one, duplicate objects are absent, dependency/exception rows remain 0/0, and the dependency RLS/check/trigger boundary is live.
13) Verification contract: `docs/ops/verification/schedule-phase2-manifest.json`
14) Verification result: `docs/ops/verification/schedule-phase2-result.json`

## Current Status

The Supabase login is working. The first local migration was applied before a filtered recent-ledger inspection exposed newer canonical calendar migrations. The guarded forward migration removed only those empty duplicate objects, preserving the canonical project-calendar row. A second forward migration now governs direct dependency access through project-scoped RLS, enforces bounded lag and acyclic relationships, and hardens calendar reason/count validation. The canonical API/dialog round-trip optional exception reasons, fail closed on calendar load/save errors, and predecessor APIs/editors accept bounded lead/lag values from -365 through 365. Five focused suites pass 32 tests, schema/type readback passes, all 24 feature blobs match `origin/main`, Vercel deployed exact commit `08d0469f0`, and the authenticated production Calendar dialog accepted the optional reason without saving test data.

## Failure Analysis

- Cause: stale checkout plus truncated broad migration-list output.
- Detection gap: no filtered overlap check before the single-file apply.
- Prevention: require latest-main synchronization and named object/migration overlap queries before any future linked migration apply.
- Recovery: preserve the deployed migration unchanged, add a forward migration that refuses cleanup if duplicate rows exist, and keep the canonical calendar as the only runtime owner.

## Exact Next Step

Leader review and acceptance. For the next Microsoft Project-parity slice, use a seeded non-production project for dependency-editor browser proof; project 1144 had zero schedule tasks, so this phase deliberately relied on the 32 focused tests instead of creating live evidence data.
