# Handoff: 2026-07-20 — FMDS0834 Vision Table Candidates

## Intake Block

1) Session ID: S208
2) Task ID: AAI-1228
Task file: `docs/ops/tasks/2026-07-20-fmds0834-vision-table-candidates.md`
3) Linear issue: AAI-1228
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1228/generate-fmds0834-vision-table-candidates-for-review
5) Current status: Complete — implementation, candidate generation, database read-back, screenshot evidence, scoped publication, and remote `main` read-back pass.
6) Files changed (absolute paths): task/handoff/evidence; FMDS table crop helper; AI SDK vision generator/schema/tests; scoped review detail/API/form/server/type files.
7) Commands run and outcome (pass/fail counts): focused Jest 2 suites/8 tests pass; changed-file typecheck passes; targeted ESLint passes; Python compile passes; crop preflight 41/41 passes; AI batch 41/41 passes; authenticated desktop/mobile route proof passes.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/pilot-localized.json`; `crop-preflight-final.json`; `batch.json`; `pilot-review-desktop.png`; `pilot-review-mobile-comparison.png`; `flagged-review-decision.png`; Linear attachments `6da28739-9475-4fa2-94bf-016d0fafea10`, `e712c040-79c0-4e30-a77b-6e3be0b61b9f`, and `c8bb366f-853e-4975-8064-ec599757b201`.
9) Top 3 findings (frontend-visible issues first): the review route now compares a localized authoritative crop with a structured candidate; merged headers/blank cells render without column shifting; verifier-flagged candidates default to Needs changes and cannot be approved.
10) Recommended next action (one line): Publish the scoped files, then review the 16 clean candidates before correcting/re-extracting the 26 verifier-flagged candidates.
11) Handoff file path: `docs/ops/handoffs/2026-07-20-S208-fmds0834-vision-table-candidates.md`
12) Migration ledger evidence: Not applicable; existing ASRS tables, storage bucket, and review RPC are reused.

## Scope

- Included: AI SDK vision extraction, independent candidate verification, candidate-only ASRS writes, and canonical table-review proof.
- Owned paths: exact AAI-1228 task/handoff/evidence, the vision candidate generator/schema, and scoped table detail/API/type/tests.
- Excluded: figures, FMDS0809, review-status mutation, review-event creation, activation, and deterministic rule cards.

## Linear Updates

- Kickoff/milestone updates were posted during implementation.
- Screenshot evidence attachments: `6da28739-9475-4fa2-94bf-016d0fafea10`, `e712c040-79c0-4e30-a77b-6e3be0b61b9f`, `c8bb366f-853e-4975-8064-ec599757b201`.
- Evidence milestone comment: `5cb6ad52-0fc0-4759-98d2-c46979dfa2b5`.

## Baseline Evidence

| Check | Result |
| --- | --- |
| Revision | FMDS0834 / 2026-04 / staging |
| Tables | 58 total; 16 structured; 42 missing structured candidates |
| Review status | 2 reviewed; 56 pending |
| Existing generator | Nine hand-authored Batch 1 objects only |

## Changed Files

- `scripts/asrs/localize_fmds_table_crop.py`
- `frontend/scripts/asrs/generate-fmds-table-vision-candidates.ts`
- `frontend/src/lib/fmds/fmds-vision-candidate.ts`
- `frontend/src/lib/fmds/__tests__/fmds-vision-candidate.test.ts`
- `frontend/src/lib/fmds/fmds-tables.server.ts`
- `frontend/src/app/api/fmds/tables/[tableId]/review/route.ts`
- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/page.tsx`
- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/review-form.tsx`
- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/review-form.unit.test.tsx`
- `frontend/src/types/asrs-database.types.ts`
- `docs/ops/tasks/2026-07-20-fmds0834-vision-table-candidates.md`
- `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/`

## Migration Ledger Evidence

- No migration planned; existing review-candidate and review-event contracts are reused.

## Command Evidence

| Command / artifact | Result |
| --- | --- |
| Focused Jest suites | Pass: 2 suites, 8 tests |
| `pnpm --dir frontend run typecheck:changed` | Pass |
| Targeted FMDS ESLint | Pass |
| `python3 -m py_compile scripts/asrs/localize_fmds_table_crop.py` | Pass |
| `crop-preflight-final.json` | Pass: 41/41 localized, 0 failed |
| `pilot-localized.json` | Pass: exact, complete, 0 discrepancies |
| `batch.json` | Pass: 41/41 generated, 0 failed |
| ASRS post-run read-back | Pass: 56 needs review, 2 reviewed, revision staging, 9 review events |

## Artifacts

- `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/pilot-review-desktop.png`
- `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/pilot-review-mobile-comparison.png`
- `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/flagged-review-decision.png`
- All three are attached to Linear AAI-1228.

## Risks and Next Step

- Risk: visual agreement is not engineering approval. The system created 16 clean candidates and kept 26 verifier-flagged candidates in needs-changes review; none were auto-approved or activated.
- Remaining scope: figure extraction is separate and no deterministic rule card may use an unapproved candidate.
- Published implementation commit: `2d21d5fc7` on `main`.
- Next: process the 16 clean candidates first and route the 26 flagged candidates through correction/re-extraction.
