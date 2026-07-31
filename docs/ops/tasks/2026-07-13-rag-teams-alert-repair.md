# Task: Repair RAG Teams Alert Delivery and Project Narrative Freshness

Status: Production Complete; Linear Tracking Blocked/Deferred
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication is required (`oauth_token_invalid_grant`).

## Objective

Stop the repeating Teams RAG alerts by restoring the project-intelligence
operating-record projection and making the alert notifier persist its throttle
state before it can deliver a notification.

## Confirmed Root Causes

- The live `alleato-project-synthesis-sweep` cron is deployed from commit
  `5be1ad4b`, older than the existing packet-ID fix, and still raises Postgres
  `22P02` from a UUID comparison against `0` while projecting
  `project_current_state`.
- The live notifier's `system_alerts` upsert receives RLS `42501`, leaving no
  `notified_at` row. The code sends Teams after the failed write, so the same
  alert repeats every 15 minutes.
- After the canonical packet-ID fix deployed, the first synthesis rerun exposed
  a second guardrail defect: cumulative card extraction consumed the 100-row PM
  projection budget after four projects, so the remaining six never reached
  their one-row packet/current-state projections.
- Teams ingestion itself is healthy; the alert is specifically about stale
  project-page narratives.

## Done Checklist

- [x] Live Teams message cadence and exact alert text captured.
- [x] Live RAG/source stats captured and the unaffected Teams ingestion lane separated from the failure.
- [x] Live Render logs prove the synthesis projection and alert-ledger failures.
- [x] Linear issue creation attempted and exact auth blocker recorded.
- [x] Session ownership claimed with non-overlapping paths.
- [x] Notifier refuses to deliver when the alert ledger cannot persist throttle state.
- [x] Regression tests cover failed ledger writes and successful throttled delivery.
- [x] `alleato-project-synthesis-sweep` runs a deployment containing the packet-ID fix.
- [x] Render notifier has a valid RAG service-role write credential, verified without exposing it.
- [x] A production synthesis run advances `project_current_state.updated_at`.
- [x] A production notifier run persists one alert and does not repeat inside the throttle window.
- [x] Targeted verification evidence is recorded below.
- [x] Task-owned implementation files are published to `origin/main`.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Teams alert history | Fail | Archon sent the same alert every 15 minutes on 2026-07-13. |
| `npm run rag:stats -- 7` | Mixed | Teams has `72 docs / 77 chunks`, zero backlog; project packets are fresh. |
| App DB readback | Fail | All `46` `project_current_state` rows were older than two days; newest was `2026-07-10T11:11:34.802Z`. |
| Synthesis Render logs | Fail | Operating-record projection raises `22P02 invalid input syntax for type uuid: "0"`. |
| Alert Render logs | Fail | `system_alerts` upsert returns `401`, RLS `42501`; Teams POST still returns `200`. |
| Linear connector | Blocked | `UNAUTHORIZED`, `TRIGGER_REAUTHENTICATION`, `oauth_token_invalid_grant`. |
| Focused backend tests | Pass | `18 passed` across notifier and synthesis-budget guardrail suites. |
| Python compile | Pass | Modified notifier and synthesis modules compile cleanly. |
| Canonical Render deploys | Pass | Both affected crons reached `live` on `c2754ccd0`; repositories now point to `The-Alleato-Group/project-management`. |
| Alert credential and first run | Pass | `system_alerts` upsert returned `201`, `ledgerHealthy=true`, and one Teams notification was delivered. |
| Fifteen-minute repeat | Pass | The next run upserted the same alert with `200`, returned `notified=0`, and did not call Teams. |
| Alert-ledger DB readback | Pass | One active row exists with durable `first_seen_at`, `last_seen_at`, and `notified_at`; no duplicate alert rows. |
| First canonical synthesis rerun | Partial/fail-loud | UUID error is gone and four operating records advanced, but the cron exited `1` after six projects hit `projection row count >100`. |
| Projection allocation guardrail | Pass locally | Page-critical packet/current-state rows are reserved before card extraction; extraction-cap deferral no longer skips narrative refresh. Tests cover continuation and fail-before-write behavior. |
| Canonical publish | Pass | Guardrail commits `6f6369bf5` and `4de51881b` are on `origin/main`. |
| Fail-fast extraction guardrail | Pass locally | `AppDbProjectionError` now escapes the per-document retry boundary so a project stops extraction at the first cap hit and proceeds to its reserved narrative writes. Published as `4de51881b`. |
| Final synthesis Render run | Pass | Run `crn-d8ne6u8js32c73dkbre0-1783933402` finished successfully: 10 packets and 10 operating records for 10 projects; no UUID error; four extraction-only deferrals remained bounded. |
| Final PM DB readback | Pass | Projects `31,34,38,43,47,60,67,88,89,90` all advanced; timestamps span `09:05:13Z` to `09:09:36Z`. |
| Final alert run | Pass | `pageWorthy=0`, `notified=0`, `teamsSent=false`, `ledgerHealthy=true`; the cron finished successfully. |
| Alert-ledger resolution | Pass | The single staleness alert row is `resolved`; no active duplicate exists. |
| Final `rag:stats` | Pass for requested lane | Teams remains `72 docs / 77 chunks`, zero backlog; project intelligence now reports `51` fresh and `0` stale packets. |

## Blocked/Deferred Tracking Item

- Cause: the Linear connector returns `UNAUTHORIZED` with
  `oauth_token_invalid_grant`.
- Detection gap: process tracking could not be created or updated even though
  runtime repair tools and provider credentials were available.
- Prevention step: reauthenticate the Linear connector and rerun the handoff
  comment command before accepting S129 in the review queue.
- Owner: workspace Linear connector administrator.
- Next action: create the real AAI issue, replace placeholder `AAI-000`, and post
  the generated completion comment from the validated handoff.

## Failure-Loud Guardrails

- Teams delivery must be conditional on durable alert-ledger persistence.
- Ledger write failure must be returned in the cron result and force a non-zero exit.
- The synthesis cron must not report a clean success when operating-record
  projections fail.
- Production verification must read back both the narrative timestamp and the
  alert ledger; HTTP `200` alone is insufficient.

## Owned Paths

- `backend/src/services/health/pipeline_alert_notifier.py`
- `backend/tests/test_pipeline_alert_notifier.py`
- `backend/src/services/intelligence/project_synthesizer.py` only if an additional fail-loud guard is required
- `backend/tests/test_project_synthesizer_budget.py` only if an additional fail-loud guard is required
- `docs/ops/tasks/2026-07-13-rag-teams-alert-repair.md`
- `docs/ops/handoffs/2026-07-13-S129-rag-teams-alert-repair.md`
- `docs/ops/orchestration/session-board.md`
- `docs/ops/orchestration/review-queue.md`
