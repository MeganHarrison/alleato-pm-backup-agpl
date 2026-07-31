# Handoff: 2026-07-13 — GitHub PR triage agent

## Intake Block

1) Session ID: S136
2) Task ID: `docs/ops/tasks/2026-07-13-github-pr-triage-agent.md`
3) Linear issue: Unavailable in-session
4) Linear URL: Unavailable in-session
5) Current status: Complete
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/agents/github-pr-triage/**`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/agent/channels/github.ts`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/agent/instructions.md`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/agent/lib/pr-github.ts`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/agent/lib/pr-triage.ts`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/agent/skills/triage.ts`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/agent/tools/apply_labels.ts`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/package.json`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/package-lock.json`; `/Users/meganharrison/Documents/github/project-management/agents/github-issue-triage/triage.yml`; `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-13-github-pr-triage-agent.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S136-github-pr-triage-agent.md`
7) Commands run and outcome (pass/fail counts): `cd agents/github-pr-triage && npm install` fail once on `ai@7.0.0-canary.171` vs `eve@0.22.6`, then pass after pin repair; `cd agents/github-pr-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck` pass; `cd agents/github-pr-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run build` pass; `cd agents/github-issue-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck` pass; `cd agents/github-issue-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run build` pass after clearing stale `.eve` cache; `cd agents/github-issue-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` pass 4/4 evals and 10/10 gates; `cd agents/github-issue-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" vercel deploy --prod --yes --scope meganharrisons-projects` pass
8) Evidence artifacts (screenshot/video/report/log paths): deployment `dpl_Fb7BTzZCtxSYeVsdzQw37FY8yVEA`; live webhook route `https://alleato-eve-github-issue-triage.vercel.app/eve/v1/github`; closed proof PR `https://github.com/MeganHarrison/alleato-pm/pull/947`; closed mis-targeted proof PR `https://github.com/The-Alleato-Group/project-management/pull/2`; task ledger in `docs/ops/tasks/2026-07-13-github-pr-triage-agent.md`
9) Top 3 findings (frontend-visible issues first):
 - This checkout did not have a local equivalent of the Vercel Eve PR triage template before this work.
 - The upstream template dependency pin `ai@7.0.0-canary.171` no longer installs cleanly with current `eve@0.22.6`; stable `ai@^7.0.22` is required for a deterministic local install.
 - Production completion required integrating the PR triage surface into the existing `agents/github-issue-triage` webhook owner because one GitHub App exposes only one webhook URL.
 - Live proof succeeded on `MeganHarrison/alleato-pm#947`: the deployed app posted a triage comment and applied the `documentation` label.
10) Recommended next action (one line): If you want `agents/github-pr-triage` to become the production owner instead of a local scaffold, provision a second GitHub App or plan a deliberate webhook-owner swap.
11) Handoff file path: `docs/ops/handoffs/2026-07-13-S136-github-pr-triage-agent.md`
12) Migration ledger evidence: N/A

## Current Status

The repo now has a local `agents/github-pr-triage` package modeled on the
Vercel template, and the live production GitHub webhook owner
`agents/github-issue-triage` now handles pull-request triage as well as issues.
Live webhook proof is complete.

## Exact Next Step

If desired later, decide whether to keep the shared webhook owner or migrate
production to the standalone `agents/github-pr-triage` package with a second
GitHub App.

## Known Pitfalls

- Do not assume Node 22 is sufficient locally; `eve@0.22.6` requires Node 24.
- Do not rely on the original upstream canary AI SDK pin; it now conflicts with
  the current Eve peer dependency range.
- Do not use `The-Alleato-Group/project-management` as the live-proof target for
  this app unless the GitHub App is installed there; the existing installation
  is on the `MeganHarrison` account.
- Do not claim live PR triage proof until a real GitHub App delivery lands, the
  comment appears, and the label mutation is visible on the PR.

## Evidence

- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck`
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run build`
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval`
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" vercel deploy --prod --yes --scope meganharrisons-projects`
- `MeganHarrison/alleato-pm#947` triage comment + `documentation` label
