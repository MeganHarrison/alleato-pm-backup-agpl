# Task: Canonical Daily Brief Teams Delivery

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-999 - https://linear.app/megankharrison/issue/AAI-999/rebuild-daily-executive-brief-teams-delivery-from-canonical-packet
Related Handoff: Not created

## Objective

Rebuild Daily Executive Brief Teams preview/send so delivery consumes the canonical `intelligence_packets` target slug `daily-executive-brief` and never regenerates or reads a parallel Daily Brief source.

## Source Of Truth Decision

- Delivery input: current canonical Daily Executive Brief packet from `frontend/src/lib/daily-briefs/canonical-packets.ts`.
- Delivery may preview, dry-run, or send only that packet.
- Missing/stale packet, missing Teams recipients, or disabled delivery must fail loudly with inspectable status.
- No delivery route may query `daily_recaps` or invoke legacy generation.

## Acceptance Criteria

- [x] `/api/executive/daily-brief/preview-teams` builds a Teams preview payload from the current canonical packet.
- [x] `/api/executive/daily-brief/send-teams` dry-runs/sends from the current canonical packet.
- [x] Delivery records ledger evidence using canonical packet metadata.
- [x] AI Ops tool policy exposes delivery tools only after they are canonical-packet consumers.
- [x] `scripts/verify/daily-brief-source-of-truth.mjs` still passes and covers the delivery route.
- [x] Focused route/unit tests cover preview, dry-run, disabled/missing-recipient, and guardrail behavior.

## Files To Change

- `docs/ops/tasks/2026-07-07-canonical-daily-brief-teams-delivery.md`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
- `frontend/src/app/api/executive/daily-brief/send-teams/route.ts`
- `frontend/src/app/api/executive/daily-brief/__tests__/preview-teams-route.test.ts`
- `frontend/src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts`
- `frontend/src/lib/daily-briefs/canonical-teams-delivery.ts`
- `frontend/src/lib/daily-briefs/__tests__/canonical-teams-delivery.test.ts`
- `frontend/src/lib/ai-ops/executive-daily-brief-workflow.ts`
- `frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`
- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`
- `scripts/verify/daily-brief-source-of-truth.mjs`

## Verification

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Source-of-truth guardrail | `node scripts/verify/daily-brief-source-of-truth.mjs` | Pass | Confirms active Daily Brief surfaces do not read `daily_recaps` or retired generation/persistence tools. |
| Focused Jest | `cd frontend && npx jest src/app/api/executive/daily-brief/__tests__/preview-teams-route.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/lib/daily-briefs/__tests__/canonical-teams-delivery.test.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts --runInBand` | Pass | 5 suites, 36 tests. Covers preview, disabled delivery, dry-run delivery, no-recipient loud failure, registry, and workflow policy. |
| Focused ESLint | `cd frontend && npx eslint src/lib/daily-briefs/canonical-teams-delivery.ts src/lib/daily-briefs/__tests__/canonical-teams-delivery.test.ts src/app/api/executive/daily-brief/preview-teams/route.ts src/app/api/executive/daily-brief/send-teams/route.ts src/app/api/executive/daily-brief/__tests__/preview-teams-route.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/lib/ai-ops/executive-daily-brief-workflow.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts src/lib/ai/tool-registry.ts src/lib/ai/__tests__/tool-registry.test.ts --quiet` | Pass | No lint errors in task-owned code. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Project map check | `npm run map:project -- --check-only` | Pass with caveat | Current dirty workspace includes unrelated untracked `/executive/editorial-brief`; generated map changes for that route were not task-owned and are not included. |

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
