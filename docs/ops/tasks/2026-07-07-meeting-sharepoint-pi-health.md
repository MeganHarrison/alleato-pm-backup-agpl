# Meeting And SharePoint Project Intelligence Health

Status: Complete
Owner: Codex
Linear: AAI-1000
Linear URL: https://linear.app/megankharrison/issue/AAI-1000/clear-meeting-and-sharepoint-project-intelligence-rag-health-criticals
Started: 2026-07-07

## Objective

Clear the remaining Meeting and SharePoint project-intelligence criticals in source/RAG health without hiding real processing gaps.

## Scope

- Inspect live Meeting and SharePoint critical rows.
- Fix scheduled health to count Fireflies meeting extractor evidence correctly.
- Process scoped project-assigned SharePoint rows through source intelligence and count succeeded synthesis outcomes.
- Add targeted tests.
- Verify live health movement.
- Push task-owned files to `origin/main`.

## Out Of Scope

- Project reassignment.
- Embedding model or chunking changes.
- New schema/migrations.
- Broad SharePoint historical backfill.

## Checklist

- [x] Live health failure shape captured.
- [x] Meeting evidence rows inspected.
- [x] SharePoint source-intelligence rows inspected.
- [x] Meeting health read-model fix implemented.
- [x] SharePoint scoped compiler/backfill run.
- [x] Targeted tests added.
- [x] Targeted tests pass.
- [x] Live health verified.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Live source/RAG health before this slice:
  - Meetings project intelligence: `0/3 critical`.
  - SharePoint project intelligence: `0/5 critical`.
  - Teams project intelligence: `3/3 healthy`.
- Meeting rows inspected:
  - `01KWW8H72YERCDP894P3KDAR78` / Weekly Accounting Meeting / project `60`.
  - `01KWHBH2SR10F1BHRP7F5CK7HF` / Alec -Review Form Feedback / project `90`.
  - `01KW9HBHD8S5PZBH5RB39F0328` / Sprinkler Division Morning Huddle / project `90`.
  - Each has embedded `meeting_transcript` chunks and `insight_card_evidence` rows.
  - None has `source_intelligence_jobs` output because Fireflies meetings use the meeting extractor path, not the source-intelligence compiler path.
- SharePoint rows inspected:
  - 5 recent project-assigned SharePoint/document rows have embedded chunks.
  - `source_intelligence_jobs.output_summary` is empty for the inspected rows.
  - No `insight_card_evidence` rows exist for those SharePoint docs.
- Root cause:
  - Meeting health is under-counting existing meeting extractor evidence by requiring source-intelligence full-read proof.
  - SharePoint project-intelligence health is under-counting succeeded `source_syntheses` rows when the compiler writes synthesis output but then fails later at the PM final-projection guard.
- Scoped SharePoint compiler run:
  - Ran the five project-assigned SharePoint rows through `process_source_document_to_packet(..., force=True, compile_packet=False)`.
  - The run failed the outer job at `enforce_pm_app_final_projection_guard()` because `ALLOW_PM_APP_FINAL_PROJECTIONS` is intentionally disabled for unbounded PM APP writes.
  - Direct read-back showed all five SharePoint rows have succeeded `source_syntheses` records, so health can count the durable synthesis output without enabling PM projection writes.
- Targeted tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_rag_health.py -q`
  - Result: `13 passed in 0.03s`.
- Live health after fix:
  - Meetings project intelligence: `3/3 healthy`.
  - SharePoint project intelligence: `5/5 healthy`.
  - Emails project intelligence: `69/69 healthy`.
  - Teams project intelligence: `3/3 healthy`.
  - `graphConversationChunks`: `healthy`.
  - Overall status remains `degraded` because attribution/task backlog warnings remain for Meetings, Teams, Emails, and SharePoint.

## Notes

- The fix preserves fail-loud behavior: meetings can count existing evidence, and SharePoint only turns healthy after a succeeded synthesis row exists.
