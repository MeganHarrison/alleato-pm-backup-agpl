# Handoff: 2026-07-26 — Training resource reviewer flow

## Intake Block

1) Session ID: S224
2) Task ID: ALL-24
3) Linear issue: ALL-24
4) Linear URL: https://linear.app/alleato-group/issue/ALL-24/t10-reviewer-publish-flow
5) Current status: Complete
6) Files changed (absolute paths): `/home/friday/.codex/isolated-workspaces/s224-all-24-9b54b4/frontend/src/app/(main)/training/**`, `/home/friday/.codex/isolated-workspaces/s224-all-24-9b54b4/frontend/src/features/training/ResourceCard.tsx`, its focused test, `/home/friday/.codex/isolated-workspaces/s224-all-24-9b54b4/frontend/src/lib/training/**`, `/home/friday/.codex/isolated-workspaces/s224-all-24-9b54b4/supabase/tests/training_resource_library.sql`, generated project/app/system maps, this handoff, the task, and its two screenshots.
7) Commands run and outcome (pass/fail counts): live Supabase type comparison passed; focused Jest passed 60/60 across seven suites; focused ESLint passed; route/map generation passed; live transactional RLS contract passed and rolled back; full repository TypeScript returned 192 unrelated diagnostics and zero task-owned diagnostics; Vercel build `dpl_ATupdV8JhD4abG7k4bUdr7FnYN76` reached Ready from exact main commit `51e0e61aec6e`; authenticated production desktop/mobile checks had zero browser errors, no horizontal overflow, and zero queue iframes.
8) Evidence artifacts (screenshot/video/report/log paths): production `docs/ops/tasks/2026-07-26-training-review-flow.desktop.png`, production `docs/ops/tasks/2026-07-26-training-review-flow.mobile.png`, `supabase/tests/training_resource_library.sql`, and this handoff's independent-review record.
9) Top 3 findings (frontend-visible issues first): a duplicate global reviewer nav entry would misstate the exact permission boundary, so the learner page owns one RPC-gated contextual action; dense reviewer lists must suppress resource embeds; the shared app-admin helper was broader than the training RLS and was replaced by one exact `current_is_app_admin()` authority.
10) Recommended next action (one line): Human reviewer opens each imported source and uses the live queue to publish or archive it.
11) Handoff file path: `docs/ops/handoffs/2026-07-26-S224-training-review-flow.md`
12) Migration ledger evidence: N/A — this slice does not change `supabase/migrations/*.sql`.

## Linear Updates

- Kickoff comment: https://linear.app/alleato-group/issue/ALL-24/t10-reviewer-publish-flow#comment-4930c0e2
- Completion comment: https://linear.app/alleato-group/issue/ALL-24/t10-reviewer-publish-flow#comment-8cb8d931

## Scope And Stop Condition

- Implement only ALL-24 reviewer visibility plus publish/archive decisions.
- Stop if the existing RLS contract cannot enforce the UI mutation without a
  schema change, or if ALL-17 takes ownership of an overlapping frontend path.

## Independent Review

Final verdict: APPROVED.

The reviewer first found that a separate `adminOnly` navigation entry allowed
developer visibility broader than training RLS. That entry was removed in favor
of the learner page's contextual action backed by the same database RPC as the
queue. A second review found that shared `requireAppAdmin` did not include the
active-person requirement enforced by training RLS. The final implementation
centralizes read, mutation, page, and visibility authorization in
`frontend/src/lib/training/reviewer-access.ts`, derives the audit actor from
that guard, and removes caller-supplied reviewer identity. Regression coverage
includes an `is_admin` profile that the canonical RPC denies.

## Release Evidence

Task file: `docs/ops/tasks/2026-07-26-training-review-flow.md`

Verification manifest: `frontend/src/lib/training/__verification__/review-flow.verification-manifest.json`

Verification result: `frontend/src/lib/training/__verification__/review-flow.verification-result.json`

Migration ledger evidence: N/A — this slice changes no migration.

## Control-Plane Note

`npm run linear:codex:check` rejects `ALL-24` because its shared regex accepts
only legacy `AAI-###` identifiers. That stale format guard is unrelated repo
debt: the authenticated Linear API kickoff, closeout comment, and Done-state
readback all succeeded. The durable prevention is to broaden the checker to the
current Linear team identifiers.
