# Task: Review Remaining FMDS0834 Tables

Status: Complete
Owner: Codex S210
Created: 2026-07-21
Task ID: AAI-1234
Linear Issue: [AAI-1234](https://linear.app/megankharrison/issue/AAI-1234/review-remaining-fmds0834-tables-and-embed-approved-structures)
Related Handoff: `docs/ops/handoffs/2026-07-21-S210-fmds0834-table-review.md`

## Objective

Review every remaining FMDS0834 April 2026 table extraction against its exact
source evidence, approve only source-faithful structured transcriptions, embed
the approved structures, and give Megan only a bounded exception list.

## Scope

- Owned runtime state: pending table records, table candidates, attributed
  review events, and approved table structured embeddings for revision
  `65306e47-c25a-4397-92a0-c44c03903d0f` in the dedicated ASRS project.
- Owned implementation/evidence: rotated-page crop correction, one idempotent
  review runner, focused tests, task/handoff, evidence, and S210 orchestration
  rows.
- Explicit exclusions: figures (AAI-1235), FMDS0809, rule-card promotion,
  corpus activation, and professional-engineer approval of a real design.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project
  `vqnnvpnoitqhijkztyhq`, FMDS0834 revision `2026-04`, source PDF SHA-256
  `c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed`.
- Existing shared primitives/services: `record_fmds_visual_review`,
  `fmds_visual_review_candidates`, source evidence in `fmds-source-evidence`,
  `scripts/asrs/embed_reviewed_fmds_structures.py`, and
  `scripts/asrs/verify_fmds0834.py`.
- Deprecated or parallel paths: legacy FM Global tables and FMDS0809 are not
  valid review sources for this task.

Verification contract: Required

## Acceptance Criteria

- [x] Every pending FMDS0834 table has an explicit outcome: approved,
  changes requested/rejected, or exception with a specific reason.
- [x] Every approval is backed by the exact evidence image, one source-matched
  candidate, attributed reviewer notes, and revision identity.
- [x] Headings, merged headers, rows, values, units, footnotes, and boundary
  language are compared without silently changing engineering meaning.
- [x] Approved tables have structured embeddings and exact-source retrieval.
- [x] Failure-loudly behavior is defined and unreviewable rows remain pending.
- [x] Relevant existing guards are identified before database mutation.
- [x] Corpus activation remains blocked until all table and figure gates pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Reuse the canonical review RPC and approved-structure embedding runner.
- [x] Correct rotated-page evidence localization and add a regression test so
  the target caption, full header, grid, and footnotes remain visible.
- [x] Add an idempotent, revision-locked batch review runner with dry-run and
  explicit exception output.
- [x] Errors are specific and actionable.
- [x] Database/provider contracts and exact source provenance are handled.

Owned files: `scripts/asrs/localize_fmds_table_crop.py`,
`scripts/asrs/review_fmds0834_tables.py`,
`scripts/asrs/tests/test_localize_fmds_table_crop.py`,
`docs/ops/tasks/2026-07-21-fmds0834-table-review.md`,
`docs/ops/handoffs/2026-07-21-S210-fmds0834-table-review.md`,
`docs/ops/evidence/2026-07-21-fmds0834-table-review/**`, and S210 rows in the
session board/review queue.

## Integration and Verification

- [x] Dry-run inventory proves exact revision, candidate, and evidence scope.
- [x] The 16 malformed native-grid candidates are replaced by revision-locked
  vision candidates generated from corrected evidence crops.
- [x] Focused static/unit checks pass.
- [x] Live review-event and table-status readback matches the decision ledger.
- [x] Approved-structure embedding coverage has zero reviewed-table gaps.
- [x] Exact semantic retrieval returns reviewed table source identity.
- [x] Evidence report and viewable screenshot are attached to AAI-1234.
- [x] Independent review approves the decision ledger and evidence.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: wrong document/revision, missing or multiple active
  candidates, missing evidence, incomplete/low-confidence transcription,
  source/candidate mismatch, provider failure, or embedding coverage drift.
- Detection path: dry-run ledger, database guard/RPC response, candidate
  comparison diagnostics, crop-content assertions, post-review coverage query,
  and semantic verifier.
- Recovery path: leave the source pending, record the exact exception, correct
  or regenerate only its candidate, then rerun the idempotent review runner.

## Incident Learning

- Failure fingerprint: `rag.native-coverage-hides-structured-gaps`
- Root cause: native PDF vectors can be complete while unreviewed structured table candidates remain unaudited and therefore unavailable as authoritative RAG.
- Detection gap: the remaining review queue was reported to Megan instead of being source-compared by Codex and reduced to a true exception list.
- Prevention: revision-locked AI review produces a source-linked decision ledger, fails closed on ambiguity, and immediately verifies embedding drift.
- Guardrail evidence: `scripts/asrs/review_fmds0834_tables.py`, `scripts/asrs/tests/test_localize_fmds_table_crop.py`, `final-ledger-validation.json`, and `post-review-verification.json`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1234 | Pass | Scope and done gate captured before database writes. |
| Candidate inventory | Live ASRS readback | Pass | 56 pending tables; 40 vision and 16 malformed native-grid active candidates; every row has one active candidate and source evidence. |
| Vision-upgrade smoke test | `vision-upgrade-smoke.json` | Failed closed | No review status changed. It exposed a rotated-page crop coordinate mismatch that omitted the left header and title. |
| Rotated-page crop regression | `python -m unittest scripts.asrs.tests.test_localize_fmds_table_crop` | Pass | Four tests cover display-coordinate conversion, stored-box compatibility, trailing footnotes, and next-table boundaries. |
| Corrected source evidence | `page-028-corrected-crop.png` and `.json` | Pass | The crop contains the full title, merged headings, grid, green cell semantics, and all three footnotes. |
| Decision ledger | `final-decision-ledger.json` and `final-ledger-validation.json` | Pass | 56/56 attributed outcomes: 13 approved, 43 changes requested; revision and candidate fingerprints are locked. |
| Replay guard | `idempotence-result.json` | Pass | All 56 events returned `already_applied`; zero duplicate events were created. |
| Candidate coverage | `final-ledger-validation.json` | Pass | 58/58 tables have exactly one active candidate; active malformed native-grid candidates: 0. |
| Embedding coverage | `post-review-verification.json` | Pass | 15/15 reviewed table sources embedded; 22 structured chunks; 225/225 native chunks unchanged. |
| Semantic retrieval | `new-table-retrieval.json` | Pass | Three newly approved tables return exact FMDS0834 table/page citations; active retrieval remains zero while staging. |
| Frontend proof | `frontend-review-status.png` and `frontend-approved-detail.png` | Pass | Canonical `/fm-global` shows reviewed/pending statuses; detail route shows FMDS0834 source beside the approved candidate. Attached to AAI-1234. |
| Independent audit | `independent-review.md` | Pass | Disputed approval was kept pending when adjacent governing text was omitted; green-highlight meaning fails closed. |

## Remaining Risk

- Figures remain a separate review slice owned by AAI-1235. No table decision
  may be treated as full FMDS design coverage or corpus activation approval.
- The 43 `changes_requested` tables require candidate correction and another
  source-image review before they can be embedded.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
