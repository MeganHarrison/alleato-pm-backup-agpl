# RAG Health Digest Throttle Handoff

Delivery lane: High-risk

## Localized boundary

The RAG health job persisted individual alert reservations and then selected Teams delivery at the report boundary. A new alert key set `newly_notifiable`, which bypassed the active report-digest cooldown.

## Confirmed cause

Live RAG `system_alerts` showed an active `rag_health:degraded_digest` and newly reserved SharePoint alert keys in the same ongoing incident. The report message was therefore delivered again even though the digest was inside its six-hour cooldown.

## Fix

Keep per-alert reservations for state tracking, but make `reserve_health_digest_notification` the only external delivery gate for the report-level Teams message.
Return zero after a completed degraded health report so Render only pages on an execution failure, not on a detected pipeline problem.

## Migration ledger evidence

Not applicable; the existing RAG `system_alerts.notified_at` column is reused.

## Verification

- `python3 -m pytest backend/tests/test_source_rag_health.py -q` — 30 passed.
- `python3 -m compileall -q backend/src/services/health/source_rag_health.py backend/tests/test_source_rag_health.py` — passed.
- Independent review required the operating-contract update: degraded findings are durable-alert outcomes, while only execution failures fail the cron.
- Live post-deployment ledger and Render-job readback remain required after publication.

## Remaining production incidents

- The graph embedding batch stopped after `PIPELINE_DAILY_MODEL_BUDGET_USD` reached $10.
- SharePoint discovery/replay is draining safely, with affected cursors preserved for retry.
