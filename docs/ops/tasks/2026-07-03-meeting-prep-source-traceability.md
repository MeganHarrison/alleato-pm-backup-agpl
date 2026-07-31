# Task: Meeting Prep Source Traceability

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Improve AI/source-backed meeting prep traceability so each prep suggestion shows a meaningful source label/context and seeded agenda rows preserve that context after meeting creation.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Create meeting page meeting prep rows
One purpose: help the meeting owner decide whether a suggested agenda item belongs in the meeting.
Primary user job: scan suggestion, understand source/context, remove irrelevant suggestions, create agenda.
Primary action: Create agenda with accepted suggestions.
Secondary actions: open source, remove/restore, regenerate.
Next action after success: agenda opens with accepted suggestions seeded.
Correction path: remove bad suggestion before create; edit seeded row after create.
Keyboard path: source links and remove buttons remain tab reachable.
Information that belongs elsewhere: full transcript, source reader, all project intelligence history.
Blessed pattern: compact form list rows with source links; no new cards.
Complexity budget: pass if source context is one compact line and does not become source preview content.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Prep route returns `sourceLabel` and `sourceContext` for suggestions.
- [x] AI-normalized suggestions preserve source label/context from source candidates.
- [x] Create page displays source labels without adding panels/cards.
- [x] Seeded agenda item descriptions include source label, URL, and compact context.
- [x] Existing fallback still returns within bounded timeout.
- [x] Browser verification proves source labels render and seeded agenda rows retain source context.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] AI SDK source/docs checked for generation API assumptions.
- [x] Existing provider utility remains reused.
- [x] No full transcript payloads are returned to the browser.
- [x] UI uses existing compact row pattern.
- [x] Failure path keeps meeting creation available.

## Planned Files

- `docs/ops/tasks/2026-07-03-meeting-prep-source-traceability.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`

## Integration Checklist

- [x] Focused ESLint passes.
- [x] Focused changed-file type guard passes.
- [x] Surface complexity audit passes or unavailable command is documented.
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
| AI SDK skill gate | `/Users/meganharrison/.agents/skills/ai-sdk/SKILL.md`; `rg "abortSignal|Output.object|generateText" frontend/node_modules/ai/docs frontend/node_modules/ai/src` | Pass | Confirmed current AI SDK generation API references. |
| Design doctrine gate | `.agents/skills/alleato-design-doctrine/SKILL.md` and required references | Pass | Product constitution, workflow gate, surface budgets, blessed patterns, and pattern operating model loaded. |
| Implementation pass | `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`, `frontend/src/hooks/use-meeting-planning-suggestions.ts`, `frontend/src/components/domain/meetings/create-meeting-form.tsx` | Pass | Added `sourceLabel`/`sourceContext`, preserved metadata through AI normalization, and seeded agenda descriptions with source context. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/hooks/use-meeting-planning-suggestions.ts' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No lint failures. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Whitespace check | `git diff --check -- <task-owned files>` | Pass | No whitespace errors. |
| Surface audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/domain/meetings/create-meeting-form.tsx` | Pass | Surface complexity audit passed. |
| Endpoint proof | Browser-authenticated `fetch('/api/projects/760/meetings/prep-suggestions', { method: 'POST' })` | Pass | Returned 200 in 13.3s with 8 suggestions, 3 recaps, and source labels/context. |
| Create page proof | `/tmp/alleato-meeting-prep-source-traceability/create-meeting-source-labels-clean.png` | Pass | Source labels render compactly in prep rows. |
| Seeded agenda proof | `/tmp/alleato-meeting-prep-source-traceability/seeded-agenda-source-context.png` | Pass | Seeded agenda action item descriptions include source label, URL, and context. |
| Test meeting cleanup | `DELETE /api/projects/760/meetings/d7740575-484a-4189-9785-33ac4c68ae85`; follow-up GET returned 404 | Pass | Verification meeting was soft-deleted. |

## Files Changed

- `docs/ops/tasks/2026-07-03-meeting-prep-source-traceability.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
