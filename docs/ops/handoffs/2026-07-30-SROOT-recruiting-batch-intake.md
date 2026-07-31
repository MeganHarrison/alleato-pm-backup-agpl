# Recruiting Batch Intake Handoff

1) Session ID: SROOT44
2) Task ID: ALL-44
3) Linear issue: ALL-44
4) Linear URL: https://linear.app/alleato-group/issue/ALL-44/m2-requisitions-and-applicant-intake
5) Current status: Complete
6) Files changed (absolute paths): Task-owned recruiting feature, hook, contract/service, API, tests, migration, generated DB types, task, and handoff paths in this workspace
7) Commands run and outcome (pass/fail counts): migration apply PASS; live DB smoke PASS including direct-audit-bypass rejection; focused unit/component 28/28 PASS; authenticated desktop/mobile workflow PASS; broad typecheck FAIL on pre-existing repository errors, with no remaining task-path errors
8) Evidence artifacts (screenshot/video/report/log paths): [verification summary](../../../tests/agent-browser-runs/2026-07-30-recruiting-batch-intake-final/VERIFICATION_SUMMARY.md), actions log, database readback, desktop/mobile screenshots, and the final browser video
9) Top 3 findings (frontend-visible issues first):
   - Jazmin requested a guarded original-resume viewer; it is now available.
   - Jazmin requested Not Qualified as a visible pipeline outcome; it is now available.
   - Jazmin requested batch intake before requisition assignment; the unassigned resume inbox now supports it.
10) Recommended next action (one line): Monitor the production deployment, then let Jazmin test with approved synthetic resumes until malware scanning is configured.
11) Handoff file path: docs/ops/handoffs/2026-07-30-SROOT-recruiting-batch-intake.md
12) Migration ledger evidence: the recruiting migration and corrected historical migration both pass the linked-ledger verifier; direct schema readback confirmed nullable `application_id`, `batch_id`, and positive `row_version`.

## Scope

- Private original-resume viewer
- Guarded multi-file UAT batch upload
- Unassigned resume inbox and requisition assignment
- Auditable Not Qualified pipeline outcome

## Ownership

- `frontend/src/features/recruiting/**`
- `frontend/src/hooks/use-recruiting/**`
- `frontend/src/lib/recruiting/**`
- `frontend/src/app/api/recruiting/**`
- `frontend/src/app/(main)/recruiting/**`
- `frontend/tests/e2e/recruiting-production.spec.ts`
- `supabase/migrations/20260730210000_recruiting_batch_intake.sql`
- `supabase/tests/recruiting_batch_intake.sql`
- `frontend/src/types/database.types.ts`
- Task and handoff files named above

## Acceptance Contract

- Uploads are private, explicitly authorized, bounded, and per-file observable.
- Unassigned candidates can be assigned once without losing provenance.
- Resume access is short-lived and recruiter-authorized.
- Not Qualified uses disposition semantics, a required reason, and an audit event.
- Real-file upload stays unavailable until scanner readiness is verified.

## Evidence

- Live batch uploaded two renamed copies of the approved synthetic fixture.
- One resume was downloaded from the unassigned inbox, assigned to the open UAT requisition, downloaded again from candidate detail, and marked Not Qualified with a required reason.
- The second resume remained unassigned during the proof.
- Both synthetic records and storage objects were deleted through the supported UAT cleanup API after screenshots were captured.
- Desktop and mobile browser consoles had no errors in the final states.
