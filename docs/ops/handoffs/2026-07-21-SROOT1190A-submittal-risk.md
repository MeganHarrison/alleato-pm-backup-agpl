# Handoff: 2026-07-21 — AAI-1190 Submittal Schedule Risk

## Intake Block

1) Session ID: SROOT1190A
2) Task ID: AAI-1190
3) Linear issue: AAI-1190
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk
5) Current status: In Progress — shared risk evaluator, guarded link API, and applied project-safe link storage are green; unlink and canonical UI are next.
6) Files changed (absolute paths): task contract and this handoff; data/API paths are reserved in the isolated workspace registry.
7) Commands run and outcome (pass/fail counts): PASS isolated workspace ownership created from current `origin/main`; RED evaluator and route imports missing; GREEN focused Jest (2 suites / 6 tests); PASS `npm run db:migrations:verify-applied -- supabase/migrations/20260722000000_schedule_task_submittal_links.sql`.
8) Evidence artifacts (screenshot/video/report/log paths): Linear AAI-1190 kickoff and this task contract.
9) Top 3 findings (frontend-visible issues first): no existing schedule-to-submittal relationship owner exists; submittals provide `required_approval_date`, `required_on_site_date`, workflow responses, and canonical detail routes; schedule task editor is the canonical activity editing surface.
10) Recommended next action (one line): add the guarded migration and red unlink test, then apply and read back the live database contract.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT1190A-submittal-risk.md`
12) Migration ledger evidence: `20260722000000_schedule_task_submittal_links.sql` applied through the configured Supabase migration connector and ledger verification passed; live SQL readback confirms the link table and both guarded RPCs.
13) Task file: `docs/ops/tasks/2026-07-21-aai-1190-submittal-risk.md`

## Linear Updates

- Kickoff pending after the task contract is committed.
