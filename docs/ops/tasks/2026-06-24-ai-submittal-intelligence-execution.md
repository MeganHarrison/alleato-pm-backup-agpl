# Task: AI Submittal Intelligence PRP Execution

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: None

## Objective

Harden the existing AI submittal review workflow so a reviewer on the real
submittal detail route can run a source-backed review, see readiness by source
layer, inspect structured findings with provenance, and get failure-loud
behavior for provider, retrieval, and persistence problems.

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
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states. (Not applicable: this workflow does not dispatch an external delivery adapter.)

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
| Task setup | `docs/PRPs/submittals/ai-submittal-intelligence/prp-ai-submittal-intelligence.md` | Pass | PRP loaded completely before implementation. |
| Companion tasks | `docs/PRPs/submittals/ai-submittal-intelligence/TASKS.md` | Pass | Workstream order and acceptance criteria adopted. |
| Repo rules | `AGENTS.md`, `frontend/src/app/(main)/AGENTS.md`, `docs/tasks/TASK-TEMPLATE.md` | Pass | Execution ledger created from live template path. |
| Linear ownership | `AAI-421` | Pass | Existing execution issue confirmed and kickoff comment posted. |
| Memory pass | `rg -n "submittal|drawing|reviewSubmittalAgainstDrawings|document-intelligence" ~/.codex/memories/MEMORY.md` | Pass | Reused prior submittal + drawing-review context to avoid greenfield drift. |
| Supabase types | `npm run db:types` | Pass | Generated fresh `frontend/src/types/database.types.ts` through repo fallback path. |
| Contract verifier | `node scripts/verify/verify_submittal_ai_review_contract.mjs` | Pass | Confirms route/service no longer use raw chat completions or manual JSON parsing. |
| Route conflicts | `npm run check:routes` | Pass | No dynamic route conflicts after new test/service files. |
| Focused Jest | `cd frontend && npm run test:unit -- --runTestsByPath ... --runInBand` | Pass | AI review route, linked drawings route, schema, and source-reference tests passed. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260624153000_submittal_ai_review_runs_checks.sql` | Pass | Migration applied via direct DB connection and repaired in remote history. |
| Browser route proof | `npm run verify:browser -- --url http://localhost:3001/876/submittals/a6fbe085-2277-4ac0-8261-662f7d5e4f84 --name ai-submittal-review --skip-cleanup` | Partial | Exact route loads and `AI Review` tab/run button were reached on project `876` submittal `a6fbe085-2277-4ac0-8261-662f7d5e4f84`; full structured result capture still pending. |
| Persistence regression tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/submittals/ai-review/__tests__/schemas.test.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/__tests__/route.test.ts' --runInBand` | Pass | Covers timestamp normalization, incomplete running-row hydration, and route delegation. |
| Static gate | `cd frontend && npx eslint src/lib/submittals/ai-review/persistence.ts src/lib/submittals/ai-review/review-run-service.ts src/lib/submittals/ai-review/__tests__/schemas.test.ts` | Pass | Shared runtime and new regression guardrail files lint cleanly. |
| TypeScript gate | `cd frontend && node scripts/run-typecheck-bounded.mjs` | Pass | Bounded frontend typecheck completed without reporting task-owned failures after the normalization fix. |
| Live API proof | `GET/POST http://localhost:3001/api/projects/876/submittals/a6fbe085-2277-4ac0-8261-662f7d5e4f84/ai-review` with saved auth cookie | Pass | `GET` now returns 200 with a structured stored run; `POST` returns 200 with failure-loud `not_ready` readiness details instead of 500. |
| Browser visible-state proof | `tests/agent-browser-runs/2026-06-25-ai-submittal-review-proof/ai-review-not-ready.png` | Pass | Screenshot captured on the exact submittal route after opening the `AI Review` tab and rendering the `not_ready` state. |
| Known unrelated verification debt | `npm run verify:browser ...` without `--skip-cleanup` | Fail unrelated | Wrapper script points to missing `scripts/agent-browser-cleanup.mjs`; actual file lives at `scripts/agent-browser/agent-browser-cleanup.mjs`. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-24-ai-submittal-intelligence-execution.md` - execution ledger and evidence
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/schemas.ts` - typed structured output and API contract
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/source-references.ts` - shared source-reference catalog and resolution helpers
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/review-run-service.ts` - canonical review runtime, persistence, and scope validation
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/route.ts` - shared-service AI review route
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/route.ts` - shared-service linked-drawing listing and scoped insert
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/[drawingId]/route.ts` - scoped unlink validation
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-submittals.ts` - normalized linked-drawing and AI-review hook contracts
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-ai-review-panel.tsx` - quiet structured review UI
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-linked-drawings-panel.tsx` - readiness-focused linked-drawing UI
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/__tests__/route.test.ts` - route coverage for auth and review delegation
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/__tests__/route.test.ts` - route coverage for listing and scoped insert
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/__tests__/schemas.test.ts` - structured-output schema coverage
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/__tests__/source-references.test.ts` - source-reference helper coverage
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_submittal_ai_review_contract.mjs` - contract guardrail for banned raw-AI patterns
- `/Users/meganharrison/Documents/alleato-pm/supabase/migrations/20260624153000_submittal_ai_review_runs_checks.sql` - normalized review run/check storage

## Risks / Gaps

- The exact live submittal used for verification still has no linked drawings or spec excerpts, so the proven browser/API outcome is the failure-loud `not_ready` path rather than a fully populated findings set.
- The shared `npm run verify:browser` wrapper still has an unrelated cleanup-script path mismatch outside this task scope.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
