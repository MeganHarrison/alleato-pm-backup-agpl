# Task: AI SDK Tool Approval Hardening

Status: Blocked — production forensic audit failed
Owner: Codex SROOT-AAI-1150-0722
Created: 2026-07-17
Task ID: AAI-1150
Linear Issue: AAI-1150 https://linear.app/megankharrison/issue/AAI-1150/harden-ai-sdk-multi-step-tool-approvals-and-assistant-surface
Related Handoff: `docs/ops/handoffs/2026-07-17-S192-ai-sdk-tool-approval-hardening.md`

## Objective

Make every canonical assistant write or delivery call execute only after a cryptographically bound AI SDK v7 approval of the exact mutating payload, while keeping side-effect-free previews non-authorizing, making the compact Ask Alleato panel server-enforced read-only, and preventing legacy approval APIs or direct handler bypasses from returning.

## Scope

- Own the registry-derived approval policy, surface capability contract, approval-secret configuration, focused approval tests, architecture verifier, task evidence, and closeout control-plane records.
- The original security slice integrated with `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`. This forensic audit makes no product-code edits; follow-on handler ownership is split between AAI-1150's mutation-perimeter repair and AAI-1264's RFI loop deletion.
- Preserve the current side-effect-free preview contracts. Their separate UX consolidation is owned by AAI-1264 because removing `confirmed` spans schemas, prompts, widgets, executor contracts, and Prime Contract SOV stale-state tokens.
- Exclude WorkflowAgent approvals, specialist-internal subagent tools, prompt/schema migration, and unrelated AI dashboard or RAG behavior.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` plus AI SDK `streamText` and the assistant tool registry.
- Existing shared primitives/services: `frontend/src/lib/ai/tool-registry.ts`, `frontend/src/lib/ai/tools/**`, `frontend/src/components/ai-assistant/chat-area.tsx`, AI SDK `toolApproval`, `experimental_toolApprovalSecret`, and `lastAssistantMessageIsCompleteWithApprovalResponses`.
- Deprecated or parallel paths: tool-level `needsApproval` on `streamText` tools, text-generated `confirmed=true` execution prompts, and action-capable compact clients that do not render tool parts.

Verification contract: Required

## Acceptance Criteria

- [x] Registry write and delivery metadata produces `user-approval`; registered reads do not.
- [x] An approve response auto-resumes and executes the exact signed tool call once; deny executes nothing; altered name, call ID, or input fails closed.
- [ ] Every product mutation or external delivery requires signed approval of the exact payload. The registered AI SDK tool path enforces this, but the direct CMO workflow and delegated Microsoft mutation/delivery catalog bypass it; production also proved the RFI preview is not the immutable input to the later signed call.
- [x] Ask Alleato uses a dedicated server route and conversation namespace that force the read-only surface; request-body data cannot widen capability or reuse the compact session on the full route.
- [x] Missing approval-secret configuration fails loudly whenever action tools are enabled.
- [x] The architecture verifier discovers all AI tool modules and rejects legacy `needsApproval` usage on the canonical stream path.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred to AAI-1264 with a bounded ownership contract.
- [ ] One user approval performs the intended write without the legacy preview, typed confirmation, and second approval loop; AAI-1264 owns this still-open original acceptance requirement.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Planned owned paths:

- `frontend/src/lib/ai/tool-approval-policy.ts`
- `frontend/src/lib/ai/tool-registry.ts`
- `frontend/src/lib/ai/tools/**` approval metadata only
- `frontend/src/components/ask-alleato/useAskAlleatoChat.ts`
- `frontend/src/app/api/ask-alleato/chat/route.ts`
- `frontend/src/lib/ai/chat-surface.ts`
- `frontend/src/components/ai-assistant/chat-area.tsx` approval roundtrip only
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` approval integration from the completed security slice; the current audit documents but does not edit the remaining bypasses
- focused tests under `frontend/src/lib/ai/__tests__`, `frontend/src/components/ask-alleato/**`, and `frontend/tests/e2e/ai-assistant/**`
- `scripts/verify/verify_ai_chat_architecture.mjs`
- `frontend/scripts/build/nonprod-routes.json` and its verifier, because production crossed Vercel's hard generated-route ceiling during release
- `frontend/src/app/(main)/[projectId]/schedule/planning/page.tsx` and `frontend/src/components/scheduling/schedule-planning-workspace.tsx`, to remove the duplicate planning boundary left by a concurrent overwrite
- `frontend/src/app/api/projects/[projectId]/scheduling/resources/**`, `reports/**`, the superseded resource/report routes, and their direct clients/tests, to reduce dynamic boundaries without removing capability
- `frontend/package.json` and `frontend/src/components/layout/spacing.tsx`, to keep the canonical focused suite and semantic shared heading contract aligned with the consolidated owners
- `scripts/dev-tools/generate-project-map.mjs`, to keep production-excluded pages out of the Assistant's `findAppPage` index
- `frontend/src/lib/app-surface/search.ts`, `frontend/src/lib/ai/tools/app-help-tools.ts`, and `docs/architecture/AI-RAG-ARCHITECTURE.md`, to keep the route-discovery contract truthful after production exclusions
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening*`
- `docs/ops/handoffs/2026-07-17-S192-ai-sdk-tool-approval-hardening.md`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/**`
- S192 orchestration rows

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual authenticated full-assistant approve, deny, and automatic-resume flows are captured.
- [x] Ask Alleato read-only behavior is captured at desktop and mobile widths.
- [x] Signed approval tamper rejection is captured in a focused regression test.
- [x] Evidence artifacts are recorded and independently reviewed against the exact isolated worktree.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned route-remediation files are published and local `HEAD` equals `origin/main` at `b9fd86668ed9a55f5a9f9e04752619e03c665da8`.

## Failure-Loudly Contract

- Cause surfaced as: a named `AI_TOOL_APPROVAL_SECRET_MISSING` or SDK signature error, while cross-surface conversation reuse returns `RESOURCE_NOT_FOUND`; none silently widen capability or write.
- Detection path: focused approval tests, `npm run rag:verify:chat-architecture`, browser approval/denial flows, and verification-contract validation.
- Recovery path: configure the shared Vercel approval secret, retry from the full assistant, or open the full assistant when an action is requested from Ask Alleato.

## Incident Learning

- Failure fingerprint: `ai.chat-approval-boundary-drift`
- Root cause: Authorization ownership was split across preview-first `confirmed` state, tool-level `needsApproval`, a direct deterministic handler branch, and a client-selected surface. Live proof also found installed AI SDK runtime skew: the server used `ai@7.0.31`, while `@ai-sdk/react` used `ai@7.0.15`, whose approval response discarded the signature.
- Detection gap: The audit test called tool executors directly, its fake UI runtime used the server's `ai` version, and the verifier scanned obsolete monolithic paths. It did not exercise the actual React runtime, split write tools, MCP artifacts, or session namespaces.
- Prevention: One registry-derived policy, a required shared secret, server-owned capabilities, real browser approve/deny/readback proof, complete-tree static checks, and a predeploy assertion that the server and React resolve the same AI SDK runtime.
- Guardrail evidence: `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/verification.md`; focused approval tests and `npm run rag:verify:chat-architecture` pass, and the verifier is wired into predeploy.
- Release incident: Vercel compiled commit `095526dd380326fead71c7effc76b47f1f28cf3d` successfully, then rejected it with `too_many_routes`: 2,060 generated routes against the 2,048 hard limit. The prior Ready commit was already at the ceiling; one concurrent schedule page was the first deployment to fail at 2,051 routes.
- Release incident correction: the first remediation's 52 demo/prototype/test exclusions were valid product hygiene but did not reduce Vercel's generated-route count; deployment `dpl_56dekTjHfE2HQsJ1ZMgWXqVc3EhB` still failed at 2,060 / 2,048. Production evidence showed the count is driven by dynamic App Router source boundaries: a fixed observed cost of 80 plus three generated rules per production dynamic page or route file.
- Release prevention candidate: remove the broken duplicate `/[projectId]/schedule/planning` page, consolidate resource-capacity operations into the existing scheduling resource owner, and consolidate three read-only schedule summaries under one report owner. The fail-closed guard now budgets 654 production dynamic source files and an estimated 2,042 generated routes, leaving six rules of headroom. This remains a candidate—not a success claim—until the exact commit reaches Ready.

Before creating a new fingerprint, searched existing lessons with:

```bash
node scripts/ops/learning-registry.mjs lookup --symptom "AI tool approval can be bypassed or stall because the assistant uses legacy needsApproval and a compact client cannot render approval parts" --files frontend/src/lib/ai frontend/src/app/api/ai-assistant/chat frontend/src/components/ask-alleato scripts/verify/verify_ai_chat_architecture.mjs
```

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Forensic audit is isolated at current production/source commit `b9fd86668ed9a55f5a9f9e04752619e03c665da8`; no product-code paths are modified by this audit. |
| Historical pre-fix architecture | AI SDK v7 bundled docs and original repo inspection | Superseded baseline | The original slice reproduced legacy tool-level approvals and the compact-client stall. Current code rejects legacy `needsApproval` on the canonical path and server-pins Ask Alleato read-only; today's blockers are the direct CMO and delegated Microsoft perimeter gaps plus the unbound RFI preview/persistence contract. |
| Ownership check | Current isolated worktree and exact-file status | Pass | Only audit/task/evidence files are task-owned. The historical S186 handler hold is not the current blocker and no handler edits are being claimed. |
| Approval policy and surface tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/ai/__tests__/tool-approval-policy.test.ts src/lib/ai/__tests__/assistant-surface.test.ts` | Pass | 2 suites, 8 tests. |
| Signed AI SDK roundtrip | `cd frontend && pnpm exec tsx --test scripts/ai/__tests__/tool-approval-roundtrip.test.mjs` | Pass | 6 tests pass on `ai@7.0.31`: exact signed approve/auto-resume, deny no-write, input/name/call-ID tamper fail-closed, and UI signature preservation. |
| Targeted lint | `cd frontend && pnpm exec eslint src/lib/ai/tool-approval-policy.ts src/lib/ai/assistant-surface.ts src/lib/ai/__tests__/tool-approval-policy.test.ts src/lib/ai/__tests__/assistant-surface.test.ts src/components/ask-alleato/useAskAlleatoChat.ts` | Pass | No output. |
| Changed type-debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` debt. |
| Vercel secret readback | `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/vercel-env-readback.txt` | Pass | Encrypted variable present in Production, Preview, and Development. |
| Architecture verifier | `npm run rag:verify:chat-architecture` | Scoped pass | No failures or warnings for the registered AI SDK tool path, Ask route split, legacy `needsApproval`, and runtime-version checks. It does not inspect direct handler service writes or delegated backend tool catalogs; the generation ownership audit records that detection gap. |
| Runtime-skew guard | `npm run rag:verify:chat-architecture` before and after frozen install | Pass | Reproduced fail at server `7.0.31` / React `7.0.15`; passed after both resolved `7.0.31`. |
| Focused policy, surface, MCP, seam, compact client, namespace, and SOV tests | `cd frontend && pnpm exec jest --runInBand --runTestsByPath ...` | Pass | 7 suites, 54 tests; includes server-owned route capability, conversation namespace isolation, read-only MCP filtering, and preserved Prime Contract SOV stale-state behavior. |
| Vercel secret readback | `vercel env ls --cwd /Users/meganharrison/Documents/github/project-management` | Pass | `TOOL_APPROVAL_SECRET` is encrypted in Production, Preview, and Development; no secret value was printed. |
| Legacy registry verifier | `npm run rag:verify:assistant-tool-registry` | Unrelated baseline fail | Clean base `64275ab0` fails with the identical 16 unregistered read/write module errors; AAI-1150 neither introduces nor expands them. |
| Duplicate preview UX ownership | Linear AAI-1264 | Deferred by design | The prompt/schema/widget/executor migration is separately bounded; this security repair does not mutate a signed payload or weaken SOV preview-token protection to fake a one-click result. |
| Linear handoff check | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-17-S192-ai-sdk-tool-approval-hardening.md` | Pass | Blocked-state handoff satisfies the control-plane contract. |
| Full assistant browser | `desktop-rfi-approved-created.png`, `mobile-rfi-denied-no-run.png`, and `database-readback.json` | Pass | Signed approval created exactly one row; denial created none; scoped cleanup returned approved row count to zero. |
| Compact Ask desktop/mobile | `desktop-ask-alleato-read-only.png`, `mobile-ask-alleato-read-only.png`, and `database-readback.json` | Pass | Dedicated compact route withheld RFI write capability and both exact subjects had row count zero. |
| Compact first-turn regression | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/components/ask-alleato/__tests__/useAskAlleatoChat.test.tsx` | Pass | Stable UI chat id prevents the backend session transition from resetting first-turn state. |
| Compact Ask response | `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/browser/ask-alleato-first-pass.png`, `browser/ask-alleato-first-pass-mobile.png` | Pass | Fresh first request sent the read-only surface, returned HTTP 200, and displayed user plus assistant text at desktop and mobile widths. |
| Dynamic scheduling ownership tests | `cd frontend && npm run -s test:schedule:focused` | Pass | 10 suites / 42 tests preserve roster, capacity, profile replacement, leveling preview, lookahead, risk, trade behavior, exports, alerts, and semantic headings; unsupported modes fail loudly. |
| Dynamic route budget | `npm run verify:nonprod-routes` plus Vercel `dpl_Ert7hKiA9nz8oNiaeomhAMLd6Rqm` | Pass | 654 production dynamic source files; observed-formula estimate 2,042 generated routes; exact deployment reached Ready. |
| Generated maps | `npm run map:project -- --check-only` and `npm run map:system -- --check-only` | Pass | Planning duplicate and superseded APIs are absent; consolidated resources/reports owners are current. |
| DB inventory generator | `npm run db:inventory` | Unrelated baseline fail | Live schema has 18 tables missing from `docs/architecture/tables.yaml`; changed route reference entries were updated directly and the stale route paths are absent. |
| Exact production deployment | Vercel `dpl_Ert7hKiA9nz8oNiaeomhAMLd6Rqm` | Pass | Commit `b9fd86668ed9a55f5a9f9e04752619e03c665da8` reached Ready and the canonical alias served the authenticated test. |
| Exact-field RFI request | `production-intent-mismatch.png` and `production-forensic-readback.json` | Fail | Production discarded the supplied subject and question and selected `deterministic-rfi-preview-router`. |
| Cancellation | `production-cancel-repreview.png` and DB readback | Fail | `Do not create ... Cancel it` matched the same positive keyword router and regenerated the preview; zero RFI rows were written. |
| Production signed approve | pending/completed screenshots and DB readback | Partial | The signature boundary created exactly one approved row and scoped cleanup returned the count to zero, but the signed payload differed from the preview payload. |
| Production signed deny | pending/completed screenshots and DB readback | Pass | Denial executed no write and the exact subject count remained zero. |
| Generation ownership audit | `docs/architecture/AI-ASSISTANT-GENERATION-OWNERSHIP-AUDIT.md` | Fail | The CMO path writes product tables before AI SDK approval; the Microsoft delegated runtime exposes mutation/delivery tools outside the signed frontend boundary and `render.yaml` enables urgent Teams auto-alert delivery; route/fallback metadata is inconsistent. |
| Forensic audit independent review | `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/independent-review.md` | Pass for audit accuracy; product remains blocked | Reviewer verified the inventory, production proof, bypasses, and deletion plan after stale acceptance/verifier language was corrected. |

## Remaining Risk

- The route-budget remediation reached Ready, but canonical production proof falsified the original one-approval and intent-fidelity acceptance requirement.
- The direct CMO write branch and delegated Microsoft mutation/delivery tools sit outside the shared signed approval boundary. AAI-1150 cannot close until the mutation perimeter is complete.
- The deterministic RFI preview is not bound to the later signed write. Production proved the preview and executed payload can differ.
- Approval auto-resume duplicates the user turn in `chat_history` and persists a false empty-response row while approval is pending.
- The canonical shared checkout contains unrelated user/session dirt, so this audit remains isolated and must publish only the named task-owned files after an explicit remote-main comparison.
- Workflow remains excluded. AAI-1264 owns the RFI preview-loop deletion; AAI-1150 remains open for the direct CMO and delegated Microsoft mutation perimeter exposed by the broader audit.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked in `docs/architecture/AI-ASSISTANT-GENERATION-OWNERSHIP-AUDIT.md`.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action in AAI-1264 and the ownership audit.
