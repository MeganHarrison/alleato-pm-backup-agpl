# Task: Meeting Prep AI Synthesis

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-923
Linear URL: https://linear.app/megankharrison/issue/AAI-923/synthesize-ai-meeting-prep-from-transcripts-and-project-intelligence

## Objective

Upgrade meeting prep from deterministic source-only extraction to bounded AI synthesis that uses prior meeting transcripts, project intelligence, and open project signals while preserving source traceability and deterministic fallback.

## Product Contract

Meeting prep should behave like a project-intelligence preparation surface, not a generic agenda generator. Source mode stays deterministic. AI mode can synthesize, but only from source packets loaded by the route and with source labels preserved in the returned suggestions and recaps.

## Acceptance Criteria

- [x] `mode: "source"` behavior remains live and deterministic.
- [x] AI mode produces structured agenda suggestions and project meeting recaps from source packets.
- [x] AI mode includes prior meetings/transcripts/project-intelligence context when available.
- [x] AI mode fails loudly or falls back intentionally when provider output is invalid.
- [x] Tests cover AI success and fallback/error behavior.
- [x] Focused lint/type/route guardrails pass.
- [x] Commit is pushed to `origin/main`.
- [x] Vercel production deploy is Ready and assigned to `projects.alleatogroup.com`.
- [x] Live production endpoint verifies source mode and AI mode behavior.

## Implementation Checklist

- [x] Use current `origin/main` as the base.
- [x] Follow current AI SDK docs/source for `generateText`.
- [x] Avoid schema or migration changes unless the route cannot meet the contract without them.
- [x] Preserve existing response shape for the create meeting page.
- [x] Keep UI noise unchanged unless data contract requires a small display fix.
- [x] Post kickoff, evidence, and closeout to Linear.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production preflight | `vercel inspect projects.alleatogroup.com --scope meganharrisons-projects` | Pass | Production alias on Ready deployment `dpl_FMK992gvCxvqWkRpKLNroWx7QMEx` before this slice. |
| Source mode preflight | Authenticated `POST /api/projects/760/meetings/prep-suggestions` with `{"mode":"source"}` | Pass | HTTP 200, `generatedBy: "source"`, `model: null`, 8 suggestions, 3 meeting recaps. |
| AI SDK docs check | Local `frontend/node_modules/ai/docs` and `@ai-sdk/openai/docs` | Pass | Verified current `generateText` plus `Output.object` usage before editing. |
| Focused API test | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts'` | Pass | 4 tests passed, including transcript segment and project-intelligence source packets. |
| Targeted ESLint | `./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No ESLint errors for changed files. |
| Changed type debt guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Changed ESLint debt guard | `cd frontend && npm run lint:changed:debt` | Pass | No new ESLint debt across 3 changed frontend files. |
| Changed API route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | Pass | Changed route has structured handling and no raw error route issue. |
| Route conflict guard | `npm run check:routes` | Pass | No route conflicts found. |
| First production publish | Commit `6044e73c7` and deployment `dpl_BAaA2jqfDoGeG2MFvs74NMcJ2vMC` | Partial | AI-first route deployed, source mode live, AI mode fell back on production with model `gpt-5.5`. |
| Model correction publish | Commit `ea12c2e38` and deployment `dpl_9LJx2st4HATy1NvFe7rh8oMbfDGv` | Partial | Switched to current AI Gateway model ID `openai/gpt-5.4-mini`; source mode live, AI mode still fell back. |
| Strict schema fix | Commit `15b0b281c` and deployment `dpl_4J2ngP3ejW12g8GpdqAyZ2FbA6io` | Pass | Removed optional fields from strict structured-output schema and required empty arrays instead. |
| Production source verification | Authenticated `POST https://projects.alleatogroup.com/api/projects/760/meetings/prep-suggestions` with `{"mode":"source"}` | Pass | HTTP 200, `generatedBy: "source"`, `model: null`, 8 suggestions, 3 meeting recaps. |
| Production AI verification | Authenticated `POST https://projects.alleatogroup.com/api/projects/760/meetings/prep-suggestions` with `{"mode":"ai"}` | Pass | HTTP 200, `generatedBy: "ai"`, `model: "openai/gpt-5.4-mini"`, 4 suggestions, 1 meeting recap. |
| Publish verification | `git rev-parse HEAD` and `git rev-parse origin/main` | Pass | Local HEAD and `origin/main` both `15b0b281c7fcc83fd519b400c7669a0c52381d60` before evidence-only closeout commit. |
| Linear closeout | Linear issue `AAI-923` comments | Pass | Kickoff, implementation evidence, schema-fix evidence, and closeout posted. |
