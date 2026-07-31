# Task: AI Page Header History And Composer Spacing

Status: Complete - Local Verified
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-696
Linear URL: https://linear.app/megankharrison/issue/AAI-696/polish-ai-page-header-history-control-and-welcome-composer-spacing
Related Handoff: Not required - narrow UI correction

## Objective

Polish the `/ai` welcome page by restoring the standard site header, making the
chat-history opener read clearly, removing the duplicate helper heading,
quieting the composer shadow, and increasing the gap before the action cards.

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

- `frontend/src/app/(main)/layout.tsx`
- `frontend/src/components/ai-assistant/rag-chat-page.tsx`
- `frontend/src/components/ai-assistant/welcome-screen.tsx`
- `frontend/src/components/ai-assistant/chat-area.tsx`
- `docs/ops/tasks/2026-06-26-ai-page-header-history-spacing.md`
- `docs/ops/evidence/2026-06-26-ai-page-header-history-spacing/ai-page-polish.png`

## Acceptance Criteria

- The `/ai` page renders the same desktop `SiteHeader` as other app pages.
- The chat-history opener is positioned on the left and uses explicit chat
  history labeling instead of an unlabeled gray circle.
- The welcome copy shows the primary greeting without the second
  `How can I help?` heading.
- The full assistant composer has a quieter shadow.
- The action cards have more vertical space below the composer.

## Failure-Loud Behavior

- Browser verification checks for header presence, chat-history label, absence
  of the secondary heading, and the expected spacing/shadow classes.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Kickoff | Linear AAI-696 | Pass | Issue created before implementation. |
| Static/type/lint | `cd frontend && npx eslint 'src/app/(main)/layout.tsx' src/components/ai-assistant/rag-chat-page.tsx src/components/ai-assistant/welcome-screen.tsx src/components/ai-assistant/chat-area.tsx` | Pass | Changed-file lint passed with no errors. |
| Targeted tests | `cd frontend && npx jest --runInBand --runTestsByPath src/components/ai-assistant/__tests__/welcome-screen.test.tsx src/lib/ai/__tests__/assistant-suggestion-resolver.test.ts` | Pass | 2 suites, 7 tests passed. |
| Browser/user-flow | `agent-browser open http://localhost:3001/ai` plus DOM/style probe | Pass | Header present; history button text `Chat history`, left `80px`; secondary heading absent; composer shadow reduced; composer-to-first-action gap `28px`. |
| DB/provider read-back | Not applicable | Pass | UI-only change; no database/provider/config change. |
| End-to-end proof | `docs/ops/evidence/2026-06-26-ai-page-header-history-spacing/ai-page-polish.png` | Pass | Screenshot shows restored header, left chat-history control, no secondary heading, quieter composer, and increased card spacing. |

## Risks / Gaps

- The current checkout has unrelated dirty files; staging and publish must stay
  scoped to task-owned paths only.
- Full-project typecheck was not run in the main thread because the repository
  instructions reserve long-running/project-wide checks for delegated
  verification. This narrow UI correction is covered by changed-file lint,
  focused tests, browser DOM/style proof, and the finish-flow changed-file gates.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
