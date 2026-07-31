# Handoff: 2026-07-22 — Backend Project Intelligence projection consolidation

## Intake Block

1) Session ID: SROOT-AAI-1250
2) Task ID: AAI-1250
3) Linear issue: AAI-1250
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1250/unify-backend-project-intelligence-scheduled-projection-jobs
5) Current status: Complete — published, deployed, and production-run verified
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/backend/src/services/project_intelligence/**`, former projection paths, exact backend consumers/tests, `render.yaml`, architecture/runbook/task/handoff/evidence
7) Commands run and outcome (pass/fail counts): py_compile/help pass; 32 focused assertions pass; independent review approved; both Render services live on `f412171e6`; controlled project and domain runs pass
8) Evidence artifacts (screenshot/video/report/log paths): Linear attachment `940d4493-3b25-4bef-8104-5bce11757b24`; Render runs `crn-d8ne6u8js32c73dkbre0-1784718439` and `crn-d83o1gkvikkc73cpcmb0-1784719409`
9) Top 3 findings: live Render retained deleted/obsolete ownership; domain projection budgeting was per-target instead of run-wide; a skipped target incorrectly hid four failed domain targets behind exit zero
10) Recommended next action (one line): continue parent AAI-1032 with the shared packet-compiler and frontend ledger consolidation; do not reopen the completed scheduler boundary.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-backend-project-intelligence-projection-consolidation.md`
12) Migration ledger evidence: N/A — no schema change.

## Linear Updates

- Kickoff comment: posted
- Milestone comments: live drift and production-run findings recorded at completion
- Completion comment: posted (`65699b7f-ed93-4f31-b943-bfec728ac6f6`); issue moved to Done

## Current Status

Implementations are moved, former paths are deleted locally and remotely, both live schedules use the one canonical runner, cumulative write budgets are enforced, and controlled production runs succeeded.

## Exact Next Step

Continue the parent architecture issue AAI-1032 with the large shared compiler and frontend ledger/promotion consolidation.

## Known Pitfalls

- Preserve the event-driven Graph sync path; only scheduled executable ownership changes.
- Keep domain and project-sweep cadence separate in Render while unifying the executable.
- Do not leave import wrappers at former module paths.

## Resume Commands

```bash
rg -n "run_domain_packet_compiler|project_synthesizer|domain_compiler|project_intelligence" render.yaml backend/src backend/tests
```
