# Task: AI Widget RFI Notification Producer

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-671 - https://linear.app/megankharrison/issue/AAI-671/produce-ai-widget-rfi-preview-notifications
Parent: AAI-647

## Objective

Extend the durable AI widget notification producer path to RFI previews. When
the assistant prepares an RFI draft, the existing global AI widget should be able
to receive a `collaboration_notifications` row with `kind='rfi_attention'` and
normalized prompt metadata that seeds the existing composer. This must reuse the
shared notification service and existing widget, not add a second store or UI.

## Attention Brief

Primary user: project team member who has an AI-generated RFI draft waiting for
review.
Primary job: notice the assistant has an RFI action ready and reopen the widget.
Primary decision: review/revise/confirm the RFI draft.
Tier 1: notification title/body and prompt.
Tier 2: project/entity linkage and source for debugging.
Tier 3: raw metadata/event key.
Hide until requested: notification history and raw payload metadata.
Remove: duplicate banners, separate widget state, page-local inserts.
Primary action: open the existing global AI widget.
Failure-loudly behavior: invalid notification payloads fail before insert; DB
insert/dedupe failures throw actionable errors through service-level tests.

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

- `frontend/src/services/notificationService.ts` - shared RFI notification producer helper.
- `frontend/src/services/__tests__/notificationService.test.ts` - producer guardrails.
- `frontend/src/lib/ai/tools/action-tools.ts` - `previewCreateRFI` producer call.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - RFI preview wiring test.
- `docs/ops/tasks/2026-06-25-ai-widget-rfi-notification-producer.md` - task ledger.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/services/notificationService.ts src/services/__tests__/notificationService.test.ts src/lib/ai/tools/action-tools.ts src/lib/ai/tools/__tests__/action-tools.test.ts` | Pass | Targeted lint for RFI producer path. |
| Static/type/lint      | `cd frontend && npx tsc --noEmit --pretty false` | Failed | Node heap OOM at default heap. |
| Static/type/lint      | `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 npx tsc --noEmit --pretty false` | Pass | Full frontend typecheck passed with project large-heap setting. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/services/__tests__/notificationService.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/collaboration/__tests__/ai-widget-notifications.test.ts` | Pass | 3 suites / 30 tests. |
| Browser/user-flow     | `node <temporary rfi_attention row + Playwright widget smoke>` | Pass | Inserted temporary `rfi_attention` row, opened `/25125/home`, hid local Agentation overlay for clickability, verified widget composer seeded from `metadata.prompt`; screenshot: `docs/ops/evidence/2026-06-25-ai-widget-rfi-notification-producer/rfi-notification-row-seeds-widget-composer.png`. |
| DB/provider read-back | `node <Supabase cleanup read-back>` | Pass | Checked `codex-aai-671-*` proof rows; `activeProofRows: 0`. No schema migration or provider config required. |
| End-to-end proof      | `previewCreateRFI` unit test + temporary row browser smoke | Pass | RFI preview emits `notifyRfiReviewNeeded`; live notification contract reaches existing widget composer. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-widget-rfi-notification-producer.md` - task ledger and definition of done.
- `frontend/src/services/notificationService.ts` - shared RFI review notification helper and prompt builder.
- `frontend/src/services/__tests__/notificationService.test.ts` - RFI producer/prompt guardrails.
- `frontend/src/lib/ai/tools/action-tools.ts` - `previewCreateRFI` emits `rfi_attention`.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - RFI preview producer guardrail.

## Risks / Gaps

- Existing checkout has unrelated dirty files. This task must stage/publish only task-owned files.
- The local Agentation feedback overlay can intercept widget launcher clicks during headless verification; browser proof may hide that dev overlay to exercise the product UI.
- Default-heap typecheck OOMed; the larger heap command passed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
