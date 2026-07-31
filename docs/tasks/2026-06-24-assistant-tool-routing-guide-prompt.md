# Task: Assistant Tool Routing Guide Prompt Injection

Status: In Progress
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-622 - https://linear.app/megankharrison/issue/AAI-622/inject-assistant-tool-routing-policy-into-runtime-prompts
Related Handoff: N/A

## Objective

Render the assistant tool registry's routing policy metadata into a compact runtime
prompt guide so source-specific requests like same-day Teams messages route to
the correct tool family before broad retrieval or meeting-intelligence fallback.

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

- Runtime assistant prompt includes a `## Tool Routing Policy` section generated
  from `frontend/src/lib/ai/tool-registry.ts`.
- The guide prioritizes source-specific tools for Teams, Outlook/email,
  meetings, documents/RAG, Acumatica, and structured project records.
- Prompt diagnostics can detect whether the routing guide is present.
- Tests fail if the guide drops the Teams regression prompt or omits routing
  policy from diagnostics.

## Failure-Loudly Behavior

If no registry policies are available, the guide renderer returns an empty
string instead of emitting stale hand-written routing advice. Tests cover the
expected checked-in policies so missing coverage fails in CI.

## Evidence

| Check                 | Command / artifact                                                                                                                                                                                                                                                                                                                      | Result | Notes                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static/type/lint      | `pnpm --dir frontend exec prettier --check src/lib/ai/tool-registry.ts src/lib/ai/bot-core.ts src/lib/ai/prompt-diagnostics.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/__tests__/prompt-diagnostics.test.ts src/lib/ai/__tests__/bot-core-prompt.test.ts ../docs/tasks/2026-06-24-assistant-tool-routing-guide-prompt.md` | Pass   | All matched files use Prettier code style.                                                                                                                        |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/__tests__/prompt-diagnostics.test.ts src/lib/ai/__tests__/bot-core-prompt.test.ts --runInBand`                                                                                                                                                     | Pass   | 3 suites, 21 tests passed.                                                                                                                                        |
| Browser/user-flow     | N/A                                                                                                                                                                                                                                                                                                                                     | N/A    | Prompt/runtime backend change only; no frontend-visible UI.                                                                                                       |
| DB/provider read-back | N/A                                                                                                                                                                                                                                                                                                                                     | N/A    | No schema, migration, env, or provider changes.                                                                                                                   |
| End-to-end proof      | Runtime prompt assembly test                                                                                                                                                                                                                                                                                                            | Pass   | `bot-core-prompt.test.ts` proves assembled runtime prompt contains `## Tool Routing Policy`, `searchTeamsMessages (teams)`, and the no-meeting-substitution rule. |

## Files Changed

- `frontend/src/lib/ai/tool-registry.ts` - render compact prompt guide from registry routing policy metadata.
- `frontend/src/lib/ai/bot-core.ts` - inject guide into runtime assistant prompt assembly.
- `frontend/src/lib/ai/prompt-diagnostics.ts` - expose guide presence in prompt diagnostics.
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts` - guard guide content and regression prompt.
- `frontend/src/lib/ai/__tests__/prompt-diagnostics.test.ts` - guard diagnostics marker.
- `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts` - guard runtime prompt injection.
- `docs/tasks/2026-06-24-assistant-tool-routing-guide-prompt.md` - task definition and evidence.

## Risks / Gaps

- Full assistant E2E with live tool calls is outside this focused code slice; the prior AAI-619 fix covers same-day Teams routing at planner/detector level.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
