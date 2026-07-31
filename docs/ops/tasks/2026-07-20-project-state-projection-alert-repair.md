# Task: Repair Project-State Projection and Teams Alert Semantics

Status: In Progress
Owner: Codex
Created: 2026-07-20
Task ID: AAI-1196
Linear Issue: [AAI-1196](https://linear.app/megankharrison/issue/AAI-1196/repair-stale-project-state-projections-and-misleading-teams-pipeline)
Related Handoff: `docs/ops/handoffs/2026-07-20-S196-project-state-projection-alert-repair.md`

## Objective

Restore fresh, controlled `project_current_state` narratives for project pages and ensure Teams describes and throttles this projection failure accurately.

## Scope

- Controlled project-state projection adapter, scheduled synthesis behavior, alert semantics, focused regression coverage, and production replay.
- Excludes ingestion/vectorization behavior, which is healthy.

## Source of Truth

- Canonical runtime/data owner: `public.apply_project_current_state_projection` called by `backend/src/services/intelligence/project_synthesizer.py`.
- Existing shared services: `backend/src/services/intelligence/compiler.py`, `backend/src/services/health/pipeline_alert_notifier.py`, `backend/src/services/health/project_intelligence_staleness_check.py`.
- Deprecated or parallel paths: the direct staleness Teams sender must not compete with the durable alert-ledger notifier.

Verification contract: Required

## Acceptance Criteria

- [ ] A production synthesis run advances `project_current_state.updated_at` through the controlled writer.
- [ ] Projection-contract rejection is covered by a focused regression test and fails the sweep loudly.
- [ ] The Teams alert names project-page narrative/projection staleness, not vectorization.
- [ ] A single durable alert path throttles delivery and resolves after recovery.

## Implementation Checklist

- [ ] Confirm the exact unsupported-field boundary and canonical envelope shape.
- [ ] Repair the producer/controlled-writer contract without bypassing the guard.
- [ ] Remove or route the duplicate direct Teams delivery path through the ledger owner.
- [ ] Add focused regression tests.
- [ ] Replay affected project narratives through the canonical runtime path.

## Integration and Verification

- [ ] Targeted tests pass.
- [ ] Production readback proves fresh project state and a resolved alert ledger.
- [ ] Render logs confirm no controlled-projection rejections on the recovery run.
- [ ] Evidence artifacts and Linear updates are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: controlled projection rejection with the offending field and project ID.
- Detection path: synthesis cron status, Render logs, and `project_current_state` freshness readback.
- Recovery path: fix the canonical projection envelope then rerun the bounded synthesis sweep; never direct-write project state.

## Incident Learning

- Failure fingerprint: `reliability.side-effect-before-durable-ledger`
- Root cause: projection producer includes an unsupported field after the controlled writer contract changed.
- Detection gap: the sweep logged individual projection errors but allowed the stale condition to appear as a generic vectorization outage.
- Prevention: typed envelope-contract regression test, fatal page-critical projection result, and alert source-specific copy.
- Guardrail evidence: focused synthesis and notifier tests plus production recovery readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Render synthesis logs, 2026-07-20 | Pass | Controlled writer rejected `project_id` as `unsupported_projection_field`; at least 30 attempts failed. |
| Freshness readback | Supabase production query | Fail | `project_current_state` newest row was 2026-07-17 while synthesis packets were fresh 2026-07-20. |
| Task setup | This task file and AAI-1196 | Pass | Scope and done gate captured before implementation. |

## Remaining Risk

- Production replay creates derived narratives; verify the controlled writer provenance and alert-ledger resolution immediately after the run.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
