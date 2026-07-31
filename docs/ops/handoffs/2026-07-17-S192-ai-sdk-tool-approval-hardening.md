# Handoff: AAI-1150 AI SDK approval ownership repair

## Intake

- Session: `SROOT-AAI-1150-0722`
Task ID: AAI-1150
Task file: `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening.md`
- Linear: https://linear.app/megankharrison/issue/AAI-1150/harden-ai-sdk-multi-step-tool-approvals-and-assistant-surface
- Delivery lane: High-risk
- Status: Security boundary published; production route-limit remediation pending proof
- Migration ledger: Not applicable
Verification manifest: `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening.verification-manifest.json`
Verification result: `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/verification-result.json`

## What changed

- The full assistant route now owns full capability; the dedicated Ask Alleato route owns read-only capability. Request bodies no longer select permissions.
- Ask Alleato conversations are stored under `metadata.surface=ask_alleato`. The full route rejects those sessions, and the compact route rejects general sessions.
- The canonical `streamText` call now uses the registry-derived AI SDK `toolApproval` policy and encrypted `TOOL_APPROVAL_SECRET`.
- Exact `confirmed:true` write/delivery calls require signed approval. Side-effect-free `confirmed:false` previews remain non-authorizing and are never mutated after signing.
- Runtime-discovered MCP artifact writes require approval on the full surface and are absent on the compact surface.
- The direct confirmed-text change-event parser/executor path was deleted.
- Legacy `needsApproval` and `needsConfirmedWriteApproval` metadata was deleted across all AI tools and stale tests.
- The architecture verifier scans the complete AI tools tree and now blocks predeploy.
- The verifier also compares the `ai` runtime resolved by the server with the runtime resolved from `@ai-sdk/react`; version skew fails release because the older React runtime dropped signed approval capabilities.
- Follow-up AAI-1264 owns the broad prompt/schema/widget/executor migration needed to remove the remaining two-step preview UX without weakening Prime Contract SOV preview-token protection.
- Release localization found Vercel's generated-route ceiling had been crossed: the first AAI-1150 production build compiled, then failed at 2,060 / 2,048 routes. The first remediation correctly removed demo/prototype/gallery/test pages from production and the Assistant index, but production disproved the assumption that those static pages reduced the provider count: `dpl_56dekTjHfE2HQsJ1ZMgWXqVc3EhB` still failed at 2,060.
- The second remediation follows the measured boundary instead of hiding product routes: it deletes a broken duplicate planning page, folds capacity/profile/leveling operations into the existing scheduling resource owner, and folds lookahead/risk/trade reads into one scheduling report owner. Six dynamic source files are removed net, producing 654 dynamic files and an observed-formula estimate of 2,042 generated routes.

## Verification

- PASS: focused Jest, 7 suites / 54 tests.
- PASS: installed AI SDK 7.0.31 approve, deny, input tamper, call-ID tamper, tool-name tamper, and UI signature roundtrip, 6 / 6.
- PASS: targeted ESLint.
- PASS: changed type-debt gate, no new `any`.
- PASS: `npm run rag:verify:chat-architecture`, no failures or warnings.
- PASS: `npm run check:routes`.
- PASS: incident learning registry audit.
- PASS: Vercel readback shows encrypted `TOOL_APPROVAL_SECRET` in Production, Preview, and Development.
- PASS: independent security review after one rework cycle. The reviewer-found client-asserted surface escalation was fixed with route and conversation namespace binding.
- PASS: authenticated full Assistant approve created one exact RFI, database readback matched signed input, and exact-id cleanup returned count to zero.
- PASS: authenticated full Assistant deny at 390x844 created no row and reported denial explicitly.
- PASS: Ask Alleato desktop/mobile and direct-route write attempts withheld the RFI write tool and created zero rows.
- PASS: runtime skew reproduced at server `ai@7.0.31` versus React `ai@7.0.15`; frozen install aligned both to `7.0.31`, live approval passed, and the verifier now blocks recurrence.
- UNRELATED BASELINE FAIL: `npm run rag:verify:assistant-tool-registry` reports the identical 16 direct-tool registration findings on clean base `64275ab0`.
- UNRELATED BUILD DEBT: repo-wide typecheck fails outside all AAI-1150 files; local `pnpm build` exhausted a 7 GB heap without an AAI-1150 compile error.
- FAIL, LOCALIZED: production deployment `dpl_5mHWNn4p9SoghzZtWKWA5bQt6QHV` compiled, then Vercel rejected 2,060 generated routes against its 2,048 hard limit (`too_many_routes`, `process-and-upload-routes`).
- FAIL, FALSIFIED: the first source-file proxy passed locally but `dpl_56dekTjHfE2HQsJ1ZMgWXqVc3EhB` remained at 2,060 generated routes. Static exclusions do not relieve this limit.
- PASS, LOCAL CANDIDATE: `npm run verify:nonprod-routes` enforces 654 production dynamic source boundaries and estimates 2,042 generated routes using the observed Vercel expansion. Exact deployment is still pending.
- PASS: `npm run -s test:schedule:focused`, 10 suites / 42 tests after replacing stale deleted-suite paths.
- PASS: independent dynamic-boundary review after one rework cycle; the reviewer-found focused-suite drift, route-inventory drift, and semantic heading regression were fixed.
- PENDING: task-owned publication and production deployment/readback.

## Evidence

- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/verification.md`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/vercel-env-readback.txt`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening.verification-manifest.json`

## Failure analysis

- Cause: authorization ownership was split across tool metadata, legacy `confirmed` flags, client-generated text, a direct handler executor, an untrusted request-body surface, and two installed AI SDK runtimes whose approval-response behavior differed.
- Detection gap: unit tests bypassed the actual React runtime and the verifier missed split tool modules, MCP artifacts, session namespaces, client-to-server capability binding, installed runtime skew, and the production generated-route count.
- Prevention: server-owned routes plus conversation namespaces, one stream-level signed policy, an environment secret, complete-tree and runtime-alignment checks, real browser/DB evidence, AI SDK tamper tests, predeploy enforcement, and a measured dynamic-boundary budget. Static non-production exclusions remain hygiene only.

## Remaining work

1. Independently review and publish the dynamic-boundary consolidation to `origin/main`.
2. Verify its exact production deployment reaches Ready at or below the provider route limit, then prove the canonical authenticated route.
3. Keep AAI-1150 In Progress until AAI-1264 removes the remaining preview-plus-second-approval UX required by the original Linear acceptance.
