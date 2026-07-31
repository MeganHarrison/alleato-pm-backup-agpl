# Task: AI Meeting Prep Recaps Intelligence

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Upgrade AI-generated create-meeting prep so it uses richer meeting intelligence: transcript-derived meeting segments, project intelligence timeline events, and compact previous meeting recaps surfaced on the create page as evidence for agenda planning.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Create meeting page meeting prep area
One purpose: help the meeting owner understand what should be discussed next and why.
Primary user job: review AI agenda suggestions, scan recent meeting evidence, remove irrelevant suggestions, and create the agenda.
Primary action: Create agenda with selected prep suggestions.
Secondary actions: regenerate prep, remove/restore suggestions, open source records/meetings.
Next action after success: agenda opens with accepted suggestions seeded.
Correction path: remove bad suggestions, edit seeded rows, open source meeting/context, fallback if AI fails.
Keyboard path: all controls remain tab reachable; no hover-only source access.
Information that belongs elsewhere: full transcript reading, full project intelligence timeline, full meeting history.
Blessed pattern: existing form page with compact list rows and progressive disclosure through source links.
Complexity budget: pass if recaps are at most a short evidence list and do not become a meeting-history dashboard.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Prep route includes transcript-derived `meeting_segments` in bounded AI context.
- [x] Prep route includes bounded project intelligence timeline events in AI context.
- [x] Prep response includes compact `meetingRecaps` for recent project meetings.
- [x] Create page renders previous meeting recaps quietly below AI prep suggestions.
- [x] Recaps are source-linked and truncated; full transcript/history remains elsewhere.
- [x] Existing create-to-agenda seeding still works.
- [x] Browser verification proves recaps render and seeded AI suggestions still create agenda rows.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] AI SDK docs/model list checked before model-code edits.
- [x] Existing provider utility reused.
- [x] Context queries are bounded and avoid full transcript payloads.
- [x] UI uses existing form/list patterns, no new cards or dashboard panels.
- [x] Failure path keeps meeting creation available.

## Planned Files

- `docs/ops/tasks/2026-07-03-ai-meeting-prep-recaps-intelligence.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`

## Integration Checklist

- [x] Focused ESLint passes.
- [x] Focused changed-file type guard passes.
- [x] Doctrine surface complexity audit passes.
- [x] Browser verification runs on `/760/meetings/new`.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] No full transcript payloads returned to the browser.
- [x] AI failure does not block manual meeting creation.
- [x] Created test meetings are cleaned up after browser verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Memory/context pass | `sed -n '236,306p' /Users/meganharrison/.codex/memories/MEMORY.md` | Pass | Reconfirmed create meeting should be source-backed and mostly pre-populated. |
| AI SDK skill gate | `/Users/meganharrison/.agents/skills/ai-sdk/SKILL.md` | Pass | Skill loaded for AI SDK work. |
| AI model list | `curl -s https://ai-gateway.vercel.sh/v1/models \| jq -r '.data[].id' \| rg '^openai/gpt-5' \| sort -V` | Pass | Current list still includes `openai/gpt-5.5`; route continues using shared provider wrapper. |
| Design doctrine gate | `.agents/skills/alleato-design-doctrine/SKILL.md` and required references | Pass | Product constitution, workflow gate, surface budgets, blessed patterns, and pattern operating model loaded. |
| Implementation pass | `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`, `frontend/src/hooks/use-meeting-planning-suggestions.ts`, `frontend/src/components/domain/meetings/create-meeting-form.tsx` | Pass | Added bounded segment/timeline context, compact source-linked recaps, and quiet divided-row recap UI. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/hooks/use-meeting-planning-suggestions.ts' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No lint failures. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Whitespace check | `git diff --check -- <task-owned files>` | Pass | No whitespace errors. |
| Endpoint latency/fallback | Browser-authenticated `fetch('/api/projects/760/meetings/prep-suggestions', { method: 'POST' })` | Pass | Returned 200 in 13.5s with fallback, 8 suggestions, 3 recaps, and no `{}` text artifacts. |
| Desktop UI proof | `/tmp/alleato-ai-meeting-prep-recaps/create-meeting-recaps-desktop-final.png` | Pass | Create page renders source-backed prep and recent meeting recaps. |
| Mobile UI proof | `/tmp/alleato-ai-meeting-prep-recaps/create-meeting-recaps-mobile.png` | Pass | Mobile screenshot captured after recaps rendered. |
| Seeded agenda proof | `/tmp/alleato-ai-meeting-prep-recaps/seeded-agenda-verification.png` | Pass | Test meeting created and opened with 8 seeded agenda rows and action item rows. |
| Test meeting cleanup | `DELETE /api/projects/760/meetings/4ac6d310-086d-4f7f-8af1-2fece860c447`; follow-up GET returned 404 | Pass | Verification meeting was soft-deleted. |
| Impeccable CLI | `impeccable noise-gate frontend/src/components/domain/meetings/create-meeting-form.tsx` | Unavailable | CLI not installed (`command not found`); manual doctrine audit passed from loaded references. |

## Files Changed

- `docs/ops/tasks/2026-07-03-ai-meeting-prep-recaps-intelligence.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
