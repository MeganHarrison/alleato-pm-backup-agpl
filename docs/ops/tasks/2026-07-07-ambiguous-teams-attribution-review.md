# Ambiguous Teams Attribution Review

Status: In Progress
Owner: Codex
Linear: AAI-998
Linear URL: https://linear.app/megankharrison/issue/AAI-998/stage-ambiguous-teams-project-attribution-rows-for-review
Started: 2026-07-07

## Objective

Make the remaining unassigned Teams conversation rows explicit review items instead of silent attribution gaps, without guessing project assignments from weak evidence.

## Scope

- Inspect the remaining unassigned Teams rows after shared attribution repair.
- Stage pending review attribution records for ambiguous project-like Teams rows.
- Verify Teams sync/vectorization/project-intelligence health after review staging.
- Push the task evidence to `origin/main`.

## Out Of Scope

- Guessing project assignment without a unique project name, number, or curated rule.
- New schema or code changes.
- Broad backfills outside Teams.

## Checklist

- [x] Remaining unassigned Teams rows inspected.
- [x] Pending review attribution records staged.
- [x] Live Teams health verified after review staging.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Post shared-attribution repair, Teams health was:
  - Synced: `10/10 healthy`.
  - Vectorized: `7/7 healthy`, `3` low-content rows excluded.
  - Project assigned: `3/6 warning`, `4` excluded.
  - Task extraction: `6/6 healthy`.
  - Project intelligence: `3/3 healthy`.
- Remaining unassigned inspected rows:
  - `teamsdm_734b810fa98e1a0c_2026-07-06`: drawing/sub bid drawings/electrical/ESI context, no unique project name or number.
  - `teamsdm_7fc2caab56a6154c_2026-07-06`: NewBrick/Dryvit/60 percent drawings context, no unique project name or number.
  - `teamsdm_c3e2df591742922c_2026-07-06`: Fire Protection bid package/publish context, no unique project name or number.
- Rows not to auto-assign:
  - `teamsdm_cb6f98af5c2b209d_2026-07-06` is Indiana Office volunteer/internal coordination; low-confidence content match is not safe.
  - `teamsdm_858eabf19d4b0e5e_2026-07-06`, `teamsdm_2610c5c4e55d11cc_2026-07-06`, and `teamsdm_29fbe7cc151fa3ca_2026-07-06` are terminal low-content/admin rows.
- Review records inserted:
  - `039fd494-2464-4685-9d29-bee9aaaa4a6e` for `teamsdm_734b810fa98e1a0c_2026-07-06`.
  - `3974614f-b9b0-4226-8990-19572bf64987` for `teamsdm_7fc2caab56a6154c_2026-07-06`.
  - `557ced38-30d6-4df6-aaf0-01f38b78aeb0` for `teamsdm_c3e2df591742922c_2026-07-06`.
- Review record shape:
  - `document_attribution_candidates.status='pending_review'`.
  - `attribution_method='review_required:no_unique_project_identifier'`.
  - `candidate_project_id=NULL`.
  - `matched_fields=['document_chunks.text']`.
- Live Teams health after review staging:
  - Synced: `10/10 healthy`.
  - Vectorized: `7/7 healthy`, `3` low-content rows excluded.
  - Project assigned: `3/6 warning`, `4` excluded.
  - Task extraction: `6/6 healthy`, `4` excluded.
  - Project intelligence: `3/3 healthy`, `4` excluded.
  - Graph conversation chunks: `healthy`.

## Notes

- This closes the silent-gap problem. It intentionally does not make the remaining `3/6` assignment warning disappear because the correct state is review-needed until stronger evidence exists.
