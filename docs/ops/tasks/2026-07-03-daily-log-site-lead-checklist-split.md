# Task: Separate Site Lead Checklist From Daily Log Form

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-914
Linear URL: https://linear.app/megankharrison/issue/AAI-914/separate-the-site-lead-checklist-from-the-daily-log-createedit-page
Related Handoff: N/A

## Objective

Remove the Site Lead Checklist from the daily log create/edit form, give it a dedicated project-scoped page, and split checklist persistence so the shared daily log form no longer owns that workflow.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: project site leads and project managers entering field records.
Primary job: log the day quickly without unrelated checklist work competing for attention.
Primary decision: am I creating a daily log entry or completing a site lead checklist.
Tier 1: daily log fields on the daily log page; checklist fields on the dedicated checklist page.
Tier 2: clear navigation between daily logs, Site Scribe, and the checklist route.
Tier 3: underlying storage details in `daily_logs.site_management_checklist`.
Hide until requested: checklist content while the user is on daily log create/edit.
Remove: checklist UI, state, validation, and submit coupling from the shared daily log form.
Primary action: save a daily log without checklist friction, or open the dedicated checklist page when checklist work is intended.
Failure-loudly behavior: focused tests must catch checklist save/load regressions and the daily log form contract must not require checklist state.

## Acceptance Criteria

- [x] `/${projectId}/daily-log/new` and `/${projectId}/daily-log/[dailyLogId]/edit` no longer show the Site Lead Checklist.
- [x] A dedicated `/${projectId}/daily-log/site-lead-checklist` page exists for the checklist workflow.
- [x] The checklist page reads and saves checklist state without going through the shared daily log form submit contract.
- [x] Existing daily log row data is preserved when saving checklist-only updates for a date that already has a daily log.
- [x] Daily log list actions expose the separate checklist route without duplicating the main log CTA.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing checklist helper and server-action ownership reviewed before adding new code.
- [x] Shared checklist rendering is extracted instead of duplicated.
- [x] Shared daily log form no longer stores or validates checklist state.
- [x] Dedicated checklist action reads/creates the correct `daily_logs` row and updates only checklist-owned fields.
- [x] Route metadata/navigation surfaces updated where needed.

## Planned Files

- `docs/ops/tasks/2026-07-03-daily-log-site-lead-checklist-split.md`
- `frontend/src/app/(main)/[projectId]/daily-log/daily-log-client.tsx`
- `frontend/src/app/(main)/[projectId]/daily-log/new/page.tsx`
- `frontend/src/app/(main)/[projectId]/daily-log/[dailyLogId]/edit/page.tsx`
- `frontend/src/app/(main)/[projectId]/daily-log/site-lead-checklist/page.tsx`
- `frontend/src/app/(main)/[projectId]/daily-log/site-lead-checklist/site-lead-checklist-client.tsx`
- `frontend/src/components/daily-log/DailyLogFormClient.tsx`
- `frontend/src/components/daily-log/SiteLeadChecklistFields.tsx`
- `frontend/src/app/(main)/actions/daily-log-actions.ts`
- `frontend/src/app/(main)/actions/__tests__/daily-log-actions.test.ts`
- `frontend/src/lib/app-surface/page-descriptions.json`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- `frontend/src/lib/sitemap-utils.ts`

## Integration Checklist

- [x] One canonical checklist route exists and list-page navigation points to it.
- [x] Checklist save path uses dedicated server actions and typed results.
- [x] Checklist save path preserves existing non-checklist daily-log content.
- [x] Linear kickoff comment recorded.

## Regression Guardrails

