# Task: AI Command Center Action Catalog

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-661 - https://linear.app/megankharrison/issue/AAI-661/build-ai-command-center-action-catalog
Related Handoff: Not applicable

## Objective

Add a visible AI action catalog to the full AI command center experience so users
can see what Alleato AI can do, which actions require preview/approval, and
which capabilities need setup or are not ready yet.

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

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npm run typecheck`; `npx eslint src/lib/ai/assistant-action-catalog.ts src/components/ai-assistant/assistant-action-catalog.tsx src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/welcome-screen.tsx src/lib/ai/__tests__/assistant-action-catalog.test.ts`; `git diff --check -- <task files>` | Pass | TypeScript, targeted ESLint, and whitespace checks passed. |
| Targeted tests        | `npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/assistant-action-catalog.test.ts src/components/ai-assistant/__tests__/welcome-screen.test.tsx` | Pass | 2 suites, 4 tests passed. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/ai`; screenshots in `docs/ops/evidence/2026-06-25-ai-command-center-action-catalog/` | Pass | Authenticated AI empty state showed catalog; clicking `Draft an RFI` populated the composer. |
| DB/provider read-back | Not applicable | Pass | No database/provider changes. |
| End-to-end proof      | `docs/ops/evidence/2026-06-25-ai-command-center-action-catalog/ai-command-center-catalog.png`; `docs/ops/evidence/2026-06-25-ai-command-center-action-catalog/ai-command-center-rfi-prompt.png` | Pass | Catalog visible with ready/preview-required labels and action prompt selection verified. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-command-center-action-catalog.md` - Task evidence.
- `frontend/src/lib/ai/assistant-action-catalog.ts` - Registry-backed catalog adapter.
- `frontend/src/components/ai-assistant/assistant-action-catalog.tsx` - Command-center catalog UI.
- `frontend/src/components/ai-assistant/chat-area.tsx` - Empty-state integration.
- `frontend/src/lib/ai/__tests__/assistant-action-catalog.test.ts` - Catalog derivation guardrails.
- `docs/ops/evidence/2026-06-25-ai-command-center-action-catalog/ai-command-center-catalog.png` - Browser proof of catalog rendering.
- `docs/ops/evidence/2026-06-25-ai-command-center-action-catalog/ai-command-center-rfi-prompt.png` - Browser proof of action prompt selection.

## Risks / Gaps

- This slice surfaces the catalog on the AI empty state first; page-contextual suggestions remain a follow-up slice.
- Some readiness labels are policy-derived from registry metadata and still need
  live workflow verification before actions should be marked ready in broader UI.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
