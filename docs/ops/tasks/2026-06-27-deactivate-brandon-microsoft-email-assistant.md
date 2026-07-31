# Disable Brandon Microsoft Email Assistant Mailbox Writes

Status: Complete
Owner: Codex
Linear: AAI-759 - https://linear.app/megankharrison/issue/AAI-759/deactivate-brandon-microsoft-email-assistant-drafts-until-further
Date: 2026-06-27

## Request

Keep the Microsoft email assistant active for Brandon's mailbox reads, questions, triage, and urgent notifications, but disable Outlook mailbox writes until further notice. This includes draft creation, Outlook category/tag writes, and other live mailbox organization changes.

## Scope

- Brandon mailbox: `bclymer@alleatogroup.com`
- Render cron: `alleato-microsoft-executive-assistant-check`
- Backend Microsoft Executive Assistant webhook / mailbox-mutation / auto-draft / Teams alert runtime flags

## Checklist

- [x] Create Linear issue and record tracking link.
- [x] Confirm pre-change state showed active assistant runs.
- [x] Correct over-deactivation: keep scheduled cron active.
- [x] Correct over-deactivation: keep backend webhook-triggered assistant runs active.
- [x] Keep urgent Teams notifications active.
- [x] Disable backend Microsoft Executive Assistant auto-draft behavior.
- [x] Disable scheduled Microsoft Executive Assistant auto-draft behavior.
- [x] Add a code-level mailbox mutation gate for Outlook category/tag writes.
- [x] Deploy the mailbox mutation gate to production.
- [x] Verify provider read-back for `MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED=false`.
- [x] Verify logs/health surfaces available for monitoring mailbox write attempts.
- [x] Verify provider read-back without exposing secrets.
- [x] Run the Microsoft assistant verifier and confirm read/triage access remains healthy.
- [x] Record cause, detection gap, and prevention step.

## Evidence

| Check | Command / Source | Result | Notes |
| --- | --- | --- | --- |
| Pre-change health | `npm run verify:microsoft-assistant-health -- --json` | Pass | At 2026-06-27T15:33:11Z, the cron had run successfully 2 minutes earlier, proving the assistant was active. |
| Corrected Render read-back | Render API `GET /v1/services` and `GET /v1/services/<id>/env-vars?limit=100` | Pass | Cron is `not_suspended`, scheduled enabled `true`, webhook enabled `true`, Teams alert `true`, auto-draft `false` on cron and backend. |
| Post-change health | `npm run verify:microsoft-assistant-health -- --json` | Pass | At 2026-06-27T15:40:04Z, Render cron, live Graph inbox, cached intake, and sync ledger all passed. Last successful cron run was 2026-06-27T15:39:50Z. |
| Mailbox mutation env read-back | Render API `GET /v1/services/<id>/env-vars?limit=100` | Pass | At 2026-06-27T15:47:26Z, cron and backend had `MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED=false`, `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_DRAFT=false`, and `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT=true`. |
| Guardrail tests | `backend/.venv/bin/python -m pytest backend/tests/test_microsoft_executive_assistant.py -q -k "mailbox_mutations or outlook_category_patch or patch_outlook_email_categories_clears or outlook_event_trigger"` | Pass | 7 passed. Confirms category writes are blocked by default, the explicit category tool is hidden while mutations are disabled, and webhook prompt no longer promises Outlook categories. |
| Render deploy read-back | Render API `GET /v1/services/<id>/deploys?limit=5` | Pass | Backend deploy `dep-d8vv1g8js32c73c9ua0g` and cron deploy `dep-d8vv1ggjs32c73c9ua60` are live on commit `5bea555a9e916971fcf76a0b3f7c039b5f36f3e9`. |
| Post-deploy health | `npm run verify:microsoft-assistant-health -- --json` | Pass | At 2026-06-27T15:49:45Z, Render cron, live Graph inbox, cached intake, and sync ledger all passed. Last successful cron run was 2026-06-27T15:46:26Z. |

## Failure-Loudly Behavior

The assistant should fail closed for Outlook mailbox writes: scheduled and webhook-triggered reads/triage may run, urgent Teams notifications may send, and Alleato review-ledger triage may be persisted, but any call to `draft_outlook_email_for_review` or Outlook category/tag mutation must return blocked/preview-only because `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_DRAFT=false` and `MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED=false`.

## Cause / Detection Gap / Prevention

- Cause: Auto-draft was enabled, and the existing triage tool could still mutate Outlook categories while the user wanted the assistant to keep reading/notifying but stop changing the actual mailbox.
- Detection gap: The health verifier proves mailbox access and cron freshness, but did not assert draft-write or Outlook category-write gates.
- Prevention: Provider read-back records `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_DRAFT=false`; this task adds `MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED=false` as the code-level guardrail for category/tag/organizing writes.

## Monitoring

- Render service logs can be filtered for `MAILBOX_MUTATION_BLOCKED` to see any attempted Outlook draft/category mutation while the gate is disabled.
- Render cron/job status plus `npm run verify:microsoft-assistant-health -- --json` prove the assistant can still read Brandon's mailbox and run notifications.
