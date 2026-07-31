# Handoff: 2026-07-21 — Parallel Session Isolation

## Intake Block

1) Session ID: S211
2) Task ID: AAI-1239
3) Linear issue: AAI-1239
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1239/add-recoverable-orphan-work-handling-to-the-canonical-checkout-writer
5) Current status: In Progress
6) Files changed (absolute paths): `/Users/meganharrison/.codex/isolated-workspaces/S211-AAI-1239/scripts/ops/isolated-session-workspace.mjs`; focused test; task/handoff; leader and worker runbooks
7) Commands run and outcome (pass/fail counts): syntax pass; focused Node tests 3/3 pass
8) Evidence artifacts (screenshot/video/report/log paths): https://uploads.linear.app/ba18f798-951f-4d5a-88ee-952e1985c6eb/dca63cde-f57a-4248-90b0-253ee4c5cd4e/282f53ad-a7f9-4187-b148-34224f7bf8b2; `/Users/meganharrison/.codex/session-quarantine/20260721T182744Z-unowned-asrs-corpus-access/MANIFEST.md`
9) Top 3 findings (frontend-visible issues first): another task cleared S211's live lease; session labels were spoofable ownership; path leases still shared a dangerous Git index
10) Recommended next action (one line): Publish this lifecycle, create AAI-1237's isolated workspace, and resume Project Intelligence.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-S211-checkout-orphan-recovery.md`
12) Migration ledger evidence: N/A — no database migration is in scope.

## Linear Updates

- Kickoff: AAI-1239 records the blocking coordination incident.
- Milestone: implementation runs in an isolated worktree and 3/3 lifecycle tests pass.

## Current Status

Implementation, focused verification, and the Linear screenshot pass. Linear closeout, canonical integration, and publication remain.

## Exact Next Step

Capture the workflow receipt, attach it to AAI-1239, then integrate the exact commit.

## Known Pitfalls

- Never mutate product work directly in canonical main.
- Never treat a session label as identity; ownership is bound to `CODEX_THREAD_ID`.
- Never retire a workspace until its head exists on `origin/main`.
