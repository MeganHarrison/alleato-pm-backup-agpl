# Independent Review: Canonical RAG Workflow Cutover

Status: Approved
Reviewer: `rag_evidence_review`
Reviewed: 2026-07-29

## Initial finding

The stale Fireflies replay endpoint still made an unauthenticated internal HTTP
request to a now-protected compatibility endpoint.

## Resolution

- Replaced the internal HTTP call with
  `enqueue_document_workflow(..., source_type="fireflies")`.
- Recorded the durable Workflow `runId`.
- Removed the obsolete URL resolver and `requests.post` path.
- Added an ownership regression contract that rejects either deleted endpoint.

## Independent evidence

- Workflow ownership contract: 8/8 passed.
- Caller authentication contract: 4/4 passed.
- No remaining concrete source blocker found.

The reviewer could not run Python tests in its isolated environment because
pytest was unavailable. The owning session independently ran the focused
backend slice: 29 passed, 1 Windows-only SIGALRM skip.
