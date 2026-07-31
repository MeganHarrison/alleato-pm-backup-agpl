# Task: GitHub PR triage agent

Status: Complete
Owner: Codex
Created: 2026-07-13
Task ID: Local task - Linear issue creation blocked by missing team-discovery tool in current Linear connector surface
Linear Issue: Unavailable in-session - `mcp__codex_apps__linear._save_issue` requires a team, but the current connector surface does not expose a team lookup/list tool for authoritative selection
Related Handoff: `docs/ops/handoffs/2026-07-13-S136-github-pr-triage-agent.md`

## Objective

Add GitHub PR triage capability that reacts to pull request events, reads the PR
diff/metadata, applies a structured triage decision, and posts one durable PR
triage comment using a repo-owned ruleset.

## Scope

- Repo-local Eve PR triage package under `agents/github-pr-triage/`
- Live production webhook owner under `agents/github-issue-triage/` because one
  GitHub App can expose only one webhook URL
- Local task/evidence documentation for implementation and verification

## Source of Truth

- Canonical runtime/data owner: `agents/github-issue-triage/` GitHub channel +
  repo-owned `triage.yml`
- Existing shared primitives/services: `agents/github-issue-triage/**`
- Deprecated or parallel paths: `agents/github-pr-triage/**` is a local template
  scaffold/reference, not the live webhook owner

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Missing PR triage config, unsupported repo, or GitHub delivery/comment failure becomes an explicit blocked triage comment or failing eval
- Detection path: `npm run typecheck`, `npm run build`, and GitHub PR comment output
- Recovery path: Fix env/config/ruleset, rerun build verification, then re-deliver PR event

## Incident Learning

Use `N/A` only for work that did not discover or address a failure. Significant
bugs and repeated problems must reference an ID in
`docs/ops/learning/recurring-failures.yaml`.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Local scaffold | `agents/github-pr-triage/**` | Pass | Added a repo-local PR triage package modeled on the Vercel template. |
| Initial package verification | `cd agents/github-pr-triage && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run build` | Pass | Fixed upstream dependency drift by pinning stable `ai@^7.0.22`, `eve@^0.22.6`, and `microsandbox`. |
| Production owner integration | `agents/github-issue-triage/**` | Pass | Added PR channel hook, `apply_labels`, PR skill, ruleset, and upgraded the live package to `eve@^0.22.6`. |
| Live deployment | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" vercel deploy --prod --yes --scope meganharrisons-projects` from `agents/github-issue-triage/` | Pass | Deployment `dpl_Fb7BTzZCtxSYeVsdzQw37FY8yVEA`; alias `https://alleato-eve-github-issue-triage.vercel.app`. |
| Webhook route proof | `curl -is -X POST https://alleato-eve-github-issue-triage.vercel.app/eve/v1/github -d '{}'` | Pass | Returned `401 unauthorized`, confirming the GitHub channel route is live and enforcing signed delivery. |
| End-to-end PR proof | `MeganHarrison/alleato-pm#947` | Pass | Real draft PR received a triage comment from `alleato-issue-triage` and the `documentation` label, then was closed after proof. |
| Cleanup | `gh pr close 947 --repo MeganHarrison/alleato-pm --delete-branch` and `gh pr close 2 --repo The-Alleato-Group/project-management --delete-branch` | Pass | Removed both temporary proof PR branches after preserving comment evidence in the closed threads. |
| Unrelated failure accounting | `gh pr create` via GitHub connector on `The-Alleato-Group/project-management` and no app reaction on PR #2 | Pass | This was not repo debt. Cause: the existing GitHub App installation is on `MeganHarrison`, not `The-Alleato-Group`, so org PR #2 was the wrong live-proof target. |

## Remaining Risk

- The live webhook owner is `agents/github-issue-triage`, not `agents/github-pr-triage`. If the dedicated package should become the production owner later, that requires either a second GitHub App or a planned webhook-owner swap.
- Local agent work still requires Node 24 because `eve@0.22.6` requires `node >=24`.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
