# Task: Daily Deep Read Finalization

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing
Related Handoff: Not created

## Objective

Make Daily Deep Read the operational source of truth for daily executive intelligence, historical backfill, review-gated candidates, and AI assistant answers.

## Non-Negotiable Done Rule

This task is not done until the backfill/audit runner can inspect and safely run date ranges, abnormal bulk-document days are skipped loudly, the AI assistant answers Daily Deep Read setup questions from the current packet/candidate tables before Deep Agents, and browser evidence proves the route behavior.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable. No schema change required.
- [x] Provider/env/config changes handled through CLI/API/MCP when available. No provider config change required.
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

- [x] Unit or integration test added/updated for the core behavior. Targeted browser/API smoke evidence captured.
- [x] Contract test added/updated for cross-module or source/delivery boundaries. Daily Brief source-of-truth guardrail includes the backfill runner and forbids raw chunk synthesis.
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

- Backfill audit supports `--start`, `--end`, `--dry-run`, `--maxDocumentsPerDay`, and writes JSON evidence.
- Abnormal bulk-document days are marked `skipped_abnormal_volume` and are not synthesized by default.
- Backfill execution can run a date range through `intelligence:daily-brief` and `intelligence:daily-consumers`.
- AI assistant Daily Deep Read/setup questions answer from `intelligence_packets` current `daily-executive-brief` and `source_signal_candidates`.
- AI assistant packet-first answer reports the current Daily Deep Read business date and review-gated candidate counts.
- Direct synthesis from `document_chunks` remains forbidden by guardrail.

## Planned Files

- `scripts/intelligence/daily-deep-read-backfill.mjs` - date-range audit/backfill runner.
- `package.json` - CLI script for the backfill runner.
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` - packet-first AI assistant interception.
- `scripts/verify/daily-brief-source-of-truth.mjs` - include new runner/AI route checks if needed.
- `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/` - audit/browser proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `node --check scripts/intelligence/daily-executive-brief.mjs && node --check scripts/intelligence/daily-deep-read-consumers.mjs && node --check scripts/intelligence/daily-deep-read-backfill.mjs` | Passed | Syntax checks for compiler, consumer, and backfill runner. |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/intelligence/page.tsx' src/lib/daily-briefs/canonical-packets.ts src/lib/ai/personal-daily-brief.ts src/app/api/ai-assistant/chat/handler-v2.ts` | Passed | No warnings after replacing local error text with shared `ErrorState`. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Passed | No new `any` type debt. |
| Targeted tests | `node scripts/verify/daily-brief-source-of-truth.mjs` | Passed | Guardrail blocks `document_chunks`/retired daily brief paths from active Daily Brief surfaces. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/ai-browser-current/` | Passed | `/ai?project=876` answered from deterministic Daily Deep Read packet lookup; reported current packet `2026-07-06`, `packet_type=current`, and review-gated candidate counts. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/project-intelligence-browser/` | Passed | `/876/intelligence` rendered under auth with no page errors after current-packet candidate scoping. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/backfill-live-single/backfill-summary.json` | Passed | 2026-06-23 snapshot packet `abeab4bc-5687-4857-be9d-f07a1b55b177`; 19 candidates inserted. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/backfill-live-remaining/backfill-summary.json` | Passed | 2026-06-24, 2026-06-25, and 2026-06-26 produced snapshot packets/candidates before source-size gate was added. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/backfill-live-remaining-2/backfill-summary.json` | Passed | 2026-06-27, 2026-06-28, and 2026-07-01 through 2026-07-05 completed; 2026-06-26, 2026-06-29, 2026-06-30, and 2026-07-06 skipped loudly for abnormal source size. |
| End-to-end proof | `npm run intelligence:daily-backfill -- --start 2026-06-26 --end 2026-07-06 --maxDocumentsPerDay 125 --maxSourceCharsPerDay 900000 --evidence-dir docs/ops/evidence/2026-07-07-daily-deep-read-finalization/backfill-live-remaining-2 --stop-on-error` | Passed | Runner completed with packet/candidate writes and abnormal-day skips. |

## Files Changed

- `docs/ops/tasks/2026-07-07-daily-deep-read-finalization.md`
- `docs/ops/evidence/2026-07-07-daily-deep-read-finalization/`
- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx`
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/lib/ai/personal-daily-brief.ts`
- `frontend/src/lib/daily-briefs/canonical-packets.ts`
- `package.json`
- `scripts/intelligence/daily-deep-read-backfill.mjs`
- `scripts/intelligence/daily-deep-read-consumers.mjs`
- `scripts/intelligence/daily-executive-brief.mjs`
- `scripts/verify/daily-brief-source-of-truth.mjs`

## Risks / Gaps

- Historical snapshot candidates exist for 2026-06-25 and 2026-06-26 from the pre-size-gate run. They are not current-packet candidates and the project intelligence page now filters Daily Deep Read candidates by the current packet ID.
- 2026-07-06 remains the current live packet and was intentionally not overwritten by historical snapshot backfill.
- Oversized days should use a separate digest strategy if they need historical reconstruction; they should not run through the normal Daily Deep Read compiler.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
