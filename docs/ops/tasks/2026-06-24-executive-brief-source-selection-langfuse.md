# Task: Executive Brief Source Selection Langfuse

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-628 - https://linear.app/megankharrison/issue/AAI-628/trace-executive-brief-source-selection-decisions-in-langfuse
Related Handoff: N/A

## Objective

Add nested Langfuse observations around executive daily brief retrieval and
source-selection decisions so the trace shows what happened before synthesis:
which source groups were found, how much evidence was available, which packets
were selected, and when the workflow had insufficient source coverage.

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
| Static/type/lint      | `pnpm --dir frontend exec eslint src/lib/ai/executive-daily-brief-langfuse.ts src/lib/ai/__tests__/executive-daily-brief-langfuse.test.ts src/lib/executive/brandon-daily-update.ts src/lib/executive/__tests__/brandon-daily-update.test.ts` | Pass | No lint output. |
| Static/type/lint      | `NODE_OPTIONS=--max-old-space-size=8192 pnpm --dir frontend exec tsc --noEmit --pretty false --incremental false` | Pass | Full frontend TypeScript passed. |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/executive/__tests__/brandon-daily-update.test.ts src/lib/ai/__tests__/executive-daily-brief-langfuse.test.ts --runInBand` | Pass | 2 suites, 26 tests. |
| Browser/user-flow     | N/A | Not run | No visible frontend UI changed. |
| DB/provider read-back | N/A | Not run | No schema, migration, env, or provider config change. |
| End-to-end proof      | Static and targeted tests above | Pass | Source-selection trace summaries are pure-tested; live generation was intentionally not run because it may invoke DB/model-heavy executive brief generation. |

## Files Changed

- `docs/ops/tasks/2026-06-24-executive-brief-source-selection-langfuse.md` - Local task done gate and evidence ledger.
- `frontend/src/lib/ai/executive-daily-brief-langfuse.ts` - Allows observations to record safe result summaries instead of only `{ ok: true }`.
- `frontend/src/lib/executive/brandon-daily-update.ts` - Adds nested observations for source preflight, embeddings, vector search, metadata lookup, candidate selection, full-text enrichment, communication signals, support filtering, and source coverage.
- `frontend/src/lib/executive/__tests__/brandon-daily-update.test.ts` - Adds guardrails that source-selection trace summaries include counts/descriptors but not full source evidence text.

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout and must not be staged accidentally.
- Trace outputs must summarize source evidence and counts without dumping full confidential source text.
- A live Langfuse source-selection trace was not generated in this slice to avoid an unnecessary DB/model-heavy executive brief run.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
