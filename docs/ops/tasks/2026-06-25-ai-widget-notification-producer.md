# Task: AI Widget Notification Producer

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-666 - https://linear.app/megankharrison/issue/AAI-666/produce-ai-widget-collaboration-notifications
Parent: AAI-647

## Objective

Add the first durable producer path for AI widget collaboration notifications so
the global AI widget can receive real `collaboration_notifications` rows with
normalized prompt metadata. The producer must use the existing collaboration
notification table and shared notification service rather than adding another
notification store, widget, or UI surface.

## Attention Brief

Primary user: project team member who has an AI-generated action preview waiting
for review.
Primary job: notice that the assistant has something actionable ready and reopen
the existing AI widget to review it.
Primary decision: whether to open the widget and continue the existing action.
Tier 1: notification kind, title/body, prompt to seed the composer.
Tier 2: project/entity linkage for route filtering and debugging.
Tier 3: raw metadata/source/event keys.
Hide until requested: notification history and raw payload metadata.
Remove: duplicate widgets, page banners, local-only action stores, UI-level
notification inserts.
Primary action: open the existing global AI widget.
Failure-loudly behavior: invalid notification payloads fail before insert;
database insert failures throw actionable errors in service-level tests and are
not swallowed by the producer helper.

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

## Planned Files

- `frontend/src/services/notificationService.ts` - shared notification producer owner.
- `frontend/src/lib/collaboration/ai-widget-notifications.ts` - existing typed AI widget notification contract.
- `frontend/src/lib/ai/tools/action-tools.ts` - likely first producer entry point for action previews.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - preview producer guardrail, if wiring lands in action tools.
- `frontend/src/services/__tests__/*` - service-level producer tests, if shared service is expanded.
- `docs/ops/tasks/2026-06-25-ai-widget-notification-producer.md` - task ledger.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/services/notificationService.ts src/services/__tests__/notificationService.test.ts src/lib/ai/tools/action-tools.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/components/ai-assistant/global-ai-widget.tsx` | Pass | Targeted lint for producer, tool wiring, and widget timing guard. |
| Static/type/lint      | `cd frontend && npx tsc --noEmit --pretty false` | Pass | Full frontend typecheck passed. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/services/__tests__/notificationService.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/collaboration/__tests__/ai-widget-notifications.test.ts` | Pass | 3 suites / 28 tests. |
| Browser/user-flow     | `node <temporary notification row + Playwright widget smoke>` | Pass | Inserted temporary `change_request_review_needed` row, opened `/25125/home`, hid local Agentation overlay for clickability, verified widget composer seeded from `metadata.prompt`; screenshot: `docs/ops/evidence/2026-06-25-ai-widget-notification-producer/notification-row-seeds-widget-composer.png`. |
| DB/provider read-back | `node <Supabase cleanup read-back>` | Pass | Checked `codex-aai-666-*` and `codex-debug-*` proof rows; `activeProofRows: 0`. No schema migration or provider config required. |
| End-to-end proof      | `createChangeEvent` preview test + temporary row browser smoke | Pass | Tool preview emits `notifyChangeRequestReviewNeeded`; live notification contract reaches existing widget composer. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-widget-notification-producer.md` - task ledger and definition of done.
- `frontend/src/services/notificationService.ts` - shared AI widget notification producer, metadata normalization, dedupe, and change-request review helper.
- `frontend/src/services/__tests__/notificationService.test.ts` - service-level producer/dedupe/failure tests.
- `frontend/src/lib/ai/tools/action-tools.ts` - `createChangeEvent` preview emits `change_request_review_needed`.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - guardrail that change-request previews call the producer.
- `frontend/src/components/ai-assistant/global-ai-widget.tsx` - seeds notification drafts when rows arrive before or after widget open.

## Risks / Gaps

- Existing checkout has unrelated dirty files. This task must stage/publish only task-owned files.
- The producer avoids duplicate unread rows for the same preview through deterministic `metadata.eventKey` dedupe.
- The live browser proof hides the local Agentation overlay because it intercepts clicks over the AI launcher in headless verification. This does not change production UI.
- Direct `tsx` import of `notificationService` for ad hoc proof failed on an unrelated local package export issue (`chat/package.json` has no exports main). Unit tests and browser/API proof covered the producer path instead.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
