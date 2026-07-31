# Handoff: 2026-07-21 — FMDS0834 Table Review

## Intake Block

1) Session ID: S210
2) Task ID: AAI-1234
3) Linear issue: AAI-1234
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1234/review-remaining-fmds0834-tables-and-embed-approved-structures
5) Current status: Accepted — all 56 originally pending tables have attributed outcomes; 13 are approved and embedded, while 43 remain fail-closed with specific correction notes; evidence checkpoint `28856ddef` is published and AAI-1234 is Done.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/scripts/asrs/localize_fmds_table_crop.py`, `/Users/meganharrison/Documents/github/project-management/scripts/asrs/review_fmds0834_tables.py`, `/Users/meganharrison/Documents/github/project-management/scripts/asrs/tests/test_localize_fmds_table_crop.py`, task/handoff/orchestration records, and `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-21-fmds0834-table-review/**`.
7) Commands run and outcome (pass/fail counts): crop unit tests pass 4/4; Python compilation and Ruff pass; ledger validation passes 56/56 with one active non-native-grid candidate per table; idempotent replay reports 56 `already_applied`; post-review verification reports 15/15 reviewed table sources embedded in 22 structured chunks and 225/225 native chunks unchanged; three exact-source semantic retrieval checks pass; authenticated canonical frontend proof was captured.
8) Evidence artifacts (screenshot/video/report/log paths): `final-decision-ledger.json`, `final-ledger-validation.json`, `idempotence-result.json`, `post-review-verification.json`, `embedding-dry-run.json`, `new-table-retrieval.json`, `review-summary.md`, `independent-review.md`, `frontend-review-status.png`, and `frontend-approved-detail.png` under `docs/ops/evidence/2026-07-21-fmds0834-table-review/`. Linear attachments: `46232b37-7b6e-4cb3-bc04-7df942a180e0` and `31beda21-3800-46c7-a713-4e47237949b6`.
9) Top 3 findings (frontend-visible issues first): canonical `/fm-global` now displays the source-separated FMDS0834 review states and exact reviewed detail evidence; the rotated-page failure was a raw-versus-display coordinate mismatch now guarded by tests; green-highlight semantics, missing footnotes/governing text, merged-header loss, and ambiguous OCR remain pending instead of entering authoritative RAG.
10) Recommended next action (one line): publish the scoped closeout, verify `HEAD == origin/main`, mark AAI-1234 accepted, then begin AAI-1235 figure review without activating the corpus.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-S210-fmds0834-table-review.md`
12) Migration ledger evidence: N/A — this task reuses the applied review and structured-embedding schema.

Task file: `docs/ops/tasks/2026-07-21-fmds0834-table-review.md`
Verification manifest: `docs/ops/evidence/2026-07-21-fmds0834-table-review/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-21-fmds0834-table-review/verification-result.json`

## Scope Boundary

This session owns remaining FMDS0834 table transcription review only. Figures
are tracked in AAI-1235 and cannot be folded into this task before S210 is
accepted.

## Cause, Detection Gap, and Prevention

- Cause: rotated pages mixed raw PDF coordinates with displayed crop geometry,
  and native vector coverage obscured missing authoritative table structures.
- Detection gap: crop completeness and active-candidate shape were not enforced
  before batch review.
- Prevention: display-coordinate normalization, crop-content regression tests,
  revision/SHA-locked ledger fingerprints, exactly-one-active-candidate checks,
  fail-closed review events, idempotent replay, and post-write embedding and
  retrieval verification.

## Verification Summary

- Pass: 56/56 original pending table sources received explicit attributed
  outcomes; 13 approved and 43 changes requested.
- Pass: 58/58 total table sources have exactly one active candidate; zero active
  `native_grid` candidates remain.
- Pass: 15/15 reviewed table sources have structured embeddings (22 chunks),
  with exact FMDS0834 source identity returned by semantic retrieval.
- Pass: the corpus is still staging and active retrieval returns zero results,
  so incomplete tables and figures cannot silently reach production chat.
- Deferred to AAI-1235: 54 pending figures and corpus activation.

## Current Status

- Reviewed all 56 table sources that were pending at intake.
- Embedded the 13 source-faithful approvals and retained 43 incomplete or
  ambiguous candidates in pending review with exact correction notes.
- Preserved staging isolation; no incomplete source is active in chat RAG.

## Known Pitfalls

- The 43 changes-requested tables are not authoritative and require corrected
  candidates before approval.
- The 54 pending figures remain a separate AAI-1235 review gate.
- This task does not authorize corpus activation or professional engineering
  approval of a sprinkler design.

## Linear Updates

- Kickoff comment: AAI-1234 records the revision-locked review scope.
- Milestone evidence: authenticated dashboard and approved-detail screenshots
  were uploaded as Linear attachments `46232b37-7b6e-4cb3-bc04-7df942a180e0`
  and `31beda21-3800-46c7-a713-4e47237949b6`.
- Review handoff: this handoff and its strict verification result will be posted
  before acceptance; Linear comment `4939b6e7-81cd-4a42-9ad8-febcfc2d7be2`.
- Completion comment: `e3d111df-8db6-4416-8e0c-b141a8608ef8`.

## Publication Readback

- Evidence/implementation checkpoint: `28856ddef`
- Published branch: `origin/main`
- Local/remote equality: verified immediately after push
- Linear status: Done
