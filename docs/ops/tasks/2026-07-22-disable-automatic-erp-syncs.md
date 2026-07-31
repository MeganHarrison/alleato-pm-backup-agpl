# Task: Disable Automatic Acumatica and JobPlanner Syncs

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: LOCAL-2026-07-22-DISABLE-AUTO-SYNCS
Linear Issue: Unavailable; no Linear connector is installed in this session.
Related Handoff: `docs/ops/handoffs/2026-07-23-SROOT-disable-automatic-sync-ui.md`

## Objective

Prevent Acumatica and JobPlanner from writing project data automatically while preserving deliberately confirmed, manual-only recovery paths.

## Scope

- Remove the Acumatica Render cron and in-process APScheduler registration.
- Remove the JobPlanner GitHub Actions schedule.
- Add fail-closed confirmation guards to both direct sync entrypoints.
- Update provider guardrails, focused tests, and the disabled frontend response.
- Suspend the live Acumatica Render cron and temporarily disable/re-enable the live JobPlanner workflow when authenticated provider access permits.
- Excludes deleting imported records, deleting provider credentials, and disabling unrelated syncs.

## Source of Truth

- Canonical runtime/data owner: `render.yaml`, `.github/workflows/jobplanner-nightly-sync.yml`
- Existing shared primitives/services: `backend/src/services/acumatica_sync.py`, `scripts/jobplanner/nightly-sync.mjs`
- Deprecated or parallel paths: Acumatica APScheduler registration in `backend/src/services/scheduler.py`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `render.yaml` contains no `alleato-acumatica-financial-sync` cron service.
- [x] Backend startup cannot register an Acumatica sync job, even when legacy enablement variables are present.
- [x] The JobPlanner workflow contains no `schedule` event and requires explicit dispatch confirmation.
- [x] Acumatica and JobPlanner write entrypoints fail before provider/database initialization without both a manual flag and confirmation environment variable.
- [x] Live JobPlanner workflow is manual-only after publication.
- [x] Live Acumatica cron is suspended, or the exact unavailable credential/tool proof is recorded.
- [x] Failure-loudly behavior is covered by focused tests and source readback.
- [x] Legacy or duplicate automatic paths are removed.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior where the runtime language permits reuse.
- [x] Errors are specific and actionable.
- [x] Provider and delivery contracts are handled, including live Render suspension evidence.

Owned files:

- `render.yaml`
- `.github/workflows/jobplanner-nightly-sync.yml`
- `backend/src/services/scheduler.py`
- `backend/scripts/run_acumatica_financial_sync.py`
- `backend/tests/test_scheduler_graph_jobs.py`
- `backend/tests/test_render_sync_blueprints.py`
- `backend/tests/test_acumatica_manual_sync_entrypoint.py`
- `scripts/jobplanner/nightly-sync.mjs`
- `scripts/jobplanner/manual-sync-mode.mjs`
- `scripts/jobplanner/__tests__/manual-sync-mode.test.mjs`
- `scripts/verify/verify-render-web-scheduler-disabled.mjs`
- `scripts/verify/verify-acumatica-sync-health.mjs`
- `frontend/src/app/api/accounting/sync/route.ts`
- this task and its evidence directory

## Integration and Verification

- [x] Targeted Python and Node tests pass.
- [x] Source, GitHub, and Render live readbacks prove the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review passes.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned implementation files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `Automatic sync is disabled; use the documented manual flag and confirmation variable for a deliberate run.`
- Detection path: focused unit tests, workflow/source contract verifier, GitHub Actions API readback, and Render service API readback when credentials are available.
- Recovery path: an operator deliberately runs the retained entrypoint with both required confirmations after reviewing scope.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; this is an intentional operating-policy change.
- Detection gap: Automatic trigger ownership was spread across Render, APScheduler, and GitHub Actions.
- Prevention: Fail-closed entrypoint guards and source/provider contract tests prevent a schedule-only change from silently restarting writes.
- Guardrail evidence: 4/4 JobPlanner assertions, 8/8 Acumatica assertions, direct negative-path invocation, source verifier, and live GitHub workflow readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Live JobPlanner stop | `gh api repos/{owner}/{repo}/actions/workflows` | Pass | Workflow `311945228` is `disabled_manually` during implementation. |
| Live JobPlanner closeout | remote workflow YAML plus Actions API | Pass | Workflow `311945228` is `active`, dispatch-only, and requires both runtime confirmations. |
| Focused guard tests | `verification.md` | Pass | JobPlanner 4/4; Acumatica/scheduler 8/8. |
| Direct fail-closed proof | both unconfirmed entrypoints | Pass | Both exit nonzero before provider/database initialization. |
| Independent review | Reviewer review of all three exact-path workspaces | Pass | No remaining code defect after admin and AI-dashboard copy remediation. |
| UI noise gate | Impeccable surface audits | Pass | Removed the dead admin action and unsupported automatic-sync tool entry. |
| Live Render suspension | User-provided Render dashboard screenshot, 2026-07-23 | Pass | `alleato-acumatica-financial-sync` reads `Manually suspended` in the Alleato Production workspace. |

## Remaining Risk

- No known automatic Acumatica or JobPlanner trigger remains active. Render shows
  the Acumatica cron as manually suspended, and the published entrypoint also
  fails closed independently of provider scheduling.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] No task work remains deferred.
