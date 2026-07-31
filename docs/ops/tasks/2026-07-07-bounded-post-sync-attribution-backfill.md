# Bounded Post-Sync Attribution Backfill

Status: Complete
Owner: Codex
Linear: AAI-1012
Linear URL: https://linear.app/megankharrison/issue/AAI-1012/bound-post-sync-communication-attribution-backfill-to-sync-window
Started: 2026-07-07

## Objective

Keep the automatic communication attribution follow-up reliable without repeatedly scanning and restaging historical unassigned rows on every Graph/Fireflies cron run.

## Scope

- Fix strict verifier argument parsing for `--key=value`.
- Allow the shared post-sync follow-up to receive a `since` window.
- Pass the Graph sync watermark into the communication attribution follow-up.
- Pass the Fireflies cron start time into the same follow-up.
- Add focused regression tests.
- Verify strict ledger proof and targeted tests.
- Push task-owned files to `origin/main`.

## Out Of Scope

- Changing attribution rules or review UI.
- New schema.
- Full historical cleanup of attribution candidates.
- Changing Render cron schedules.

## Checklist

- [x] Live broad-scan shape captured.
- [x] Verifier parses `--key=value`.
- [x] Post-sync follow-up is bounded by sync window.
- [x] Graph and Fireflies pass sync start times to the follow-up.
- [x] Focused tests pass.
- [x] Strict/live verifier proof recorded.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Strict ledger proof after prior slice:
  - `node scripts/verify/verify_graph_post_sync_attribution_followup.mjs --hours 6 --require-recent=true` effectively ran with `requireRecent=false` due parser gap.
  - Latest communication run: `started_at=2026-07-07T17:40:54.123Z`, `communications_synced=10`.
  - Recorded project backfill: `scanned=250`, `assigned=0`, `review_staged=250`, `failed=0`.
- Root cause:
  - `maybe_run_comm_project_backfill()` always calls `run_incremental_project_backfill(client)` without a `since` bound.
  - The verifier argument parser only handles `--flag value`, not `--flag=value`.
- Prevention target:
  - Scheduled post-sync follow-up should scan only rows from the current sync window.
  - Strict verifier flags must parse correctly so `--require-recent=true` actually enforces recent-run evidence.

## Implementation Evidence

- Updated `scripts/verify/verify_graph_post_sync_attribution_followup.mjs`.
  - Parser now supports `--key=value` and `--key value`.
  - Strict command now reports `requireRecent: true`.
- Updated `backend/src/services/ingestion/sync_followups.py`.
  - `maybe_run_comm_project_backfill(client, since=...)` forwards the sync window to the shared backfill.
- Updated `backend/src/services/ingestion/communication_project_backfill.py`.
  - Candidate query now selects and filters by `created_at`.
  - This aligns the post-sync window with ingestion timing for Teams, email, and Fireflies rows.
- Updated `backend/src/services/integrations/microsoft_graph/sync.py`.
  - Graph passes its buffered sync watermark into the attribution follow-up.
- Updated `backend/scripts/run_fireflies_sync.py`.
  - Fireflies passes its cron run start time into the attribution follow-up.
- Updated tests:
  - `backend/tests/test_graph_sync_options.py` asserts Graph passes a `since` timestamp.
  - `backend/tests/test_communication_project_backfill.py` uses `created_at` for scoped backfill fixtures.
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_graph_sync_options.py backend/tests/test_communication_project_backfill.py -q`
  - Result: `17 passed in 1.25s`.
- Strict verifier proof:
  - `node --check scripts/verify/verify_graph_post_sync_attribution_followup.mjs && node scripts/verify/verify_graph_post_sync_attribution_followup.mjs --hours=6 --require-recent=true`
  - Result: pass, `requireRecent=true`, latest communication run `communications_synced=10`, `project_backfill.failed=0`.
- Live bounded-window proof:
  - Exact downstream start window `2026-07-07T17:40:54+00:00`: `scanned=0`, `failed=0`.
  - Graph buffered sync watermark `2026-07-07T17:35:54+00:00`: `scanned=2`, `review_staged=2`, `failed=0`.
  - This proves the bounded path no longer scans the historical default `250` rows for the same cron cycle.
- Publish evidence:
  - `npm run codex:finish -- --message "Bound post-sync attribution backfill" --files backend/scripts/run_fireflies_sync.py backend/src/services/ingestion/communication_project_backfill.py backend/src/services/ingestion/sync_followups.py backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_communication_project_backfill.py backend/tests/test_graph_sync_options.py scripts/verify/verify_graph_post_sync_attribution_followup.mjs docs/architecture/AI-RAG-ARCHITECTURE.md docs/ops/tasks/2026-07-07-bounded-post-sync-attribution-backfill.md`
  - Result: published task-owned files to `origin/main` at `bcfdb4f8f`.
