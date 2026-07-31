# Task: Admin Dashboard URL Resource Ingestion Control

Status: Complete - Local Verified
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-693
Linear URL: https://linear.app/megankharrison/issue/AAI-693/add-admin-dashboard-url-resource-ingestion-control-for-existing-rag
Related Handoff: docs/ops/handoffs/2026-06-26-S95-admin-dashboard-url-resource-ingestion.md

## Objective

Add a compact admin-dashboard control that accepts one or more URLs and sends
them into the existing backend URL ingestion path so operators can create
`rag_document_metadata` plus `document_chunks` records through the normal RAG
pipeline without a separate ingestion or retrieval path.

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

- `docs/ops/tasks/2026-06-26-admin-dashboard-url-resource-ingestion.md`
- `docs/ops/handoffs/2026-06-26-S95-admin-dashboard-url-resource-ingestion.md`
- `docs/ops/orchestration/session-board.md`
- `frontend/src/app/(admin)/admin/page.tsx`
- `frontend/src/app/api/admin/url-resources/route.ts`
- `frontend/src/app/api/admin/url-resources/__tests__/route.test.ts`
- `frontend/src/components/admin/url-resource-ingestion-panel.tsx`

## Acceptance Criteria

- The admin dashboard exposes a compact control for submitting one or more URLs.
- Submission routes through a frontend admin API endpoint that forwards to the
  existing backend `/api/ingest/url-resources` path with `ADMIN_API_KEY`.
- The operator sees explicit submitted, unchanged, and failed outcomes per URL.
- The UI stores no duplicate local state model for RAG resources and does not
  create a new retrieval path.
- Focused verification proves the admin UI can trigger the existing RAG
  ingestion workflow end to end.

## Failure-Loud Behavior

- If the admin API key or backend URL is missing, the admin route returns a
  specific configuration error.
- If the current user is not an admin, the route returns an explicit auth or
  permission failure.
- If one or more URLs fail ingestion, the UI renders those failures in-place
  with URL-specific messages instead of hiding partial results.
- If the backend returns an empty or malformed response, the frontend route
  fails explicitly instead of synthesizing a fake success state.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Kickoff | Linear AAI-693 | Pass | Issue created before implementation. |
| Kickoff comment | Linear AAI-693 comment `ee459b01-7ee8-4805-a3c1-f5c9b3408f46` | Pass | Scope, constraints, and planned files posted before implementation. |
| Targeted route test | `cd frontend && npx jest --runInBand --runTestsByPath src/app/api/admin/url-resources/__tests__/route.test.ts` | Pass | 3 focused tests cover request forwarding, invalid payload failure, and admin auth failure. |
| Static/type/lint | `cd frontend && npx eslint 'src/app/(admin)/admin/page.tsx' 'src/app/api/admin/url-resources/route.ts' 'src/app/api/admin/url-resources/_shared.ts' 'src/app/api/admin/url-resources/__tests__/route.test.ts' 'src/components/admin/url-resource-ingestion-panel.tsx'` | Pass | Changed-file lint passed with no errors. |
| Browser/user-flow | `tests/agent-browser-runs/2026-06-26-admin-dashboard-url-resource-ingestion/VERIFICATION_SUMMARY.md` | Pass | Admin dashboard showed the new control, surfaced a loud fetch failure when no backend was listening, then showed `1 ingested or updated`, `1 unchanged`, `0 failed` after rerun with local backend available. |
| Frontend-route readback | Browser `fetch('/api/admin/url-resources', ...)` from authenticated admin page | Pass | Follow-up re-run returned HTTP 200 with both URLs `skipped_unchanged`, proving duplicate/hash guardrails through the frontend route. |
| DB read-back | `tests/agent-browser-runs/2026-06-26-admin-dashboard-url-resource-ingestion/VERIFICATION_SUMMARY.md` | Pass | Newly ingested `https://www.python.org/psf/` resource read back as `category=resource`, `type=web_page`, with 11 chunks. |
| Handoff validation | `npm run linear:codex:check -- docs/ops/handoffs/2026-06-26-S95-admin-dashboard-url-resource-ingestion.md` | Pass | Handoff intake and Linear evidence satisfy repo closeout requirements. |

## Risks / Gaps

- The live task-template path referenced in `AGENTS.md` appears stale in this
  checkout, so this task follows the active task format already used under
  `docs/ops/tasks/`.
- The admin dashboard is intentionally quiet and directory-like, so the new
  control must not turn it into a noisy monitoring panel.
- The current checkout has unrelated dirty files; later staging/publish must
  stay scoped to task-owned paths only.
- Local browser proof depends on a backend listener matching the frontend dev
  proxy target (`127.0.0.1:8000`). The first attempted submission failed loudly
  until the local backend was started on that port.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
