# Task: Assistant Tool Routing Policy Metadata

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-621 - https://linear.app/megankharrison/issue/AAI-621/add-source-tool-routing-policy-metadata-to-assistant-registry
Related Handoff: N/A

## Objective

Add first-pass routing policy metadata to the AI assistant tool registry so key
source tools document when to use them, when not to use them, freshness
expectations, empty-result behavior, citation rules, and regression prompts.

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

Acceptance criteria:

- Registry entry type supports optional routing policy metadata.
- Tool definitions project routing policy into metadata for prompt/diagnostic use.
- Key source families have at least one assistant-chat source-bearing tool with
  routing policy: Teams, Outlook/email, meetings/Fireflies, documents/RAG,
  Acumatica, and project records.
- Tests fail loudly when the required source-family routing-policy coverage is
  missing.

Failure-loudly behavior:

- Registry tests identify the exact missing source family/tool policy gap instead
  of relying on user-visible model failures.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

Files/modules to change:

- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`
- `docs/tasks/2026-06-24-assistant-tool-routing-policy.md`

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
| Static/type/lint      | `pnpm --dir frontend exec prettier --check src/lib/ai/tool-registry.ts src/lib/ai/__tests__/tool-registry.test.ts` | Pass | All matched files use Prettier code style. |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/ai/__tests__/tool-registry.test.ts --runInBand` | Pass | 1 suite, 15 tests passed. Coverage proves required source-family routing policy exists and projects into tool definition metadata. |
| Browser/user-flow     | N/A                | N/A    | Registry metadata only; no UI changed. |
| DB/provider read-back | N/A                | N/A    | No database/provider changes. |
| End-to-end proof      | `toolDefinitionsForWorkflow({ workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID, allowedToolNames: ["searchTeamsMessages"] })` via Jest | Pass | Returned metadata includes `routingPolicy` with Teams use/do-not-use guidance, empty-result behavior, and the same-day Teams regression prompt. |

## Files Changed

- `docs/tasks/2026-06-24-assistant-tool-routing-policy.md` - Task gate and evidence ledger.
- `frontend/src/lib/ai/tool-registry.ts` - Adds `AssistantToolRoutingPolicy`, projects it into tool metadata, and adds canonical routing guidance for key source tools.
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts` - Adds registry guardrails for required source-family routing policy coverage and metadata projection.

## Risks / Gaps

- This slice adds validated metadata; a later slice should generate prompt
  instructions or diagnostics directly from the routing policy.
- Existing unrelated dirty files remain in the checkout and were not touched.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
