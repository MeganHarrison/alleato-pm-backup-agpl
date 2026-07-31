# Graph Post-Sync Attribution Ledger

Status: Complete
Owner: Codex
Linear: AAI-1011
Linear URL: https://linear.app/megankharrison/issue/AAI-1011/verify-graph-post-sync-attribution-follow-up-in-source-sync-ledger
Started: 2026-07-07

## Objective

Make the Graph communication attribution follow-up observable from the durable `source_sync_runs` ledger so ops can verify it without tailing Render logs.

## Scope

- Persist the Graph downstream `project_backfill` result into `source_sync_runs.metadata`.
- Include Graph communication counts in the downstream ledger row.
- Add a standalone verifier for recent Graph downstream rows that synced communications but did not record project-backfill evidence.
- Add focused regression coverage.
- Verify targeted tests and live health.
- Push task-owned files to `origin/main`.

## Out Of Scope

- Waiting for a long Render cron/log tail in the main conversation.
- Changing Render cron schedules.
- New database schema.
- UI for attribution review candidates.

## Checklist

- [x] Graph downstream ledger metadata includes project-backfill result.
- [x] Standalone verifier added.
- [x] Focused tests pass.
- [x] Live health readback stays clean.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Current state:
  - Graph sync JSON includes `project_backfill`.
  - Graph downstream `source_sync_runs.metadata` does not yet persist that result, so a later verifier cannot prove from the ledger that post-sync attribution ran.
- Root cause:
  - The follow-up is observable in immediate process output but not in durable source-sync run metadata.
- Prevention target:
  - Recent Graph downstream runs with `communications_synced > 0` must include `metadata.project_backfill`; the verifier must fail loudly if it is missing or errored.

## Implementation Evidence

- Updated `backend/src/services/integrations/microsoft_graph/sync.py`.
  - Graph downstream phase ledger metadata now includes `communications_synced`.
  - Graph downstream phase ledger metadata now includes the project-backfill summary from downstream processing.
- Updated `backend/tests/test_graph_sync_options.py`.
  - Added assertion that the downstream `source_sync_runs` metadata contains the project-backfill summary and communication count.
- Added `scripts/verify/verify_graph_post_sync_attribution_followup.mjs`.
  - Reads RAG DB `source_sync_runs`.
  - Checks recent `microsoft_graph_downstream` / `downstream_enrichment` rows.
  - Fails when a run with synced communications lacks project-backfill evidence or records failed follow-up rows.
  - Supports `--require-recent=true` for post-cron enforcement after a Render run is expected.
- Updated `docs/architecture/AI-RAG-ARCHITECTURE.md`.
  - Added the ledger-verifiable Graph post-sync attribution follow-up entry.
- Targeted test evidence:
  - `node --check scripts/verify/verify_graph_post_sync_attribution_followup.mjs`.
  - Result: pass.
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_graph_sync_options.py -q`.
  - Result: `14 passed in 1.30s`.
- Live verifier evidence:
  - `node scripts/verify/verify_graph_post_sync_attribution_followup.mjs --hours 24`.
  - Result: pass; found `37` Graph downstream runs, `0` communication runs with the new metadata window, no failures. This is expected until the next Graph/Teams cron run syncs communication items after this change.
- Render readback:
  - `alleato-graph-sync` active, not suspended, schedule `20 */2 * * *`, last successful run `2026-07-07T16:25:53Z`.
  - `alleato-teams-dm-sync` active, not suspended, schedule `40 * * * *`, last successful run `2026-07-07T16:40:45Z`.
  - `alleato-teams-channel-sync` active, not suspended, schedule `10 * * * *`, last successful run `2026-07-07T17:10:44Z`.
- Publish evidence:
  - `npm run codex:finish -- --message "Verify Graph attribution follow-up ledger" --files backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_graph_sync_options.py scripts/verify/verify_graph_post_sync_attribution_followup.mjs docs/architecture/AI-RAG-ARCHITECTURE.md docs/ops/tasks/2026-07-07-graph-post-sync-attribution-ledger.md`
  - Result: published task-owned files to `origin/main` at `9cd28dac6`.
