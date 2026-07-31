# GitHub Issue Triage

Eve agent package for GitHub issue triage. This agent listens to GitHub App
issue events, filters by configured repo and label, classifies the delivery
path, and asks for explicit approval before preparing a bounded fix workflow.

## What it does

- Listens on Eve's built-in GitHub channel.
- Filters by configured repository allowlist and required triage labels.
- Routes issues into one of:
  - `direct-to-main`
  - `pr-required`
  - `wait-for-clarification`
  - `blocked`
- Posts a durable GitHub comment with the route, reasons, approval state, and
  verification expectations.
- Uses Eve HITL approval before preparing a fix workflow contract.

## Current scope

v1 is a triage and approval agent. It does not execute repository mutations by
itself. After approval, it returns a bounded workflow contract that a later
automation or human can execute.

## Required environment

```bash
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...
GITHUB_APP_SLUG=...
EVE_GITHUB_TRIAGE_REPOS=MeganHarrison/alleato-pm
EVE_GITHUB_TRIAGE_LABELS=admin-feedback
EVE_GITHUB_TRIAGE_MODEL=openai/gpt-5.4-mini
```

## GitHub App wiring

- Webhook URL: `https://<deployment>/eve/v1/github`
- Required webhook events:
  - `issues`
  - `issue_comment`
- Minimum permissions:
  - `Issues: Read and write`
  - `Pull requests: Read and write` if you want PR-thread triage follow-up
  - `Contents: Read` for sandbox checkout context on repo-backed turns

The issue filter is intentionally label-gated. Unlabeled issues are ignored.
Missing triage config is not silent: matching issue events will produce a
blocked triage comment.

## Backfill support

The package also includes a proactive backfill schedule for existing open
issues:

- schedule file:
  `agent/schedules/backfill-open-issues.ts`
- default cadence:
  weekday `14:00 UTC`
- duplicate protection:
  skips issues that already contain an `## Eve GitHub Triage` comment unless
  `EVE_GITHUB_TRIAGE_BACKFILL_SKIP_EXISTING=false`

Optional backfill env:

```bash
EVE_GITHUB_TRIAGE_BACKFILL_REPOS=MeganHarrison/alleato-pm
EVE_GITHUB_TRIAGE_BACKFILL_LABELS=admin-feedback
EVE_GITHUB_TRIAGE_BACKFILL_LIMIT=100
EVE_GITHUB_TRIAGE_INSTALLATION_ID=12345678
EVE_GITHUB_TRIAGE_BACKFILL_SKIP_EXISTING=true
```

If `EVE_GITHUB_TRIAGE_INSTALLATION_ID` is omitted, the agent resolves the
installation by repo through the GitHub App API.

## Local commands

```bash
cd /Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage
npm install
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval
```

## Delivery contract

The triage comment is expected to state:

- `Path`
- `Why`
- `Approval`
- `Verification`
- `Next step`

The direct-to-main lane is reserved for small, isolated, targeted-verification
fixes. Anything involving migrations, auth, permissions, provider/deployment
configuration, security, or broad refactors is forced into `pr-required`.
