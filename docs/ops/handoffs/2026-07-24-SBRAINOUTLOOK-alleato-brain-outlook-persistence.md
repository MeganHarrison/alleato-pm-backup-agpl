# Handoff: 2026-07-24 — Outlook Business Area persistence

## Intake Block

1) Session ID: SBRAINOUTLOOK
2) Task ID: ALL-11
3) Linear issue: ALL-11 — Alleato Brain Phase 3
4) Linear URL:
   [ALL-11](https://linear.app/alleato-group/issue/ALL-11/alleato-brain-phase-3-rewire-routing-permissions-and-ai-retrieval)
5) Current status: independent review approved; verification contract and
   strict handoff check pass; ready for exact-path publication.
6) Files changed:
   - `backend/src/services/integrations/microsoft_graph/outlook.py`
   - `backend/src/services/supabase_helpers.py`
   - `backend/src/services/pipeline/embedder.py`
   - `backend/tests/test_outlook_intake.py`
   - `backend/tests/test_business_area_embedder.py`
   - task, evidence, and this handoff
7) Commands run and outcome:
   - focused adjacent pytest: 59 passed
   - Python compilation: pass
   - `git diff --check`: pass
   - independent final Outlook/embedder pytest: 27 passed
   - independent review: APPROVED after three findings were fixed
   - verification contract: PASS
   - strict handoff check: PASS
8) Evidence artifact:
   `docs/ops/evidence/2026-07-24-alleato-brain-outlook-persistence/`
9) Top findings:
   - Outlook live sync now persists a typed Business Area assignment.
   - Existing scope wins over conversation consensus.
   - Historical repair and missing-document rebuild preserve branch scope.
   - Learned non-project rule replay cannot erase a branch assignment.
   - Canonical chunks carry `business_area_id`.
10) Recommended next action: publish this verified slice, then migrate the
    remaining Graph/Fireflies callers and retrieval authorization.
11) Handoff path:
    `docs/ops/handoffs/2026-07-24-SBRAINOUTLOOK-alleato-brain-outlook-persistence.md`
12) Migration ledger evidence: N/A — no migration in this slice.
13) Task file:
    `docs/ops/tasks/2026-07-24-alleato-brain-outlook-persistence.md`
14) Verification manifest:
    `docs/ops/evidence/2026-07-24-alleato-brain-outlook-persistence/verification-manifest.json`
15) Verification result:
    `docs/ops/evidence/2026-07-24-alleato-brain-outlook-persistence/verification-result.json`

## Failure-Loudly Closeout

- Cause: project-only assumptions in live sync, repair, and rule replay.
- Detection gap: prior tests covered project assignment but not a null-project,
  non-null-Business-Area target across every Outlook lifecycle path.
- Prevention: shared typed target, validated source-metadata parser, exact-scope
  persistence, chunk labels, and regressions covering live, repair, rebuild,
  malformed metadata, and replay.
