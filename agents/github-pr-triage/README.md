# GitHub PR Triage Agent

Eve agent package for GitHub pull request triage. This package mirrors the
Vercel `eve-pr-triage-agent-template` pattern as a repo-local agent:

- reacts to opened pull requests through Eve's GitHub webhook route
- reads PR title, description, and diff from the injected GitHub context
- applies fitting labels from a repo-owned `triage.yml`
- posts one structured triage comment with summary, risk, review focus, labels,
  and suggested reviewers

## What it does

- Runs as a GitHub App webhook on `/eve/v1/github`.
- Uses `triage.yml` as the single source of truth for:
  - label definitions
  - risk signals
  - reviewer routing by path
- Posts one PR triage comment per opened pull request.
- Applies labels only when they exist in the target repository and genuinely fit
  the diff.

## Current scope

v1 triages opened pull requests only. It does not auto-rerun on later pushes,
assign reviewers, or mutate repository contents.

## Required environment

```bash
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...
# Optional for future mention-driven turns:
# GITHUB_APP_SLUG=...
```

## GitHub App wiring

- Webhook URL: `https://<deployment>/eve/v1/github`
- Required webhook events:
  - `pull_request`
- Minimum permissions:
  - `Pull requests: Read and write`
  - `Metadata: Read-only`

## Local commands

```bash
cd /Users/meganharrison/Documents/github/project-management/agents/github-pr-triage
npm install
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run build
```

## Ruleset

Edit `triage.yml` to control:

- labels the agent may apply
- how risk is classified
- which file paths suggest which reviewers

`triage.yml` is baked in at build time. Rebuild and redeploy after changing it.
