# Outlook Stale Subscription Prevention

Status: Published

Linear: AAI-718

Worktree: `/Users/meganharrison/.codex/worktrees/outlook-stale-subscription-prevention/alleato-pm`

## Objective

Prevent stale Outlook Graph subscription rows from lingering and include `mharrison@alleatogroup.com` in the configured Microsoft sync mailbox set.

## Root Cause

The Graph subscription reconciler only guarantees rows for `MICROSOFT_SYNC_USERS`. Rows for mailboxes no longer in that list could remain visible with `renewal_due` or expired status. That is not production-ready because source-health and assistant status can keep seeing irrelevant stale rows, and because Megan's mailbox should not have been excluded from the configured set.

## Checklist

- [x] Create Linear issue and isolated worktree.
- [x] Add code path that marks Outlook subscription rows outside configured targets as removed during reconciliation.
- [x] Add focused backend tests for stale-row removal and target inclusion behavior.
- [x] Update Render `MICROSOFT_SYNC_USERS` safely to include `mharrison@alleatogroup.com` on Graph-related services.
- [x] Run live subscription reconcile and verify no stale Outlook rows remain.
- [x] Delegate typecheck/syntax verification after edits.
- [x] Run focused backend tests and live verifier.
- [x] Update progress notes and evidence.
- [x] Publish to `origin/main` and close Linear.

## Evidence

- Render config read-back, live subscription verifier, Megan mailbox sync proof, and delegated verification: [outlook-stale-subscription-prevention-aai-718.md](../evidence/2026-06-25-ai-rag-production-finalization/outlook-stale-subscription-prevention-aai-718.md)
- Strict subscription verifier passed with `expectedTargetCount=11`, `activeSubscriptionCount=11`, `staleSubscriptionCount=0`, `unconfiguredSubscriptionCount=0`.
- Megan mailbox sync read-back passed with `sync_status=success`, `last_sync_at=2026-06-26T12:57:54.566226+00:00`, and latest RAG `source_sync_runs` row `status=succeeded`.
- Delegated verification passed: `29 passed`, Python compile passed, Node syntax check passed.
- Published commit: `76c1e1cb684251963fc09083466ffedc4bb67dfe`.
- Linear AAI-718 marked Done.
