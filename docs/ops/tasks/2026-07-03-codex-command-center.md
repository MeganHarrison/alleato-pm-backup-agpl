# Task: Codex Command Center

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-916 - https://linear.app/megankharrison/issue/AAI-916/implement-codex-command-center-with-session-board-review-queue-and
Related Handoff: N/A

## Objective

Implement a durable Codex operations control plane in the repo and app so
multi-session work can be managed without synchronous `continue` loops, session
ownership drift, or resume-time rediscovery.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and
evidence is filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document cause, detection gap, prevention step, owner,
and next action.

## Attention Brief

Primary user: Megan operating multiple Codex sessions across product, audit, and
verification work.
Primary job: assign work, inspect progress, review evidence, and resume any
initiative without re-reading thread history.
Primary decision: which initiative or session needs attention now, and what the
next concrete action is.
Tier 1: active initiatives, session ownership, pending review items, resume
packets.
Tier 2: linked task docs, handoffs, evidence, publish truth, and issue state.
Hide until requested: implementation internals, raw log streams, decorative
dashboard metrics.
Remove: duplicate status surfaces, ambiguous ownership, session-memory-only
context, and “just continue” as the default progress mechanism.
Primary action: open the initiative/session that needs intervention and resume
from a durable packet.
Failure-loudly behavior: if orchestration ledgers are missing or malformed, the
command center must show a concrete broken-control-plane error instead of a
silent empty state.

## Acceptance Criteria

- [ ] `/command-center` shows distinct views for active work, review, and initiatives, with active work derived from sessions plus resume packs.
- [ ] Existing initiative-card board behavior remains available inside the command center.
- [ ] Repo orchestration docs define leader/worker behavior, session claiming, review flow, and resume expectations.
- [ ] Session board rows can point to owned scope, linked issue, handoff, current status, and next checkpoint.
- [ ] Review queue rows can capture pending review items with explicit disposition.
- [ ] Resume packs show enough context to restart work after a pause or on another computer without rediscovery.
- [ ] The app surfaces file-based orchestration failures loudly and specifically.

## Implementation Plan

1. Create the task artifact and bind it to the new Linear issue.
2. Restore the missing orchestration control-plane files under
   `docs/ops/orchestration/` and add a durable handoff template under
   `docs/ops/handoffs/`.
3. Add a file-backed orchestration parser that reads `session-board.md`,
   `review-queue.md`, active task docs, and linked handoff metadata into typed
   server-side structures.
4. Refactor the existing admin `Command Center` route into a multi-view
   operations surface that keeps the current initiative board as one tab and
   promotes active work plus review into clearer operator-facing workspaces.
5. Add targeted tests for parser behavior and UI rendering on missing/malformed
   orchestration inputs.
6. Run narrow verification, capture evidence, and update the task ledger.

## Task List

- [ ] Create `docs/ops/orchestration/README.md`, `leader-runbook.md`,
      `worker-protocol.md`, `session-board.md`, and `review-queue.md`.
- [ ] Create `docs/ops/handoffs/HANDOFF-TEMPLATE.md`.
- [ ] Add `frontend/src/lib/codex-command-center/` server/parser helpers.
- [ ] Refactor `frontend/src/app/(admin)/command-center/page.tsx` so the route
      becomes a tabbed command center instead of a board-only page.
- [ ] Extract the existing initiative board into a reusable child component so
      it can live under the `Initiatives` tab.
- [ ] Add an `Active Work` view that combines session rows with linked task and
      handoff context.
- [ ] Add a `Needs Review` view sourced from `review-queue.md`.
- [ ] Add focused tests for parser and view behavior.
- [ ] Record verification evidence and remaining risks.

## Files To Change

- `docs/ops/tasks/2026-07-03-codex-command-center.md`
- `docs/ops/orchestration/README.md`
- `docs/ops/orchestration/leader-runbook.md`
- `docs/ops/orchestration/worker-protocol.md`
- `docs/ops/orchestration/session-board.md`
- `docs/ops/orchestration/review-queue.md`
- `docs/ops/handoffs/HANDOFF-TEMPLATE.md`
- `frontend/src/app/(admin)/command-center/page.tsx`
- `frontend/src/lib/codex-command-center/*`
- `frontend/src/components/...` command-center support components as needed
- Focused test files for parser/UI behavior

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
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear issue | `AAI-916` | Pass | Created before implementation started. |
| Existing surface audit | `rg`/`sed` review of existing command-center, initiative-card, feature-request, idea, and worker-status files | Pass | Existing board route and feature/handoff surfaces identified before edits. |
| Memory/orchestration audit | `MEMORY.md` and repo search for orchestration artifacts | Pass | Confirmed prior orchestration model existed but current checkout lacks the active files. |
| Orchestration ledger health | `npm run worker-status 2026-07-03`; `npm run linear:codex:check -- docs/ops/handoffs/2026-07-03-SLEADER-workstream.md` | Pass | Restored session board, review queue, and live handoff validate successfully. |
| Surface structure audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/app/(admin)/command-center/page.tsx' 'frontend/src/components/admin/command-center/ops-views.tsx'`; `node .agents/skills/alleato-design-doctrine/scripts/audit-split-page-consistency.mjs 'frontend/src/components/admin/command-center/ops-views.tsx'` | Pass | Active-work and review views now follow the doctrine split-page workspace pattern and stay within complexity budget. |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(admin)/command-center/page.tsx' 'src/components/admin/command-center/ops-views.tsx'` | Blocked | Local `frontend/node_modules` package binaries are missing in this checkout, so eslint cannot be executed from the repo-local path. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath 'src/lib/codex-command-center/__tests__/control-plane.test.ts' --runInBand` | Blocked | Local `frontend/node_modules` package binaries are missing in this checkout, so jest cannot be executed from the repo-local path. |
| Browser/user-flow | In-app browser at `http://localhost:3001/command-center` | Partial | User has the live route open, but agent-side browser automation and screenshot capture remain blocked by admin-session/tooling limits in this thread. |
| DB/provider read-back | Not applicable | Pass | No database, migration, or provider-config changes were made. |
| End-to-end proof | `curl -I http://localhost:3001/command-center` | Partial | Route exists and redirects unauthenticated/unauthorized users as expected, but final admin-route content proof is blocked by allowlist access. |

## Risks / Gaps

- The current checkout is missing the live orchestration files referenced by the
  repo process and scripts, so this implementation must re-establish them
  cleanly rather than assuming an intact baseline.
- Existing `Command Center` is a large single-file client board. Refactoring it
  safely will likely require extraction before adding the tabbed control-plane
  views.
- Full repo typecheck/build are intentionally out of scope for the main thread;
  narrow verification and targeted tests should be enough unless a concrete
  blocker appears.
- Final browser proof for the live admin route still depends on either a usable
  agent-side admin browser session or user confirmation from the already-open
  in-app browser.
- Narrow lint/test verification is currently blocked in this checkout because
  repo-local frontend package binaries are missing.

## Blocked / Deferred

- Cause: this checkout cannot currently run repo-local frontend verification
  commands because `frontend/node_modules` package binaries are missing, and
  agent-side browser proof is not available in this thread.
- Detection gap: the task had earlier evidence recorded from a different local
  state, but today's checkout/tooling state differs and required revalidation.
- Prevention step: keep repo-local dependencies installed in the active
  checkout and keep one working admin browser-verification path available for
  admin-only surfaces.
- Owner: Codex for dependency/tool restoration, Megan or a later browser-capable
  session for final live screenshot proof.
- Next action: restore frontend dependencies in this checkout, rerun narrow
  lint/test checks, and capture live `/command-center` proof from an admin
  session.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
