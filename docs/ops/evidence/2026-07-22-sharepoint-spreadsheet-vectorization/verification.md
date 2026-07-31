# SharePoint Spreadsheet Vectorization Verification

Status: PASSED
Captured at: 2026-07-22T20:04:44Z

## Root Cause

The production Graph extractor admitted PDF, DOC/DOCX, TXT, Markdown, and CSV, but silently skipped XLSX/XLSM while still advancing the SharePoint delta cursor. The prior 423/423 coverage calculation began with already-cataloged documents, so the eight skipped workbooks were absent from both the numerator and denominator. PDF extraction also stopped after page 50 and Graph metadata content was cut to 50,000 characters before embedding.

## Exact Source Inventory

Microsoft Graph enumeration of the three configured project evidence folders and descendants returned 26 files:

- 18 PDF/DOCX files already cataloged and vectorized.
- 8 XLSX/XLSM workbooks absent from both the PM App catalog and AI/RAG vectors.
- No unsupported file extension exists in this configured 26-file scope after XLSX/XLSM support is deployed.

The pre-release database readback returned the same eight missing source IDs in both databases. See `source-inventory.json`.

## Implemented Guardrails

- XLSX/XLSM materializes every non-empty cell with worksheet and coordinate provenance.
- Formulas and their available persisted cached values are both retained.
- PDF page caps and the 50,000-character RAG persistence cap are removed.
- DOCX paragraphs, tables, headers, and footers are materialized.
- Unsupported SharePoint file types, oversized files, low-content extraction, download failures, storage failures, and metadata failures preserve the prior delta cursor and fail the run loudly.
- Per-run file safety limits preserve the prior cursor; already cataloged files do not consume the next replay's new-file budget.

## Focused Verification

```text
PYTHONPATH=backend SUPABASE_URL=https://fake.supabase.co SUPABASE_SERVICE_ROLE_KEY=fake OPENAI_API_KEY=sk-test pytest -q --confcutdir=backend/tests/__pycache__ backend/tests/test_microsoft_graph_onedrive_project_documents.py backend/tests/test_sharepoint_sync_recovery.py
16 passed

ruff check backend/src/services/integrations/microsoft_graph/onedrive.py backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_microsoft_graph_onedrive_project_documents.py backend/tests/test_sharepoint_sync_recovery.py
All checks passed

python -m py_compile backend/src/services/integrations/microsoft_graph/onedrive.py backend/src/services/integrations/microsoft_graph/sync.py
passed
```

The normal repository conftest path is temporarily blocked by unrelated canonical-checkout work: `backend/src/api/main.py` imports `list_llm_wiki_history`, which the concurrently edited `src.services.agents.llm_wiki` package does not currently export. The focused test command deliberately bypassed that unrelated application fixture and used an offline RAG store.

## Production Release Proof

Render deployed `origin/main` commit `66ff2a88300ff209d09218daf5dceefee93ed9fe` to both `alleato-graph-sync` and `alleato-source-rag-health` with status `live`.

The Union estimate resource cursor was reset only for:

```text
sharepoint:AlleatoGroup:/Alleato Group/Alleato Group-Shared/2026 Jobs/26-119 - Union Collective (Union%2C KY)/04 - Estimate
```

Production job `job-d9gi70u1a83c73fjk7b0` succeeded from 2026-07-22T20:09:41Z through 2026-07-22T20:12:54Z. It cataloged all eight workbooks, generated 55 workbook chunks, and returned the resource to `sync_status=success` with a 476-character incremental delta cursor and no error.

One redundant diagnostic job, `job-d9gi85nlk1mc73frlus0`, failed before application execution because the ad-hoc Render start command used shell-style environment prefixes without a shell. It did not invalidate or replace the primary replay; the primary job completed successfully and owns the database evidence below.

Live readback proves:

- 26/26 source files cataloged.
- 8/8 workbooks cataloged.
- 26/26 source files have embedded chunks.
- 8/8 workbooks have embedded chunks.
- 436 total chunks; 55 workbook chunks.
- Every embedding is 3072 dimensions.
- All eight workbooks have non-empty full-text RAG payloads totaling 176,607 characters.
- Source, PM catalog, and vector ID-set hashes are identical: `239bfd3b3d8483e59c8249ab31c7dc8e`.
- No source ID is missing.

## Scope Boundary

This proves the three explicitly configured project estimate/proposal folders and descendants. It is not a tenant-wide SharePoint inventory. Future unsupported files in configured folders now fail closed and preserve the cursor instead of disappearing; tenant-wide discovery remains a separate architecture scope.
