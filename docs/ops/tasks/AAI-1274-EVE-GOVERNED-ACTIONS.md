# Task: Governed Eve Actions and Ownership Cleanup

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1274
Linear Issue: [AAI-1274](https://linear.app/megankharrison/issue/AAI-1274/execute-one-signed-app-action-proposed-by-eve)
Related Handoff: N/A, single-session delivery

## Objective

Enable one production-grade Eve mutation path whose exact payload is authorized,
approved once, executed idempotently, and returned with an immutable receipt,
while removing legacy paths that contradict the Eve-only and durable RAG
ownership contracts.

## Scope

- Native Eve 0.27.13 tool approval and durable resume for authenticated app writes.
- Request-scoped permission, user, project, session, and tool binding.
- Exact-payload idempotency and receipt enforcement for the first supported action.
- Removal of stale generator verifiers and unreachable meeting-memory extraction.
- Removal of direct compatibility-route callers and database-side HTTP dispatch.
- Truthful help/catalog generation with fail-loud zero-source validation.
- Explicit exclusion: ASRS/FMDS tools and unrelated project-management workflows.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant` for generation; the
  existing Next.js production tool registry and services for app data mutations;
  Vercel Workflow for post-persistence RAG ordering.
- Existing shared primitives/services:
  `frontend/src/lib/ai/eve-runtime/production-tool-registry.ts`,
  `frontend/src/lib/ai/tools/write/action-tool-internals.ts`,
  `frontend/src/components/ai-assistant/chat-area.tsx`.
- Deprecated or parallel paths:
  FastAPI `/api/pipeline/process`, database `pg_net` pipeline dispatch,
  deleted frontend generator verifiers, unreachable meeting-memory extraction.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Eve advertises only tools authorized for the authenticated caller and pinned project.
- [x] Every Eve write uses native durable `input.requested` approval and cannot execute before approval.
- [x] The displayed proposal, approved request, executed tool input, and receipt identify one exact immutable payload.
- [x] One approval produces exactly one write and one receipt; retry/reconnect/replay cannot duplicate the effect.
- [x] Denial, cancellation, tampering, stale state, missing permission, and missing project produce zero writes and specific recoverable errors.
- [x] The app UI renders and answers Eve approval requests through `inputResponses`.
- [x] The unreachable direct-key meeting-memory helper and its dead tests are removed.
- [x] No supported caller uses FastAPI `/api/pipeline/process`; the route is removed after caller proof.
- [x] Supabase retains required ingestion-job bookkeeping without database-side HTTP dispatch.
- [x] Help/catalog generation fails on missing or zero source content and generated copy states Eve's actual capabilities.
- [x] Focused tests, authenticated browser proof, live database readback, deployment readback, and independent review pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, approval, idempotency, and receipt contracts are enforced.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: stable error code and actionable message at the first failed boundary.
- Detection path: Eve evals and route tests for authorization/approval/replay,
  database readback for trigger/receipt state, and browser evidence for approval UI.
- Recovery path: retry only with the same idempotency-bound payload or start a new
  proposal after permissions/project/stale state are corrected.

## Incident Learning

- Failure fingerprint: Eve approval resumed without a matching tool output and
  OpenAI rejected the durable history with `No tool output found for function call`.
- Registry disposition: N/A. The prevention is enforced in the version pin and
  release evidence contract rather than a symptom-only workaround.
- Root cause: Eve 0.22.6 did not produce valid approved-tool history during the
  deployed durable resume. Separately, legacy owners had been disabled or
  deleted without removing every caller, verifier, generated claim, and
  database dispatch.
- Detection gap: Existing guards mocked approval and checked source ownership,
  but did not execute a deployed approve/deny roundtrip with database readback.
- Prevention: Eve, AI SDK, and OpenAI provider versions are pinned to the
  deployed passing combination. The release contract now requires one denied
  proposal, one approved proposal, exact-row readback, and the successful audit
  receipt in addition to the fail-closed ownership suite.
- Guardrail evidence: governed Eve route/RFI tests, the Eve-only verifier,
  the 9/9 workflow ownership contract, the live DB suspension guardrail, and
  non-empty generated help verification recorded in the Evidence table.

Before creating a new fingerprint:

```bash
node scripts/ops/learning-registry.mjs lookup --symptom "Eve write approval or duplicate pipeline owner remains after cutover" --files agents/alleato-assistant,frontend/src/app/api/ai-assistant/eve,backend/src/api/main.py,supabase/migrations
```

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Acceptance and failure-loudly contract captured before implementation and closed with live evidence. |
| Eve agent contract | `npm run test:auth`; `npm run typecheck` in `agents/alleato-assistant` | Pass | 41/41 tests; native approval, signed bridge, durable binding, and no persisted bearer token. |
| Governed route and write | focused Jest route and RFI write suites | Pass | 17/17 tests for permission, exact payload, tamper denial, receipt, reservation, and replay. |
| Eve-only runtime | `npm run verify:eve-only-runtime` | Pass | Canonical generation owner and retired-path guardrails confirmed. |
| Governed verifier | `node scripts/verify/verify_ai_feature_request_fast_path.mjs` | Pass | Repointed from deleted frontend generator to the live Eve contract. |
| Workflow ownership | `node --test scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs` | Pass | 9/9; FastAPI ingress absent and all operational callers use Vercel Workflow. |
| Backend syntax | `python -m py_compile ...` | Pass | FastAPI and Fireflies cleanup compile. Full pytest is unavailable in the default Python environment. |
| Live trigger readback before migration | read-only PostgreSQL query | Fail as expected | Old HTTP dispatcher was enabled and bookkeeping replacement was absent. |
| Migration application | direct transaction plus Supabase ledger insert | Pass | Version `20260730131500` applied to configured production database. |
| Live trigger readback after migration | `node --env-file=frontend/.env.local scripts/verify/verify-db-pg-net-suspensions.mjs` | Pass | HTTP dispatcher and `pipeline_url` absent; bookkeeping trigger enabled. |
| Generated help | `node scripts/docs/generate-app-expert-artifacts.mjs` | Pass | 364 routes, 60 articles, and 372 features; zero-source generation now fails. |
| Public docs | `https://docs.alleatogroup.com/architecture/ai-platform` | Pass | Rendered copy states governed RFI only, Ask Alleato read-only, and other writes unavailable. |
| Eve runtime upgrade | pinned `eve@0.27.13`, `ai@7.0.42`, `@ai-sdk/openai@4.0.24`; `test:auth`, `typecheck`, `eve build` | Pass | 41/41 tests and production build pass; `d9241b86588b108db4ce0e7f2d108ba728710d50` is published on `origin/main`. |
| Live denial | `AAI-1274-live-approval-denial.png`; authenticated `/ai` session | Pass | Denied `createRFI` proposal created zero matching RFI rows. |
| Live approval UI | `AAI-1274-live-approved-receipt.png`; authenticated `/ai` session | Pass | UI reported `Create RFI Completed`, RFI #2, and `Durable receipt: Recorded successfully`. |
| Live RFI readback | authenticated `GET /api/projects/1142/rfis` | Pass | Exactly one matching row: `963ea818-ef15-4eb8-80b6-30d4fe2b6a7b`, project 1142, status open, expected creator. |
| Live receipt readback | service-role read of `ai_tool_write_audits` | Pass | Exactly one matching successful receipt: `66ff34b7-122a-4a1d-a83b-e25353e77861`, bound to the same user, project, tool, idempotency key, and RFI ID. |
| Deployment readback | app deployment `dpl_AzSEF665ehPWaQqq3N8LZHo7YY1L`; Eve deployment `dpl_DsyqyGbQFfsgTcDqEHGQuYS4uVTF` | Pass | App served commit `0f9d79fe3066735f2353ac6615c156d077241616`; Eve 0.27.13 production alias executed the approved mutation. |
| Architecture truth | `pnpm exec markdownlint-cli2 --no-globs docs/architecture/RAG-PIPELINE-OWNERSHIP.md` | Pass | The stale remaining-cleanup table is now a truthful completed disposition record. |
| Independent review | read-only reviewer plus verification agent | Pass | No security blocker; deployed denial, approval, row, and receipt evidence close the prior conditional release. |

## Remaining Risk

- `createRFI` is the only live Eve mutation. Every other write tool remains
  intentionally unavailable until it implements the same permission, native
  approval, exact-payload, idempotency, and receipt contract.
- Supabase type generation remains blocked by an invalid legacy `sbp_` CLI
  token and no installed Docker/Podman runtime. Existing generated types were
  inspected and the live database proved the required
  `ai_tool_write_audits` and `rfis` contracts.
- `pnpm install` reports the pre-existing Nitro/Jiti peer-version warning. The
  pinned runtime typechecks and builds successfully; a future Nitro toolchain
  update must keep the same build and deployed approval smoke test.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
