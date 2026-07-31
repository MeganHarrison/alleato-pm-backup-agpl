# Live RAG Meeting Vector Repair

Status: Complete
Owner: Codex
Linear: Not created - live production repair continuation
Started: 2026-07-07

## Objective

Restore today's RAG health gate so recent Fireflies meetings are either embedded in `document_chunks` or explicitly excluded when they have no searchable content.

## Scope

- Verify Graph/Teams/meeting RAG health after the previous sync hardening.
- Identify exact Fireflies rows missing embedded meeting chunks.
- Repair vectorizable meeting content without broad re-sync.
- Mark metadata-only Fireflies rows as intentionally non-vectorizable.
- Rerun the relevant health gates and record evidence.

## Out Of Scope

- New schema or migrations.
- Broad Fireflies pipeline redesign.
- Project-attribution rule changes.
- Unrelated dirty frontend/daily-brief files.

## Checklist

- [x] Graph post-sync attribution ledger verified.
- [x] Teams ingestion/vector contract verified.
- [x] Graph embedding contract verified.
- [x] Meeting vectorization failure captured.
- [x] Missing recent meeting rows identified.
- [x] Metadata-only meeting excluded from vector coverage.
- [x] Summary-bearing meeting chunked and embedded.
- [x] Backfill guardrail prevents excluded rows from being embedded.
- [x] Teams zero-content row excluded from vector coverage.
- [x] Legacy RAG-only email rows queued for attribution review.
- [x] Missing meeting task extraction repaired.
- [x] Meeting vectorization health passes.
- [x] Cross-source source/RAG watchdog passes.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- `node scripts/verify/verify_graph_post_sync_attribution_followup.mjs --hours=6 --require-recent=true`
  - Result: pass.
  - Latest scheduled run: `2026-07-07T18:41:30.097Z`, `communications_synced=26`, `project_backfill.scanned=0`, `failed=0`.
- `npm run rag:verify:graph-embedding`
  - Result: pass.
- `npm run rag:verify:teams-ingestion`
  - Result: pass.
- `npm run rag:verify:meetings`
  - Result: fail.
  - Failure: only `67 of 69` meetings from the last 14 days had embedded chunks.
- Missing rows:
  - `01KWVKBKFGZWJFQT45FJHRBATQ` - `Kebba -Review Form Feedback`, content length `237`, 0-minute metadata-only row, no chunks.
  - `01KWYH9PT6VBXM86EZFD9Q7FYA` - `Bob Wright Review`, content length `2294`, summary/action content, no chunks.
- Production repairs:
  - Updated `01KWVKBKFGZWJFQT45FJHRBATQ` to `status='skipped_low_content'`.
  - Ran `RAG_DATABASE_WRITES_ENABLED=true node scripts/backfill-recent-meeting-chunks.mjs --days=14 --limit=100`.
  - Inserted summary chunks, then removed three bad chunks written for excluded rows before patching the guardrail.
  - Kept the valid `meeting_summary` chunk for `01KWYH9PT6VBXM86EZFD9Q7FYA`.
  - Updated `teamsdm_734b810fa98e1a0c_2026-07-07` to `status='skipped_low_content'` because `content_len=0`.
  - Ran recent communication attribution backfill: `scanned=215`, `assigned=1`, `review_staged=214`, `failed=0`.
  - Staged seven legacy RAG-only Outlook rows in `document_attribution_candidates` with `status='pending_review'`.
  - Ran Fireflies post-ingest extraction for `01KWC3EJZ9ZMX80Y9VF96RX90R`; result included `tasks=3`, `decisions=4`, `risks=5`, `opportunities=5`.
- Guardrail fixes:
  - `scripts/backfill-recent-meeting-chunks.mjs` now excludes terminal statuses and interview rows before writing chunks.
  - `backend/src/services/health/source_rag_health.py` now counts searchable meeting chunk types, including `meeting_summary`, in lifecycle vector coverage.
  - Meeting project-intelligence lifecycle now counts explicit `project_intelligence.refresh_project_intelligence` packet refresh jobs.
- Verification:
  - `RAG_DATABASE_WRITES_ENABLED=true node scripts/backfill-recent-meeting-chunks.mjs --days=14 --limit=100 --dry-run`
  - Result: `Recent meetings missing chunks: 0`.
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_source_rag_health.py -q`
  - Result: `20 passed in 0.02s`.
  - `npm run rag:verify:meetings`
  - Result: pass, `70/70` recent meetings with embedded chunks.
  - `npm run rag:verify:graph-embedding`
  - Result: pass.
  - `npm run rag:verify:teams-ingestion`
  - Result: pass.
  - `node scripts/verify/verify_graph_post_sync_attribution_followup.mjs --hours=6 --require-recent=true`
  - Result: pass, latest run `status=succeeded`, `failures=[]`.
  - `run_source_rag_health_check(trigger_remediation=False)`
  - Result: `status='healthy'`, `passed=True`, `warningAlerts=0`, `criticalAlerts=0`, `unhealthySources=0`.
