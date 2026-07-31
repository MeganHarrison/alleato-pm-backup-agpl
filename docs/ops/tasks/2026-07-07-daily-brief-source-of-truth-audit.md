# Task: Daily Brief Source Of Truth Audit And Collapse

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-995 - https://linear.app/megankharrison/issue/AAI-995/collapse-daily-executive-brief-reads-onto-canonical-intelligence
Related Handoff: Not created

## Objective

Find every Executive Daily Brief / Daily Brief read surface that still uses legacy `daily_recaps` or generation code and collapse the user-facing reads onto the canonical `intelligence_packets` target `daily-executive-brief`.

## Source Of Truth Decision

- Canonical compiled brief: `public.intelligence_packets` for active target slug `daily-executive-brief`.
- Historical daily brief list/detail: `intelligence_packets` current/snapshot rows for that same target.
- Legacy `daily_recaps` reads are not source truth for the Daily Executive Brief UI.
- Fresh generation from `/api/executive/daily-brief?fresh=true` is retired until it calls the manual source-bundle runner or a rebuilt automation with the same source contract.

## Audit Findings

- `/876/intelligence` was updated to render `daily-executive-brief`.
- `/executive/intelligence-brief` still read `getExecutiveBriefingDashboard()` and generated another brief shape.
- `/api/executive/intelligence-brief` still generated from the legacy dashboard.
- `/api/executive/daily-brief` still read/regenerated legacy daily recap drafts.
- `/api/executive/daily-brief/history` still listed `daily_recaps`.
- `/daily-briefs` still listed legacy history through `/api/executive/daily-brief/history`.
- `/daily-briefs/[briefId]` still loaded `daily_recaps` detail rows.

## Acceptance Criteria

- [x] `/executive/intelligence-brief` reads the latest canonical daily executive brief packet.
- [x] `/api/executive/intelligence-brief` returns the latest canonical daily executive brief packet.
- [x] `/api/executive/daily-brief` returns the latest canonical daily executive brief packet and fails loudly for retired fresh generation.
- [x] `/api/executive/daily-brief/history` lists canonical packet rows, not `daily_recaps`.
- [x] `/daily-briefs` lists canonical packet rows.
- [x] `/daily-briefs/[briefId]` renders canonical packet detail by packet ID.
- [x] Old read paths are either removed from the touched surfaces or explicitly blocked with a clear error.
- [x] Assistant chat exposes a read-only current Daily Executive Brief tool instead of a generator.
- [x] AI Ops workflow policy only exposes canonical packet/source read tools until generation and delivery are rebuilt on `intelligence_packets`.
- [x] Guardrail script fails if active Daily Brief surfaces query `daily_recaps` directly.

## Files To Change

