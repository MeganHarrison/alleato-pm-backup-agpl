# Handoff: 2026-07-20 — Branch Consolidation

Task file: `docs/ops/tasks/2026-07-20-branch-consolidation.md`
Verification manifest: `docs/ops/tasks/2026-07-20-branch-consolidation.verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-20-branch-consolidation/verification-result.json`

## Intake Block

1) Session ID: S207
2) Task ID: AAI-1225
3) Linear issue: AAI-1225
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1225/consolidate-repository-work-onto-main-and-remove-stale-branches
5) Current status: Complete / Accepted
6) Files changed (absolute paths): `.husky/pre-push`, `scripts/ops/codex-finish.mjs`, `scripts/verify/verify_main_only_delivery_policy.mjs`, Acumatica follow-up paths, `docs/roadmap/MOBILE-APP-PLAN.md`, task/handoff/evidence/control-plane files
7) Commands run and outcome (pass/fail counts): branch inventory and tag readback passed; GitHub non-main creation smoke correctly rejected; local policy verifier passed; local hook negative smoke passed; `codex:finish` bypass negative smoke passed; route checks passed; non-production route check passed; Acumatica pytest 9/9 passed; frontend Jest could not start because `jest` is absent in this checkout
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-20-branch-consolidation/branch-reconciliation.md`, `branch-reconciliation.html`, `main-only-delivery-receipt.png`, `verification.md`, `verification-result.json`, `independent-review.md`; Linear attachment `https://uploads.linear.app/ba18f798-951f-4d5a-88ee-952e1985c6eb/290b515d-d024-4694-b19c-0a2912be0c9c/245706d7-7e6f-416d-a658-6ea399cff1a0`
9) Top 3 findings (frontend-visible issues first): the seven-branch count was six stale/unmerged remote refs plus main; current Acumatica and mobile-plan work required deliberate promotion; GitHub native delete-on-merge cannot prevent agent-created ref accumulation, so a no-bypass branch-creation ruleset is now the primary control
10) Recommended next action (one line): keep work in local worktrees until it is ready to reconcile directly onto main; do not recreate remote feature branches.
11) Handoff file path: `docs/ops/handoffs/2026-07-20-S207-branch-consolidation.md`
12) Migration ledger evidence: Not applicable unless branch adjudication intentionally incorporates a Supabase migration; if so, exact remote ledger proof is required before closeout.

## Linear Updates

- Kickoff comment: posted
- Milestone comments: policy, recovery tags, and remote cleanup recorded at closeout
- Completion comment: posted after publication readback at `02e7e17ca0e5cfa83a89c6839c14a017325059f2`; Linear AAI-1225 marked Done.

## Current Status

Only `refs/heads/main` remains on GitHub. Every retired tip has a published archive tag, current Acumatica/mobile-plan work is reachable from main, incomplete Team Chat and obsolete nightly-snapshot work remain recoverable but unshipped, and the GitHub/local policy now fails closed for new non-main branches.

## Exact Next Step

Reconcile the remaining local worktrees directly onto `main`; their remote branch names can no longer be recreated.

## Known Pitfalls

- A squash/rebase makes ancestry alone insufficient to prove work is missing.
- Deleting a clean local branch can still fail while its worktree is attached.
- Dirty worktrees contain uncommitted work and must not be removed.

## Evidence

- Linear: https://linear.app/megankharrison/issue/AAI-1225/consolidate-repository-work-onto-main-and-remove-stale-branches
- Initial remote refs: six non-main refs after `git fetch --prune origin`.
- Strict review-gate correction: the initial handoff omitted the machine-readable task and verification paths; `npm run verify:review-queue -- --strict` detected this before acceptance. Prevention: include the three required path fields at handoff creation and retain strict review verification before acceptance.
