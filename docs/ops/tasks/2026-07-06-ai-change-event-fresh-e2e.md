# AI Change Event Fresh E2E Flow

Date: 2026-07-06
Linear: [AAI-972](https://linear.app/megankharrison/issue/AAI-972/verify-and-harden-fresh-ai-change-event-artifact-create-flow)
Status: Ready for finish

## Objective

Verify and harden the fresh user-facing AI Change Event workflow from a new
chat request through persistent artifact draft, project selection, final preview,
approval, and native draft Change Event creation.

## Scope

- Start from the user-facing `/ai` route with a fresh or active session.
- Confirm the assistant creates or hydrates a persistent `change_event_draft`
  artifact for the workflow.
- Confirm artifact project selection, required draft fields, and readiness state
  update correctly.
- Confirm `Review create` hands the artifact draft to the native
  `createChangeEvent` path.
- Confirm approval creates a draft Change Event record.
- Fix blockers discovered in the fresh flow and add focused regression coverage
  for any code change.

## Out Of Scope

- Eve implementation.
- Deep-agent implementation.
- Line-item phase beyond confirming line items do not block draft creation.
- Cosmetic redesign outside obvious flow blockers.

## Current Repo Truth

- Project selection now persists through the Change Event draft artifact edit
  API and updates `workspace_artifacts.project_id`.
- Browser proof exists for an existing artifact, but not yet for a fresh
  end-to-end chat-to-create flow.
- The current browser session is on `/ai?session=e28c801a-0745-488f-84e3-32f8d6a8ca78`.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Run fresh browser flow from the AI page.
- [x] Capture artifact persistence/readiness evidence.
- [x] Capture Review create / approval handoff evidence.
- [x] Verify draft Change Event record exists after approval.
- [x] Fix any blockers discovered in the fresh flow.
- [x] Add focused regression coverage for any code changes.
- [x] Run focused lint/tests/type/route checks for any code changes.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-972`.
- Linear closeout comment: `5cf0d5b3-7d8d-4df4-ab39-baeee5a89e74`.
- Browser session: `/ai?session=9fe707e1-8ace-4ced-83e4-eb180806f545`.
- Browser evidence: `docs/ops/evidence/2026-07-06-ai-change-event-fresh-e2e/created-confirmed-write.png`.
- Fresh flow proof:
  - Project picker selected project `760` / Exol Wilmer.
  - Persistent Change Event draft artifact rendered with project, inferred title,
    owner-change scope/type/reason, `$18,000` cost impact, and no schedule impact.
  - `Review create` produced a native `createChangeEvent` preview with
    `confirmed=false` instead of re-ingesting the workflow prompt.
  - Approval replay used `confirmed=true` and the preview fields.
- Database proof:
  - `change_events.id = 19624060-c74f-4006-8e6b-2c4be1e87466`
  - `number = 005`
  - `project_id = 760`
  - `title = Restroom relocation after framing`
  - `status = Open`
- Trace proof:
  - Confirmed-create assistant row uses
    `provider_path = deterministic-change-event-confirmed-write`.
  - Latest replay has no AI Gateway provider fallback row before the deterministic
    success row.
- Checks:
  - `cd frontend && npx jest src/lib/ai/__tests__/change-event-workflow.test.ts --runInBand` passed.
  - `cd frontend && npx eslint src/app/api/ai-assistant/chat/handler-v2.ts src/lib/ai/change-event-workflow.ts src/components/ai-assistant/change-event-draft-artifact.tsx src/components/ai-assistant/chat-area.tsx src/lib/ai/__tests__/change-event-workflow.test.ts` passed.
  - `cd frontend && npm run typecheck:changed` passed.

## Failure Contract

- Cause: prior proof verified artifact project persistence on an existing
  artifact, not the complete fresh user journey.
- Detection gap: missing end-to-end evidence from first user prompt through
  native draft Change Event creation.
- Prevention: use browser/API proof for the complete fresh flow, add regression
  coverage for final-preview intent detection, and route confirmed approvals
  through a deterministic native write path that fails loudly instead of falling
  back to generic AI Gateway synthesis.

## Noise Gate

- Primary user: project user creating a Change Event from chat.
- Primary job: turn a natural-language change request into a draft Change Event
  without losing context or requiring duplicate form entry.
- Primary decision: confirm the structured preview before native record creation.
- Tier 1: project, title, description, type/scope/reason, and final create action.
- Tier 2: readiness state and related evidence.
- Tier 3: trace/debug metadata.
- Hide until requested: backend trace details and raw tool payloads.
- Remove: duplicate provider fallback rows for deterministic approvals.
- Primary action: approve the preview and create the draft Change Event.
- Failure-loudly behavior: missing project/title blocks deterministic create;
  native create errors persist a specific failure response.
