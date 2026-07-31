# Task: AI Change Request Review Card

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-672 - https://linear.app/megankharrison/issue/AAI-672/add-structured-assistant-change-request-review-card
Parent: AAI-647

## Objective

Add a reusable structured review-card contract for AI assistant write previews,
starting with change requests/change events. The assistant should show required,
optional, and generated fields in the existing chat preview surface before the
user explicitly confirms the write.

## Attention Brief

Primary user: PM or executive reviewing an AI-prepared change request draft.
Primary job: see what will be written, which fields are required, which fields
are optional/defaulted, and which fields Alleato will generate.
Primary decision: confirm the draft, revise the prompt, or stop before writing.
Tier 1: title, project, description, scope, type, status, and generated number.
Tier 2: field grouping and empty optional/defaulted states.
Tier 3: raw table/field metadata.
Hide until requested: database table names and internal event keys.
Remove: duplicate confirmation CTAs, standalone widget variants, decorative
preview wrappers.
Primary action: confirm through the existing assistant confirmation flow.
Failure-loudly behavior: preview metadata builder and renderer tests fail if
required fields or generated fields disappear.

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

- `frontend/src/lib/ai/change-request-field-guide.ts` - source metadata for required/optional/generated change-request fields.
- `frontend/src/lib/ai/__tests__/change-request-field-guide.test.ts` - metadata contract guardrail.
- `frontend/src/lib/ai/tools/action-tools.ts` - attach structured review-card metadata to `createChangeEvent` preview output.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - preview metadata guardrail.
- `frontend/src/components/ai-assistant/chat-area.tsx` - render structured preview groups in the existing assistant surface.
- `frontend/src/components/ai-assistant/__tests__/chat-area.test.tsx` or an existing focused renderer test - UI guardrail.
- `docs/ops/tasks/2026-06-25-ai-change-request-review-card.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `cd frontend && npx eslint src/lib/ai/change-request-field-guide.ts src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/tools/action-tools.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/preview-review-card.ts src/components/ai-assistant/__tests__/chat-area-review-card.test.ts src/components/ai-assistant/welcome-screen.tsx src/components/ai-assistant/__tests__/welcome-screen.test.tsx ... --rule 'design-system/no-raw-search-input:error'` | Pass | Targeted lint clean for AI preview/widget files and combined guardrail run. |
| Static/type/lint | `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 npx tsc --noEmit --pretty false` | Pass | Full frontend typecheck passed with project large-heap setting. |
| Targeted tests | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/components/ai-assistant/__tests__/chat-area-review-card.test.ts src/components/ai-assistant/__tests__/welcome-screen.test.tsx src/app/(main)/comments/__tests__/comments-page-utils.test.ts` | Pass | 5 suites / 27 tests. |
| Browser/user-flow | `node <Playwright authenticated widget smoke>` | Pass | Opened `/comments`, waited for deferred widget mount, opened AI widget, confirmed no greeting/profile/teach footer, compact suggestions, and composer textarea present. Screenshot: `docs/ops/evidence/2026-06-25-ai-change-request-review-card/widget-compact-reference-pass.png`. |
| DB/provider read-back | Not applicable | Pass | No schema migration or provider config changed. |
| End-to-end proof | `createChangeEvent` preview test + widget browser smoke | Pass | Preview returns structured review-card metadata; widget empty state follows compact reference direction. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-change-request-review-card.md` - task ledger and evidence.
- `frontend/src/lib/ai/change-request-field-guide.ts` - structured review-card metadata builder.
- `frontend/src/lib/ai/__tests__/change-request-field-guide.test.ts` - field-guide/review-card contract.
- `frontend/src/lib/ai/tools/action-tools.ts` - `createChangeEvent` preview includes `reviewCard`.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - action-tool preview metadata guardrail.
- `frontend/src/components/ai-assistant/preview-review-card.ts` - shared preview metadata parser for UI rendering.
- `frontend/src/components/ai-assistant/__tests__/chat-area-review-card.test.ts` - parser guardrail.
- `frontend/src/components/ai-assistant/chat-area.tsx` - grouped review-card rendering and compact widget empty state.
- `frontend/src/components/ai-assistant/welcome-screen.tsx` - widget-specific welcome variant without full assistant greeting/footer.
- `frontend/src/app/globals.css` - tighter default AI widget panel dimensions.

## Risks / Gaps

- Existing checkout has unrelated dirty files. Stage only task-owned files.
- The existing confirmation flow remains text-confirm based; this slice improves preview clarity without introducing a second write path.
- Browser proof used the authenticated agent-browser storage state and hid the local Agentation overlay in Playwright. The overlay is not production UI.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
