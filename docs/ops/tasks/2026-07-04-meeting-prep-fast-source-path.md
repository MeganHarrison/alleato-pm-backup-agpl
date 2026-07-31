# Task: Meeting Prep Fast Source Path

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-919
Linear URL: https://linear.app/megankharrison/issue/AAI-919/harden-ai-meeting-prep-generation-response-path
Related Handoff: N/A

## Objective

Make create-meeting prep suggestions return useful source-backed agenda prep quickly by default, while keeping AI synthesis available only when explicitly requested and bounded by timeout.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Root Cause

Browser verification of the create-meeting flow showed the prep suggestions endpoint waited on Vercel AI Gateway for roughly 12 seconds before falling back to already-useful source-backed suggestions. The expensive AI call was in the default response path, so the user waited even though deterministic project intelligence, prior meeting recaps, transcript segments, tasks, RFIs, submittals, schedule, and change events were already available.

## Doctrine Gate

Surface: Create meeting prep suggestions
One purpose: prepare a meeting agenda from live project context quickly.
Primary user job: create a meeting with useful, source-backed prep items.
Primary decision: what should be discussed in the meeting.
Tier 1: source-backed prep suggestions, meeting recaps, source links.
Tier 2: whether prep was source-backed or AI-synthesized.
Tier 3: fallback/recovery reason only when AI was explicitly requested and failed.
Hide until requested: AI rewrite/synthesis.
Remove: default wait on AI provider before showing deterministic prep.
Primary action: create agenda.
Failure-loudly behavior: response metadata reports source fallback or AI failure without blocking meeting creation.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Default prep suggestion requests do not call AI generation.
- [x] Default response returns source-backed suggestions and meeting recaps when available.
- [x] Explicit AI requests still call AI synthesis and keep the current timeout/fallback safety.
- [x] Response metadata distinguishes `source`, `ai`, and unavailable fallback states.
- [x] Client-side types accept the new source-backed response state.
- [x] Focused tests cover default source path and explicit AI path.
- [x] API/browser verification proves the default path is fast and source-backed.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Current `origin/main` implementation is used as source of truth.
- [x] No schema or migration is introduced.
- [x] No new UI panel, helper banner, or dashboard chrome is added.
- [x] Existing create agenda flow still seeds accepted suggestions.
- [x] AI provider failures remain logged with cause and bounded fallback.

## Planned Files

- `docs/ops/tasks/2026-07-04-meeting-prep-fast-source-path.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx` if UI copy needs the new source state.

## Integration Checklist

- [x] Focused route unit test passes.
- [x] Focused ESLint passes.
- [x] Changed-file type guard passes.
- [x] API smoke/browser verification runs against `/760/meetings/new` or the prep endpoint.
- [x] Linear updated with evidence.

## Regression Guardrails

- [x] No default AI wait before showing prep.
- [x] Existing source URLs and transcript anchors are preserved.
- [x] No duplicate primary CTA or new persistent helper copy.
- [x] AI explicit mode fallback remains useful if provider times out.
- [x] No temporary verification data remains.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| AI SDK gate | `frontend/node_modules/ai/docs` and `ai-sdk` skill | Pass | Confirmed `generateText`, `Output.object`, and `abortSignal` are the current structured-output path. |
| Linear kickoff | AAI-919 comment `cea2d008-9451-41d7-ac5b-dabce7b15aa8` | Pass | Scope and root cause posted before implementation. |
| Focused route test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts'` | Pass | 3 tests passed: default source path skips AI, explicit AI path calls AI, AI failure returns source fallback. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts' 'src/hooks/use-meeting-planning-suggestions.ts' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No lint failures. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Auth setup warm-up | `PLAYWRIGHT_BASE_URL=http://localhost:3002 npx playwright test tests/auth.setup.ts --config=config/playwright/playwright.config.ts --project=setup --reporter=line` | Pass | First run timed out while `/tasks` compiled; rerun passed in 7.2s after route warm-up. |
| Browser page proof | `agent-browser --state frontend/tests/.auth/user.json open http://localhost:3002/760/meetings/new` | Pass | Authenticated clean worktree page opened and showed `Generate AI prep`, confirming source-first UI mode. |
| Browser endpoint proof | Authenticated browser `fetch('/api/projects/760/meetings/prep-suggestions', { method: 'POST', body: JSON.stringify({ mode: 'source' }) })` | Pass | Returned 200, `generatedBy: "source"`, `model: null`, 8 suggestions, 3 recaps, first source label `Project task`, no fallback reason. Server handler durations for warmed source requests were 1.732s and 1.153s. |
| Screenshot | `/tmp/alleato-meeting-prep-fast-source/create-meeting-source-first.png` | Pass | Clean create meeting page state after source-first load. |
| Linear evidence update | AAI-919 comment `6774ab2a-882e-4335-9633-fa5a30f0dc55` | Pass | Implementation evidence, verification commands, risk notes, and next action posted. |

## Files Changed

- `docs/ops/tasks/2026-07-04-meeting-prep-fast-source-path.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
