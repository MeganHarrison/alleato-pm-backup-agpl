# Handoff: Machine readiness baseline

Date: 2026-07-30
Session: S20260730-MACHINE
Task: AAI-1281-MACHINE-READINESS
Status: Accepted

## Outcome

The workstation now uses
`C:\Users\KimiClaw\.codex\capabilities\alleato-project-management.env` as
the shared secret source. The PowerShell all-hosts profile loads it into every
new shell, including Codex shell commands.

The prior `full` profile was incomplete and accepted stale values. It now
performs authenticated checks for:

- Supabase production access
- Vercel account and canonical project
- GitHub canonical repository push permission
- Render access to `alleato-backend`
- AI Gateway model access
- OpenAI model access
- Linear viewer identity
- authenticated browser tooling

Backend, `agents/`, and `render.yaml` workspaces infer this full profile before
creation. Remote checks use bounded timeouts and provider/credential-scoped
cache entries.

## Secure Recovery and Provider Repair

- Recovered and validated an existing Render API credential.
- Replaced stale shared AI Gateway and Linear credentials with locally
  recoverable credentials that pass HTTP 200 authenticated readback.
- Imported the Azure Document Intelligence configuration and the existing
  Render Slack webhook into the shared machine environment.
- Updated Vercel production sensitive values for AI Gateway, OpenAI, and Linear.
- Updated only Render `alleato-backend`'s `OPENAI_API_KEY` using the individual
  env-var endpoint; authenticated readback now returns HTTP 200.
- No secret values were printed, documented, or committed.

## Verification

- `npm run machine:ready`: pass
- Focused Node tests: 20 passed
- PowerShell bootstrap syntax: pass
- Installed PowerShell profile syntax and environment loading: pass
- Shared environment ACL: protected, one explicit current-user entry
- Repeated profile installation: one marker block after repeated runs
- Independent review: approved with no remaining findings

## Remaining Administrative Credentials

Sentry organization administration and PostHog organization administration
still lack locally recoverable personal tokens. Runtime DSN/client
configuration remains available. Creating new organization-level tokens
requires those providers' authenticated admin UI and is not silently inferred.

## Release

Published to canonical `origin/main` through the required `codex:finish` flow.
Render deploy `dep-d9ll9l15efls73bgjjvg` was triggered so the repaired backend
OpenAI fallback is loaded by the running service.
