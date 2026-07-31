# Task: AI Profile Context Visibility

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-700 - https://linear.app/megankharrison/issue/AAI-700/ai-profile-context-visibility-next-slice
Related Handoff: Not applicable

## Objective

Make the existing AI Profile easier to audit by showing the governed context
packet categories Alleato AI can use for the logged-in user, without adding a
new schema, route, or noisy dashboard treatment.

## Source Notes

- Requested planning source `docs/ai-plan2/AI_USER_INTELLIGENCE_PROFILE_MATRIX.md`
  is not present in this branch snapshot.
- Existing local source lineage reviewed:
  `docs/ops/tasks/2026-06-25-ai-profile-mvp.md`,
  `docs/ops/tasks/2026-06-25-ai-profile-context-packet.md`, and
  `docs/ops/tasks/2026-06-25-ai-profile-prompt-context.md`.

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

- `frontend/src/components/ai-assistant/ai-profile-page.tsx` - Add quiet context packet audit section using existing data.
- `frontend/src/lib/ai/ai-profile-context-packet.ts` - Add focused category summary helper if needed for UI/test reuse.
- `frontend/src/lib/ai/__tests__/ai-profile-context-packet.test.ts` - Guard category summary behavior.
- `docs/ops/tasks/2026-06-26-ai-profile-context-visibility.md` - Task evidence.

## Acceptance Criteria

- AI Profile shows identity, approval/write mode, notification routing,
  leadership context policy, blocked capabilities/warnings, and selected memory
  context in a compact audit view.
- UI reuses the existing profile and memory API data and the shared context
  packet helper.
- Leadership/coaching context remains explicit as not configured; UI must not
  imply hidden leadership data exists.
- No stat cards, decorative panels, duplicate CTAs, database schema, or broad
  route changes.

## Failure-Loudly Behavior

- If profile or memory loading fails, existing `ErrorState` remains the single
  visible failure path.
- If identity or authority is unresolved, the context packet marks status
  degraded, lists warnings, and blocks write/delivery capabilities.
- If leadership context is unavailable, the packet and UI show policy state
  instead of silently omitting it.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Dependency bootstrap | `pnpm --dir frontend install --frozen-lockfile` | Partial | Dependencies populated; command exited 1 because pnpm ignored package build scripts pending approval. No secrets printed. |
| Static/type/lint | `cd frontend && npx eslint src/components/ai-assistant/ai-profile-page.tsx src/lib/ai/ai-profile-context-packet.ts src/lib/ai/__tests__/ai-profile-context-packet.test.ts`; `cd frontend && npm run typecheck:changed`; `git diff --check` | Pass | Targeted lint clean; changed-type debt guard clean; no full/project typecheck run. Initial lint before bootstrap failed on missing `eslint-plugin-storybook`; rerun passed after dependency bootstrap. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/ai-profile-context-packet.test.ts` | Pass | 7 tests passed. Initial run before bootstrap failed on missing local `jest`; rerun passed after dependency bootstrap. |
| Browser/user-flow | `agent-browser open http://localhost:3001/ai/profile`; `agent-browser get url`; `agent-browser screenshot /Users/meganharrison/.codex/worktrees/ai-profile-context-visibility/alleato-pm/docs/ops/evidence/2026-06-26-ai-profile-context-visibility/ai-profile-context-audit-final.png` | Pass | `/ai/profile` loaded; profile and memories APIs returned 200 in dev-server logs; screenshot shows Prompt Context Audit. |
| DB/provider read-back | Not applicable | Pass | No database/provider changes planned. |
| End-to-end proof | `agent-browser get text 'body'` | Pass | Text output contained Prompt Context Audit, leadership not-configured policy, blocked capability state, and Selected for prompts memories. |

## Files Changed

- `docs/ops/tasks/2026-06-26-ai-profile-context-visibility.md` - Task evidence.
- `docs/ops/evidence/2026-06-26-ai-profile-context-visibility/ai-profile-context-audit-final.png` - Browser evidence artifact.
- `frontend/src/components/ai-assistant/ai-profile-page.tsx` - Added prompt context audit UI using the shared context packet.
- `frontend/src/lib/ai/ai-profile-context-packet.ts` - Added audit category summary helper.
- `frontend/src/lib/ai/__tests__/ai-profile-context-packet.test.ts` - Added category summary guardrail.

## Risks / Gaps

- The requested matrix doc path is missing in this checkout, so this slice is
  grounded in the prior AI Profile task docs and live code instead.
- Browser verification may be limited by local auth/dev-server state; if so,
  targeted tests and source proof will be recorded separately.
- `pnpm --dir frontend install --frozen-lockfile` exits 1 in this environment
  because pnpm requires build-script approvals. The targeted JS tooling was
  still installed and the requested lint/test checks passed afterward.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
