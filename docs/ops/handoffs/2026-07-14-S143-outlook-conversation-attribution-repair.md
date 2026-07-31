# S143 Handoff: Outlook Conversation Attribution Repair

## Intake Block

1) Session ID: S143
2) Task ID: AAI-1066
3) Linear issue: AAI-1066
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1066/repair-cross-mailbox-outlook-project-attribution-drift-in-deep-read
5) Current status: Pending Review
6) Files changed (absolute paths): task-owned backend attribution/compilation modules and focused tests; scoped repair/verifier scripts; recurring-failure registry hunk; task/handoff/evidence; regenerated July 13 consumer artifacts; operational-loss council report
7) Commands run and outcome (pass/fail counts): focused attribution/compiler tests 8/8 passed; live repair passed; scoped verifier passed; regenerated Deep Read and consumers passed; broader intake file 21 passed/7 unrelated stale-symbol failures
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-14-outlook-conversation-attribution-repair/REPORT.md` and regenerated packet artifacts beneath the same directory
9) Top 3 findings (frontend-visible issues first): false Uniqlo task/candidate removed and not regenerated; corrected task now belongs only to Superior; 16 other historical attribution conflicts require source adjudication
10) Recommended next action (one line): adjudicate or exclude the 16 historical conflicts, then create the 30-50 episode operational-loss calibration ledger
11) Handoff file path: `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-14-S143-outlook-conversation-attribution-repair.md`
12) Migration ledger evidence: N/A unless implementation requires a migration

## Linear Updates

- Kickoff comment: Posted (`4e699add-4ab9-4c46-92d8-c4d13a261dbb`)
- Milestone comments: Posted (`daf33107-952f-43f5-9079-1f6597af264e`)
- Completion/blocker comment: Pending

## Current Status

Scoped production repair, durable guardrails, corrected packet regeneration,
and portfolio-wide conflict measurement are complete. Implementation and
evidence were published to `origin/main` at `559d8cef78`.

## Exact Next Step

Adjudicate or explicitly exclude the 16 historical conflicts, then create the
30-50 episode operational-loss calibration ledger.

## Known Pitfalls

- `source_signal_candidates` is owned by the RAG database, not the app database.
- Same logical Outlook conversation has different Graph conversation IDs across
  mailboxes; the fingerprint must be mailbox-independent.
- The shared checkout contains unrelated dirty files that must not be staged.

## Resume Commands

```bash
node scripts/verify/verify_outlook_conversation_attribution_consistency.mjs --subject "Superior Sprinklers" --date 2026-07-13 --expected-project-id 178
cd backend && pytest -q tests/test_outlook_attribution.py tests/test_outlook_conversations.py
```

## Evidence

- Task: `docs/ops/tasks/2026-07-14-outlook-conversation-attribution-repair.md`
- Report: `docs/ops/evidence/2026-07-14-outlook-conversation-attribution-repair/REPORT.md`
- Corrected packet: `163e5716-9eae-45c3-b30a-ff23f01d5f1f`
