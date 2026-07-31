# Handoff: 2026-07-22 — AAI-1191 Revision API

## Intake Block

1) Session ID: SROOT1191C
2) Task ID: AAI-1191
3) Linear issue: https://linear.app/megankharrison/issue/AAI-1191/add-baselines-revisions-and-controlled-schedule-publishing
4) Current status: In Progress — project-scoped revision API contracts are published; canonical UI remains.
5) Files changed: revision collection/current/transition routes and 3 focused route suites.
6) TDD evidence: all three route suites first failed because the routes did not exist; green result is 5/5.
7) Failure-loudly behavior: invalid payloads return 400, expired authentication returns 401 before DB access, permission errors map to 403, and the current endpoint returns 404 rather than draft/review fallback.
8) Next action: reuse the canonical schedule page for snapshot/review/publish controls and server-computed baseline comparison.
