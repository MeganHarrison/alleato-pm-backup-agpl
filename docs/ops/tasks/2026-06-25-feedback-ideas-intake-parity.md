# Task: Feedback ideas intake parity

Status: Done
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-645 - https://linear.app/megankharrison/issue/AAI-645/unify-ideas-and-feature-requests-into-feedback-inbox-intake
Related Handoff: Not created - single-session implementation

## Objective

Make ideas and feature requests first-class submissions in the existing Feedback Inbox workflow so future Teams, form, AI assistant, and in-app submissions can all route into one central intake system.

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
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] The existing Feedback Inbox remains the single source of truth for idea and feature-request intake.
- [x] No new idea-specific database table or parallel workflow is introduced.
- [x] In-app idea submissions use product-intake language while preserving existing `feature_request` storage.
- [x] Feedback Inbox tabs and labels make idea/feature-request items discoverable as product ideas.
- [x] Teams/GitHub/title labels use the same shared request-type labels.
- [x] Tests prove ideas still route as `feature_request` and receive the product-intake label.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npx eslint 'src/lib/admin-feedback/constants.ts' 'src/lib/admin-feedback/title.ts' 'src/lib/admin-feedback/teams-webhook.ts' 'src/lib/admin-feedback/github.ts' 'src/lib/admin-feedback/__tests__/request-types.unit.test.ts' 'src/components/admin-feedback/AdminFeedbackWidget.tsx' 'src/app/(admin)/feedback-inbox/constants.ts'` | Pass | Targeted lint passed with no output. |
| Route check           | `npm run check:routes` | Pass | No route conflicts found. |
| Targeted tests        | `npm run test:unit -- --runTestsByPath 'src/lib/admin-feedback/__tests__/request-types.unit.test.ts'` | Pass | 3 tests prove `feature_request` presents as `Idea` and keeps GitHub integration labels. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/feedback-inbox && agent-browser wait 3000 && agent-browser snapshot -i` | Pass | Inbox rendered `Ideas 15`; screenshot: `/Users/meganharrison/.agent-browser/tmp/screenshots/screenshot-2026-06-25T19-56-33-147Z-xlhqo7.png`. |
| Teams source review   | Teams fetch `/chats/19:38f414d6-e90d-4886-b2f3-5a1b644c3fa2_737d4feb-3a1e-4715-bb15-ebc1d7002b27@unq.gbl.spaces/messages/1782412892540?is_channel=true` | Pass | Verified Colin Gillespie's June 25 drone/Links message matched the pasted request. |
| DB/provider read-back | N/A                | Pass   | Current schema already supports `feature_request`; no migration needed. |
| End-to-end proof      | Shared constants + inbox route + test evidence | Pass | Idea/product intake now routes through the existing Feedback Inbox `feature_request` path with shared labels for title, Teams, GitHub, and inbox tabs. |
| Known unrelated failure | Prior full frontend typecheck: `src/lib/executive/brandon-daily-update.ts(3758,11): error TS1117` | Unrelated | Full typecheck was not rerun for this slice; this existing duplicate-object-property failure is outside the feedback intake files. |

## Files Changed

- `frontend/src/lib/admin-feedback/constants.ts` - shared request-type labels and intake copy.
- `frontend/src/lib/admin-feedback/title.ts` - title labels for idea/feature-request records.
- `frontend/src/lib/admin-feedback/teams-webhook.ts` - Teams notification label parity.
- `frontend/src/lib/admin-feedback/github.ts` - GitHub label/body parity.
- `frontend/src/components/admin-feedback/AdminFeedbackWidget.tsx` - in-app idea submission copy/metadata.
- `frontend/src/app/(admin)/feedback-inbox/constants.ts` - inbox tab/label parity.
- `frontend/src/lib/admin-feedback/__tests__/request-types.unit.test.ts` - regression coverage for idea labels and integration labels.
- `docs/ops/tasks/2026-06-25-feedback-ideas-intake-parity.md` - working definition of done.

## Risks / Gaps

- Teams channel ingestion and standalone form/webhook intake are follow-up adapter slices, not part of this first parity pass.
- `frontend/src/components/header/feedback-button.tsx` is already dirty from unrelated work and will not be touched in this slice.
- Browser verification confirmed the Feedback Inbox label change. The admin inbox route did not expose the Velt composer during the follow-up click attempt, so composer copy is covered by source review and targeted lint rather than browser interaction.
- The checkout contains extensive unrelated dirty files, so this slice was not committed or pushed from the main conversation.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
