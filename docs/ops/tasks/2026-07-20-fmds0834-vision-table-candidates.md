# Task: Generate FMDS0834 Vision Table Candidates

Status: Complete
Owner: Codex S208
Created: 2026-07-20
Task ID: AAI-1228
Linear Issue: [AAI-1228](https://linear.app/megankharrison/issue/AAI-1228/generate-fmds0834-vision-table-candidates-for-review)
Related Handoff: `docs/ops/handoffs/2026-07-20-S208-fmds0834-vision-table-candidates.md`

## Objective

Generate structured, revision-locked vision candidates for every FMDS0834 April 2026 table that lacks usable rows, so the canonical review page can compare the authoritative source with an actual candidate transcription.

## Scope

- AI SDK structured extraction and independent visual verification over the existing private evidence images.
- Candidate-only writes to `fmds_visual_review_candidates` in the dedicated ASRS project.
- Table detail/API support for rendering and approving a specifically reviewed structured candidate.
- Excluded: source-table mutation, automatic review events, corpus activation, deterministic rule-card promotion, figure extraction, and FMDS0809 data.

## Source of Truth

- Corpus identity: `FMDS0834`, revision `2026-04`, staging revision only.
- Authoritative content: rendered evidence image and source PDF.
- Provider path: repository AI SDK through Vercel AI Gateway/BYOK.
- Review authority: attributed human decision through `record_fmds_visual_review` only.

## Baseline

- 58 total tables.
- 16 tables have structured source rows/cells.
- 42 tables have no structured source rows, cells, or structured latest candidate.
- 2 tables are reviewed; 56 remain pending.

## Acceptance Criteria

- [x] Generator refuses a non-staging or non-FMDS0834/2026-04 revision.
- [x] Generator targets only tables without usable structured rows/cells/candidates.
- [x] Structured output preserves headings, units, symbols, blank cells, merged-cell meaning, notes, and visible governing text.
- [x] Independent verification reports discrepancies and completeness without silently correcting the candidate.
- [x] Writes are idempotent, candidate-only, and never change review status or activation state.
- [x] The reported Table 2.1.4.5.5 is generated and read back first.
- [x] The canonical detail route shows column headings and candidate rows against the source.
- [x] All remaining missing tables are attempted with explicit success/failure coverage.

## Implementation Checklist

- [x] Inspect live ASRS baseline and local provider/key availability without exposing secrets.
- [x] Inspect the existing queue/batch scripts and AI SDK v7 structured image APIs.
- [x] Add shared candidate schema/readiness helpers and focused tests.
- [x] Add revision-locked AI SDK generator with extraction and verification passes.
- [x] Update the review API to accept only submitted, active, source-matching structured candidates.
- [x] Render candidate column headings and verification status on the canonical detail page.
- [x] Pilot one table, read it back, and verify the frontend.
- [x] Run remaining-table batch and record coverage/status-drift evidence.

## Integration and Verification

- [x] Focused unit/type/lint checks pass.
- [x] Candidate database read-back matches the pilot source identity and retains `status='candidate'`.
- [x] Source review statuses and revision status are unchanged after pilot and batch runs.
- [x] Authenticated desktop and mobile screenshots are attached to AAI-1228.
- [x] Task-owned files are published and remote `main` read-back is recorded.

## Failure-Loudly Contract

- Cause surfaced as: missing evidence, invalid revision/status, provider failure, schema-invalid output, empty rows, verification mismatch, candidate write/read-back failure, or source-status drift.
- Detection path: preflight inventory, per-table result ledger, post-write read-back, status checksum, focused tests, and browser proof.
- Recovery path: leave the source record pending, retain the failed item in the run report, repair the named evidence/provider/schema issue, and rerun idempotently.

## Incident Learning

- Failure fingerprint: a review page has a source image but no usable candidate transcription.
- Root cause: the existing queue seeder copies PyMuPDF output, while the only richer generator covers nine hand-authored Batch 1 objects; neither provides general structured vision extraction for the remaining 42 tables.
- Detection gap: queue coverage counted candidate records, not candidate readiness.
- Prevention: readiness coverage separately counts candidates containing structured rows and fails when a requested item produces none.
- Guardrail evidence: 8 focused tests, a 41-of-41 crop preflight, a 41-of-41 batch ledger, source-status checksums, and authenticated review-route screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live baseline | Revision-scoped ASRS SQL read-back | Pass | 58 total, 16 structured, 42 missing, 2 reviewed, 56 pending. |
| Provider configuration | Environment-name inspection only | Pass | Gateway, OpenAI fallback, ASRS URL, DB URL, and ASRS service secret are present in secured env files. |
| Focused tests | `pnpm --dir frontend exec jest --runInBand --runTestsByPath ...` | Pass | 2 suites, 8 tests; includes merged-cell geometry and flagged-candidate approval guard. |
| Changed-file typecheck | `pnpm --dir frontend run typecheck:changed` | Pass | Task-owned TypeScript compiles. |
| Targeted lint | FMDS schema, server, API, and review-route files | Pass | No targeted lint errors. |
| Crop helper | `python3 -m py_compile scripts/asrs/localize_fmds_table_crop.py` | Pass | Normal, lettered, repeated-dot, and rotated table crops were exercised. |
| Crop preflight | `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/crop-preflight-final.json` | Pass | 41 requested, 41 localized, 0 failed; no writes. |
| Pilot | `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/pilot-localized.json` | Pass | Table 2.1.4.5.5: exact match, complete, 0 discrepancies, 5 columns, 19 rows. |
| Full candidate batch | `docs/ops/evidence/2026-07-20-fmds0834-vision-table-candidates/batch.json` | Pass | 41 requested, 41 generated, 0 failed; 42 total vision-v2 candidates including pilot. |
| Status drift guard | Post-run ASRS read-back | Pass | 56 needs review, 2 reviewed; revision remains staging; review-event count remains 9. |
| UI proof | Desktop, mobile, and flagged-decision screenshots attached to AAI-1228 | Pass | Clean source/candidate comparison and fail-closed review decision are visible. |

## Remaining Risk

- Engineering accuracy still requires human review even when extraction and verifier agree.
- 16 candidates passed the automated visual cross-check; 26 are intentionally marked for needs-changes review because the verifier found a partial extraction or discrepancies.
- Figures remain a separate extraction and verification workstream.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Screenshot gate is satisfied.
- [x] Any deferred failures name cause, detection gap, prevention, owner, and next action.
