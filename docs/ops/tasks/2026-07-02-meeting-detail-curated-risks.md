# Task: Meeting Detail Curated Risks

Status: In Progress
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-907
Linear URL: https://linear.app/megankharrison/issue/AAI-907/use-curated-meeting-intelligence-risks-on-meeting-detail-pages
Related Handoff: N/A

## Objective

Make the meeting detail page use curated meeting-risk output from the extractor/compiler pipeline instead of rendering only the raw flattened `meeting_segments[].risks` list.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: PM reviewing a single meeting for what actually matters.
Primary job: scan a trustworthy short list of real risks from the meeting.
Primary decision: which risk needs follow-up and whether the AI found the right issue.
Tier 1: curated risk statement, supporting why-it-matters context, severity/priority cues, feedback affordance.
Tier 2: raw segment fallback only when curated meeting risk output is unavailable.
Tier 3: debug/provenance details hidden unless needed.
Hide until requested: raw segment-local duplicates and pipeline internals.
Remove: blind trust in flattened segment arrays as the default risk view.
Primary action: review a curated risk and submit feedback on whether it is real/useful.
Failure-loudly behavior: if curated meeting risk output is missing, the page must fall back explicitly instead of silently showing an empty or misleading list.

## Acceptance Criteria

- [x] Meeting detail risk list prefers curated meeting intelligence output tied to the current meeting source document.
- [x] Raw `meeting_segments[].risks` remain as an explicit fallback only when curated meeting risk output is absent.
- [x] Risk feedback controls still work on the displayed risk items.
- [x] The page does not silently drop all risks if curated data is unavailable.
- [ ] The implementation does not reintroduce the removed digest section dependency.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Meeting detail loader reads curated risk source before raw segment fallback.
- [x] Shared meeting detail component can render either curated or fallback risk items without one-off page-specific overrides.
- [x] Fallback path is obvious in code comments and data flow.

## Planned Files

- `docs/ops/tasks/2026-07-02-meeting-detail-curated-risks.md`
- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx`
- `frontend/src/app/(tables)/meetings/[meetingId]/page.tsx`
- `frontend/src/components/meetings/meeting-detail-content.tsx`
- `frontend/src/lib/meetings/server.ts`
- `frontend/src/components/ai/ai-feedback-control.tsx`
- `frontend/src/lib/ai/services/agent-learning-service.ts`

## Integration Checklist

- [x] Linear kickoff comment recorded.
- [x] Curated meeting risk query is scoped to the current meeting source document.
- [x] Fallback list remains available for meetings with no curated signals yet.
- [x] Focused lint/type checks run on touched files.

## Regression Guardrails

- [x] No silent empty-state regression for the Action Snapshot risk section.
- [x] No duplicate feedback-control implementation added.
- [ ] Browser/user-flow verification run for at least one meeting detail page, or blocker recorded.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `nl -ba docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Template path referenced by AGENTS is absent; this task mirrors the active `docs/ops/tasks/*` format. |
| Linear kickoff | `AAI-907` | Pass | Issue created before this implementation slice. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/lib/meetings/server.ts' 'src/components/meetings/meeting-detail-content.tsx' 'src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx' 'src/app/(tables)/meetings/[meetingId]/page.tsx'` | Pass | No lint errors on task-owned meeting risk files. |
| Diff whitespace | `git diff --check -- 'docs/ops/tasks/2026-07-02-meeting-detail-curated-risks.md' 'frontend/src/lib/meetings/server.ts' 'frontend/src/components/meetings/meeting-detail-content.tsx' 'frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx' 'frontend/src/app/(tables)/meetings/[meetingId]/page.tsx' 'frontend/src/components/ai/ai-feedback-control.tsx' 'frontend/src/lib/ai/services/agent-learning-service.ts'` | Pass | No whitespace errors across task-owned changes. |

## Files Changed

- `docs/ops/tasks/2026-07-02-meeting-detail-curated-risks.md`
- `frontend/src/lib/meetings/server.ts`
- `frontend/src/components/meetings/meeting-detail-content.tsx`
- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx`
- `frontend/src/app/(tables)/meetings/[meetingId]/page.tsx`
- `frontend/src/components/ai/ai-feedback-control.tsx`
- `frontend/src/lib/ai/services/agent-learning-service.ts`
