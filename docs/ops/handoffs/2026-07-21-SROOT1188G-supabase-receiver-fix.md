# Handoff: 2026-07-21 — AAI-1188 Supabase Receiver Fix

## Intake Block

1) Session ID: SROOT1188G
2) Task ID: AAI-1188
3) Linear issue: AAI-1188
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1188/calculate-cpm-float-and-calendar-aware-schedule-impacts
5) Current status: In Progress — targeted code/tests pass; deployment proof pending.
6) Files changed (absolute paths): calendar API route/tests, scheduling Gantt service/tests, task/handoff documentation.
7) Commands run and outcome (pass/fail counts): PASS focused Jest (2 suites/7 tests).
8) Evidence artifacts (screenshot/video/report/log paths): canonical authenticated API response showed the pre-fix 500; post-deployment browser artifact pending.
9) Top 3 findings (frontend-visible issues first): calendar GET and Gantt GET fail together on detached Supabase `.from`; direct invocation restores the client receiver; regressions make the failure loud.
10) Recommended next action (one line): publish, wait for exact deployment, then capture calendar and Gantt browser/API proof.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT1188G-supabase-receiver-fix.md`
12) Migration ledger evidence: not applicable.
13) Task file: docs/ops/tasks/2026-07-21-aai-1188-supabase-receiver-fix.md

## Linear Updates

- Runtime root-cause and test update: `d3b67e06-c0da-4456-a8bf-d69909b05ad7`.
