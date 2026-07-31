# Handoff: Standard Main Publisher

1) Session ID: SROOT1240
2) Task ID: AAI-1240
3) Linear issue: AAI-1240
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1240/make-canonical-checkout-workflow-resilient-to-concurrent-scoped-work
5) Current status: Pending Review
6) Files changed: `scripts/ops/codex-finish.mjs`, task, handoff
7) Commands run: PASS `node --check`; PASS no-rebase search; PASS remote CAS publication at `464662b6`
8) Evidence: source inspection and exact remote publish
9) Finding: local rebase/autostash is invalid in a shared checkout.
10) Next: every normal task can use `codex:finish -- --files <exact paths>` without waiting for a clean shared checkout.
11) Handoff: this file
12) Migration ledger evidence: N/A