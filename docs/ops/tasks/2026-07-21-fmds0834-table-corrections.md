# Task: Correct FMDS0834 Changes-Requested Tables

Status: Complete
Owner: Codex S212
Created: 2026-07-21
Task ID: AAI-1242
Linear Issue: [AAI-1242](https://linear.app/megankharrison/issue/AAI-1242/correct-and-approve-fmds0834-changes-requested-tables)
Related Handoff: `docs/ops/handoffs/2026-07-21-S212-fmds0834-table-corrections.md`

## Objective

Correct and independently verify every FMDS0834 April 2026 table candidate
currently marked `changes_requested`, approve only exact source-faithful
transcriptions, embed newly approved structures, and leave the revision staging
until every activation gate passes.

## Scope

- Owned data: table candidates, attributed review events, review status, and
  structured embeddings for revision `65306e47-c25a-4397-92a0-c44c03903d0f`.
- Initial verified batch: Tables `2.2.3.1.2(g)` p33, `2.2.3.2.1` p34,
  `2.2.3.2.3.1` p46, `2.2.4.2.1` p51, and `2.4.3.3.3.1` p111.
- Explicit exclusions: FMDS0809, FMDS0834 figure decisions, corpus activation,
  deterministic engineering-rule activation, and professional-engineer approval.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project
  `vqnnvpnoitqhijkztyhq`, FMDS0834 revision `2026-04`, source SHA-256
  `c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed`.
- Existing shared primitives/services: `record_fmds_visual_review`, the active
  table candidate contract, `scripts/asrs/review_fmds0834_tables.py`,
  `scripts/asrs/embed_reviewed_fmds_structures.py`, and canonical `/fm-global`
  table/detail routes.
- Deprecated or parallel paths: legacy FMDS0809 and `fm_global_tables` are not
  valid sources for these decisions.

Verification contract: Required

## Acceptance Criteria

- [x] Every changes-requested table is compared with its exact source image and
  PDF page; routine discrepancies are corrected by Codex.
- [x] Corrected candidates preserve identifiers, titles, merged headings, every
  row/value, blanks, units, footnotes, governing paragraphs, and source quirks.
- [x] Approval events are append-only, attributed, revision locked, and point to
  exactly one current source-matched candidate.
- [x] Newly approved table structures are embedded and retrieval-tested without
  changing native 225/225 coverage or leaking staging evidence into active RAG.
- [x] Canonical frontend evidence shows the resulting reviewed and pending state.
- [x] Failure-loudly behavior and the staging activation boundary are defined.

## Implementation Checklist

- [x] Files/modules and owned data are listed before edits or mutations.
- [x] Reuse the canonical candidate, review-event, embedding, and exact-source
  citation paths; do not create parallel table storage.
- [x] Correct and apply the first five-table batch transactionally and prove
  idempotence.
- [x] Process the remaining exception queue in deterministic batches with a
  portable decision/correction ledger.
- [x] Errors are specific and actionable; every mutation is read back.

Owned files: `scripts/asrs/review_fmds0834_tables.py`, focused tests under
`scripts/asrs/tests/`, this task/handoff, and
`docs/ops/evidence/2026-07-21-fmds0834-table-corrections/**`.

## Integration and Verification

- [x] Current live inventory and exact active-candidate coverage are captured.
- [x] Focused unit/static checks pass.
- [x] Correction apply and immediate idempotent replay pass.
- [x] Reviewed-table structured embedding coverage and representative retrieval pass.
- [x] Authenticated canonical frontend screenshot is attached to AAI-1242.
- [x] Evidence manifest and independent verification pass.
- [x] Task-owned files are published by exact-file fast-forward and remote
  readback; the unrelated dirty shared checkout is intentionally not mutated.

## Failure-Loudly Contract

- Cause surfaced as: revision/SHA/status mismatch, source-image mismatch,
  ambiguous merged cells, omitted governing text, candidate fingerprint drift,
  a newer review decision, more than one active candidate, native-vector drift,
  embedding failure, or retrieval provenance loss.
- Detection path: revision-locked preflight, source/candidate fingerprints,
  one-transaction apply, postflight SQL readback, idempotent replay, embedding
  coverage, live semantic queries, and authenticated frontend proof.
- Recovery path: roll back the scoped batch, keep the source `needs_review`,
  regenerate only its candidate against the exact crop/page, and rerun validation.

## Incident Learning

- Failure fingerprint: `rag.native-coverage-hides-structured-gaps`
- Root cause: extraction output omitted or flattened source structure while
  complete native vectors made the corpus appear retrievable.
- Detection gap: native embedding coverage did not prove source-faithful table
  structure or governing text coverage.
- Prevention: separate reviewed-structure coverage, exact candidate/event
  provenance, source-image comparison, and activation gates.
- Guardrail evidence: AAI-1234 exception ledger, this correction ledger,
  post-apply validation, embedding idempotence, and retrieval artifacts.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1242 and this task file | In progress | Scope and done gate captured before table mutations. |
| Initial independent re-audit | five-table verdict | Pass | Four approval-ready; p46 requires the visible §2.2.3.2.3.2 governing paragraph. |
| Live preflight | `preflight-initial-batch.json` | Pass | 58 tables; 15 reviewed, 43 pending; exactly one active candidate per table. |
| Correction guardrail | `correct_fmds0834_tables.py` and focused test | Pass | Ruff passed; 3/3 tests passed; revision/candidate/event fingerprints, row-cell insertion, and transactional replay enforced. |
| First correction apply | `initial-correction-apply.json` | Pass | Page-46 table approved with complete §2.2.3.2.3.2 governing text; coverage 16 reviewed / 42 pending. |
| Correction idempotence | `initial-correction-idempotence.json` | Pass | Immediate replay returned `already_applied`; no duplicate candidate/event. |
| Structured embedding | `initial-embedding-apply.json` and `initial-embedding-idempotence.json` | Pass | Three new chunks embedded; rerun inserted/embedded 0; coverage 16/16 tables and 60/60 figures. |
| Live semantic retrieval | `initial-retrieval.json` | Pass | Exact structured rank 1, combined staging rank 2, governing paragraph present, active result count 0. |
| Main publication | `a842d16c2bba0b9a4c150b398bfe0475a7078887`, `cb179c019707b05a33882ff8f2f8c46d9c4cac29`, `01b2da1a9c3f182e1632af952908e90640d69ee5` | Pass | Done gate, correction runner/evidence, and safe locking fix published before live apply. |
| Second source review | pages 12, 47, 49, and 71 full-page evidence | Pass | Grid fidelity confirmed; complete governing instructions/footnotes restored; visible p47 `(0)` source inconsistency preserved. |
| Second correction apply | `second-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 20 reviewed / 38 pending. |
| Second embedding apply | `second-embedding-apply.json` and idempotence report | Pass | 13 chunks added; rerun added 0; coverage 20/20 tables and 60/60 figures, native unchanged. |
| Second live retrieval | `second-retrieval.json` | Pass | Four of four exact sources in structured top 5; active result count 0 for every query. |
| Third source review | pages 40, 73, 86, and 93 full-page evidence | Pass | Three prior reviewer flags were disproved by the source; one real `IRAs` to `IRAS` header error was corrected, and complete governing text was restored. |
| Third correction apply | `third-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 24 reviewed / 34 pending. |
| Third embedding apply | `third-embedding-apply.json` and idempotence report | Pass | 10 chunks added; rerun added 0; coverage 24/24 tables and 60/60 figures, native 225/225 unchanged. |
| Third live retrieval | `third-retrieval.json` | Pass | Four of four exact sources ranked first in structured retrieval; combined staging ranks were 1, 1, 7, and 9; active result count 0. |
| Third pre-apply publication | `4220144714716f6361ecfcf90ec9f9722c5fd56e` | Pass | Source images, locked ledger, validation, and column-patch guardrail published to `origin/main` before live mutation. |
| Fourth source review | pages 42, 63, 64, and 70 full-page evidence | Pass | False line-break/revision-color flags were rejected; page 70's omitted second footnote and the page-62 green-cell meaning for pages 63-64 were restored. |
| Fourth correction apply | `fourth-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 28 reviewed / 30 pending. |
| Fourth embedding apply | `fourth-embedding-apply.json` and idempotence report | Pass | 10 chunks added; rerun added 0; coverage 28/28 tables and 60/60 figures, native 225/225 unchanged. |
| Fourth live retrieval | `fourth-retrieval.json` | Pass | Four of four exact sources in structured top 5; all present in combined staging top 24; active result count 0. |
| Fourth pre-apply publication | `5e86b7c4d3237d5e71c7141bc278818fc3464c30` | Pass | Source images, locked ledger, and validation published to `origin/main` before live mutation. |
| Fifth source review | pages 62, 72, 78, and 80 full-page evidence | Pass | Complete notes/footnotes and selection/design rules restored; page 78's short body row was repaired with a tested cell-insertion guardrail. |
| Fifth correction apply | `fifth-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 32 reviewed / 26 pending. |
| Fifth embedding apply | `fifth-embedding-apply.json` and idempotence report | Pass | 8 chunks added; rerun added 0; coverage 32/32 tables and 60/60 figures, native 225/225 unchanged. |
| Fifth live retrieval | `fifth-retrieval.json` | Pass | Four of four exact sources in structured top 5 and combined staging top 17; active result count 0. |
| Fifth pre-apply publication | `c98d755d17af30639863076b8628f310bd9f4a6b` | Pass | Source images, locked ledger, validation, and cell-insertion guardrail published to `origin/main` before live mutation. |
| Sixth source review | pages 43, 44, and 55 full-page evidence | Pass | Short continuation rows and an absorbed header were repaired; six `Pendant` values were corrected to source `Pendent`; full footnotes and design rules restored. |
| Sixth correction/embedding/retrieval | `sixth-*` evidence | Pass | Four approvals; replay added 0; 10 chunks added then 0; coverage 36/36 tables and 60/60 figures; four sources in structured top 5; active results 0. |
| Seventh correction apply | `seventh-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 40 reviewed / 18 pending. |
| Seventh vector-color semantics | `seventh-correction-ledger.json` and pages 27-30 source images | Pass | Green cell fill was read from PDF vector geometry and preserved as qualified per-height options with the source-defined 250 gpm hose demand and 1-hour duration. |
| Seventh embedding/retrieval | `seventh-embedding-apply.json`, idempotence report, and `seventh-retrieval.json` | Pass | 16 chunks added; rerun added 0; coverage 40/40 tables and 60/60 figures; all four sources in structured top 5 and staging top 50; active results 0; native 225/225 unchanged. |
| Seventh pre-apply publication | `45bfe5bd5afd9126c15db768ae1b36453eb33877` | Pass | Locked ledger, validation, and full source-page evidence published to `origin/main` before live mutation. |
| Eighth correction apply | `eighth-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 44 reviewed / 14 pending. |
| Eighth title and footnote repair | `eighth-correction-ledger.json` and `eighth-title-readback.json` | Pass | Corrected the page-33 `Sprnkler` source-title typo transactionally, repaired its merged header, restored all Table 2.2.3.1.2(f) footnotes, and read the corrected database title back exactly. |
| Eighth embedding/retrieval | `eighth-embedding-apply.json`, idempotence report, and `eighth-retrieval.json` | Pass | 10 chunks added; rerun added 0; coverage 44/44 tables and 60/60 figures; all four sources in structured top 5 and staging top 50; active results 0; native 225/225 unchanged. |
| Eighth pre-apply publication | `f50895d3e08acbb7b3a80586e546d6b9fee0d145` | Pass | Tested source-title correction guardrail, locked ledger, validation, and pages 31-33 evidence published to `origin/main` before live mutation. |
| Ninth correction apply | `ninth-correction-apply.json` and idempotence report | Pass | Two approvals applied; replay returned two `already_applied`; coverage 46 reviewed / 12 pending. |
| Ninth whole-table repair | `ninth-correction-ledger.json` and pages 39/41 source images | Pass | Restored four crop-omitted body rows per table, completed the truncated rows, repaired the full-table merge spans, restored three footnotes, and preserved green no-balance/virtual-floor semantics. |
| Ninth embedding/retrieval | `ninth-embedding-apply.json`, idempotence report, and `ninth-retrieval.json` | Pass | 8 chunks added; rerun added 0; coverage 46/46 tables and 60/60 figures; all four semantic cases in structured top 5 and staging top 50; active results 0; native 225/225 unchanged. |
| Ninth pre-apply publication | `dcdac510e27f0ddf972ffd9a848b4df8867a2d55` | Pass | Tested source-locked row-insertion guardrail, locked ledger, validation, and pages 39/41 evidence published to `origin/main` before live mutation. |
| Tenth correction apply | `tenth-correction-apply.json` and idempotence report | Pass | Four approvals applied; replay returned four `already_applied`; coverage 50 reviewed / 8 pending. |
| Tenth full-page adjudication | `tenth-correction-ledger.json` and pages 45/50/56/58 source images | Pass | Rejected false merge/cell objections, preserved the printed `10 @ 22 (1.0)` source quirk, kept the following table separate from the p56 footnote, and restored the p49 green-option note plus Sections 2.2.4.2.2.2-.4. |
| Tenth embedding/retrieval | `tenth-embedding-apply.json`, idempotence report, and `tenth-retrieval.json` | Pass | 13 chunks added; rerun added 0; coverage 50/50 tables and 60/60 figures; all four sources in structured top 5 and staging top 50; active results 0; native 225/225 unchanged. |
| Tenth pre-apply publication | `d89fa58ddec28c1aae66dc9f88742b680ee6b1f0` | Pass | Locked ledger, validation, and pages 45/50/56/58 evidence published to `origin/main` before live mutation. |
| Eleventh correction apply | `eleventh-correction-apply.json` and idempotence report | Pass | Six approvals applied; replay returned six `already_applied`; coverage 56 reviewed / 2 pending. |
| Eleventh source adjudication | `eleventh-correction-ledger.json` and pages 59/74/79/84 source images | Pass | Corrected four p74 merge spans; restored three complete p84 footnotes and Sections 2.2.7.2.2.2-.4; preserved p74 `0 (3.0)`, p79 `tandard-Response`, and the p59 title/header distinction. |
| Eleventh embedding/retrieval | `eleventh-embedding-apply.json`, idempotence report, and `eleventh-retrieval.json` | Pass | 15 chunks added; rerun added 0; coverage 56/56 tables and 60/60 figures; all six sources in structured top 5 and staging top 50; active results 0; native 225/225 unchanged. |
| Eleventh pre-apply publication | `b5604b0b2296240ea6daf7e9da698d856fe43658` | Pass | Locked ledger, validation, and pages 59/74/79/84 evidence published to `origin/main` before live mutation. |
| Final correction apply | `twelfth-correction-apply.json` and idempotence report | Pass | Two approvals applied; replay returned two `already_applied`; coverage 58 reviewed / 0 pending with exactly one active candidate for every table. |
| Final page-100 source review | `twelfth-correction-ledger.json` and `page-100-source.png` | Pass | Removed the duplicate merged header cell in Table 2.3.2.4.6.1; confirmed both grids and preserved source-printed numeric and header quirks. |
| Final embedding/retrieval | `twelfth-embedding-apply.json`, idempotence report, and `twelfth-retrieval.json` | Pass | 4 chunks added; rerun added 0; coverage 58/58 tables and 60/60 figures; both exact sources ranked 1-2 in structured and staging retrieval; active results 0; native 225/225 unchanged. |
| Final pre-apply publication | `4eff90b85fddc1111f15615b3eba34d9361a0ece` | Pass | Tested cell-deletion guardrail, locked ledger, validation, and page-100 evidence published before mutation. |
| Full corpus readiness | `final-corpus-verification.json` | Pass | 122/122 rendered pages, 225/225 native embeddings, 58/58 tables, 60/60 figures, 9/9 rule cards, complete storage evidence, six representative retrieval checks, zero blockers; `activation_ready=true`. |
| Canonical table frontend | `fmds0834-reviewed-tables.png` and `fmds0834-reviewed-table-detail.png` | Pass | Authenticated port-3000 UI shows FMDS0834 2026-04, 58 rows, reviewed status, authoritative source crop, exact candidate, and signed PDF-page links. |
| Live AI Gateway preflight | `openai/gpt-5.4` five-word smoke prompt | Pass | New `vck_` Gateway key returned `OK`; local, Development, Preview, and Production configuration was read back without exposing the value. |
| Live FMDS RAG question | `fmds0834-rag-chat-proof.png` | Pass with follow-up | Answer returned 250 gpm / 60 min with Table 2.1.4.5.4, PDF page 12, and 950 L/min. The citation identity is correct; clickable chat citation remains cutover follow-up. |
| Sixth pre-apply publication | `b96a84398ab870ee7894e5f337b4bd48a075ed6e` | Pass | Source images, locked ledger, and validation published before mutation. |

## Remaining Risk

- No table candidates are excluded from authoritative structured retrieval.
  Revision activation is technically ready but remains a separate explicit
  cutover action, as defined by this task's scope boundary.
- The chat answer's source identity is correct but is not yet a clickable PDF-page
  citation. The AI cutover task owns that product guardrail.
- The shared checkout contains unrelated concurrent-session files; this task was
  published by exact-file fast-forward and remote readback without disturbing them.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred activation has cause, prevention, owner, and next action.
