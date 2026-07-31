# Graph Communication Attribution Follow-Up

Status: Complete
Owner: Codex
Linear: AAI-1010
Linear URL: https://linear.app/megankharrison/issue/AAI-1010/run-communication-attribution-follow-up-after-graph-sync
Started: 2026-07-07

## Objective

Run the shared communication project attribution backfill automatically after Microsoft Graph sync so Outlook and Teams rows do not wait for manual repair before unresolved project attribution becomes explicit review.

## Scope

- Confirm Fireflies already runs the shared post-sync attribution follow-up.
- Wire the same follow-up into Microsoft Graph downstream processing for synced Outlook/Teams communications.
- Make follow-up failures visible as downstream errors.
- Add focused regression coverage.
- Verify targeted tests.
- Push task-owned files to `origin/main`.

## Out Of Scope

- New attribution schema.
- New Render cron service.
- Broad historical attribution cleanup.
- UI for attribution review candidates.

## Checklist

- [x] Existing Fireflies follow-up owner confirmed.
- [x] Graph downstream processing runs the communication attribution follow-up.
- [x] Follow-up failure is fail-loud in Graph downstream output.
- [x] Targeted tests pass.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Current state:
  - `backend/src/services/ingestion/sync_followups.py` owns `maybe_run_comm_project_backfill()`.
  - `backend/scripts/run_fireflies_sync.py` already calls `maybe_run_comm_project_backfill(client)` after Fireflies ingestion.
  - `backend/src/services/integrations/microsoft_graph/sync.py` does not call the follow-up, so Graph-synced Outlook/Teams rows can miss automatic review staging until a manual/admin backfill.
- Root cause:
  - Post-sync attribution follow-up ownership exists but is not wired into the Graph source path.
- Prevention target:
  - Graph downstream output must include `project_backfill` when Outlook or Teams communications were synced, and failures must be surfaced in `downstream_errors`.

## Implementation Evidence

- Updated `backend/src/services/integrations/microsoft_graph/sync.py`.
  - Graph downstream processing now calls `maybe_run_comm_project_backfill(supabase)` when `communications_synced > 0`.
  - The Graph result now includes `project_backfill`.
  - If the follow-up reports failed rows or raises, Graph records a downstream error and returns `complete_with_errors`.
  - When no Outlook/Teams communications were synced, `project_backfill` is explicitly skipped with reason `no_new_outlook_or_teams_communications`.
- Updated `backend/tests/test_graph_sync_options.py`.
  - Added coverage that Graph communication sync invokes the shared attribution follow-up.
  - Added coverage that follow-up failures become downstream errors.
  - Added coverage that the follow-up does not run when no communications were synced.
- Updated `docs/architecture/AI-RAG-ARCHITECTURE.md`.
  - Added the 2026-07-07 Graph communication attribution follow-up entry.
  - Corrected the Fireflies sync section to reference the dedicated `alleato-fireflies-sync` cron and shared post-sync attribution follow-up.
  - Added a Graph communication attribution follow-up section.
- Targeted test evidence:
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_graph_sync_options.py -q`
  - Result: `14 passed in 1.42s`.
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_graph_sync_options.py backend/tests/test_communication_project_backfill.py backend/tests/test_source_rag_health.py -q`
  - Result: `35 passed in 1.27s`.
- Live health readback:
  - `run_source_rag_health_check(trigger_remediation=False)`.
  - Result: `degraded=None`, warnings `0`, critical `0`.
- Publish evidence:
  - `npm run codex:finish -- --allow-staged --message "Run Graph communication attribution follow-up" --files backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_graph_sync_options.py docs/ops/tasks/2026-07-07-graph-communication-attribution-followup.md docs/architecture/AI-RAG-ARCHITECTURE.md`
  - Result: published task-owned files to `origin/main` at `b1bd6dae3`.
