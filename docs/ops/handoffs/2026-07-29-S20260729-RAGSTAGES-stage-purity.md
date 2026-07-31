# RAG stage-purity and live-data verification handoff

**Session:** S20260729-RAGSTAGES

**Task:** AAI-1280-STAGE-PURITY

**Delivery lane:** High-risk

**Status:** Ready for integration

## Code improvements

- Removed the hidden call from Microsoft Graph embedding into the vision
  analyzer. Embed now consumes existing page intelligence and never executes a
  different stage.
- Made the Workflow-owned vision stage handle Graph PDF documents directly.
- Added the persisted Graph source values "outlook_email",
  "outlook_attachment", and "teams_dm" to the ownership classifier.
- Expanded the ownership regression test so those source names and the
  no-hidden-vision invariant cannot regress.

## Live-data evidence

### SharePoint PDF

- Project: 34.
- Workflow-owned vision: 7 pages analyzed.
- Isolated embed: 3.34 seconds.
- Vector readback: 10 chunks, comprising 3 text and 7 `vision_page` chunks.
- Retrieval: the document was the top project-34 result with 8/8
  source-filtered results and 8 metadata references.

### Newly acquired Outlook record

- Incremental acquisition: 21 Outlook plus 33 Teams-DM records, 54 total, zero
  errors; embedding/OCR/attachment promotion were disabled during acquisition.
- Selected record: persisted `outlook_email`, project 178, 1,810 characters.
- Corrected stage behavior: parse skipped, vision returned `not a PDF`, embed
  produced one appropriately sized chunk, extract skipped.
- Retrieval: the new record was the top project-178 result with 8/8
  source-filtered results and 7 metadata references.

## Focused checks

- `npm run test:rag:workflow-ownership` — pass, 7/7.
- `python -m py_compile` for the stage runner and Graph embedder — pass.
- `git diff --check` — pass.

## Remaining release boundary

The backup implementation is verified against live data, but live Render still
does not expose `/api/pipeline/stages/{stage}` and the production web
application does not expose the Eve/Workflow ingress. A visible deployed Eve
citation remains unproved until the canonical production repository/deployments
receive this cutover.

## Failure accounting

- **Cause:** Graph embedding retained a legacy vision fallback and the source
  classifier did not include actual persisted Outlook/Teams aliases.
- **Detection gap:** static ownership documentation did not execute a newly
  acquired record through every adapter.
- **Prevention:** the regression test now enforces stage purity and persisted
  source aliases; live verification uses one new acquisition and one
  vision-bearing PDF.

## Migration ledger evidence

No database migration was created or changed.
