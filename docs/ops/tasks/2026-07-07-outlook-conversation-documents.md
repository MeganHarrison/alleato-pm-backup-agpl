# Task: Outlook Conversation Documents For RAG

Date: 2026-07-07
Linear: AAI-988
Parent: AAI-636
Status: Complete

## Objective

Compile raw Outlook intake rows into deterministic conversation-level RAG
documents so Outlook source sync can succeed at raw persistence while
downstream enrichment operates on replayable conversation documents.

## Scope

- `backend/src/services/integrations/microsoft_graph/outlook_conversations.py`
- `backend/src/services/integrations/microsoft_graph/sync.py`
- Focused backend regression tests for conversation compilation and Graph
  downstream integration
- Task/evidence documentation for this slice only

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Inventory existing Outlook raw intake and RAG metadata persistence paths.
- [x] Add deterministic conversation compiler from `outlook_email_intake`.
- [x] Persist compiled conversations through the existing RAG metadata store.
- [x] Skip unchanged conversations by content hash.
- [x] Wire compilation into the Microsoft Graph downstream phase before embedding.
- [x] Preserve existing Outlook delta sync behavior.
- [x] Add focused backend regression tests.
- [x] Run Python compile/pytest for touched backend files.
- [x] Update task evidence and residual risk after verification.

## Evidence

Linear issue:

- AAI-988: https://linear.app/megankharrison/issue/AAI-988/build-outlook-conversation-document-compiler-for-rag
- Kickoff comment: `6b6bbaa3-725b-466f-bc5d-8e892c03e016`

Verification:

- `PYTHONPATH=backend /Users/meganharrison/Documents/alleato-pm/backend/.venv/bin/python -m py_compile backend/src/services/integrations/microsoft_graph/outlook_conversations.py backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_outlook_conversations.py backend/tests/test_graph_sync_options.py` - PASS
- `PYTHONPATH=backend /Users/meganharrison/Documents/alleato-pm/backend/.venv/bin/python -m pytest backend/tests/test_outlook_conversations.py backend/tests/test_graph_sync_options.py -q` - PASS, `15 passed, 6 warnings`
- `PYTHONPATH=backend /Users/meganharrison/Documents/alleato-pm/backend/.venv/bin/python -m pytest backend/tests/test_outlook_conversations.py backend/tests/test_document_low_content_pipeline.py backend/tests/test_graph_sync_options.py -q` - PASS, `18 passed, 6 warnings`
- Live RAG read-back after bounded `bclymer@alleatogroup.com` backfill - PASS:
  `10` Outlook conversation docs had `content`, `embedding_status='embedded'`,
  and only `source_type='email'` chunks.

Behavior changes captured:

- Added `outlook_conversations.py`, a bounded compiler that reads recent raw
  `outlook_email_intake` rows, groups by `mailbox_user_id + conversation_id`,
  and uses a deterministic subject fallback when `conversation_id` is missing.
- Compiled documents use stable IDs, `content_hash`, `type='email'`,
  `category='email'`, taxonomy-safe `document_type='email_message'`, and
  `source_metadata.document_kind='outlook_conversation'`.
- Compiled documents persist through `SupabaseRagStore.upsert_document_metadata`
  so the existing app catalog / RAG metadata split remains the write path.
- Existing conversation docs with matching content hashes are skipped.
- `_run_graph_downstream_processing(...)` now runs conversation compilation
  before embedding when Outlook source sync is enabled.
- Compiler failures are recorded as Graph downstream errors and included in the
  downstream phase metadata.
- Generic document embedding now skips `source_metadata.document_kind='outlook_conversation'`
  rows so it cannot overwrite Graph-owned email chunks with generic meeting/document chunks.
- The compiler repairs damaged rows whose `content_hash` matches but whose RAG
  `content` / `raw_text` was stripped by another path.

## Initial Constraints

- The primary checkout is dirty on an unrelated feature branch. This task uses
  the clean temporary main worktree at `/tmp/alleato-pm-graph-phase-main`.
- Do not add a parallel Outlook sync owner.
- Do not add schema unless the existing `SupabaseRagStore` path cannot support
  conversation documents.
- Do not hide downstream compiler failures inside a generic Graph sync result.

## Root Cause

Outlook raw intake exists, but conversation-level RAG documents are not a
first-class downstream artifact. That keeps retrieval fragmented around
individual messages and makes downstream embedding/enrichment errors look like
source sync instability.

## Residual Risk

- This slice compiles Outlook conversations only. Teams conversation/day
  documents remain the next separate slice.
- This slice does not run a live production Graph sync. It is covered by focused
  unit/regression tests and will need the next scheduled Render run monitored.
- Very large conversations are capped by `OUTLOOK_CONVERSATION_CONTENT_MAX_CHARS`
  to prevent oversized RAG metadata payloads.

## Final Status

- [x] Required checklist items for this slice are complete.
- [x] Evidence is recorded.
- [x] Remaining work is explicitly scoped as follow-up, not hidden in this slice.

## Failure-Loud Guardrail

This slice is not complete unless the downstream Graph summary reports Outlook
conversation compilation separately and compiler failures are surfaced as
downstream errors, not swallowed as successful sync.
