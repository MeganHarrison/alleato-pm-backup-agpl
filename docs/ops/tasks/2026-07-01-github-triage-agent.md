# Task: GitHub triage agent

Status: Partial
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-849 - https://linear.app/megankharrison/issue/AAI-849/build-eve-github-triage-agent-with-direct-to-main-versus-pr-routing
Related Handoff: docs/ops/handoffs/2026-07-01-S104-github-triage-agent.md

## Objective

Create a dedicated Eve GitHub triage agent that listens to GitHub issue
events, filters by repo and label, posts a durable routing decision back to
GitHub, and blocks fix execution until the issue has explicit approval.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing Eve agent patterns and GitHub channel docs reviewed.
- [x] Shared helper and abstraction opportunities identified before adding new code.
- [x] Canonical routing policy defined for `direct-to-main`, `pr-required`, and `wait`.
- [x] GitHub trigger/approval/delivery owner path chosen.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined for blocked or ambiguous issues.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] New Eve agent package scaffolded under `agents/github-issue-triage/`.
- [x] GitHub channel filters by configured repo and label.
- [x] Triage logic emits inspectable path and reasons.
- [x] Approval gate blocks execution unless explicit issue approval is present.
- [x] Durable GitHub status comment format implemented.
- [x] README/env wiring documents required GitHub App configuration.

## Integration Checklist

- [x] GitHub issue event dispatch uses one canonical Eve channel entrypoint.
- [x] Issue triage, approval detection, and delivery share the same routing module.
- [x] Bounded fix workflow inputs are typed and inspectable.
- [x] Delivery comments report routed, blocked, and waiting states distinctly.
- [x] Agent does not silently start fix execution from unlabeled or unapproved issues.

## Regression Guardrails

- [x] Evals cover `direct-to-main`, `pr-required`, and `wait` routing.
- [x] Evals cover approval gating.
- [x] Guardrail added for missing repo/label config.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test/eval run.
- [ ] Browser/user-flow verification run for external surfaces if applicable.
- [x] Database/provider read-back performed for external-service changes if applicable.
- [ ] End-to-end workflow proof captured for the requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck` | Pass | `agents/github-issue-triage` package compiles with strict TS. |
| Targeted tests/evals | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` | Pass | 4/4 evals, 10/10 gates. |
| Browser/user-flow | GitHub App settings in logged-in Safari | Pass | Repaired webhook secret in the live GitHub App settings and generated a fresh private key for the app. |
| DB/provider read-back | `npx vercel logs dpl_2K2YtD8LiE5QBVZ5KbqtP4si3ZBP --no-follow --since 10m --expand` | Pass | Verified the webhook signature mismatch on the broken deployment, then repaired the GitHub App secret/private key and redeployed. |
| End-to-end proof | `npx tsx` one-shot backfill using `agent/lib/github-app.ts` + `agent/lib/triage.ts` | Partial | Deterministic backfill updated all 72 open `admin-feedback` issues with live GitHub triage comments from this machine; production cron route is deployed but still needs one clean hosted run read-back to close the last proof gap. |

## Files Changed

- `agents/github-issue-triage/**` - new Eve agent package and supporting files
- `docs/ops/tasks/2026-07-01-github-triage-agent.md` - local task ledger
- `docs/ops/handoffs/2026-07-01-S104-github-triage-agent.md` - local handoff ledger

## Risks / Gaps

- The live one-shot backfill is now proved, but the hosted recurring cron path
  still needs one clean observed run after the deterministic schedule rewrite.
- v1 still stops at triage and approval; repository mutation/fix execution is
  not yet automated by this agent.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
