# AI Change Event Artifact Simplification

Date: 2026-07-06
Linear: [AAI-981](https://linear.app/megankharrison/issue/AAI-981/simplify-end-user-ai-change-event-artifact-surface)
Status: In Progress

## Objective

Reduce cognitive load in the user-facing AI Change Event artifact while
preserving the debug and trace surfaces needed for development.

## Scope

- Keep the persistent Change Event draft artifact focused on the draft fields,
  related evidence, save state, and final review/create action.
- Remove or hide end-user checklist noise that makes the artifact feel like a
  technical workflow tracker.
- Preserve instrumentation in existing trace/debug surfaces.
- Validate the artifact in the live `/ai` route.

## Out Of Scope

- Eve implementation.
- Deep-agent routing changes.
- Line-item phase two.
- Removing trace/debug tooling from developer surfaces.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Identify the current end-user noise sources in the artifact.
- [x] Simplify the artifact UI without removing required create/edit actions.
- [x] Preserve existing draft save and Review create behavior.
- [x] Run focused lint/type checks.
- [x] Capture browser evidence on `/ai`.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-981`.
- Linear closeout comment: `5635925d-e8ca-4101-9bfd-420091e8393d`.
- Noise sources found: separate `Recommendations`, `Still needed`, and
  `Next question` blocks competed with the editable draft fields and create
  actions.
- UI change: collapsed recommendations behind `AI notes`, consolidated missing
  fields/risks into `Before preview`, removed the `Next question` heading, and
  made `Review create` the first action.
- Checks:
  - `cd frontend && npx eslint src/components/ai-assistant/change-event-draft-artifact.tsx` passed.
  - `cd frontend && npm run typecheck:changed` passed.
- Browser evidence:
  - Fresh authenticated `/ai` session with project picker and simplified
    persistent artifact:
    `docs/ops/evidence/2026-07-06-ai-change-event-artifact-simplification/artifact-simplified.png`.
- Remaining risk:
  - The artifact surface is quieter, but title extraction can still be too
    literal when the user names a project in the same sentence as the event.
    That belongs in a follow-up extraction-quality slice.

## Failure Contract

- Cause: prior iterations exposed too much workflow/debug state in the
  end-user artifact, creating cognitive overload.
- Detection gap: the flow was validated for creation but not for end-user
  attention economy.
- Prevention: apply the product noise gate to the artifact and keep debug
  detail on trace/debug surfaces rather than in the primary create workspace.

## Noise Gate Brief

- Primary user: project user creating a Change Event from chat.
- Primary job: review and correct the structured draft before creation.
- Primary decision: is the draft accurate enough to preview/create?
- Tier 1: project, title, narrative, type, scope, cost, schedule, create action.
- Tier 2: save state, missing blockers, related evidence.
- Tier 3: trace/debug metadata.
- Hide until requested: raw tool trace, backend route path, debug counts.
- Remove: checklist-as-process UI and duplicate status copy.
- Primary action: save draft changes, then review/create.
- Failure-loudly behavior: missing project/title blocks preview with a specific
  message; save failures remain visible inline.
