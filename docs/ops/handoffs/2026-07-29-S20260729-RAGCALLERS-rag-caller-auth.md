# RAG compatibility caller authentication handoff

**Session:** S20260729-RAGCALLERS  
**Task:** AAI-1280-RAG-CALLERS  
**Delivery lane:** High-risk  
**Status:** Ready for integration

## Change

All four remaining operator callers of the compatibility endpoint now send the
existing `ADMIN_API_KEY` in `x-admin-api-key` and fail or report explicitly when
the credential is absent:

- `scripts/rag/detect-under-embedded-docs.mjs`
- `scripts/jobplanner/import-submittal-documents.mjs`
- `scripts/ops/requeue-vision-analysis.mjs`
- `frontend/scripts/trigger-pipeline-batch.ts`

The change pairs with the authenticated `/api/pipeline/process` route owned by
session `S20260729-RAGVERIFY`.

## Evidence

- `node --test scripts/verify/__tests__/rag-pipeline-callers-auth-contract.test.mjs`
  — pass, four callers checked.
- `node --check` for all three JavaScript operator scripts — pass.
- `git diff --check` — pass.

## Failure accounting

- **Cause:** the compatibility endpoint inherited its historical public
  database-trigger contract even after database-side HTTP fan-out was disabled.
- **Detection gap:** ownership verification asserted delegation but did not
  assert ingress authentication or caller credentials.
- **Prevention:** the route now fails closed and static regression tests require
  both route authentication and authenticated maintenance callers.

## Migration ledger evidence

No database migration was created or changed.
