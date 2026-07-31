# AAI-1150 verification

Status: Release candidate; local authenticated proof complete, production proof pending
Base commit: `64275ab0e216d065d992365da63be8901d0c7897`

## Outcome

The repaired ownership boundary works in the running application. The full Assistant executed one exact signed RFI write after approval, denial executed no write, and Ask Alleato remained read-only. The approved test row was removed by exact id after readback.

During browser verification, approval initially failed closed because the server resolved `ai@7.0.31` while the stale local `@ai-sdk/react` installation resolved `ai@7.0.15`. That older client implementation discarded the signature when constructing the approval response. A frozen-lockfile install aligned both runtimes to `7.0.31`; the same live flow then passed. The architecture verifier now rejects that runtime mismatch before release.

## Proven boundaries

- `/api/ask-alleato/chat` forces read-only capability and accepts only `ask_alleato` conversations. `/api/ai-assistant/chat` forces full capability and rejects `ask_alleato` sessions. Request-body data cannot widen capability.
- Ask Alleato excludes registry write/delivery tools, deterministic action paths, and MCP artifact-write tools.
- Full-assistant mutating calls use registry-derived `toolApproval` plus `experimental_toolApprovalSecret`.
- Approve resumes and executes the exact signed input once. Deny executes nothing. Altered input, tool name, or call ID fails closed.
- The direct confirmed-text handler bypass is deleted; no AI tool contains legacy `needsApproval` metadata.
- The predeploy architecture verifier scans the complete AI tool tree and asserts that server and React resolve the same `ai` runtime.

## Verification results

| Check | Result |
| --- | --- |
| Focused Jest: policy, surface, route/namespace, compact client, MCP, handler seam, Prime Contract SOV | PASS, 7 suites / 54 tests |
| Installed AI SDK roundtrip | PASS, 6 / 6 tests |
| Authenticated full Assistant approve | PASS, UI completed; exact DB row count 1 before cleanup and 0 after cleanup |
| Authenticated full Assistant deny | PASS, explicit denied state; exact DB row count 0 |
| Authenticated Ask Alleato desktop/mobile | PASS, write capability unavailable; two exact DB subject counts 0 |
| AI runtime-skew detection | PASS, reproduced 7.0.31/7.0.15 failure and verified aligned 7.0.31/7.0.31 pass |
| Architecture verifier | PASS, no failures or warnings |
| Targeted ESLint | PASS |
| Changed type-debt gate | PASS, no new `any` |
| Route conflict check | PASS |
| Predeploy shell syntax | PASS |
| Learning registry audit | PASS, 25 fingerprints |
| Vercel environment readback | PASS, encrypted secret present in Production, Preview, Development |
| Independent review | PASS after one rework cycle and final runtime-guard re-review; no blockers |
| Assistant tool-registry verifier | BASELINE FAIL, identical 16 unregistered-module errors on clean base `64275ab0` |
| First production deployment | FAIL after successful compile: Vercel `too_many_routes`, 2,060 generated routes / 2,048 limit at deployment `dpl_5mHWNn4p9SoghzZtWKWA5bQt6QHV` |
| First production route-budget hypothesis | FAIL: 52 non-production exclusions were valid hygiene, but exact deployment `dpl_56dekTjHfE2HQsJ1ZMgWXqVc3EhB` remained at 2,060 / 2,048 because static pages were not the provider-count driver |
| Dynamic route-budget guard | PASS locally: 654 / 654 production dynamic source files and observed-formula estimate 2,042 / 2,042 generated routes; exact production count remains pending |
| First route-limit remediation independent review | SUPERSEDED: it proved the exclusions were legitimate but reviewed a source-file proxy that production subsequently falsified |
| Dynamic-boundary consolidation independent review | PASS after one rework cycle: stale focused-suite paths, route inventory drift, and semantic heading regression were fixed; no task-related findings remain |
| Production deployment/readback | PENDING |

## Evidence

- `action-log.txt`
- `database-readback.json`
- `negative-path.txt`
- `regression-test.txt`
- `summary.md`
- `visual-review.md`
- Desktop screenshots: signed approval, expanded controls, completed write, denial, Ask read-only.
- Mobile screenshots: signed approval, expanded controls, denial, Ask read-only.
- `vercel-env-readback.txt`

## Deliberate non-claim

The legacy preview UI still makes the user review a preview, reply `confirm`, and then approve the signed SDK call. It is no longer an authorization bypass, but it is still a poor two-decision UX. AAI-1264 owns the prompt/schema/widget/executor migration required to make it one decision without mutating signed inputs or weakening Prime Contract SOV stale-state protection.

Workflow is not recommended for this interactive boundary. It remains a later candidate only for durable, resumable background jobs such as progress-report enrichment after the Assistant ownership repair is released.

## Unrelated baseline debt

`npm run rag:verify:assistant-tool-registry` fails on both this workspace and clean base `64275ab0` with the same 16 direct-tool registration findings across `asrs-intelligence.ts`, seven read modules, and eight split write modules. Repo-wide typecheck has existing failures outside AAI-1150 files, and a local production build exhausted a 7 GB heap without an AAI-1150 compile error. Neither is silently counted as task evidence.
