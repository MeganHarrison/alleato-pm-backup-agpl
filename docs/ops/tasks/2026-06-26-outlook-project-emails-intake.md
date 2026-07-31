# Task: Outlook project Emails live intake repair

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-721 - https://linear.app/megankharrison/issue/AAI-721/repair-project-emails-route-to-read-live-outlook-intake
Related Handoff: N/A

## Objective

Repair the project Emails page so `/{projectId}/emails` shows live Outlook-synced messages from `outlook_email_intake` instead of relying only on the stale `project_emails` projection.

## Scope Checklist

- [x] Capture live evidence that Outlook intake rows exist while `project_emails` is stale.
- [x] Identify the exact frontend/API route used by the screenshot.
- [x] Capture production browser/API evidence that the page still returned `[]` after the route patch.
- [x] Identify the production runtime config fallback to the PM App Supabase project.
- [x] Keep app-authored draft writes scoped to `project_emails`.
- [x] Update the project GET route to read live Outlook intake rows for project views.
- [x] Add guardrail tests proving the project route does not silently rely on `project_emails` for Outlook rows.
- [x] Add fail-loud guardrail preventing Outlook intake from falling back to the PM App database.
- [x] Update AI/RAG finalization progress notes.

## Implementation Checklist

- [x] `source=all` returns app-composed rows plus live Outlook intake rows.
- [x] `source=outlook` returns only live Outlook intake rows.
- [x] `source=app` preserves the existing app-composed `project_emails` behavior.
- [x] Project, status, search, starred, related-tool, and ownership filters behave intentionally.
- [x] Attachment icon state uses real `outlook_email_intake_attachments` rows for Outlook rows.
- [x] Failures raise explicit route errors instead of rendering a fake empty inbox.
- [x] Production runtime config validation requires the RAG Supabase env vars that Outlook intake reads need.

## Verification Checklist

- [x] Focused route tests pass.
- [x] Changed-file typecheck is delegated.
- [x] Browser/API evidence proves a project page/API returns recent live Outlook rows.
- [x] Evidence artifacts are recorded below.

## Failure-Loudly Behavior

The GET route must fail with a 500 if either app email reads or Outlook intake reads fail. A stale `project_emails` result must not be treated as proof that the inbox is empty when `source=all` or `source=outlook` requires the live Outlook source.

## Root Cause

Live database readback on 2026-06-26 showed `outlook_email_intake` had 545 rows in the last seven days, while `project_emails` had 0 rows created in that same window. The screenshot route `/{projectId}/emails` calls `/api/projects/{projectId}/emails`, and that project API route still selected only `project_emails`.

