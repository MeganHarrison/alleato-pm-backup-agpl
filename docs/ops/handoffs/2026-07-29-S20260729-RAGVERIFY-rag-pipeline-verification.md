# RAG Workflow ownership verification handoff

**Session:** S20260729-RAGVERIFY  
**Task:** AAI-1280-RAG-VERIFY  
**Delivery lane:** High-risk  
**Status:** Integrated into backup `main`

## Completed

- Added a seven-test ownership contract for the exact Workflow stage order,
  durable run creation, ingress and stage authentication, retry classification,
  compatibility delegation, and source-specific FastAPI stage behavior.
- Changed `/api/pipeline/process` from an unauthenticated historical ingress to
  an `ADMIN_API_KEY`-protected compatibility adapter.
- Replaced its stale in-process orchestration documentation with the actual
  Vercel Workflow delegation contract.
- Paired the endpoint change with authenticated updates to every remaining
  operator caller in the RAGCALLERS slice.

## Evidence

- `npm run test:rag:workflow-ownership` — pass, 7/7.
- `node --test scripts/verify/__tests__/rag-pipeline-callers-auth-contract.test.mjs`
  — pass, 4/4.
- `python -m py_compile backend/src/api/main.py` — pass.
- Pre-commit route, retired-artifact, system-map, and nonproduction-route gates
  — pass.
- Backup `main` readback:
  `75b8dbf6c9d54b6071f38b8815cea02afde7a305`.

## Not yet release-complete

The backup implementation remains ahead of canonical production. Live Render
does not expose the stage route, source jobs remain stale, and a deployed
source-to-Eve-citation trace is still outstanding. This handoff verifies and
publishes the repository ownership boundary; it does not certify the live
production migration.

## Failure accounting

- **Cause:** the older public compatibility ingress survived after the
  database-side trigger owner was disabled.
- **Detection gap:** no regression test asserted authentication and sole durable
  ordering ownership together.
- **Prevention:** route and caller authentication tests now fail if either side
  drifts, while the ownership test prevents FastAPI from regaining orchestration.

## Migration ledger evidence

No database migration was created or changed.