- [x] Targeted Jest coverage added or updated for checklist-only save/load behavior.
- [x] Focused lint passes for touched frontend files.
- [x] Route check run for the new route.
- [x] Browser verification covers the exact daily log page and new checklist page.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear kickoff | Linear comment `590dc49d-cac2-4bbe-914c-c8d7b36a69e9` | Pass | Scope, file plan, and verification plan recorded before implementation. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/daily-log/daily-log-client.tsx' 'src/app/(main)/[projectId]/daily-log/[dailyLogId]/edit/page.tsx' 'src/app/(main)/[projectId]/daily-log/site-lead-checklist/page.tsx' 'src/app/(main)/[projectId]/daily-log/site-lead-checklist/site-lead-checklist-client.tsx' 'src/components/daily-log/DailyLogFormClient.tsx' 'src/components/daily-log/SiteLeadChecklistFields.tsx' 'src/lib/sitemap-utils.ts'` | Pass with existing warnings | New checklist files passed. Existing warnings remained in `frontend/src/components/daily-log/DailyLogFormClient.tsx` for raw numeric inputs at lines 686, 788, 789, 974, and 987. |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runTestsByPath 'src/app/(main)/actions/__tests__/daily-log-actions.test.ts' --runInBand` | Pass | Added coverage for checklist load normalization and checklist-only save preserving existing rows. |
| Route check | `npm run check:routes` | Pass | New `site-lead-checklist` route did not introduce dynamic route conflicts. |
| Browser: daily log create | `agent-browser --session daily-log-check-2 open http://localhost:3001/876/daily-log/new` then `eval` | Pass | Returned `{\"title\":\"Daily Log\",\"hasChecklistText\":false,\"hasWeather\":true}` confirming the checklist is no longer on the daily log form. |
| Browser: checklist page | `agent-browser --session daily-log-check-2 open http://localhost:3001/876/daily-log/site-lead-checklist` then `eval` | Pass | Returned `{\"title\":\"Site Lead Checklist\",\"hasChecklistText\":true,\"hasDate\":true,\"hasFollowUpLabel\":false}` confirming the separate checklist page renders. |
| Browser screenshots | `/tmp/daily-log-checklist-proof/daily-log-new.png`, `/tmp/daily-log-checklist-proof/site-lead-checklist.png` | Pass | Captured the split routes after verification. |
| Diff check | `git diff --check -- 'docs/ops/tasks/2026-07-03-daily-log-site-lead-checklist-split.md' ...` | Pass | No whitespace or patch-format issues in task-owned files. |
| Known unrelated local verification gap | `agent-browser --session daily-log-check-2 open http://localhost:3001/876/daily-log` | Unrelated timeout | Local list route intermittently timed out waiting for `load`; this did not block verification of the exact reported create route or the new checklist route. |

## Files Changed

- `docs/ops/tasks/2026-07-03-daily-log-site-lead-checklist-split.md` - task ledger for this split.
- `frontend/src/app/(main)/actions/daily-log-actions.ts` - split checklist load/save into dedicated actions and removed checklist ownership from the shared daily log form actions.
- `frontend/src/app/(main)/actions/__tests__/daily-log-actions.test.ts` - added checklist load/save regression coverage.
- `frontend/src/app/(main)/[projectId]/daily-log/daily-log-client.tsx` - exposed the separate Site Lead Checklist entry point from the daily log list header.
- `frontend/src/app/(main)/[projectId]/daily-log/[dailyLogId]/edit/page.tsx` - stopped hydrating checklist state into the edit form.
- `frontend/src/app/(main)/[projectId]/daily-log/site-lead-checklist/page.tsx` - added the project-scoped checklist route.
- `frontend/src/app/(main)/[projectId]/daily-log/site-lead-checklist/site-lead-checklist-client.tsx` - implemented the dedicated checklist page client.
- `frontend/src/components/daily-log/DailyLogFormClient.tsx` - removed checklist UI, state, validation, and submit coupling from the daily log form.
- `frontend/src/components/daily-log/SiteLeadChecklistFields.tsx` - centralized checklist section rendering for the new route.
- `frontend/src/lib/app-surface/page-descriptions.json` - documented the separate checklist route and removed checklist language from the daily log description.
- `frontend/src/lib/app-surface/app-surface.generated.json` - mirrored app-surface description updates for the route map.
- `frontend/src/lib/sitemap-utils.ts` - registered the new checklist route in the sitemap inventory.

## Risks / Gaps

- Local `agent-browser` navigation to `http://localhost:3001/876/daily-log` timed out intermittently during header-action verification, so the new list-page CTA is verified by code inspection plus the exact create/checklist route browser proof rather than by a clean list-page DOM snapshot.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
