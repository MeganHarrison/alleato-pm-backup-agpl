# Handoff: RAG source health repair

Date: 2026-07-30
Session: S20260730-RAGHEALTH
Task: AAI-1280-RAG-HEALTH-REPAIR
Status: Pending backup publication

## Ownership

- `backend/src/services/health/source_sync_health.py`
- `backend/tests/test_source_sync_health.py`
- AI/RAG architecture and functionality documents named in the isolated workspace lease
- This task, council report, and handoff

## Acceptance Contract

- Retired owners cannot degrade current source health.
- Current ingestion, vectorization, promotion, subscription, and retrieval failures remain visible and actionable.
- Production readback and a scoped retrieval probe are required.
- The functionality catalog must identify the owner, route, source, status, and failure behavior for every Eve capability.

## Current Evidence

- Production health at 2026-07-30 reported 344 sources, 289 alerts, 2,036 sampled documents without chunks, 57 SharePoint bootstrap folders, 282 missing SharePoint promotion rows, one unconfigured Graph subscription, and 25 old stuck Fireflies items.
- The returned alert window was monopolized by 77 retired teams_chat rows last attempted in April/May 2026.
- Current Teams DM sync writes `teams_chat_export`.
- Acumatica historical AR payment application lines remain blocked by the provider endpoint and are not being represented as complete.

## Implementation

- Retired teams_chat live and snapshot rows are excluded through the shared
  inactive Graph-resource predicate.
- Graph freshness now consumes the canonical
  `microsoft_graph_source_sync` receipt for the aggregate and parent-owned
  sub-sources.
- The complete assistant and RAG ownership documents now contain the current
  production metrics and exact remaining operational owners.

## Verification

- Canonical focused test file: 28 passed.
- Independent reviewer: approved with no findings.
- Production recompute: 61 sources, five alerts, zero retired Teams rows, Graph
  aggregate healthy at nine minutes.

## Release Evidence

- Canonical code: `7629c90f3381cac924c9730978a11cc2db60df9d`
- Canonical freshness follow-up: `77909c04861c52de6964035cc40c54309973fbcb`
- Learning registry: `b0012343a7bd5b8f27eb05e5afd9df6917e4b7bf`

## Remaining Work

- Publish this backup mirror and documentation.
- Use the Render control plane to run or resize the owning Graph/SharePoint
  crons; direct backend web triggers correctly return `503` in API-only mode.
- Expose the Acumatica payment-application GI.
