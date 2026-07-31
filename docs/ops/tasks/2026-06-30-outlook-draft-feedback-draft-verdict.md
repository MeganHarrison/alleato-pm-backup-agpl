# Task: Outlook draft feedback draft verdict

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-770 - https://linear.app/megankharrison/issue/AAI-770/make-outlook-draft-feedback-panel-inline-editable
Related Handoff: N/A

## Objective

Add an explicit saved `draft correct / draft incorrect` verdict to `/outlook-draft-feedback` so the reviewer can directly tell the AI whether the draft reply itself was good or bad.

Extended in this turn: project assignment feedback now also captures structured reasoning signals plus an optional note so the AI can learn how the reviewer identified the correct project.

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
| Static/type/lint      | `cd frontend && npx eslint 'src/lib/email-assistant/brandon-review.ts' 'src/lib/email-assistant/__tests__/brandon-review.test.ts' 'src/hooks/use-emails.ts' 'src/app/api/emails/route.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/email-inbox/reviewed/route.ts' 'src/app/api/email-inbox/reviewed/__tests__/route.test.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/route.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts' 'src/features/emails/project-emails-workspace.tsx'` | Pass with warnings | 0 errors. Existing design-system warnings remain in `frontend/src/features/emails/project-emails-workspace.tsx` for older raw button/date/search input usage unrelated to this training-contract slice. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath 'src/lib/email-assistant/__tests__/brandon-review.test.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/api/email-inbox/reviewed/__tests__/route.test.ts' 'src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts'` | Pass | 4 suites, 17 tests passed. Covers explicit `fieldFeedback.draft`, required structured project-assignment reasons, and create/update review-flow persistence of reason signals and note metadata. |
| Browser/user-flow     | Not run in this turn | Blocked/Deferred | Exact protected-route proof still depends on a working owner/Brandon auth session for `localhost:3001`. |
| DB/provider read-back | Not applicable     | Pass | No schema, migration, or provider configuration change was required; the new verdict is stored in existing review metadata. |
| End-to-end proof      | Same as browser/user-flow | Blocked/Deferred | Cause: live protected-route verification was not available in-turn. Detection gap: review-metadata features can be mechanically correct while the exact route still lacks authenticated proof. Prevention step: refresh a known-good owner or Brandon browser session before closing the route change as fully verified. |

## Files Changed

- `docs/ops/tasks/2026-06-30-outlook-draft-feedback-draft-verdict.md` - task definition and evidence ledger.
- `frontend/src/lib/email-assistant/brandon-review.ts` - review payload/schema contract for field feedback.
- `frontend/src/lib/email-assistant/__tests__/brandon-review.test.ts` - guard explicit `draft` field feedback in the shared review payload schema.
- `frontend/src/hooks/use-emails.ts` - shared client type for assistant review field feedback.
- `frontend/src/app/api/emails/route.ts` - parse draft verdict from stored review metadata.
- `frontend/src/app/api/emails/__tests__/route.test.ts` - guard shared email-route hydration of stored draft verdict feedback.
- `frontend/src/app/api/email-inbox/reviewed/route.ts` - parse and persist draft verdict in update responses.
- `frontend/src/app/api/email-inbox/reviewed/__tests__/route.test.ts` - guard project-assignment reason persistence on review updates.
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/route.ts` - persist structured project-assignment reasoning on initial review creation.
- `frontend/src/app/api/email-inbox/[emailId]/assistant-review/__tests__/route.test.ts` - guard project-assignment reason persistence on initial review creation.
- `frontend/src/features/emails/project-emails-workspace.tsx` - render explicit draft verdict controls in the shared feedback rail.

## Risks / Gaps

- Browser verification may still be blocked by the current protected-route auth issue on `localhost:3001`.
- Existing shared-workspace design-system warnings remain unrelated repo debt unless the feedback rail gets a broader cleanup.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
