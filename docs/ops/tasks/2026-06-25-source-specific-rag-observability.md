# Source-Specific RAG Observability Contract

Date: 2026-06-25
Session: S91
Linear: AAI-638
Parent: AAI-636
Status: Complete for AAI-638 Gate; Broader Finalization Continues

## Objective

Recover the source-specific RAG contract so recent Teams retrieval proves it checks live Microsoft Graph and the indexed Supabase fallback with explicit, source-specific observability before model synthesis.

## Scope

- AI assistant source-specific RAG retrieval content for recent Teams discussions.
- Existing source-specific verifier contract.
- Focused regression coverage for Teams retrieval observability.
- No new retrieval implementation and no legacy fallback path.

## Done Checklist

- [x] Create task markdown before implementation.
- [x] Inspect the failing source-specific verifier contract.
- [x] Confirm live Microsoft Graph and indexed Supabase fallback paths already exist.
- [x] Patch the canonical source-specific RAG formatting path.
- [x] Add or update focused regression coverage.
- [x] Run focused unit coverage for source-specific RAG.
- [x] Re-run `npm run rag:verify:source-specific`.
- [x] Update handoff/parent audit evidence and Linear.

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific-after-aai-639.txt` - failing baseline after AAI-639.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific-rag-unit-after-observability-fix.txt` - focused Jest coverage passed.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific-after-observability-fix.txt` - source-specific contract verifier passed.

## Current Findings

- The failing contract is not missing live Microsoft Graph or indexed Supabase retrieval.
- `frontend/src/lib/ai/retrieval/source-specific-rag.ts` already calls `fetchRecentTeamsMessagesFromGraph`, queries stored Teams rows, hydrates from RAG metadata, and reports the `document_metadata/document_chunks-backed Teams index`.
- The failing gap is explicit Teams row-count observability: the verifier requires `Retrieved ${rows.length} Teams row(s)`.
- Fixed the canonical Teams evidence block to include `Retrieved ${rows.length} Teams row(s)` and the indexed Teams fallback source path before model synthesis.
- Added focused Jest coverage so Teams prefetch evidence must include both the Teams row count and `document_metadata/document_chunks-backed Teams index`.

## Failure-Loud Guardrail

This task fails loudly if recent Teams source-specific RAG can return evidence without stating the retrieval count and checked source path, or if the assistant can silently fall back to generic source lookup for a source-specific Teams prompt.