After the route patch was deployed, production still returned `[]` because Vercel runtime env readback showed the active production env missing `RAG_SUPABASE_URL`, `RAG_SUPABASE_SERVICE_ROLE_KEY`, and `RAG_DATABASE_READS_ENABLED`. `createOutlookIntakeServiceClient()` therefore fell back to the PM App Supabase project, whose `outlook_email_intake` table had 0 rows in the one-week operational window. The AI/RAG Supabase project had 525+ recent rows and project `876` contained `Re: Exol Morrisville PA`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live DB baseline | Node Supabase readback from `frontend` workspace | Fail before fix | `outlook_email_intake` recent count: 545; `project_emails` recent count: 0. |
| Focused unit guardrail | `npm --prefix frontend run test:unit -- --runTestsByPath 'src/app/api/projects/[projectId]/emails/__tests__/route.test.ts' --runInBand` | Pass | 3 tests prove default feed includes intake, `source=outlook` bypasses `project_emails`, and `source=app` preserves app draft storage. |
| Expanded route guardrail | `npm --prefix frontend run test:unit -- --runTestsByPath 'src/app/api/projects/[projectId]/emails/__tests__/route.test.ts' 'src/app/api/emails/__tests__/route.test.ts' --runInBand` | Pass | 5 tests prove project and global email routes use live Outlook intake and preserve app-source behavior. |
| Focused lint | `./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/emails/route.ts' 'src/app/api/projects/[projectId]/emails/__tests__/route.test.ts' 'src/app/api/emails/__tests__/route.test.ts' 'src/app/(main)/[projectId]/emails/emails-client.tsx' 'src/features/emails/project-emails-workspace.tsx' --cache --cache-strategy content` from `frontend` | Pass with existing warnings | 0 errors. Existing warnings remain in `project-emails-workspace.tsx` for raw button/date/search inputs. |
| Delegated changed-file typecheck | `npm --prefix frontend run typecheck:changed` | Pass | Worker reported `No new 'any' type debt detected in changed changes.` |
| Authenticated local API probe | `curl http://localhost:3001/api/projects/876/emails?source=outlook` | Blocked | Returned `AUTH_EXPIRED`; no browser/API success claim made from this probe. |
| Production browser/API before env fix | [production-876-emails.png](../../../tests/agent-browser-runs/2026-06-26-outlook-project-emails-intake/production-876-emails.png), [production-summary.json](../../../tests/agent-browser-runs/2026-06-26-outlook-project-emails-intake/production-summary.json), [rag-db-readback.json](../../../tests/agent-browser-runs/2026-06-26-outlook-project-emails-intake/rag-db-readback.json) | Fail before env fix | Authenticated admin page/API returned `[]`; RAG DB readback showed matching project `876` rows including `Re: Exol Morrisville PA`. |
| Production env readback before fix | `vercel env pull --environment=production` redacted host/flag summary | Fail before env fix | Active pulled env had `hasRagUrl=false`, `hasRagKey=false`, `ragReads=null`, app host `lgveqfnpkxvzbnnwuled.supabase.co`. |
| Vercel env repair | `vercel env add RAG_SUPABASE_URL production --force`, `vercel env add RAG_SUPABASE_SERVICE_ROLE_KEY production --force`, `vercel env add RAG_DATABASE_READS_ENABLED production --force` | Applied | Values sourced from existing local secure env without printing secrets. |
| Outlook client fallback guard | `npm --prefix frontend run test:unit -- --runTestsByPath 'src/lib/supabase/__tests__/service.test.ts' 'src/app/api/projects/[projectId]/emails/__tests__/route.test.ts' 'src/app/api/emails/__tests__/route.test.ts' --runInBand` | Pass | 7 tests prove Outlook intake uses the RAG client and missing RAG env fails loudly. |
| Runtime config guard | Node spawn of `scripts/validate-runtime-config.mjs` with production env and missing RAG vars | Pass | Validator exits 1 and names missing `RAG_SUPABASE_URL`, `RAG_SUPABASE_SERVICE_ROLE_KEY`. |
| Production redeploy | `vercel redeploy alleato-frhcy86dw-meganharrisons-projects.vercel.app --target production` | Pass | Deployment `dpl_7f5gZeBdGQDphgiUJyK4myqS7MJJ` reached READY at commit `f9e16cd000566e876d9d733c9087fff5adaff658`. |
| Production API after env fix | [production-api-after-vercel-rag-env-fix.json](../../../tests/agent-browser-runs/2026-06-26-outlook-project-emails-intake/production-api-after-vercel-rag-env-fix.json) | Pass | Authenticated `/api/emails` returned 1000 rows; authenticated `/api/projects/876/emails?source=outlook` returned 28 rows with `Re: Exol Morrisville PA` first. |
| Production browser text after env fix | [production-876-emails-after-vercel-rag-env-fix.txt](../../../tests/agent-browser-runs/2026-06-26-outlook-project-emails-intake/production-876-emails-after-vercel-rag-env-fix.txt) | Pass | Browser body text contains `Steve Fischer` and `Re: Exol Morrisville PA`; empty-state strings are absent. Screenshot command hung and was not used as completion evidence. |

## Additional Safety Fixes

- Project views now treat Outlook-sourced rows as read-only for old `project_emails` edit/delete/task/summarize endpoints.
- Bulk delete excludes Outlook intake rows so selected live inbox rows cannot call stale project email delete endpoints.
- Reading-panel attachment queries are disabled for Outlook intake rows until attachment rendering is migrated to `outlook_email_intake_attachments`.

## Files To Change

- `frontend/src/app/api/projects/[projectId]/emails/route.ts`
- `frontend/src/app/api/projects/[projectId]/emails/__tests__/route.test.ts`
- `frontend/src/app/api/emails/__tests__/route.test.ts` if the existing global route guardrail is stale
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- This task file
