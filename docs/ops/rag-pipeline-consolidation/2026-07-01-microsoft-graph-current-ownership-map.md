# Microsoft Graph Current Ownership Map

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: [AAI-848](https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover)

## Related Links

- Implementation task doc: [2026-07-01-rag-pipeline-consolidation-implementation-tasks.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-implementation-tasks.md)
- Architecture proposal: [2026-07-01-rag-pipeline-consolidation-architecture-proposal.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-architecture-proposal.md)
- Fireflies ownership map: [2026-07-01-fireflies-current-ownership-map.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-fireflies-current-ownership-map.md)

## Objective

Map the currently active Microsoft Graph-derived source family so the next consolidation slice can remove one competing runtime owner at a time.

## Source Family Included Here

- Outlook email intake
- Outlook webhook mailbox drain
- Teams channel sync
- Teams DM export
- OneDrive / SharePoint file sync
- Microsoft Graph embedding follow-through
- Outlook attachment promotion into project documents

## Current Runtime Owners

### 1. Render cron entrypoints

Current live cron surfaces in [render.yaml](/Users/meganharrison/Documents/alleato-pm/render.yaml):

- `alleato-teams-channel-sync`
  - command: `timeout 25m python3 scripts/run_graph_teams_channel_sync.py`
  - owner shape: direct script
- `alleato-teams-dm-sync`
  - command: `timeout 10m python3 scripts/run_graph_teams_dm_sync.py`
  - owner shape: direct script
- `alleato-graph-sync`
  - command: `timeout 25m python3 scripts/run_graph_sync.py`
  - owner shape: dedicated direct script
- `alleato-graph-subscription-reconcile`
  - command: `timeout 5m python3 src/scripts/run_graph_subscription_reconcile.py`
  - owner shape: direct script
- `alleato-graph-webhook-drain`
  - command: `timeout 5m python3 scripts/run_graph_webhook_drain.py`
  - owner shape: dedicated script

### 2. Scheduler-owned Graph runtime

Current active scheduler ownership in [backend/src/services/scheduler.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/scheduler.py):

- no remaining scheduler-owned Graph sync or subscription-reconcile runtime wrappers

The remaining Graph-family ownership seam is now phase-specific cron entrypoints versus source-family direct scripts, not APScheduler ownership.

### 3. Manual / API trigger surfaces

Current active API/manual surfaces in [backend/src/api/main.py](/Users/meganharrison/Documents/alleato-pm/backend/src/api/main.py):

- `POST /api/graph/sync`
- `POST /api/graph/outlook/sync-mailbox`
- `POST /api/graph/outlook/live-inbox`
- `POST /api/graph/outlook/reclassify-intake`
- `POST /api/graph/outlook/apply-filter-rule`
- `POST /api/graph/outlook/subscribe-mailbox`

Current active admin repair/backfill surfaces in [backend/src/api/admin_endpoints.py](/Users/meganharrison/Documents/alleato-pm/backend/src/api/admin_endpoints.py):

- `POST /documents/onedrive-project-backfill`
- OneDrive/SharePoint path enrichment backfill
- OCR admin pass hooks that affect Graph-derived file records

### 4. Direct source-family processing owners

Current Graph-family processing owners:

- [backend/src/services/integrations/microsoft_graph/sync.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/integrations/microsoft_graph/sync.py)
  - fetches changed Outlook / Teams / SharePoint rows
- [backend/src/services/integrations/microsoft_graph/embed.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/integrations/microsoft_graph/embed.py)
  - vectorizes pending Graph-derived document rows
- [backend/src/services/integrations/microsoft_graph/attachment_promotion.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/integrations/microsoft_graph/attachment_promotion.py)
  - promotes Outlook attachments into project documents
- [backend/src/services/ingestion/sync_followups.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/ingestion/sync_followups.py)
  - still owns shared post-sync follow-through such as communication project backfill

### 5. Direct generic pipeline bypass still present

[backend/src/services/url_resource_ingestion.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/url_resource_ingestion.py) still calls `run_full_pipeline(document_id)` directly. This is not Microsoft Graph-specific, but it is an existing example of source-specific work bypassing a single canonical lifecycle owner.

## Keep / Replace / Delete Assessment

### Keep

- Direct source sync logic in `integrations/microsoft_graph/sync.py`
- Direct Graph embedding logic in `integrations/microsoft_graph/embed.py`
- Outlook attachment promotion logic in `integrations/microsoft_graph/attachment_promotion.py`
- Admin/manual endpoints that are still needed for bounded operator control, as long as they target the canonical owner

### Replace

- Any remaining generic phase-runner entrypoint that mutates Graph source flags instead of exposing a dedicated owner script
- Outlook downstream duplicate attachment ownership:
  - `backend/src/services/integrations/microsoft_graph/outlook.py` still writes direct attachment-backed document rows
  - `backend/src/services/integrations/microsoft_graph/attachment_promotion.py` separately promotes the same Outlook intake attachment data
- Inline comms intelligence hooks in source modules that compete with project-level synthesis ownership:
  - `outlook.py`
  - `teams.py`
  - `embed.py`

### Delete After Cutover