- `docs/ops/tasks/2026-07-07-daily-brief-source-of-truth-audit.md`
- `frontend/src/lib/daily-briefs/canonical-packets.ts`
- `frontend/src/lib/daily-briefs/types.ts`
- `frontend/src/features/daily-briefs/daily-briefs-table-config.tsx`
- `frontend/src/app/api/executive/daily-brief/route-helpers.ts`
- `frontend/src/app/api/executive/daily-brief/history/route.ts`
- `frontend/src/app/api/executive/daily-brief/widget/route.ts`
- `frontend/src/app/api/executive/daily-brief/preview-teams/route.ts`
- `frontend/src/app/api/executive/intelligence-brief/route.ts`
- `frontend/src/app/api/executive/daily-brief/__tests__/route.test.ts`
- `frontend/src/app/api/executive/brandon-daily-update/__tests__/route.test.ts`
- `frontend/src/app/(main)/executive/intelligence-brief/page.tsx`
- `frontend/src/app/(tables)/daily-briefs/[briefId]/page.tsx`
- `frontend/src/lib/ai/tools/executive-brief-tools.ts`
- `frontend/src/lib/ai/assistant-action-catalog.ts`
- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai-ops/executive-daily-brief-workflow.ts`
- `frontend/src/lib/ai-ops/source-adapters.ts`
- `frontend/src/lib/ai-ops/tool-registry.ts`
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/app/api/executive/daily-brief/send-teams/route.ts`
- `frontend/src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts`
- `frontend/src/lib/ai/__tests__/tool-registry.test.ts`
- `frontend/src/lib/ai-ops/__tests__/workflow-pack.test.ts`
- `scripts/verify/daily-brief-source-of-truth.mjs`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/architecture/PROJECT-MAP.md`
- `frontend/src/lib/app-surface/app-surface.generated.json`

## Verification

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Audit inventory | `rg -n "daily_recaps|daily-brief|executive/intelligence-brief|intelligence_packets" ...` | Pass | Found the legacy routes listed above. |
| Legacy read scan | `rg -n "daily_recaps|CEO_EXECUTIVE_BRIEFING_RECAP_KIND|getExecutiveBriefingDashboard|generateExecutiveIntelligenceBrief|regenerateDailyBriefDraft|DEFAULT_EXECUTIVE_WINDOW_DAYS|clampDailyBriefWindowDays" frontend/src/app/api/executive/daily-brief frontend/src/app/api/executive/intelligence-brief frontend/src/app/api/executive/brandon-daily-update frontend/src/app/(main)/executive/intelligence-brief frontend/src/app/(tables)/daily-briefs frontend/src/hooks/use-daily-brief-history.ts frontend/src/features/daily-briefs/daily-briefs-table-config.tsx frontend/src/lib/daily-briefs` | Pass | No runtime route/page hits remain; only send-teams delivery path remains kill-switched and separate. |
| Focused lint | `cd frontend && npm exec eslint -- <touched daily brief files>` | Pass | No errors or warnings after removing page-level raw grids. |
| Focused route tests | `cd frontend && npx jest src/app/api/executive/daily-brief/__tests__/route.test.ts src/app/api/executive/brandon-daily-update/__tests__/route.test.ts --runInBand` | Pass | 2 suites, 4 tests passed; tests assert canonical packet reads and 409 retired generation. |
| Changed-file type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Executive page browser proof | `docs/ops/evidence/2026-07-07-daily-brief-source-of-truth-audit/browser/executive-intelligence-brief.png`; `executive-intelligence-brief-dom.json` | Pass | `/executive/intelligence-brief` shows July 6, 212 sources, and canonical saved packet link. |
| History page browser proof | `docs/ops/evidence/2026-07-07-daily-brief-source-of-truth-audit/browser/daily-briefs-history.png`; `daily-briefs-history-dom.json` | Pass | `/daily-briefs` shows 2 canonical packet rows: current 212 sources and snapshot 207 sources. |
| Detail page browser proof | `docs/ops/evidence/2026-07-07-daily-brief-source-of-truth-audit/browser/daily-brief-detail.png`; `daily-brief-detail-dom.json` | Pass | `/daily-briefs/6eaec0e0-cdce-4bd5-b6df-f7378ce2759a` renders from `intelligence_packets`, 212 sources, and the July 6 brief sections. |
| API proof | `docs/ops/evidence/2026-07-07-daily-brief-source-of-truth-audit/browser/api-proof.json` | Pass | `/api/executive/daily-brief`, `/api/executive/intelligence-brief`, `/api/executive/brandon-daily-update`, and `/api/executive/daily-brief/widget` return packet `6eaec0e0-cdce-4bd5-b6df-f7378ce2759a`; fresh generation and Teams preview return 409 retired errors. |
| Canonical source guardrail | `node scripts/verify/daily-brief-source-of-truth.mjs` | Pass | Active Daily Brief UI/API/assistant/tool-policy surfaces do not reference `daily_recaps`, retired generation, retired persistence, or retired delivery tool names. |
| Focused assistant/API tests | `cd frontend && npx jest src/app/api/executive/daily-brief/__tests__/route.test.ts src/app/api/executive/daily-brief/__tests__/send-teams-route.test.ts src/app/api/executive/brandon-daily-update/__tests__/route.test.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai-ops/__tests__/workflow-pack.test.ts --runInBand` | Pass | 5 suites, 35 tests passed. Tests cover canonical API reads, 409 retired generation, 409 retired Teams send, read-only assistant tool registry, and read-only AI Ops workflow policy. |
| Focused lint | `cd frontend && npm exec eslint -- src/lib/ai/tools/executive-brief-tools.ts src/lib/ai/tool-registry.ts src/lib/ai-ops/executive-daily-brief-workflow.ts src/lib/ai-ops/source-adapters.ts src/lib/ai-ops/tool-registry.ts src/app/api/ai-assistant/chat/handler-v2.ts src/app/api/executive/daily-brief/send-teams/route.ts src/lib/ai/assistant-action-catalog.ts` | Pass | No errors or warnings. |
| Changed-file type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Project map/docs gate | `npm run map:project`; `docs/architecture/AI-RAG-ARCHITECTURE.md` update | Pass | Project map regenerated because AI tools changed; architecture doc records the Daily Brief read-only canonical packet contract. |

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
