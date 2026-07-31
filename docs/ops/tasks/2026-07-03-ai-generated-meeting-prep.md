# Task: AI Generated Meeting Prep

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Turn the create meeting page from deterministic project-context suggestions into true AI-generated meeting prep that synthesizes open project work, prior meeting context, and current coordination risks into editable agenda/action suggestions before the meeting is created.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Create meeting page meeting prep section
One purpose: help a project user start a meeting with the right agenda context already drafted.
Primary user job: review, remove, restore, regenerate, and create a meeting from source-backed prep suggestions.
Primary action: Create meeting with selected prep suggestions.
Secondary actions: regenerate prep, remove suggestion, restore removed suggestions, manually edit the agenda after creation.
Next action after success: route to the agenda page with accepted prep seeded into agenda/action rows.
Correction path: remove poor suggestions before create, edit seeded rows after create, fallback to deterministic suggestions if AI fails.
Keyboard path: tab through controls and suggestions; create flow remains form-first and keyboard reachable.
Information that belongs elsewhere: full project task management, full RFI/submittal/change event review, complete meeting transcript review.
Blessed pattern: Form page with compact optional prep list; no dashboard cards or decorative AI panels.
Complexity budget: Full page section, pass if AI status and source confidence remain compressed and do not compete with the form.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Create meeting prep is generated through a server-side AI route using the repo's AI Gateway/provider conventions.
- [x] AI output is structured, validated, capped, and mapped to the existing meeting suggestion contract.
- [x] The route gathers meaningful project context from existing project work before generation.
- [x] Failure is loud to logs/API callers but graceful in the UI, falling back to deterministic suggestions without blocking meeting creation.
- [x] The UI keeps the prep section compact and editable, with optional regeneration and no duplicate primary CTA.
- [x] Accepted AI suggestions still seed into the created meeting agenda using the existing agenda item contract.
- [x] Browser verification proves generated prep on `/760/meetings/new` and create-to-agenda seeding.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Supabase types gate blocker recorded before adding database-reading route code.
- [x] AI SDK docs/source and current gateway model list checked before model code was written.
- [x] Existing AI provider utility reused instead of creating a new provider path.
- [x] Server route validates auth before generating project prep.
- [x] Client hook supports AI result, deterministic fallback, loading, failure, remove, restore, and regenerate.
- [x] UI changes reuse existing create meeting form structure and avoid new one-off visual shells.

## Planned Files

