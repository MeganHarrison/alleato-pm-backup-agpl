# Handoff: 2026-07-21 — AAI-1190 Submittal Risk API Unlink

## Intake Block

1) Session ID: SROOT1190C
2) Task ID: AAI-1190
3) Linear issue: AAI-1190
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk
5) Current status: Complete — guarded unlink endpoint is published.
6) Files changed (absolute paths): `frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/submittals/[submittalId]/route.ts`; its focused route test; this handoff.
7) Commands run and outcome (pass/fail counts): RED route missing; GREEN focused Jest (1 suite / 2 tests).
8) Evidence artifacts (screenshot/video/report/log paths): focused API guardrail test output.
9) Top 3 findings (frontend-visible issues first): unlink gives a specific unauthorized response before RPC execution; valid unlink routes only through the database-enforced RPC; UI wiring remains owned by SROOT1190B.
10) Recommended next action (one line): wire link list, risk state, and unlink action into the canonical task editor.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT1190C-submittal-risk-api.md`
12) Migration ledger evidence: covered by `20260722000000_schedule_task_submittal_links.sql`, already applied and verified.
13) Task file: `docs/ops/tasks/2026-07-21-aai-1190-submittal-risk.md`

## Linear Updates

- API unlink TDD slice is ready to publish.
- Follow-up correction: independent review found the GET risk read incorrectly filtered `schedule_dependencies.project_id`, which does not exist. The read now derives project scope through `schedule_tasks!inner(project_id)`, and a dependency-read failure returns a specific 400 instead of silently calculating risk without dependent work. TDD: the new GET tests failed before this correction and pass afterward (5/5 focused route tests).
