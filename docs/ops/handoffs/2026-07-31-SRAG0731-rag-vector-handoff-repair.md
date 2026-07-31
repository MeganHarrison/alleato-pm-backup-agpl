# RAG vector handoff repair

Session: SRAG0731
Status: In Progress
Delivery lane: High-risk

## Root cause and changes

- Production backend lacked its dedicated RAG database URL and service-role key. Both were added individually and verified by secure readback.
- Metadata upserts now always materialize a RAG replica, including `no_text` rows.
- Existing OneDrive/SharePoint rows missing that replica fall through to full rehydration.
- Teams DM scheduler state now maps `user:<email>` keys instead of starving all but the alphabetical first mailbox.
- Graph phases have per-phase timeouts and retain OCR immediately before embedding; the outer cron window is 55 minutes.
- Production lifecycle constraint now permits `workflow_queued` (ledger version `20260731183000`).

## Verification

- Focused backend suite: 91 passed, 1 skipped.
- Independent review: no findings.
- Production env/config deploy: live and healthy at the ownership boundary.
- Remaining: exact local-day replay, source-level chunk/vector counts, retrieval smoke, and affected packet refresh.

## Migration ledger evidence

- `20260731183000 | allow_workflow_queued_source_processing_status`
- Constraint readback includes `workflow_queued`.

## Safe replay boundary

Use one authenticated `POST /api/pipeline/process` per exact local-day backlog ID, at no more than five concurrent requests. Do not run the historical batch drain. Rehydrate only failed SharePoint scopes `26-114`, `26-117`, `26-119`, and `26-124`, then refresh only projects actually represented by successfully embedded records.
