# Task: Submittal AI Review Workflow Action

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S97-submittal-ai-review-workflow-action.md

## Objective

Let an assigned reviewer record a submittal workflow response from the AI Review
tab, using the existing submittal workflow response model and the saved AI
findings as response context.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static lint | `cd frontend && npx eslint --quiet src/lib/submittals/workflow-response-service.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts' src/hooks/use-submittals.ts src/features/submittals/submittal-ai-review-panel.tsx src/features/submittals/submittal-detail-client.tsx` | PASS | Touched workflow action files lint clean. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Targeted route tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/__tests__/route.test.ts'` | PASS | 2 suites, 4 tests passed. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 3 changed routes passed structured error handling guard. |
| DB fixture setup | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... insert AI Review Verification step ... EOF` | PASS | Created pending response `d88f16a7-69c8-4e95-897a-31dd1567d0e5` for live proof. |
| DB/service read-back | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... recordSubmittalWorkflowResponse(...) ... EOF` | PASS | Response persisted as `Revise and Resubmit`; submittal auto-closed with `ball_in_court: null`. |
| Fixture restored for manual inspection | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... insert AI Review Follow-up step ... EOF` | PASS | Created pending response `ed04b6f8-2240-46a9-a508-531e1ac50f59` and reopened synthetic submittal for inspection. |
| Focused lint after person-id workflow fix | `cd /Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend && ./node_modules/.bin/eslint src/lib/submittals/workflow-response-service.ts src/lib/submittals/__tests__/workflow-response-service.test.ts src/features/submittals/submittal-detail-client.tsx src/lib/users/current-user-profile-server.ts src/hooks/use-current-user-profile.ts src/app/api/users/me/profile/route.ts 'src/app/api/projects/[projectId]/shell/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond/route.ts'` | PASS | Revalidated changed source after rebasing onto `origin/main`. |
| Focused unit guardrail after person-id workflow fix | `cd /Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/submittals/__tests__/workflow-response-service.test.ts` | PASS | 1 suite, 9 tests passed; includes guardrail for responses assigned to linked `people.id`. |
| Browser/user-flow | `agent-browser --session submittal-browser-proof-3002b` against `http://127.0.0.1:3002/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248` | PASS | AI Review tab showed `Record Response`; clicking it removed the action after submit. Screenshot: `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/workflow-response-submitted.png`. |
| DB read-back after browser submit | Supabase REST read of `submittal_responses`, `submittals`, and `submittal_history` for synthetic submittal `7dfbccac-6ccf-4d69-8129-7de7918c5248` | PASS | Response `9a719db4-e656-45ea-9430-2fb6e671a883` persisted as `Revise and Resubmit`, comments included AI review context, `responded_at` set, submittal closed with `ball_in_court: null`, and `workflow_response_recorded` history stored `source: ai_review`. |
| Fresh browser error check | `agent-browser --session submittal-browser-proof-3002b errors --clear; agent-browser --session submittal-browser-proof-3002b reload; agent-browser --session submittal-browser-proof-3002b errors` | PASS | No fresh page errors after reload. |
| Activity visibility lint | `cd /Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx' src/lib/submittals/ai-review/response-comment.ts src/lib/submittals/ai-review/__tests__/response-comment.test.ts src/features/submittals/submittal-ai-review-panel.tsx src/features/submittals/submittal-detail-client.tsx` | PASS WITH WARNING | No errors. Existing page-shell design-system warning remains on the submittal page file. |
| Activity visibility unit guardrail | `cd /Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/submittals/ai-review/__tests__/response-comment.test.ts` | PASS | 1 suite, 4 tests passed for AI-review response comment build/parse/status recommendation. |
| Activity visibility browser proof | `agent-browser --session submittal-activity-proof` against `http://127.0.0.1:3002/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248` | PASS | Activity now renders AI Review summary, recommendation, and findings instead of raw saved context. Screenshot: `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/activity-ai-review-context-parsed.png`. |
| Activity inline context browser proof | `agent-browser --session submittal-activity-proof` against `http://127.0.0.1:3002/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248` | PASS | Older one-line AI Review comments now render without the raw `AI review response context:` prefix. Screenshot: `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/activity-ai-review-context-inline-parsed.png`. |
| Activity visibility fresh browser errors | `agent-browser --session submittal-activity-proof errors` | PASS | No fresh page errors after reload. |
| AI Review tab deep-link proof | `agent-browser --session submittal-activity-proof` against `http://127.0.0.1:3002/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248?tab=ai-review` | PASS | Deep-link opens the AI Review panel after load; Details removes `?tab=ai-review`; AI Review restores it. Screenshots: `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/tab-ai-review-deeplink-after-load.png`, `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/tab-url-switching.png`. |
| Original submittal recovery browser proof | `agent-browser --session submittal-activity-proof` against `http://127.0.0.1:3002/25125/submittals/b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f?tab=ai-review` | PASS | The user-provided submittal has searchable submittal text but no linked drawings; AI Review now shows `Link drawings in Details`, and clicking it opens Details with the Drawing selector. Screenshots: `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/original-ai-review-not-ready-recovery.png`, `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/original-ai-review-recovery-details.png`. |
| Migration ledger | `set -a; source /Users/meganharrison/Documents/alleato-pm/.env; source /Users/meganharrison/Documents/alleato-pm/frontend/.env.local; set +a; npm run db:migrations:verify-applied -- supabase/migrations/20260624153000_submittal_ai_review_runs_checks.sql` | PASS | Supabase migration ledger confirms `20260624153000`. |
| Contract verifier | `node --check scripts/verify/verify_submittal_ai_review_contract.mjs && node scripts/verify/verify_submittal_ai_review_contract.mjs` | PASS | Verifies AI Review route delegates to the shared service, no route-level raw model JSON parse, normalized run/check persistence, source references, and linked drawing delete scope validation. |
| Linked drawing delete guardrail | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/[drawingId]/__tests__/route.test.ts'` | PASS | Delete validates scoped submittal and scoped drawing before deleting; no delete is attempted when drawing scope validation fails. |
| Original submittal source-backed review | `cd frontend && node --require tsx/cjs <<'EOF' ... createSubmittalAIReviewService(...).runReview(25125, 'b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f', ...) ... EOF` | PASS | Linked A201 to the original submittal, ran AI Review, persisted run `3b3792a4-72f9-4471-9a81-97db1df30d4c` as `ready`; all readiness layers ready; source coverage `submittalDocumentCount=1`, `linkedDrawingCount=1`, `ragChunkCount=1`, `specSourceCount=4`; 4 checks saved. |
| Original submittal persisted read-back | Supabase service-role read of `submittals`, `submittal_linked_drawings`, `submittal_ai_review_runs`, and `submittal_ai_review_checks` for `b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f` | PASS | Compatibility cache is `ready`, A201 remains linked, latest normalized run has no error, and all 4 saved checks include source references. |
| Submittal document OCR/text coverage | `node scripts/verify/verify_submittal_document_text_coverage.mjs --project-id 25125 --limit 500 --fail-on-missing` | PASS | Project 25125 has 4 linked submittal documents and 4 searchable documents; missing text count is 0. No OCR backfill is currently needed for linked submittal documents. |
| Synthetic source-backed proof | `node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | PASS | Synthetic submittal still produces the expected high-severity finish conflict with ready drawing/spec/source layers. |
| Focused AI review suite | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath ... ai-review, workflow-response, linked-drawings, schemas, source-references, ops-ledger ...` | PASS | 8 suites, 19 tests passed after updating workflow-response route test for the service-role mutation client. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-review-workflow-action.md` - working done gate.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S97-submittal-ai-review-workflow-action.md` - verification handoff.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/workflow-response-service.ts` - shared workflow response writer.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/route.ts` - AI Review workflow action endpoint.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond/route.ts` - normal workflow response endpoint using same service-client mutation path.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/shell/route.ts` - project shell profile contract now includes `personId`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/users/me/profile/route.ts` - current profile contract now includes `personId`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-current-user-profile.ts` - current profile type now includes `personId`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/users/current-user-profile-server.ts` - current profile payload resolves linked `people.id`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts` - route guardrail tests.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-submittals.ts` - hook for AI Review workflow action.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-ai-review-panel.tsx` - quiet workflow action controls.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-detail-client.tsx` - pass workflow context into AI Review tab.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx` - server detail query now selects workflow history metadata so client source labels work on first render.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/response-comment.ts` - shared AI Review workflow response comment builder/parser/status recommender.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/__tests__/response-comment.test.ts` - parser/formatter/status guardrail tests.

## Risks / Gaps

- This does not add external email distribution or architect notification; it records the in-app workflow response only.
- Existing unrelated checkout dirt remains outside this task and is not owned by this work.
- Browser proof required port `3002` because another active worktree owned port `3001`; no code risk, but future proof should avoid assuming one fixed local dev port.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
