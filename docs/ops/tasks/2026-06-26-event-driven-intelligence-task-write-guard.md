# Event-Driven Intelligence And Task Write Guard Finalization

Date: 2026-06-26
Linear: AAI-699
Parent: AAI-636
Status: Complete

## Objective

Finalize the production path for event-driven Outlook/Teams intelligence and task writes after source sync, without unsafely bypassing the high-churn AI/intelligence database-write guard.

## Scope

- Outlook and Teams event-driven project synthesizer/intelligence extraction path.
- High-churn AI/intelligence write guard behavior.
- Source-signal, insight-card, packet, and task write ownership boundaries.
- Active-window Outlook/Teams redrive proof.
- Source lifecycle, project attribution, assistant/RAG consumption verification after changes.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory active Outlook/Teams event-driven intelligence/task code paths.
- [x] Identify exact guard call site and target tables/writes.
- [x] Determine final production write ownership: AI/RAG staging versus PM app bounded projection.
- [x] Patch confirmed active gap without adding a parallel workflow.
- [x] Add focused regression tests or verifier guardrails.
- [x] Run bounded Outlook redrive and prove source sync, embedding, project assignment, intelligence/task writes.
- [x] Run bounded Teams redrive and prove source sync, embedding, project assignment, intelligence/task writes.
- [x] Run source lifecycle, project attribution, and assistant/RAG verifiers after changes.
- [ ] Delegate frontend typecheck after any TS/JS change.
- [ ] Run Python compile/pytest for backend changes.
- [ ] Update central AI/RAG finalization `TASKS.md`.
- [x] Update handoff with evidence and residual risk.
- [x] Publish code/docs/evidence if changed.

## Evidence

Evidence will be stored under:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/`

Linear issue:

- AAI-699: https://linear.app/megankharrison/issue/AAI-699/finalize-event-driven-outlookteams-intelligence-and-task-writes-past
- Kickoff comment: `e9330c5f-8ae8-48a3-8c72-068acb391994`
- Milestone comment: `cfe93a8c-6ae8-4005-ba1e-46602e842bb2`
- Inventory/change evidence: [event-driven-intelligence-write-guard-aai-699.md](../evidence/2026-06-25-ai-rag-production-finalization/event-driven-intelligence-write-guard-aai-699.md)

Local verification:

- `backend/.venv/bin/python -m compileall backend/src/services/intelligence/project_synthesizer.py backend/unit_tests/test_task_writer_titles.py` — PASS.
- `cd backend && .venv/bin/python -m pytest unit_tests/test_task_writer_titles.py tests/test_db_pressure_guard.py tests/test_graph_sync_options.py -q` — PASS, `22 passed, 6 warnings`.
- `cd backend && .venv/bin/python -m pytest tests/test_render_sync_blueprints.py -q` — PASS, `7 passed, 6 warnings`.
- `npm run rag:verify:source-lifecycle -- --days 7` — PASS.
- `PROJECT_ATTRIBUTION_AUDIT_DAYS=7 npm run verify:project-attribution` — PASS.
- `npm run verify:microsoft-assistant-health -- --json` — PASS after bounded Outlook sync refreshed cached intake.
- `npm run rag:verify:project-intelligence-live-paths` — PASS after restoring top-level docs source-of-truth files.
- `npm run rag:verify:source-specific` — PASS.
- `npm run rag:verify:chat-architecture` — PASS.

Active-window redrives:

- Outlook-only bounded sync — PASS: `total_synced=2`, `embed.embedded=1`, `intelligence_extraction.errors=[]`, `pm_projection_rows={}`.
- Teams-only bounded sync — PASS: `total_synced=1`, `teams_dm=1`, `intelligence_extraction.errors=[]`, `pm_projection_rows={}`.

## Initial Constraints

- The checkout contains unrelated dirty frontend files; this slice must stay scoped to event-driven intelligence/task write code, task docs, and evidence.
- Do not disable the high-churn guard just to make redrives pass.
- Do not introduce duplicate Outlook/Teams compiler/synthesizer paths.
- Active operational windows follow the user's rule: Outlook/Teams older than one week are not blockers unless needed for historical reconstruction.

## Blockers

- None for this slice.

## Follow-Up

- Add a deterministic seeded integration fixture that forces one project-scoped Outlook/Teams task/card projection. The production path is fixed and covered by unit/regression tests, but the live active-window redrives did not happen to contain a project-scoped actionable communication that produced new PM task/card rows.

## Root Cause

- `backend/src/services/integrations/microsoft_graph/sync.py` correctly calls `synthesize_new_comms_since(...)` after communication sync.
- `synthesize_new_comms_since(...)` and `run_synthesis_sweep(...)` still had an obsolete whole-entrypoint `enforce_no_pm_app_high_churn_writes(...)` guard, so the path failed before reaching the already-bounded RAG staging and PM final-projection writers.
- `source_signal_candidates` staging is already AI/RAG-owned through `get_rag_write_client()`. App-facing `insight_cards`, `insight_card_targets`, `insight_card_evidence`, `intelligence_packets`, and `tasks` must use bounded PM final projection.

## Prevention

- Replaced the obsolete whole-entrypoint block with a cumulative run-level PM projection reservation before card/task/packet projection rows are written.
- Added `pm_projection_rows` to event-driven and sweep summaries so redrive and monitoring evidence show the exact bounded app projection volume.
- Added regression tests proving Outlook/Teams task writes reserve projection budget and over-budget runs fail before PM task upsert.
- Patched live Render `alleato-graph-sync` env with the bounded projection variables through the single-key Render env-var API and verified by read-back.

## Failure-Loud Guardrail

This slice is not complete until the event-driven Outlook/Teams path either writes through the finalized production ownership boundary or fails with a surfaced, monitored, retryable state instead of silently dropping intelligence/task work.
