# Handoff: 2026-07-21 — Canonical Session Write Lease

## Intake Block

1) Session ID: S209
2) Task ID: AAI-1232
3) Linear issue: AAI-1232
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1232/prevent-codex-dirty-checkout-collisions-with-a-canonical-writer-lease
5) Current status: Pending Review
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/AGENTS.md`, `/Users/meganharrison/Documents/github/project-management/scripts/ops/checkout-session-gate.mjs`, `/Users/meganharrison/Documents/github/project-management/scripts/ops/__tests__/checkout-session-gate.test.mjs`, `/Users/meganharrison/Documents/github/project-management/docs/ops/learning/recurring-failures.yaml`, `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-21-canonical-session-write-lease.md`, `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-21-S209-canonical-session-write-lease.md`.
7) Commands run and outcome (pass/fail counts): `node --test scripts/ops/__tests__/checkout-session-gate.test.mjs` passed (4/4); status readback detected the current unsafe state without mutation.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/tasks/2026-07-21-canonical-session-write-lease.md` Evidence table.
9) Top 3 findings (frontend-visible issues first): No frontend surface; current checkout is on a deleted branch with concurrent dirty work.
10) Recommended next action (one line): Reconcile the 54 current dirty paths into owned publish/defer sets, then recover this checkout to `main` and bootstrap the lease.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-S209-canonical-session-write-lease.md`
12) Migration ledger evidence: N/A — no migrations.

## Current Status

The repository-owned concurrency boundary is implemented and tested. It does not remove existing worktrees, branches, or diffs.

## Linear Updates

- Kickoff and implementation comment posted to AAI-1232: https://linear.app/megankharrison/issue/AAI-1232/prevent-codex-dirty-checkout-collisions-with-a-canonical-writer-lease#comment-ca80ce68

## Known Pitfalls

- Do not bootstrap or force a lease while the current checkout is dirty or on a non-main branch. That failure is the guardrail preserving the existing work; recovery requires owner attribution first.
