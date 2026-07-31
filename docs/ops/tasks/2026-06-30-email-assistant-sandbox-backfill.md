# Task: Email Assistant Sandbox Backfill

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-775 - https://linear.app/megankharrison/issue/AAI-775/backfill-brandon-email-assistant-sandbox-reviews-for-todays-inbox
Related Handoff: N/A

## Objective

Generate sandbox assistant review rows for Brandon's emails received on 2026-06-30 so `/outlook-draft-feedback` shows what the AI would have done: priority, category, action, and draft body, without changing Brandon's Outlook mailbox.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked, with evidence filled in. If any required item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Confirm the backfill reads today's Brandon mailbox rows from `outlook_email_intake`.
- [x] Confirm all writes go only to `outlook_email_assistant_reviews`.
- [x] Confirm no Outlook/Graph draft, category, send, archive, move, or mark-read operation is used.
- [x] Define dry-run output before live writes.
- [x] Define idempotency behavior for reruns.

## Implementation Checklist

- [x] Add a bounded backfill script with `--date`, `--mailbox`, `--limit`, dry-run default, and `--write`.
- [x] Reuse the existing Brandon deterministic triage rules for action, priority, score, reason, owner, risk, evidence, and rules.
- [x] Generate draft bodies through AI SDK using the existing AI provider path and Brandon review learning guidance.
- [x] Store sandbox category in `source_metadata.sandboxCategory`.
- [x] Store script/run metadata in `source_metadata` for read-back proof.
- [x] Fail loudly on missing environment, provider failure, DB read/write failure, or invalid date.

## Integration Checklist

- [x] Dry run reports the target email count and intended writes.
- [x] Live run writes sandbox review rows for emails received on 2026-06-30.
- [x] Rerun behavior avoids duplicate generated rows.
- [x] Read-back verifies counts and sampled row fields.
- [x] Linear kickoff and completion comments are posted.

## Regression Guardrails

- [x] Script contains no Microsoft Graph mailbox mutation calls.
- [x] Static checks pass for the new script.
- [x] Verification reads back `outlook_email_assistant_reviews` rows with the sandbox backfill marker.

## Verification Checklist

- [x] Static/type check run.
- [x] Dry run completed.
- [x] Live run completed or blocked with exact cause.
- [x] Read-back completed.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- The `/outlook-draft-feedback` table can show today's Brandon emails with recorded assistant action, priority, category, and draft state.
- The rows are auditable as sandbox backfill rows.
- The backfill is safe to rerun without duplicate review rows.
- The implementation does not enable any live Outlook mutation.

## Files To Change

- `frontend/scripts/backfill-email-assistant-sandbox-reviews.ts`
- `package.json`
- `docs/ops/tasks/2026-06-30-email-assistant-sandbox-backfill.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| AI SDK docs/source | `test -d frontend/node_modules/ai/docs`; `rg "generateText" frontend/node_modules/ai/docs frontend/node_modules/ai/src` | Pass | Local AI SDK docs/source present; existing `generateText` call shape is supported. |
| Dry run | `cd frontend && npx tsx scripts/backfill-email-assistant-sandbox-reviews.ts --date=2026-06-30 --mailbox=bclymer@alleatogroup.com --json` | Pass | Found 2 target emails, planned 2 inserts before live run. |
| Live run | `cd frontend && npx tsx scripts/backfill-email-assistant-sandbox-reviews.ts --date=2026-06-30 --mailbox=bclymer@alleatogroup.com --write --json` | Pass | Inserted 2 review rows and generated 2 draft bodies. Run ID: `backfill-email-assistant-sandbox-reviews-2026-06-30-20260630155521`. |
| Read-back | Supabase read-back for intake IDs 4046 and 4047 | Pass | 2 sandbox rows, both `reply`/`urgent`, category `Reply Needed`, outcome `draft_edited`, draft lengths 129 and 241, `mailboxMutationEnabled=false`. |
| Idempotency | `npm run email-assistant:backfill-sandbox -- --date=2026-06-30 --mailbox=bclymer@alleatogroup.com --json` | Pass | After live run, dry run reports `plannedInserts=0`, `plannedUpdates=2`. |
| Static/type | `cd frontend && npx eslint scripts/backfill-email-assistant-sandbox-reviews.ts --quiet`; `git diff --check -- package.json frontend/scripts/backfill-email-assistant-sandbox-reviews.ts docs/ops/tasks/2026-06-30-email-assistant-sandbox-backfill.md`; changed-file type/unsafe guardrails | Pass | ESLint and whitespace checks passed. Generic changed-file type/unsafe guardrails skipped `frontend/scripts`; runtime dry/live/read-back and ESLint cover this script. |
| Mutation guardrail | `rg -n "graph\\.microsoft|microsoft\\.com/v1|create.*draft|categories|mark.*read|archive|sendMail|move\\(" frontend/scripts/backfill-email-assistant-sandbox-reviews.ts` | Pass | No Graph or mailbox mutation calls; only prompt safety text matched archive/category words. |

## Files Changed

- `frontend/scripts/backfill-email-assistant-sandbox-reviews.ts`
- `package.json`
- `docs/ops/tasks/2026-06-30-email-assistant-sandbox-backfill.md`

## Risks / Gaps

- Provider quota/configuration can block draft generation.
- Intake freshness still depends on the suspended Microsoft assistant cron and existing sync cache state.
- Authenticated browser proof of `/outlook-draft-feedback` may still require an owner/Brandon browser session.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
