# Task: AI Approval Queue MVP

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-646 - https://linear.app/megankharrison/issue/AAI-646/plan-ai-action-discovery-and-approval-ux-implementation-slice

## Objective

Build the smallest useful AI approval/review queue surface over existing
`collaboration_notifications` rows where `kind = ai_notification_decision`,
without creating a new database table or adding outbound delivery behavior.

## Attention Brief

Primary user: PM or authorized approver responsible for AI-created drafts.
Primary job: find AI decisions that need review before becoming record truth or
client-facing communication.
Primary decision: review now, open the related record/context, mark reviewed, or
discard stale noise.
Tier 1: unread approval/review-oriented AI decisions and their required action.
Tier 2: project/record context, event type, age, and read/review state.
Tier 3: source reason and failure-loud behavior.
Hide until requested: raw metadata, delivery arrays, preference hints, source
confidence internals.
Remove: KPI cards, decorative wrappers, duplicate CTAs, Teams/Outlook sending,
new approval tables.
Primary action: open the related record/context or mark the queue item reviewed.
Failure-loudly behavior: missing/invalid event metadata is excluded by a shared
helper and covered by tests; API load/update failures show exact errors.

## Scope Checklist

- [x] Existing notification decision ledger reviewed.
- [x] Existing collaboration notification API/hook reviewed.
- [x] Existing AI command center route shape reviewed.
- [x] Shared helper chosen for approval/review event identification.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] No database schema, table, or migration added.
- [x] Existing `collaboration_notifications` API/hook reused or narrowly extended.
- [x] Approval/review event filtering handles malformed metadata safely.
- [x] Queue UI remains quiet and operational with no KPI cards/decorative wrappers.
- [x] Existing producer files listed by the user remain untouched.

## Integration Checklist

- [x] Queue route exists under the AI surface.
- [x] Queue fetches only `ai_notification_decision` rows from the existing API path.
- [x] Queue identifies approval/review-oriented metadata event types.
- [x] Users can mark a queue item reviewed using existing notification mutation semantics.
- [x] Users can discard stale queue items using existing notification mutation semantics.
- [x] Related record/context links are available when notification entity/project fields allow it.

## Regression Guardrails

- [x] Focused unit tests cover approval queue event identification and malformed metadata.
- [x] Focused lint covers changed frontend files.
- [x] No full/project typecheck run per user constraint.

## Planned Files

- `frontend/src/lib/collaboration/ai-approval-queue.ts` - shared event/filter/presentation helpers.
- `frontend/src/lib/collaboration/__tests__/ai-approval-queue.test.ts` - helper guardrails.
- `frontend/src/hooks/use-collaboration-notifications.ts` - optional query filters for existing hook.
- `frontend/src/app/api/collaboration/notifications/route.ts` - optional query filters for existing endpoint.
- `frontend/src/app/(main)/ai/approvals/page.tsx` - quiet queue surface.
- `docs/ops/tasks/2026-06-26-ai-approval-queue-mvp.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Template lookup | `sed -n '1,220p' docs/tasks/TASK-TEMPLATE.md` | Failed | Referenced task template is missing in this worktree; ledger follows current `docs/ops/tasks` format. |
| Dependency bootstrap | `cd frontend && pnpm install` | Partial | Dependencies installed; pnpm exited with `ERR_PNPM_IGNORED_BUILDS` for unrelated package build-script approvals. No approval policy was changed. |
| Focused lint | `cd frontend && npx eslint 'src/app/(main)/ai/approvals/page.tsx' src/app/api/collaboration/notifications/route.ts src/hooks/use-collaboration-notifications.ts src/lib/collaboration/ai-approval-queue.ts src/lib/collaboration/__tests__/ai-approval-queue.test.ts` | Pass | Changed frontend files are lint-clean. |
| Focused unit test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/collaboration/__tests__/ai-approval-queue.test.ts` | Pass | 1 suite / 6 tests passed. |
| Route smoke | `agent-browser open http://localhost:3004/ai/approvals && agent-browser wait 2000 && agent-browser get url && agent-browser get text body` | Pass | Authenticated browser reached `/ai/approvals` and rendered `AI approvals`, `Needs review`, and the empty queue state. |
| API smoke | Dev-server log for `/ai/approvals` | Pass | `GET /api/collaboration/notifications?limit=100&kind=ai_notification_decision 200` after route load. |
| Screenshot artifact | `/tmp/ai-approval-queue-agent-browser.png` | Pass | Full-page screenshot captured from authenticated route. |

## Files Changed

- `docs/ops/tasks/2026-06-26-ai-approval-queue-mvp.md` - task ledger and evidence.
- `frontend/src/app/(main)/ai/approvals/page.tsx` - quiet AI approval queue route.
- `frontend/src/app/api/collaboration/notifications/route.ts` - optional notification query filters.
- `frontend/src/hooks/use-collaboration-notifications.ts` - optional hook filters for existing endpoint.
- `frontend/src/lib/collaboration/ai-approval-queue.ts` - shared queue metadata/event/link helper.
- `frontend/src/lib/collaboration/__tests__/ai-approval-queue.test.ts` - helper guardrails.

## Risks / Gaps

- Existing main checkout has unrelated dirty files; this work is isolated in
  `/Users/meganharrison/.codex/worktrees/ai-approval-queue-mvp/alleato-pm`.
- No full/project typecheck was run by request.
- Clean unauthenticated browser contexts redirect to `/auth/login?callbackUrl=%2Fai%2Fapprovals`, as expected for a protected main-app route.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
