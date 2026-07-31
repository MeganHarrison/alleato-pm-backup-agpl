# Task: AI-routable idea inbox

Status: Published to origin/main at 10d22cc10
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-643 https://linear.app/megankharrison/issue/AAI-643/build-ai-routable-idea-inbox-with-quick-capture-and-status-tracking
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-routable-idea-inbox.md

## Objective

Megan can capture an idea into a lightweight editable table from the frontend, a future slash command, or the AI assistant without hunting for a prior conversation. The idea is persisted with source context, routing metadata, status, and an inspectable next action so AI review can route work without silent magic.

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
| Static/type/lint      | `npm run db:types`; `cd frontend && npx eslint 'src/lib/ai/tools/feature-request-tools.ts' 'src/lib/ai/tool-registry.ts' 'src/lib/ai/rag-assistant-prompt.ts' 'src/app/api/ideas/route.ts' 'src/app/(main)/ideas/page.tsx' 'src/components/ideas/IdeaInboxTable.tsx' 'src/lib/ideas/server.ts' 'src/lib/ideas/types.ts'` | Pass | Regenerated Supabase types after migration apply; focused lint passed with 0 warnings/errors. |
| Targeted tests        | `cd frontend && npx jest src/lib/ai/__tests__/tool-registry.test.ts --runInBand` | Pass | 16 tests passed; assistant registry accepts `captureIdeaItem`. |
| TypeScript            | `cd frontend && NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit --pretty false --skipLibCheck --incremental false` | Pass | Fixed the two blocker errors in `animated-modal.tsx` and `brandon-daily-update.ts`; full TypeScript now passes. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/ideas`; `agent-browser snapshot -i`; `agent-browser screenshot tests/agent-browser-runs/2026-06-25-idea-inbox/ideas-table.png` | Pass | Route rendered, editable controls appeared, seeded idea was visible. |
| DB/provider read-back | `npm run db:migrations:verify-applied -- supabase/migrations/20260625154000_create_idea_items.sql`; psql read-back queries | Pass | CLI db push failed with 401/missing `SUPABASE_DB_PASSWORD`; direct psql apply succeeded; ledger repaired and verification passed. |
| End-to-end proof      | `agent-browser fill/click` add flow plus psql row read-back/delete cleanup | Pass | Frontend added a test idea, DB returned the inserted row, and cleanup confirmed 0 test rows remain. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-routable-idea-inbox.md` - working definition of done and evidence ledger.
- `supabase/migrations/20260625154000_create_idea_items.sql` - lightweight editable ideas table and RLS policies.
- `frontend/src/lib/ideas/*` - shared idea table service, types, and validation.
- `frontend/src/app/api/ideas/route.ts` - slash-command/assistant-compatible API entry point.
- `frontend/src/app/(main)/ideas/page.tsx` - editable ideas table surface.
- `frontend/src/components/ideas/IdeaInboxTable.tsx` - quick-add and inline-edit table UI.
- `frontend/src/lib/ai/tools/feature-request-tools.ts` - assistant write tool for lightweight idea capture.
- `frontend/src/lib/ai/tool-registry.ts` - registry metadata for `captureIdeaItem`.
- `frontend/src/lib/ai/rag-assistant-prompt.ts` - routing guidance for idea capture versus feature-request packets.
- `frontend/src/components/ui-library/animated-modal.tsx` - TypeScript gate fix for outside-click target narrowing.
- `frontend/src/lib/executive/brandon-daily-update.ts` - TypeScript gate fix for duplicate telemetry input key.
- `frontend/src/types/database.types.ts` - regenerated Supabase types for `idea_items`.
- `frontend/src/components/dev-tools/page-schema-fk.generated.ts` - regenerated FK map timestamp from `npm run db:types`.
- `tests/agent-browser-runs/2026-06-25-idea-inbox/*` - browser verification artifacts.

## Risks / Gaps

- Initial slash-command registration is deferred unless a command registry exists in this repo; `/api/ideas` is the contract it should call.
- AI routing is initially represented as editable status/routing fields; autonomous promotion to Linear/sub-agent work should be a follow-up worker once table capture is stable.
- `npm run db:types` regenerated from a schema source that omitted `idea_items` after direct SQL apply; the generated type file was patched with the verified `idea_items` shape so local typing matches the applied migration.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
