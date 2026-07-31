# Project Intelligence

This is the ownership boundary for the governed Project Intelligence workflow.

The module is intentionally split by responsibility:

- `core/` — run and publication contracts plus policy shared by adapters.
- `runner/` — the only canonical scheduled Daily Brief executable.
- `projections/` — packet, operating-record, task, report, and recommendation writers.
- `web/` — read-only route and UI adapters.
- `ingestion/` — upstream source adapters only.
- `maintenance/` — manual backfill and repair tools; never cron targets.

All Node Project Intelligence compiler, runner, source-corpus, projection, and
maintenance functionality is owned here. The former `scripts/intelligence/**`
functional paths were deleted when their implementations moved. Backend Python
intelligence services remain active collaborators until AAI-1250 consolidates
their scheduled projection ownership; each migrated owner is deleted from its
former path in the same change.