- Superseded generic Graph phase-runner entrypoints once dedicated direct scripts are live and proven
- Any manual replay surface that still drives old Graph-specific behavior instead of the canonical owner
- SharePoint knowledge-route bypass in `frontend/src/app/api/knowledge/sync-sharepoint/route.ts` once the canonical Graph file owner replaces it
- Generic Graph document triggers that still depend on `/api/pipeline/process`:
  - `frontend/src/lib/documents/pipeline-trigger.ts`
  - `frontend/scripts/trigger-pipeline-batch.ts`

## Best Next Cutover Boundary

The best next cutover boundary is Outlook downstream ownership after intake persistence:

`outlook_email_intake/document_metadata persisted` -> one owner for attachment promotion, vectorization, and project/task/card outcomes

Reason:

- This is the clearest same-data double-owner problem in the Graph family.
- It matches the user’s stated preference for fixing one real workflow seam completely instead of only moving wrappers around.
- The current duplicate path is concrete:
  - `sync_outlook_emails(...)` in `outlook.py` fetches and persists intake rows
  - `outlook.py` also writes direct attachment-backed document/project-document rows
  - `attachment_promotion.py` separately promotes from intake into project documents
  - source-level inline compiler hooks compete with project-level synthesis ownership
- Fixing this boundary removes more real ambiguity than a scheduler-only cleanup by itself.

## Recommended First Graph Slice

### Slice goal

Keep Outlook fetch + intake persistence, then make one downstream owner responsible for attachment promotion, vectorization, and project/task/card follow-through.

### In scope

- Keep `sync_outlook_emails(...)` as fetch + intake persistence only
- Make `attachment_promotion.py` the only attachment-to-document owner
- Keep `embed_pending_graph_documents(...)` as the only Graph vectorization owner
- Keep `synthesize_new_comms_since(...)` as the only project/task/card owner for Graph communications
- Remove inline source-module hooks that compete with those owners
- Prove one Outlook item still flows from intake to document/vector/project/task outcome without the duplicate owners

### Out of scope for the first Graph slice

- Rewriting all Outlook manual admin endpoints
- Choosing the final long-term scheduler surface for every Graph cron
- Wider generic pipeline consolidation such as `url_resource_ingestion.py`
- Removing every Graph repair/backfill script

## Evidence Collected So Far

- Render cron layout mixes direct script entrypoints and inline Python entrypoints for the same source family.
- `scheduler.py` still owns Graph sync, webhook drain, embedding, subscription reconcile, and attachment promotion wrappers.
- `backend/src/api/main.py` still exposes multiple manual Graph control surfaces, which makes it important to pick one narrow boundary first instead of trying to replace everything in one step.
- Outlook attachment parity gap discovered during implementation readiness review:
  - `_sync_email_attachment(...)` in `outlook.py` used to upload attachment bytes to storage, extract text for supported files, dedupe by content hash, and write richer `document_metadata`
  - `attachment_promotion.py` now matches that required byte-copy/extraction/dedupe behavior for the promoted attachment path
  - the duplicate direct attachment writer has now been deleted from `outlook.py`
- Canonical downstream proof captured for attachment `outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc`:
  - promoted from Outlook intake attachment row `id=6`
  - linked `document_metadata.status='embedded'` in the app DB
  - linked AI DB `rag_document_metadata.embedding_status='embedded'`
  - linked AI DB `document_chunks` count = `9`
  - canonical `synthesize_new_comms_since(...)` reviewed the project window and produced a clean zero-yield result for cards/tasks on this attachment
- Competing inline Graph intelligence hooks removed for this cutover:
  - deleted the inline Outlook source-intelligence trigger from `sync_outlook_emails(...)`
  - deleted the inline Graph embed completion trigger from the normal Graph document embed path
- Scheduler duplicate-owner cleanup completed for this slice:
  - deleted the scheduler-owned `graph_embedding` registration/wrappers in `backend/src/services/scheduler.py`
  - deleted the scheduler-owned `outlook_attachment_promotion` registration/wrappers in `backend/src/services/scheduler.py`
  - created live Render cron `crn-d92m440k1i2s73d2n0g0` / `alleato-graph-webhook-drain`
  - deleted the scheduler-owned `graph_webhook_drain` registration/wrappers in `backend/src/services/scheduler.py`
  - `run_graph_sync(...)` remains the single automated owner that performs Outlook/SharePoint sync, Graph embedding, attachment promotion, and event-driven synthesis in one cycle
  - first direct live run on the new cron failed because Render built from `origin/main` before `backend/scripts/run_graph_webhook_drain.py` existed there, so the image lacked `/app/scripts/run_graph_webhook_drain.py`
  - second live failure after push exposed one env gap: the cron needed `SUPABASE_SERVICE_ROLE_KEY` in its direct service env set
  - after adding that env var and forcing one API deploy, the direct cron ran successfully and returned a clean no-work result

## Current Recommendation

Repeat the Fireflies pattern on the Outlook downstream boundary first:

1. keep Outlook fetch/intake persistence
2. keep `attachment_promotion.py` as the only attachment-to-document owner
3. keep `embed.py` as the only vectorization owner
4. keep `project_synthesizer.py` as the only project/task/card owner
5. use the live proof above as the deletion proof for the first Outlook downstream slice
6. continue the next Graph slice from the Teams-only crons and remaining operator/reporting surfaces, because Graph sync, subscription-reconcile, and webhook-drain now each have dedicated direct cron owners with live success proof
