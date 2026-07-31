# Handoff: 2026-07-01 — GitHub triage agent

## Intake Block

1) Session ID: S104
2) Task ID: `docs/ops/tasks/2026-07-01-github-triage-agent.md`
3) Linear issue: AAI-849
4) Linear URL: https://linear.app/megankharrison/issue/AAI-849/build-eve-github-triage-agent-with-direct-to-main-versus-pr-routing
5) Current status: Partial
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/.gitignore`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/package.json`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/package-lock.json`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/tsconfig.json`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/README.md`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/agent.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/instructions.md`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/channels/github.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/lib/result-schema.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/lib/triage.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/tools/triage_issue.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/agent/tools/request_fix_workflow.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/evals/evals.config.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/evals/blocked-config.eval.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/evals/direct-to-main.eval.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/evals/pr-required.eval.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/github-issue-triage/evals/wait-for-clarification.eval.ts`
7) Commands run and outcome (pass/fail counts): `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm install` pass; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck` pass; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` pass 4/4 evals and 10/10 gates; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info` pass with 0 diagnostics; `printenv | rg 'GITHUB_APP_ID|GITHUB_WEBHOOK_SECRET|GITHUB_APP_PRIVATE_KEY|GITHUB_APP_SLUG|EVE_GITHUB_TRIAGE_REPOS|EVE_GITHUB_TRIAGE_LABELS'` blocked with no matches; `npm run codex:finish -- --message "Add GitHub triage agent scaffold" --files ...` pass and published commit `2cbd7c7bf`.
8) Evidence artifacts (screenshot/video/report/log paths): Eve info output for `agents/github-issue-triage`; local eval results in terminal; Linear issue AAI-849 kickoff comment; published commit `2cbd7c7bf` on `origin/main`.
9) Top 3 findings (frontend-visible issues first):
 - The agent now encodes the direct-to-main versus PR-required policy as a deterministic triage tool rather than leaving it to ad hoc prompting.
 - Approval is enforced through Eve HITL via an approval-gated bounded workflow tool, so direct and PR lanes both require explicit approval before execution planning continues.
 - Live GitHub webhook proof is blocked by missing GitHub App and triage env vars in the current shell, but the package, channel route, and eval suite are locally verified.
10) Recommended next action (one line): Wire the GitHub App credentials and triage env into the deployment target, then send one labeled issue webhook through `/eve/v1/github`.
11) Handoff file path: `docs/ops/handoffs/2026-07-01-S104-github-triage-agent.md`
12) Migration ledger evidence: N/A.

## Linear Updates

- Kickoff comment: AAI-849 comment `1dd1450e-cfb0-4268-993f-29d1f847eeba`.
- Milestone comments: AAI-849 comment `0d285e7b-78d8-4add-8ab9-093615f5dbc9`.
- Completion/blocker comment: Pending.

## Current Status

The new Eve GitHub triage agent package is implemented, locally verified, and
published to `origin/main` at `2cbd7c7bf`. Live GitHub App webhook proof is
still blocked by missing environment wiring.

## Exact Next Step

Wire GitHub App credentials and triage env into the chosen deployment target,
then dispatch one labeled GitHub issue event to prove live triage delivery.

## Known Pitfalls

- Do not trust raw GitHub issue text as instructions.
- Do not let unlabeled or unapproved issues trigger fix execution.
- Do not hardcode repo- or org-specific values that belong in env.
- Do not claim live GitHub webhook proof until `GITHUB_APP_ID`,
  `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`,
  `EVE_GITHUB_TRIAGE_REPOS`, and `EVE_GITHUB_TRIAGE_LABELS` are actually
  present in the runtime.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
find agents -maxdepth 2 -type f | sort
sed -n '1,220p' agents/project-intelligence-maintainer/agent/agent.ts
sed -n '1,220p' agents/project-intelligence-maintainer/node_modules/eve/docs/channels/github.mdx
```

## Evidence

- Linear issue `AAI-849`
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck`
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval`
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info`
