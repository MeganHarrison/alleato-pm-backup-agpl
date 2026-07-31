# Action log — Outlook Business Area persistence

Task: ALL-11
Session: SBRAINOUTLOOK
Completed: 2026-07-24

## Changed boundary

- Replaced Outlook live-sync and historical-repair use of the project-only
  inference API with the shared typed assignment target.
- Persisted `business_area_id` to application `document_metadata` while keeping
  `project_id` null for mapped internal branches.
- Preserved an existing project or Business Area scope before conversation
  consensus or fresh inference.
- Added Business Area labels to canonical pipeline chunk metadata and retained
  the label in RAG document `source_metadata`.
- Made missing-document rebuilds and learned `not_project` rule replay preserve
  existing Business Area assignments.

## Verification history

1. Initial focused suite passed.
2. Independent review found two historical backfill paths that could drop the
   branch label.
3. Both paths were corrected and covered by regressions.
4. Re-review found a learned-rule replay path that could relabel an existing
   Business Area record as `not_project`.
5. The replay guard was corrected and covered.
6. Final independent review approved the boundary.
7. Final focused suite: 59 passed.

## Provider readback note

The current Vercel-linked project did not expose a Supabase service credential
in its production env, so the attempted fresh provider pull failed loudly and
no secret was printed. Database evidence uses the verified production
management-API readback captured during the immediately preceding ALL-7/ALL-10
foundation and relabel operation.
