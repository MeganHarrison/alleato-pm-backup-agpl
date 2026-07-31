# Live RAG Post-Sync Regression Repair

Status: Complete
Owner: Codex
Linear: Not created - continuation of live production RAG verification
Started: 2026-07-07

## Objective

Restore the live source/RAG watchdog after later scheduled sync activity introduced one unembedded Fireflies summary meeting and several zero-content Teams DM rows.

## Scope

- Identify exact post-sync meeting and Teams rows causing degraded health.
- Repair vectorizable meeting content with the guarded recent-meeting chunk backfill.
- Mark zero-content Teams rows as terminal `skipped_low_content`.
- Add or verify guardrails so empty rows do not keep failing vector health.
- Rerun the live health gates.
- Push only task-owned files to `origin/main`.

## Out Of Scope

- Unrelated frontend branch work currently dirty in the checkout.
- Broad Teams sync redesign.
- New database schema or migrations.

## Checklist

- [x] Fresh failure captured.
- [x] Exact missing meeting and Teams rows identified.
- [x] Summary-bearing meeting embedded.
- [x] Zero-content Teams rows excluded.
- [x] Guardrail reviewed or patched.
- [x] RAG project assignment propagation patched.
- [x] Live meeting/Teams/Graph gates pass.
- [x] Cross-source source/RAG watchdog passes.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Fresh `npm run rag:verify:meetings` result:
  - Failed with `72/73` recent eligible meetings embedded.
  - Missing meeting: `01KWH7GA1CMHR4AP6MV9TCSHF7` - `Quarterly Meeting Review`, `content_len=2224`.
- Fresh source/RAG watchdog:
  - `status='degraded'`, `warningAlerts=2`, `criticalAlerts=0`, `unhealthySources=0`.
  - Warnings: meeting project-intelligence coverage and Teams vectorized coverage.
- Missing zero-content Teams rows:
  - `teamsdm_be216efdb7c22230_2026-07-07` - `Company Vehicle Owners`, `content_len=0`.
  - `teamsdm_17e74a384e5bc3c3_2026-07-07` - `19:meeting_M`, `content_len=0`.
  - `teamsdm_03109b1a9a7954f7_2026-07-07` - `Operations`, `content_len=0`.
  - `teamsdm_f11fb31831cf3cf4_2026-07-07` - `19:19322edea`, `content_len=0`.
- Production repairs:
  - Ran `RAG_DATABASE_WRITES_ENABLED=true node scripts/backfill-recent-meeting-chunks.mjs --days=14 --limit=100`.
  - Result: inserted `1` chunk for `01KWH7GA1CMHR4AP6MV9TCSHF7`.
  - Updated the four zero-content Teams DM rows to `status='skipped_low_content'`.
  - Updated their RAG metadata to `embedding_status='skipped'`.
  - Repaired `01KWC3EJZ81MMEKYK4FDWTKRGC` RAG assignment: `rag_document_metadata.project_id=756` and `14` chunks updated with `metadata.project_id=756`.
  - Ran Fireflies post-ingest extraction for `01KWC3EJZ81MMEKYK4FDWTKRGC`; result included `tasks=7`, `decisions=3`, `risks=6`, `opportunities=6`.
  - Ran bounded project intelligence refresh for project `756`; packet `7310a838-1594-491e-9121-6b3f47aff068`, `docs_in_window=2`, `covered_end_at=2026-07-07T19:15:33.981652+00:00`.
- Guardrail fixes:
  - `backend/src/services/integrations/microsoft_graph/embed.py` now marks empty non-SharePoint Graph items as `skipped_low_content` instead of `embedded`.
  - `backend/src/services/ingestion/communication_project_backfill.py` now propagates high-confidence app project assignments into `rag_document_metadata.project_id` and chunk `metadata.project_id`.
  - Added regression coverage in `backend/tests/test_graph_embed.py`.
  - Extended `backend/tests/test_communication_project_backfill.py` to verify RAG project propagation.
- Verification:
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_graph_embed.py backend/tests/test_source_rag_health.py backend/tests/test_communication_project_backfill.py -q`
  - Result: `27 passed`.
  - `npm run rag:verify:meetings`
  - Result: pass, `73/73` recent meetings with embedded chunks.
  - `npm run rag:verify:graph-embedding`
  - Result: pass.
  - `npm run rag:verify:teams-ingestion`
  - Result: pass.
  - `node scripts/verify/verify_graph_post_sync_attribution_followup.mjs --hours=6 --require-recent=true`
  - Result: pass, latest communication run `communications_synced=4`, `project_backfill.failed=0`.
  - `run_source_rag_health_check(trigger_remediation=False)`
  - Result: `status='healthy'`, `passed=True`, `warningAlerts=0`, `criticalAlerts=0`, `unhealthySources=0`.
