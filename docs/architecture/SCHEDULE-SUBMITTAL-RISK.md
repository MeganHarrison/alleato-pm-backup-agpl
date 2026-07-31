# Schedule–Submittal Risk

## Purpose

Schedule activities can reference project submittals. The schedule editor shows
the server-calculated risk when a linked submittal is rejected, requires revision,
or has a required approval date after the activity starts. This document records
the canonical owners so future work changes the contract rather than recreating it.

## Canonical user routes

- [Schedule editor](/[projectId]/schedule) — open an activity and use **Linked submittals**.
- [Project submittals](/[projectId]/submittals) — owns the source submittal and workflow state.

## Contract owners

| Concern | Canonical owner |
| --- | --- |
| Link storage and authorization | [`20260722000000_schedule_task_submittal_links.sql`](../../supabase/migrations/20260722000000_schedule_task_submittal_links.sql) |
| Risk calculation | [`submittal-risk.ts`](../../frontend/src/lib/scheduling/submittal-risk.ts) |
| Read and create API | [`route.ts`](../../frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/submittals/route.ts) |
| Delete API | [`route.ts`](../../frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/submittals/[submittalId]/route.ts) |
| Editor presentation and interaction | [`task-edit-modal.tsx`](../../frontend/src/components/scheduling/task-edit-modal.tsx) |
| Editor data refresh | [`schedule/page.tsx`](../../frontend/src/app/(main)/[projectId]/schedule/page.tsx) |

The only write path is the migration’s `link_schedule_task_submittal` and
`unlink_schedule_task_submittal` RPCs. They confirm that the caller is a project
member and that the task and submittal belong to the same project. The client does
not calculate risk and does not retain an optimistic result after unlinking; it
re-reads the GET contract so a previously blocking warning is removed only when
the server says it is clear.

## Risk semantics

- **At risk:** a linked submittal workflow is `Rejected` or `Revise and Resubmit`.
- **At risk:** a linked `Pending` submittal has a required approval date later
  than the task start date.
- **Clear:** every linked submittal is outside those conditions.
- The returned reason names the blocking submittal and includes dependent task
  context where present. The modal renders it with an alert role.

## Failure and recovery

The APIs return specific authentication, authorization, project-scope, and input
errors. The editor makes a failed link visible instead of swallowing the action.
To recover, select a same-project submittal, correct the source workflow/date, or
unlink the relationship; the editor then refreshes the authoritative risk result.

## Tests and delivery records

- [`submittal-risk.test.ts`](../../frontend/src/lib/scheduling/__tests__/submittal-risk.test.ts)
- [Link route tests](../../frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/submittals/__tests__/route.test.ts)
- [Unlink route tests](../../frontend/src/app/api/projects/[projectId]/scheduling/tasks/[taskId]/submittals/[submittalId]/__tests__/route.test.ts)
- [Modal interaction tests](../../frontend/src/components/scheduling/__tests__/task-edit-modal.submittal-risk.test.tsx)
- [AAI-1190 implementation task](../ops/tasks/2026-07-21-aai-1190-submittal-risk.md)
- [AAI-1190 in Linear](https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk)

The task record owns production browser screenshots and independent-review
evidence. Do not close the issue until those records link to the deployed
canonical route.

## Production build guardrail

The Vercel production environment sets `NEXT_PRODUCTION_BUILD_ENGINE=webpack`,
`NEXT_PRODUCTION_BUILD_NODE_OPTIONS=--max-old-space-size=12288`, and
`NEXT_BUILD_MAX_OUTPUT_BYTES=8589934592`. The first avoids the known Turbopack
endpoint-write failure observed for the schedule route; the second prevents the
Webpack fallback’s observed 7 GB Node heap OOM; the third allows the observed
transient 4 GB compilation peak while retaining a bounded output guardrail.
Completed local output is 584 MB and has no nested Next.js directory. The build
wrapper still detects the Turbopack fingerprint, retries once, and falls back to
Webpack if the engine override is absent. These are operational reliability
guardrails, not part of the schedule data contract.
