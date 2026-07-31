# Phase 2 evidence — Branch relabeling (ALL-7)

Executed: 2026-07-23 ~21:15 UTC via Supabase Management API
Script: additive `UPDATE`s only; every row keeps its original `project_id`
stamp (parallel-run design). No deletes, no access tightening.

## Count verification (before == after, exact)

| Branch | Docs before (by project) | Docs after (by branch) | Chunks before | Chunks after |
| --- | --- | --- | --- | --- |
| Leads (756) | 46 | 46 | 695 | 695 |
| AI (767) | 14 | 14 | 9 | 9 |
| Finance (60) | 1,302 | 1,302 | 5,763 | 5,763 |
| Internal Ops (90) | 242 | 242 | 5,981 | 5,981 |
| Marketing (89) | 511 | 511 | 203 | 203 |
| **Total** | **2,115** | **2,115** | **12,651** | **12,651** |

- Rows carrying BOTH stamps (project + branch): **2,115** — intended until Phase 6 cutover.
- Chunks stamped with `business_area_id` before run: 0 (no double-stamping).
- App DB: `document_metadata.business_area_id` set from `business_area_project_map`.
- RAG DB: `document_chunks.metadata.business_area_id` (JSON number) set by `metadata->>'project_id'` match.

The initial 12,651 count is a point-in-time migration snapshot. A fresh
2026-07-24 readback found 12,581 current chunks and proved exact parity between
the current branch-label count and the current retained legacy-container count.
The 70-row change is normal chunk lifecycle churn, not label loss.

## Plan refinement recorded

The `access_level='restricted'` flip for Finance rows moved from Phase 2 to
Phase 3 so Finance content never has a window of being hidden from legitimate
users before branch permissions reach the AI tool layer and memberships are
seeded.

## Rollback for this phase

- App DB: `update document_metadata set business_area_id = null where project_id in (756,767,60,89,90)`
- RAG DB: `update document_chunks set metadata = metadata - 'business_area_id' where metadata->>'project_id' in ('756','767','60','89','90')`
