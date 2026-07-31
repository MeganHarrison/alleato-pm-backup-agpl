# Task: AI Meeting Prep Server Context

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Move AI-generated create-meeting prep from client-aggregated source candidates to a server-side project context route that reads current project work directly after the Supabase token/type gate is restored.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Create meeting page meeting prep section
One purpose: generate useful agenda prep before the meeting exists.
Primary user job: review AI-generated prep, remove irrelevant items, regenerate, and create the meeting with accepted rows seeded.
Primary action: Create meeting with selected AI prep suggestions.
Secondary actions: regenerate, remove, restore, edit after creation.
Next action after success: agenda page opens with accepted suggestions seeded.
Correction path: deterministic fallback, remove suggestions, edit agenda rows, partial seeding warning.
Keyboard path: existing form and suggestion controls remain keyboard reachable.
Information that belongs elsewhere: full project task/RFI/submittal/change-event/schedule management and complete transcript review.
Blessed pattern: existing form page plus compact optional prep list.
Complexity budget: pass if the server-side data upgrade does not add new visual chrome.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Supabase types regenerate successfully with the new access token and `database.types.ts` remains valid.
- [x] Server route gathers project context directly for tasks, RFIs, submittals, change events, schedule tasks, and prior meeting context where safe.
- [x] AI route no longer depends on the client passing full source candidates, while still allowing deterministic fallback.
- [x] Returned suggestions keep the existing compact suggestion contract used by the create page.
- [x] Auth/project-scope failures fail loudly through API guardrails.
- [x] Browser verification proves `/760/meetings/new` AI prep still renders and seeds accepted suggestions.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Supabase types gate run before database-query code changes.
- [x] Current AI SDK docs/source and model list checked before model-code changes.
- [x] Existing provider utility reused.
- [x] Context query helpers are bounded and avoid large transcript/document payloads.
- [x] UI remains unchanged unless needed for the new server contract.

## Planned Files

- `docs/ops/tasks/2026-07-03-ai-meeting-prep-server-context.md`
- `frontend/src/types/database.types.ts`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx` only if the client contract requires it.

## Integration Checklist

- [x] Focused ESLint passes for touched files.
- [x] Focused changed-file type guard passes.
- [x] Doctrine surface complexity audit passes if UI files change.
- [x] Browser verification runs on the real route or blocker is recorded.

## Regression Guardrails

- [x] No secret values printed in logs or evidence.
- [x] No duplicate primary CTA.
- [x] AI failure does not block manual meeting creation.
- [x] Structured output schema prevents malformed suggestions.
- [x] Created test meetings are cleaned up after browser verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Token presence | `rg -n '^SUPABASE_ACCESS_TOKEN=' . .env* frontend/.env* \| sed 's/=.*/=<redacted>/'` | Pass | Token exists in `.env` and `frontend/.env.local`; value was not printed. |
| AI SDK skill gate | `/Users/meganharrison/.agents/skills/ai-sdk/SKILL.md` | Pass | Skill loaded for AI SDK work. |
| Root env token check | `python3` length/prefix check | Fixed | Root `.env` had invalid token length while `frontend/.env.local` was valid; root `.env` was synchronized from the valid frontend env without printing the secret. |
| Supabase project read-back | `set -a; source .env; set +a; npx supabase projects list` | Pass | Confirmed the PM APP project ref was visible after env synchronization; secret value was not printed. |
| Supabase types gate | `set -a; source frontend/.env.local; set +a; npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Pass | Types regenerated; output only included the existing deprecated `[inbucket]` config warning. |
| Generated type diff | `git diff -- frontend/src/types/database.types.ts` | Pass | Diff is limited to PostgREST version and `admin_feedback_items.category` column. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/hooks/use-meeting-planning-suggestions.ts' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No lint errors. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/domain/meetings/create-meeting-form.tsx frontend/src/hooks/use-meeting-planning-suggestions.ts 'frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts'` | Pass | All touched files passed. |
| Whitespace diff | `git diff --check -- docs/ops/tasks/2026-07-03-ai-meeting-prep-server-context.md 'frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' frontend/src/hooks/use-meeting-planning-suggestions.ts frontend/src/components/domain/meetings/create-meeting-form.tsx frontend/src/types/database.types.ts` | Pass | No whitespace errors. |
| Direct endpoint | `fetch("/api/projects/760/meetings/prep-suggestions", { method: "POST" })` | Pass | Returned HTTP `200`, `generatedBy: "ai"`, and 4 suggestions from server-gathered context. |
| Browser: create page | `/760/meetings/new` | Pass | Rendered AI prep with server-side tasks, change events, project context, and prior meeting carry-forward. |
| Browser: seeded create | Created `Codex server AI prep verification` | Pass | Redirected to `/760/meetings/8608296f-71c9-4aa1-ab47-6e94ee259258/agenda` with 4 seeded rows. |
| Browser screenshots | `/tmp/alleato-ai-meeting-prep-server/seeded-agenda-desktop.png`; `/tmp/alleato-ai-meeting-prep-server/seeded-agenda-mobile.png` | Pass | Captured desktop and mobile evidence after seeded server-side AI prep. |
| Mobile overflow | `agent-browser set viewport 375 780`; `document.documentElement.scrollWidth > window.innerWidth` | Pass | `overflow: false`. |
| Browser errors | `agent-browser errors` | Pass | No current browser errors after server-side AI prep verification. |
| Test cleanup | `fetch("/api/projects/760/meetings/8608296f-71c9-4aa1-ab47-6e94ee259258", { method: "DELETE" })` | Pass | Verification meeting soft-deleted with status `200`. |

## Files Changed

- `docs/ops/tasks/2026-07-03-ai-meeting-prep-server-context.md`
- `frontend/src/types/database.types.ts`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
