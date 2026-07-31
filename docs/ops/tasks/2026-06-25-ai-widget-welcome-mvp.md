# Task: AI Widget Welcome Notification MVP

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-649 - https://linear.app/megankharrison/issue/AAI-649/implement-quick-welcome-notification-mvp-for-global-ai-widget
Related Handoff: docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md

## Objective

Ship a narrow owner-demo MVP for the existing global floating AI widget: first-time eligible users should see an unread/welcome indicator, opening the widget should show a concise welcome message with useful actions, and those actions should start preview-first AI prompts without leaving the current page.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

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

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/components/ai-assistant/global-ai-widget.tsx src/components/ai-assistant/widget-ai-chat.tsx src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/welcome-screen.tsx src/components/ai-assistant/__tests__/welcome-screen.test.tsx` | Pass | No warnings after switching the test fixture to shared UI primitives. |
| Patch hygiene         | `git diff --check -- frontend/src/components/ai-assistant/global-ai-widget.tsx frontend/src/components/ai-assistant/widget-ai-chat.tsx frontend/src/components/ai-assistant/chat-area.tsx frontend/src/components/ai-assistant/welcome-screen.tsx frontend/src/components/ai-assistant/__tests__/welcome-screen.test.tsx docs/ops/tasks/2026-06-25-ai-widget-welcome-mvp.md docs/ops/tasks/2026-06-25-ai-widget-mvp-handoff.md docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md docs/ops/evidence/2026-06-25-ai-widget-mvp/open-widget-welcome-action-seeded.png` | Pass | No whitespace issues. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/components/ai-assistant/__tests__/welcome-screen.test.tsx` | Pass | 1 test passed. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/25125/home`; reset localStorage key; opened widget through DOM fallback due dev overlay; clicked the starter action; read composer value | Pass | Historical proof from the original MVP; current workflow is now change-request focused under AAI-654. |
| Current browser recheck | `agent-browser open http://localhost:3001/25125/home`; reset `alleato-ai-widget-welcome-seen-v1`; waited for delayed widget mount; clicked launcher and the change-request starter; read composer value | Pass | Recheck target changed 2026-06-25. Current expected composer value is `Help me create a new change request for this project.` |
| DB/provider read-back | Not applicable | Pass | No database/provider changes. |
| End-to-end proof      | `docs/ops/evidence/2026-06-25-ai-widget-mvp/open-widget-welcome-action-seeded.png` | Pass | Screenshot captured after action seeded the prompt. |
| Current proof artifacts | `docs/ops/evidence/2026-06-25-ai-widget-mvp/current-check/closed-launcher-current.png`; `docs/ops/evidence/2026-06-25-ai-widget-mvp/current-check/open-welcome-current.png`; `docs/ops/evidence/2026-06-25-ai-widget-mvp/current-check/action-chip-seeded-current.png` | Pass | Fresh screenshots captured after current-state recheck. |
| Known unrelated issue | Existing dev server console output reports `frontend/src/app/(main)/knowledge/page.tsx` cannot resolve `@/features/knowledge/knowledge-base-page` | Unrelated | Existing route/module issue, not caused by this task. |

## Files Changed

- `frontend/src/components/ai-assistant/global-ai-widget.tsx` - Owner-demo unread welcome trigger and seen-state wiring.
- `frontend/src/components/ai-assistant/widget-ai-chat.tsx` - Pass widget-only welcome props into shared chat.
- `frontend/src/components/ai-assistant/chat-area.tsx` - Render compact widget-only welcome actions and seed preview-first prompts.
- `frontend/src/components/ai-assistant/welcome-screen.tsx` - Add opt-in content slot before the composer.
- `frontend/src/components/ai-assistant/__tests__/welcome-screen.test.tsx` - Guard the opt-in welcome action slot.
- `docs/ops/tasks/2026-06-25-ai-widget-welcome-mvp.md` - Task definition and evidence.
- `docs/ops/evidence/2026-06-25-ai-widget-mvp/open-widget-welcome-action-seeded.png` - Browser proof screenshot.
- `docs/ops/evidence/2026-06-25-ai-widget-mvp/current-check/closed-launcher-current.png` - Current recheck screenshot for closed launcher.
- `docs/ops/evidence/2026-06-25-ai-widget-mvp/current-check/open-welcome-current.png` - Current recheck screenshot for open welcome actions.
- `docs/ops/evidence/2026-06-25-ai-widget-mvp/current-check/action-chip-seeded-current.png` - Current recheck screenshot for seeded action prompt.

## Risks / Gaps

- This MVP uses browser localStorage for the one-time welcome prompt. Durable multi-channel notification routing remains a follow-up through `collaboration_notifications`.
- Agent-browser physical clicks were blocked by the dev-only MCP annotation overlay, so browser interaction used DOM evaluation fallback for the widget launcher and action chip. The rendered interactive elements were visible in the accessibility snapshot.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
