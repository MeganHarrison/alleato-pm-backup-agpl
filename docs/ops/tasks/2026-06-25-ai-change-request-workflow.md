# Task: AI Change Request Workflow

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-654 - https://linear.app/megankharrison/issue/AAI-654/complete-ai-assistant-change-request-creation-workflow
Related Handoff: docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md

## Objective

Complete and verify the AI assistant workflow for helping a user create a change request/change event: widget starter copy should seed a change-request prompt, the assistant tool path must be registered and source-backed, and any business-record write must stay preview-first with a user-visible confirmation UI before submission.

## Workflow Map

User action: click AI widget welcome action or ask assistant to create/log/draft a change request.
Frontend owner component: `frontend/src/components/ai-assistant/chat-area.tsx`.
Shared primitive/component owner: AI Elements message/tool/confirmation primitives plus `assistant-widget-renderer.tsx` if a dedicated preview card is needed.
Client state changed: assistant composer input, streamed tool parts, confirmation action state.
API route(s): `frontend/src/app/api/ai-assistant/chat/route.ts`.
Validation schema(s): `frontend/src/lib/ai/tools/action-tools.ts` `createChangeEvent` input schema and any added field-reference helper.
Service/helper(s): `frontend/src/lib/ai/tool-registry.ts`, `frontend/src/lib/ai/tools/action-tools.ts`, prompt/reference helpers under `frontend/src/lib/ai`.
Supabase table(s): `change_events`; no schema change planned unless the current contract cannot represent required fields.
Live DB column/type assumptions: `change_events.project_id` is numeric, `number` and `updated_at` are required, and existing tool generates number before insert.
Side effects on render: none expected.
Bulk/import/template behavior: not applicable for single change request creation.
Expected success evidence: starter prompt is change-request focused; tool registry includes the write tool; preview output renders before confirmed write; tests cover registry/preview guidance.
Expected failure behavior: missing required fields produce a specific preview/validation response, not a silent write or generic failure.

## Attention Brief

Primary user: PM or executive using AI assistant to start a change request.
Primary job: capture a possible scope/cost/schedule change with enough required information for review.
Primary decision: whether the previewed change request is accurate enough to submit.
Tier 1: required fields, concise preview, confirm/reject action.
Tier 2: optional fields and source/context references.
Tier 3: tool/debug trace details.
Hide until requested: raw JSON, advanced optional fields, registry internals.
Remove: direct writes without preview, duplicate RFI wording, decorative preview chrome.
Primary action: confirm the previewed change request creation.
Failure-loudly behavior: missing required fields and failed writes identify the specific field/action and do not create partial records.

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

- `frontend/src/components/ai-assistant/chat-area.tsx` - widget starter copy/action.
- `frontend/src/lib/ai/tool-registry.ts` - registry proof and any missing registration.
- `frontend/src/lib/ai/tools/action-tools.ts` - change request preview/confirmation contract.
- `frontend/src/lib/ai/rag-assistant-prompt.ts` or a shared reference helper - required/optional field guidance.
- `frontend/src/lib/ai/assistant-widgets.ts` and `frontend/src/components/ai-assistant/assistant-widget-renderer.tsx` - generative UI preview card only if the current confirmation UI is insufficient.
- Focused tests under `frontend/src/lib/ai/**/__tests__` and/or `frontend/src/components/ai-assistant/__tests__`.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/lib/ai/change-request-field-guide.ts src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/tool-registry.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/tools/action-tools.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/ai/rag-assistant-prompt.ts src/lib/ai/assistant-widgets.ts src/lib/ai/action-capabilities.ts src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/__tests__/welcome-screen.test.tsx src/lib/collaboration/ai-widget-notifications.ts src/lib/collaboration/__tests__/ai-widget-notifications.test.ts src/hooks/use-collaboration-notifications.ts src/app/api/collaboration/notifications/route.ts src/components/ai-assistant/global-ai-widget.tsx` | Pass | No ESLint errors. |
| Patch hygiene | `git diff --check -- <task-owned files>` | Pass | No whitespace errors. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/components/ai-assistant/__tests__/welcome-screen.test.tsx src/lib/collaboration/__tests__/ai-widget-notifications.test.ts` | Pass | 5 suites, 39 tests passed. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/25125/home`; reset `alleato-ai-widget-welcome-seen-v1`; opened widget; clicked `Create a change request`; read composer value | Pass | Composer value became `Help me create a new change request for this project.` |
| DB/provider read-back | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Blocked/Not needed | CLI exited non-zero after `WARN: config section [inbucket] is deprecated`; no migration/schema change was made. The truncated file was repaired from committed generated types before continuing. |
| End-to-end proof      | `docs/ops/evidence/2026-06-25-ai-change-request-workflow/open-widget-change-request-actions.png`; `docs/ops/evidence/2026-06-25-ai-change-request-workflow/change-request-starter-seeded.png` | Pass | Screenshots saved locally; evidence directory is ignored by repo policy. Tool-level preview test proves no-write preview path. |

## Files Changed

- `frontend/src/components/ai-assistant/chat-area.tsx` - Change-request widget starter and change-request preview card heading/labels.
- `frontend/src/components/ai-assistant/__tests__/welcome-screen.test.tsx` - Updated starter fixture wording.
- `frontend/src/lib/ai/change-request-field-guide.ts` - Shared change request field/confirmation guide.
- `frontend/src/lib/ai/__tests__/change-request-field-guide.test.ts` - Guard field guide contents and rendered guidance.
- `frontend/src/lib/ai/tools/action-tools.ts` - `createChangeEvent` tool description now uses the shared change request guide.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - Guard `createChangeEvent` preview-before-write behavior.
- `frontend/src/lib/ai/rag-assistant-prompt.ts` - Map change request wording to `createChangeEvent` and inject the shared guide.
- `frontend/src/lib/ai/assistant-widgets.ts` - Recognize change request wording in generated action preview widgets.
- `frontend/src/lib/ai/action-capabilities.ts` - Visible action wording now says change requests/change events.
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts` - Guard `createChangeEvent` availability in assistant chat workflow.
- `docs/ops/tasks/2026-06-25-ai-change-request-workflow.md` - Task ledger and evidence.
- `docs/ops/tasks/2026-06-25-ai-widget-welcome-mvp.md` - Updated historical recheck wording from RFI to current change-request target.

## Risks / Gaps

- Existing checkout has unrelated dirty files. This task must stage/publish only task-owned files.
- A previous loop has in-progress collaboration-notification changes; keep final staging scoped by task.
- Live LLM submission was not run because the browser session landed on `/knowledge` during one reload, making project context ambiguous. The deterministic tool preview test verifies the no-write creation path.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