- `docs/ops/tasks/2026-07-03-ai-generated-meeting-prep.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
- Supporting AI prompt/schema helper only if needed to keep route readable.

## Integration Checklist

- [x] Doctrine surface complexity audit passes for touched UI files.
- [x] Focused ESLint passes for touched files.
- [x] Focused changed-file type guard and sub-agent static verification pass.
- [x] Browser verification runs on the real route or blocker is recorded.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] AI failure does not block manual meeting creation.
- [x] Structured output schema prevents malformed suggestions from entering the create flow.
- [x] Created test meetings are cleaned up after browser verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `ls docs/ops/tasks \| rg 'TASK|template'` | Process gap | The AGENTS-referenced `docs/ops/tasks/TASK-TEMPLATE.md` is absent, so this task mirrors current `docs/ops/tasks/*` format. |
| Linear issue gate | `tool_search Linear create issue comment` | Blocked | Existing prior check showed available Linear MCP tools expose comments, not issue creation. |
| Supabase type gate | Pending new Supabase token | Pending | User is creating a fresh token; database route code will wait until types can be regenerated without corrupting `database.types.ts`. |
| AI SDK skill gate | `/Users/meganharrison/.agents/skills/ai-sdk/SKILL.md` | Pass | Skill loaded; local AI SDK docs are present under `frontend/node_modules/ai/docs`. |
| Design doctrine gate | `.agents/skills/alleato-design-doctrine/SKILL.md` plus required references | Pass | Product constitution, workflow gate, surface budgets, blessed patterns, and pattern operating model loaded. |
| AI SDK docs/source | `frontend/node_modules/ai/docs/07-reference/01-ai-sdk-core/28-output.mdx`; `frontend/node_modules/ai/src` | Pass | Verified `generateText` with `Output.object({ schema, name, description })` against local docs/source. |
| AI Gateway model list | `curl -s https://ai-gateway.vercel.sh/v1/models \| jq -r '.data[].id' \| rg '^openai/gpt-5' \| sort -V` | Pass | Chose `gpt-5.5` from the current gateway model list instead of stale model memory. |
| Sub-agent: AI SDK/provider mapping | `multi_agent_v1` code mapper `019f29b7-3820-7da3-9097-96101d135916` | Pass | Confirmed `getLanguageModel`, gateway provider conventions, and local structured-output docs. |
| Sub-agent: data-source mapping | `multi_agent_v1` code mapper `019f29b7-7817-74a2-894c-38dba91e6839` | Pass | Confirmed future direct server-side context should use projects, document metadata, meeting preps, tasks, RFIs, submittals, change events, and schedule tasks after Supabase token refresh. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/hooks/use-meeting-planning-suggestions.ts' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No lint errors. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/domain/meetings/create-meeting-form.tsx frontend/src/hooks/use-meeting-planning-suggestions.ts 'frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts'` | Pass | All touched UI/API files passed surface complexity audit. |
| Whitespace diff | `git diff --check -- docs/ops/tasks/2026-07-03-ai-generated-meeting-prep.md 'frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' frontend/src/hooks/use-meeting-planning-suggestions.ts frontend/src/components/domain/meetings/create-meeting-form.tsx` | Pass | No whitespace errors. |
| Sub-agent static verification | `multi_agent_v1` code mapper `019f29bb-ce06-7a51-aac1-d16c71103096` | Pass | Confirmed route wrapper shape, `Output.object` usage, hook payload, and create form response assumptions. |
| Browser: AI prep visible | `agent-browser open http://localhost:3001/760/meetings/new`; wait for `Open source` | Pass | `/760/meetings/new` showed AI-generated agenda prep from open project work with four suggestions and compact regenerate/remove controls. |
| Browser: regenerate | `agent-browser click @e14` | Pass | Regenerate completed and rendered AI-generated suggestions without browser errors. |
| Browser: seeded create | Created `Codex AI prep verification seeded` from `/760/meetings/new` | Pass | Redirected to `/760/meetings/6709047d-8001-4bf6-86ea-9f0523ec4e7a/agenda` with four seeded rows: tasks, change event, and context. |
| Browser screenshots | `/tmp/alleato-ai-meeting-prep/seeded-agenda-desktop.png`; `/tmp/alleato-ai-meeting-prep/seeded-agenda-mobile.png` | Pass | Captured desktop and mobile agenda evidence after seeded AI suggestions. |
| Mobile overflow | `agent-browser set viewport 375 780`; `document.documentElement.scrollWidth > window.innerWidth` | Pass | `overflow: false` on seeded agenda mobile viewport. |
| Browser errors | `agent-browser errors` | Pass | No current browser errors after seeded verification. |
| Failure-path hardening | First create hit transient `Failed to fetch` during seeding | Fixed | Seed helper now uses `Promise.allSettled` so one failed insert cannot abort the rest of the accepted suggestions. |
| Test cleanup | `fetch("/api/projects/760/meetings/<id>", { method: "DELETE" })` for `9694c2c1-60e8-4bbe-b3ff-bd27c66cd365`, `93359080-4c1a-49e1-a06e-4a47ea94122f`, `6709047d-8001-4bf6-86ea-9f0523ec4e7a` | Pass | All three verification meetings soft-deleted with status `200`. |

## Files Changed

- `docs/ops/tasks/2026-07-03-ai-generated-meeting-prep.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
