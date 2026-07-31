# Task: Outlook draft feedback three-column layout

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-770 - https://linear.app/megankharrison/issue/AAI-770/make-outlook-draft-feedback-panel-inline-editable
Related Handoff: N/A

## Objective

Make `http://localhost:3001/outlook-draft-feedback` use the shared UI-library split-page layout with a durable three-column workspace that fills the available app viewport instead of clipping or cutting off the reading/feedback panes.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint 'src/features/emails/project-emails-workspace.tsx' 'src/features/emails/__tests__/project-emails-workspace.test.tsx' 'src/components/ui/split-page.tsx' 'src/components/ui/__tests__/split-page.test.tsx'` | Pass with warnings | 0 errors. Existing design-system warnings remain in `frontend/src/features/emails/project-emails-workspace.tsx` at raw `<button>`/raw search/date input usage; this layout slice did not add them. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath 'src/features/emails/__tests__/project-emails-workspace.test.tsx' 'src/features/emails/inbox/__tests__/email-inbox-client.test.ts' 'src/components/ui/__tests__/split-page.test.tsx'` | Pass | 3 suites, 5 tests passed. Added guardrails for the shared split-page fill-height contract and the mail workspace root contract. |
| Browser/user-flow     | `agent-browser open 'http://localhost:3001/outlook-draft-feedback' && agent-browser wait 3000 && agent-browser get url` | Blocked/Deferred | Exact route redirects to `http://localhost:3001/auth/login?callbackUrl=%2Foutlook-draft-feedback`. `agent-browser auth login alleato-test-3001` also failed with `page.goto: net::ERR_ABORTED` at `http://localhost:3001/auth/login`, so local auth state is not usable for proof in this session. |
| DB/provider read-back | Not applicable     | Pass | No database, migration, or provider configuration change was required for this shared layout-owner fix. |
| End-to-end proof      | Same as browser/user-flow | Blocked/Deferred | Cause: local browser auth for `localhost:3001` is stale/broken. Detection gap: previous route work deferred authenticated proof, so this regression survived despite code changes. Prevention step: refresh the local auth fixture or use a known-good browser session before closing frontend layout work on protected routes. |

## Files Changed

- `docs/ops/tasks/2026-06-30-outlook-draft-feedback-three-column-layout.md` - task definition and verification ledger.
- `frontend/src/features/emails/project-emails-workspace.tsx` - shared three-column split-page owner for the actual mail workspace.
- `frontend/src/components/ui/split-page.tsx` - shared split-page primitive if the height/overflow contract needs repair.
- `frontend/src/components/ui/__tests__/split-page.test.tsx` - guard the new `fill` height contract without relying on a DOM test environment.
- `frontend/src/features/emails/__tests__/project-emails-workspace.test.tsx` - guard the mail workspace root against reintroducing viewport subtraction.

## Risks / Gaps

- Authenticated browser proof may still be blocked if the local auth fixture is stale again.
- Existing design-system warnings remain inside `frontend/src/features/emails/project-emails-workspace.tsx`; they predate this height fix and are unrelated repo debt unless the route still needs a broader shell cleanup.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
