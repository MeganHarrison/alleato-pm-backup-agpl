# Task: Backend Project Intelligence projection consolidation

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1250
Linear Issue: [AAI-1250](https://linear.app/megankharrison/issue/AAI-1250/unify-backend-project-intelligence-scheduled-projection-jobs)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-backend-project-intelligence-projection-consolidation.md`

## Objective

Give backend Project Intelligence projections one explicit package owner and one scheduled executable, while preserving the independently scheduled domain and project-sweep policies.

## Scope

- Move domain packet, communication extraction, and rolling current-state projection implementations into `backend/src/services/project_intelligence/projections/`.
- Replace the standalone root-style script and module self-execution with `backend/src/services/project_intelligence/runner.py`, the only backend scheduled executable for these projections.
- Keep two Render schedules because their cadence and workload contracts differ; both must invoke the same runner with an explicit projection mode.
- Delete all former functional paths in the same change. Do not retain wrappers or compatibility modules.
- Exclude the broader 4,023-line packet compiler refactor and frontend ledger consolidation from this slice.

## Source of Truth

- Canonical runtime owner: `backend/src/services/project_intelligence/runner.py`
- Canonical projection owners: `backend/src/services/project_intelligence/projections/`
- Existing shared services: `backend/src/services/intelligence/compiler.py`, pipeline extraction, DB pressure guards, and Supabase helpers
- Deprecated or parallel paths: `backend/src/scripts/run_domain_packet_compiler.py`, `backend/src/services/intelligence/{domain_compiler,project_synthesizer,project_intelligence}.py`

Verification contract: Required

## Acceptance Criteria

- [x] Repository and live Render cron definitions invoke the single canonical runner with explicit modes.
- [x] Former functional paths are absent locally and from `origin/main`.
- [x] Event-driven Graph ingestion and backend API imports resolve through canonical projections.
- [x] Domain and project-sweep exit behavior remains failure-loud and covered.
- [x] No wrapper, compatibility shim, archived copy, or duplicate implementation remains locally.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] One runner owns argument parsing, environment loading, start/finish receipts, and process exit.
- [x] Projection modules own domain-specific behavior and retain actionable errors.
- [x] Domain writes share one cumulative run budget; stale-card reconciliation is bounded per target.
- [x] A partial domain batch exits nonzero and cannot be hidden by a skipped target.
- [x] No database schema, credential, permission, or provider contract change is introduced.

## Integration and Verification

- [x] Targeted Python tests pass.
- [x] Render blueprint contract test passes.
- [x] Canonical import and former-path negative checks pass.
- [x] Live Render service readback proves both services use the canonical command after deployment.
- [x] Evidence artifact is attached to AAI-1250.
- [x] Controlled production runs prove project and domain projection outcomes.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a structured projection receipt plus non-zero process exit for invalid mode, missing target, any partial domain batch, zero compiled domains, or critical project-sweep errors.
- Detection path: runner tests, Render command contract, former-path guard, and live Render service readback.
- Recovery path: invoke the named projection mode through the canonical runner after correcting the reported source, provider, or data condition.

## Incident Learning

- Failure fingerprint: `architecture.project-intelligence-backend-projection-ownership-drift`
- Root cause: two Python projection controllers accumulated separate scheduled entrypoints, while live Render retained a deleted command, an obsolete repository link, and a suspended domain service. The domain batch also validated each target independently and treated a skipped target as enough to hide four failed targets.
- Detection gap: no executable ownership guard, cumulative run budget, live command/revision readback, or production-run assertion rejected those states.
- Prevention: one runner, explicit modes, moved projection package, deleted former paths, cumulative projection budgeting, bounded stale reconciliation, truthful batch exit logic, and live deployment/run readbacks.
- Guardrail evidence: 32 focused assertions pass; independent review approved; former-path/import, cumulative-budget, bounded-stale, and partial-exit tests fail on regression.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Focused backend regression | runner/projection, DB pressure, project budget, and Render command targeted pytest commands | Pass (32) | One pre-existing unrelated health assertion was deselected and is recorded below. |
| Syntax/import | `py_compile`; canonical runner `--help` | Pass | Moved modules and mode parser import cleanly. |
| Independent review | Codex reviewer | Approved | Missed unit-test import was found, fixed, and guarded repo-wide. |
| Viewable proof | Linear attachment `940d4493-3b25-4bef-8104-5bce11757b24` | Pass | Viewable architecture proof is attached directly to AAI-1250. |
| Live Render pre-change readback | `render services -o json` | Drift found | Project sweep uses deleted module path; domain compiler is suspended, auto-deploy off, and linked to obsolete repository. Post-publish correction required. |
| Live Render final readback | service/deploy API and CLI | Pass | Both services use the canonical repository/runner, are active, and are live on `f412171e6a66f79e57dc0d5742898554c07b1968`. |
| Project production run | `crn-d8ne6u8js32c73dkbre0-1784718439` | Pass | 10 packets and 10 current-state projections landed; lower-priority extraction backlog was safely deferred by the 100-row cap. |
| Domain false-green reproduction | `crn-d83o1gkvikkc73cpcmb0-1784718992` | Failed as observed | Four real targets were guard-blocked while one no-doc skip caused exit zero; this localized the silent-success contract bug. |
| Domain production correction | `crn-d83o1gkvikkc73cpcmb0-1784719409` | Pass | 4 domains compiled, 1 correctly skipped, 0 failed; 134 total PM projection rows, Render success in about 110 seconds. |

## Remaining Risk

- The large shared packet compiler and frontend ledger/promotion modules remain parent-architecture work under AAI-1032.
- Unrelated existing tests: health-check test imports missing `_post_teams`; repo-wide Render pressure tests include pre-existing `false` services outside these two corrected cron definitions.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
