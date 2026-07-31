# Automatic ERP Sync Shutdown Verification

Date: 2026-07-23

## Requested Outcome

Acumatica and JobPlanner must not import data automatically. Deliberate manual
runs may remain available, but an accidental schedule must fail before provider
or database initialization.

## Source Contract

- `render.yaml` no longer declares `alleato-acumatica-financial-sync`.
- `alleato-backend` declares `ACUMATICA_FINANCIAL_SYNC_ENABLED=false`.
- `backend/src/services/scheduler.py` has no Acumatica registration or wrapper.
- `.github/workflows/jobplanner-nightly-sync.yml` has only
  `workflow_dispatch`; no `schedule` event remains.
- Acumatica write runs require both `--manual` and
  `ACUMATICA_MANUAL_SYNC_CONFIRMED=true`.
- JobPlanner write runs require both `--manual` and
  `JOBPLANNER_MANUAL_SYNC_CONFIRMED=true`.
- Both guards execute before provider or database imports initialize.

## Verification Results

| Boundary | Command | Result |
| --- | --- | --- |
| JobPlanner guard and workflow contract | `node --test scripts/jobplanner/__tests__/manual-sync-mode.test.mjs` | Pass: 4/4 |
| Acumatica entrypoint, scheduler, and manifest contract | focused `python3 -m pytest` selection | Pass: 8/8 |
| Python syntax | `python3 -m py_compile backend/scripts/run_acumatica_financial_sync.py backend/src/services/scheduler.py` | Pass |
| Acumatica accidental direct invocation | `python3 backend/scripts/run_acumatica_financial_sync.py` | Expected nonzero before imports, with the actionable manual-only message |
| JobPlanner accidental direct invocation | `node scripts/jobplanner/nightly-sync.mjs` | Expected nonzero before imports, with the actionable manual-only message |
| Acumatica source/provider verifier | `node scripts/verify/verify-acumatica-sync-health.mjs` | Source pass; live Render readback blocked by missing credential |
| Diff hygiene | `git diff --check` | Pass |
| JobPlanner live stop | GitHub Actions API, workflow ID `311945228` | Pass: `disabled_manually` during rollout |
| JobPlanner live closeout | remote `main` YAML plus Actions API | Pass: `active`, only `workflow_dispatch`, explicit `confirm`, `--manual`, and confirmation environment variable |
| Acumatica live closeout | User-provided Render dashboard screenshot, 2026-07-23 | Pass: `alleato-acumatica-financial-sync` is `Manually suspended` in Alleato Production |
| Independent review | Reviewer, combined three-workspace diff | Pass: no remaining code defect |
| UI noise gate | `audit-surface-complexity.mjs` on both changed frontend data/component files | Pass |

Focused Python command:

```bash
PYTHONPATH=backend python3 -m pytest \
  backend/tests/test_acumatica_manual_sync_entrypoint.py \
  backend/tests/test_scheduler_graph_jobs.py::test_init_scheduler_never_registers_acumatica_job_from_legacy_env \
  backend/tests/test_render_sync_blueprints.py::test_backend_render_blueprint_keeps_high_risk_sync_crons_in_parity \
  backend/tests/test_render_sync_blueprints.py::test_acumatica_automatic_sync_is_absent_and_web_fallback_is_disabled \
  -q
```

## Existing Unrelated Guardrail Debt

The whole `backend/tests/test_render_sync_blueprints.py` file and
`node scripts/verify/verify-render-web-scheduler-disabled.mjs` fail on existing,
unrelated Render declarations. Multiple non-Acumatica crons have
`APP_DB_PRESSURE_GUARD_REQUIRED=false`, two Graph flags are `auto` where the
verifier expects `false`, and the daily executive brief lacks the guard flag.
The task-specific Acumatica assertions pass.

## User-Facing Consistency

- Removed the dead Acumatica action from the admin actions page.
- Removed the AI OS `Acumatica Sync` tool entry and its scheduled/hourly claims.
- Changed Accounting Dashboard copy to the latest approved manual import.
- Kept the API as a specific HTTP 409 manual-only guard for accidental callers.

## Live Provider Closeout

The user supplied an authenticated Render dashboard screenshot on 2026-07-23.
It shows the exact service `alleato-acumatica-financial-sync` in the Alleato
Production workspace with status `Manually suspended`.

This closes the previously unavailable provider-control-plane readback. Defense
in depth remains in place: the service is suspended, its declaration was removed
from `render.yaml`, and the published entrypoint exits before provider/database
initialization unless both manual confirmations are supplied.

## Publication

- Core shutdown: `53e194e93a1fbcb195f15edd63c2935d84e1694d`
- Admin action removal: `36119885452a9356a44fb04189721f71cab85f42`
- AI OS copy cleanup / implementation head:
  `4cdec1b1e5d40cc5e22889ed3b464c1a9778c2a6`
- Remote `render.yaml` contains no Acumatica cron service and declares
  `ACUMATICA_FINANCIAL_SYNC_ENABLED=false`.
- Live JobPlanner workflow ID `311945228` read back as `active` after the
  dispatch-only workflow reached `main`.
