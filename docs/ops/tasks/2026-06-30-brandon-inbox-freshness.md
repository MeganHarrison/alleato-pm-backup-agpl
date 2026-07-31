# Task: Brandon inbox freshness

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-780 - https://linear.app/megankharrison/issue/AAI-780/fix-brandon-inbox-freshness-and-graph-subscription-expiry-guardrail

## Objective

Repair Brandon's stale Outlook inbox cache and add a guardrail so an expired
Microsoft Graph subscription cannot be reported as healthy just because its row
still says `active`.

## Scope Checklist

- [x] Confirm the app's Brandon inbox source of truth.
- [x] Compare cached `outlook_email_intake` rows with live Microsoft Graph inbox data.
- [x] Identify why the latest cached Brandon email stopped at 7:28 AM ET.
- [x] Run a scoped Brandon mailbox catch-up without changing unrelated frontend worktree files.
- [x] Reconcile Microsoft Graph subscriptions with production webhook configuration.
- [x] Add stale-expiration detection to the Graph subscription verifier.
- [x] Run focused verification and record command evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Cached inbox before repair | Supabase read of `outlook_email_intake` for `bclymer@alleatogroup.com` ordered by `received_at desc` | Fail | Latest cached row was `2026-06-30T11:28:50+00:00` / 7:28 AM ET. |
| Live Outlook read | `list_live_outlook_inbox(mailbox_user_id="bclymer@alleatogroup.com", limit=15)` | Pass | Live Graph showed newer inbox mail through `2026-06-30T19:10:29Z` / 3:10 PM ET. |
| Scoped catch-up | `sync_outlook_emails(..., "bclymer@alleatogroup.com", [], None, "2026-06-30")` with `OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX=200` | Pass | Synced 81 Brandon messages and saved delta token. |
| Cache read-back after repair | Supabase read of latest Brandon `outlook_email_intake` rows | Pass | Latest cached row is `2026-06-30T19:10:29+00:00` / 3:10 PM ET. |
| Subscription read-back before reconcile | Supabase read of Brandon `graph_subscriptions` row | Fail | Row was `status=active` but `expiration_at=2026-06-28T12:18:54.340956+00:00`, with no notifications. |
| Subscription reconcile | `backend/src/scripts/run_graph_subscription_reconcile.py` with Render webhook env | Pass | Created 11 fresh Graph subscriptions; failed count 0. |
| Subscription read-back after reconcile | Supabase read of Brandon `graph_subscriptions` row | Pass | Brandon row now expires `2026-07-02T19:25:58.451814+00:00`; `last_error_message=null`. |
| Linear issue | AAI-780 | Pass | Created after operational repair started to correct tracking gap; issue is in progress. |
| Verifier syntax | `node --check scripts/verify/verify_graph_subscriptions.mjs` | Pass | Node syntax check passed. |
| Live subscription verifier | `npm run verify:graph-subscriptions -- --json` | Pass | `validActiveSubscriptionCount=11`, `expiredActiveSubscriptionCount=0`, `staleSubscriptionCount=0`, `erroredSyncStateCount=0`. |

## Risks / Gaps

- The task template referenced by AGENTS at `docs/ops/tasks/TASK-TEMPLATE.md`
  is missing in this checkout; this file uses the existing project-local task
  structure instead.
- Graph attachment RAG sync produced separate `400 Bad Request` errors during
  catch-up for some PDF attachments. Intake rows still landed; attachment
  promotion should be tracked separately.
- Existing unrelated local frontend changes are present and must not be staged
  with this task.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
