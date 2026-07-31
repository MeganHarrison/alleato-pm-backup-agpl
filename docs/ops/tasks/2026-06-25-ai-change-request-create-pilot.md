# Task: AI Change Request Create Pilot

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-688 - https://linear.app/megankharrison/issue/AAI-688/implement-full-ai-assistant-change-request-creation-pilot
Related Handoff: Missing from checkout; implementation based on user-provided pasted handoff text and current code.

## Objective

Implement change requests/change events as the complete model workflow for AI
assistant create actions: machine-readable workflow metadata, canonical field
mapping, preview-first UX, confirmed DB-compatible writes, and focused
regression tests.

## Workflow Map

User action: ask AI assistant to create/log/draft a change request/change event.
Frontend/API owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` via
`createStrategistTools(... includeActionTools: true)`.
Tool owner: `frontend/src/lib/ai/tools/action-tools.ts` `createChangeEvent`.
Workflow metadata owner: shared AI workflow registry under `frontend/src/lib/ai`.
Native route contract: `frontend/src/app/api/projects/[projectId]/change-events`.
Supabase table: `change_events`.
Expected success evidence: confirmed tool writes a DB-compatible
`change_events` insert payload using canonical enum values and generated number.
Expected failure behavior: missing required fields or invalid mappings return
specific, preview-safe errors without partial writes.

## Attention Brief

Primary user: PM or executive starting a change request from chat.
Primary job: capture possible scope/cost/schedule change with enough structure
to review and submit.
Primary decision: whether the previewed change request is accurate enough to
confirm.
Tier 1: project, title, type, scope, status, description, confirmation.
Tier 2: reason, origin, revenue expectation, line-item revenue source.
Tier 3: raw tool payload/debug trace.
Hide until requested: registry internals, raw JSON, advanced optional fields.
Remove: direct writes without canonical validation; duplicate AI-only field
definitions; generic "creation failed" errors.
Primary action: confirm the previewed change request creation.
Failure-loudly behavior: invalid enum/value drift fails tests before runtime.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for workflow metadata and DB write mapping.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria implemented as observable behavior, not hopes.
- [x] Failure-loudly behavior implemented.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Centralized/shared abstraction used for the workflow metadata.
- [x] Change request field values mapped to native route/DB canonical values.
- [x] Preview remains no-write and confirmation-gated.
- [x] Confirmed write returns specific actionable errors.
- [x] User-facing copy/UI follows product noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] Assistant chat can see the action tool.
- [x] Workflow metadata identifies required fields, defaults, prompt order, and fallback page.
- [x] Tool execution uses the same canonical values as the native route.
- [x] Write audit records success/error for confirmed writes.
- [x] No unrelated dirty checkout files are modified by this task.

## Regression Guardrails

- [x] Unit/integration test added for workflow metadata.
- [x] Contract test added for preview output.
- [x] Contract test added for confirmed DB-compatible insert payload.
- [x] Guardrail added so enum/field drift fails loudly next time.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes, or explicitly scoped out.
- [x] Database/provider read-back performed for migrations/config/external services, or not applicable.
- [x] End-to-end workflow proof captured for the requested outcome, or remaining gap documented.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `frontend/src/lib/ai/workflow-registry.ts` - shared workflow metadata for the pilot create flow.
- `frontend/src/lib/ai/__tests__/workflow-registry.test.ts` - guard metadata contract.
- `frontend/src/lib/ai/tools/action-tools.ts` - canonicalize `createChangeEvent` inputs and confirmed insert payload.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - preview and confirmed write guardrails.
- `frontend/src/lib/ai/change-request-field-guide.ts` - align copy/defaults with workflow registry if needed.
- `docs/ops/tasks/2026-06-25-ai-change-request-create-pilot.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Targeted lint | `cd frontend && npx eslint src/lib/ai/workflow-registry.ts src/lib/ai/__tests__/workflow-registry.test.ts src/lib/ai/change-request-field-guide.ts src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/tools/action-tools.ts src/lib/ai/tools/__tests__/action-tools.test.ts` | Pass | No lint output. |
| Targeted tests | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/__tests__/workflow-registry.test.ts src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts` | Pass | 3 suites, 26 tests passed. Covers registry, preview, invalid enum failure, and confirmed insert payload. |
| Follow-up targeted tests | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/__tests__/change-request-field-guide.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts` | Pass | 2 suites, 22 tests passed after duplicate-preview guidance guardrail. |
| Follow-up targeted lint | `cd frontend && npx eslint src/lib/ai/change-request-field-guide.ts src/lib/ai/__tests__/change-request-field-guide.test.ts` | Pass | No lint output after duplicate-preview guidance guardrail. |
| Diff whitespace | `git diff --check -- frontend/src/lib/ai/workflow-registry.ts frontend/src/lib/ai/__tests__/workflow-registry.test.ts frontend/src/lib/ai/change-request-field-guide.ts frontend/src/lib/ai/__tests__/change-request-field-guide.test.ts frontend/src/lib/ai/tools/action-tools.ts frontend/src/lib/ai/tools/__tests__/action-tools.test.ts docs/ops/tasks/2026-06-25-ai-change-request-create-pilot.md` | Pass | No whitespace errors. |
| Static/typecheck | Delegated to sub-agent `019f0170-c9c2-73f2-af11-71a5c5130c1a`: `cd frontend && npm run typecheck` | Pass | Sub-agent compact report: no failing command, no error lines, no owner files, no related failure. |
| Browser/user-flow | `agent-browser` on isolated `http://localhost:3002/ai` | Pass with caveat fixed | Initial run produced a correct not-saved preview but called `createChangeEvent` 3 times. Added tool guidance guardrail and reran; second run showed one `Create Change Event Completed` step and canonical preview values. Screenshot: `/Users/meganharrison/.agent-browser/tmp/screenshots/screenshot-2026-06-26T01-16-38-246Z-vsvv45.png`. |
| DB/provider read-back | N/A | N/A | No migration or provider configuration changed. |
| End-to-end proof | `createChangeEvent` confirmed-write contract test | Pass | Mocks the Supabase write and asserts canonical `change_events` insert payload, idempotency audit success, and no preview notification on confirmed write. Live production DB write intentionally not performed without a disposable fixture. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-change-request-create-pilot.md` - task ledger.
- `frontend/src/lib/ai/workflow-registry.ts` - registry metadata, canonical enum options, normalization, preview/write payload builder.
- `frontend/src/lib/ai/__tests__/workflow-registry.test.ts` - workflow metadata and normalization guardrails.
- `frontend/src/lib/ai/change-request-field-guide.ts` - field guide/review card now derives from registry metadata.
- `frontend/src/lib/ai/__tests__/change-request-field-guide.test.ts` - updated review-card contract.
- `frontend/src/lib/ai/tools/action-tools.ts` - `createChangeEvent` normalizes preview/write input and writes DB-compatible canonical payloads.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - preview, invalid-value, and confirmed-write contract coverage.

## Risks / Gaps

- The checkout has unrelated dirty files. Stage and publish only task-owned
  paths.
- The handoff file named in the prompt is not present locally; user-provided
  pasted text is the source for product intent.
- Full frontend typecheck passed in delegated sub-agent
  `019f0170-c9c2-73f2-af11-71a5c5130c1a`.
- Browser verification found a duplicate preview-tool-call behavior on the first
  run. The tool guidance now says to call `createChangeEvent` at most once per
  user request, and the rerun showed a single completed tool step.
- No disposable live DB fixture was identified in this turn, so live production
  write proof was intentionally not performed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
