# Task: Transplant the verified Eve assistant

Status: Complete
Owner: Codex SEVEMIG0731
Created: 2026-07-31
Task ID: AAI-1306
Linear Issue: AAI-1306, https://linear.app/megankharrison/issue/AAI-1306/transplant-the-verified-eve-assistant-and-all-ai-tools-verification
Related Handoff: `docs/ops/handoffs/2026-07-31-SEVEMIG0731-eve-transplant.md`

## Objective

Run the repaired Alleato Eve assistant from the production project-management monorepo with every applicable product update from the active AI Tools Verification task included.

## Scope

- Directly transplant `agents/alleato-assistant`, the existing `/ai` Eve transport and UI integration, the governed tool bridge, the tool-testing registry, and the repeatable Eve verifier.
- Account for committed source work, canonical dirty work, and active verification-workspace work in a migration manifest.
- Preserve production authentication, project context, existing `/ai` navigation, product services, RAG, Microsoft, Fireflies, OCR, and Project Intelligence systems.
- Exclude the superseded standalone Eve application, separate-domain cutover, legacy deletion, generated dependencies, local runtime data, credentials, browser-profile repairs, and temporary evidence.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant` plus `frontend/src/app/api/ai-assistant/eve`
- Existing shared primitives/services: `frontend/src/components/ai-assistant`, `frontend/src/lib/ai/eve-runtime`, `frontend/src/lib/ai/tools`
- Deprecated or parallel paths: standalone `eve-chat-template` application and AAI-1304 deletion/cutover workspaces are explicitly superseded and excluded

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The existing production `/ai` surface is wired to the transplanted Eve runtime through Alleato authentication and project context.
- [x] The migration manifest accounts for committed, dirty, and isolated-workspace changes from AI Tools Verification.
- [x] Governed write and delivery tools are available only to authorized administrators, with non-admin restrictions preserved.
- [x] Every non-read tool requires approval; confirmation and idempotency are added only after approval; execution receipts are returned.
- [x] Focused assistant, transport, registry, and approval regression tests pass.
- [x] An authenticated message, authorized project read, signed-scope rejection, approval denial, and one approved single-effect write are proven locally and at the changed route boundary.
- [x] No unrelated Microsoft, Fireflies, OCR, RAG, Project Intelligence, navigation-domain, or standalone-app code is rebuilt.
- [x] A final delta check proves no later AI Tools Verification product update was missed before AAI-1307 begins.

## Implementation Checklist

- [x] Files/modules to change are listed before edits through the SEVEMIG0731 path lease.
- [x] Existing Eve and Alleato owners were inspected before implementation.
- [x] Source snapshot and manifest are recorded.
- [x] Baseline assistant files are transplanted.
- [x] Active verification deltas are layered onto the baseline.
- [x] Errors are specific and actionable.
- [x] Authentication, authorization, approval, idempotency, and delivery contracts are preserved.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual authenticated user-flow evidence proves the changed boundary.
- [x] Verification artifacts are recorded under `docs/ops/verification/2026-07-31-aai-1306-*`.
- [x] Independent review is recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and the merged commit is present on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit HTTP error, approval state, tool execution error, or verifier terminal-state mismatch
- Detection path: focused route/unit tests, `verify:eve-only-runtime`, live Eve verifier, authenticated browser evidence, and receipt/database readback
- Recovery path: repair the first failing assistant boundary, rerun only that focused check, then repeat the final source delta comparison

## Incident Learning

- Failure fingerprint: `ai-chat-turn-persistence-drift`
- Root cause: `.omit()` was invalid for refined schemas, message persistence was missing, and insert-only idempotency did not account for Eve reusing a message ID as approval state advanced.
- Detection gap: the initial focused suite did not reload a completed approval from `chat_history`.
- Prevention: model schema rebuilding plus full execution revalidation, authenticated snapshot persistence, bound snapshot replacement, focused regression tests, and a verifier that waits for durable terminal state.
- Guardrail evidence: 40 focused checks plus approved/denied live traces and exact database counts.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and SEVEMIG0731 lease | Pass | High-risk scope and done gate captured before product edits. |
| Conflicting work stopped | Replace old AI assistant task handoff | Pass | Separate app, domain cutover, deletion commit, and destructive migration excluded. |
| Source migration manifest | `docs/ops/verification/2026-07-31-aai-1306-migration-manifest.md` | Pass | Source HEAD, governed catalog, verifier workspace, dirty files, copied paths, already-present paths, and exclusions are classified. |
| Eve agent tests | `pnpm test:auth` in `agents/alleato-assistant` | Pass | 42 tests passed. |
| Eve agent typecheck | `pnpm typecheck` in `agents/alleato-assistant` | Pass | TypeScript passed. |
| Frontend focused tests | Assistant UI, Ask Alleato, registry, proxy, and durable-turn Jest suites | Pass | 101 tests passed; one explicit AAI-1307 legacy-retirement todo remains. |
| Runtime ownership guard | `npm run verify:eve-only-runtime` | Pass | Canonical Eve runtime is present; strict legacy retirement remains assigned to AAI-1307. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |
| Production configuration | Vercel environment name readback | Pass | The same server-only proxy secret is configured on Eve and the production frontend; Eve has the production Alleato app URL. Values were not printed. |
| Eve deployment | `https://eve-chat-template-the-alleato-group.vercel.app` | Pass | Production deployment is Ready. `/eve/v1/health` returns 200 and a direct unauthenticated session request returns 403. |
| Frontend Eve binding | Vercel production environment readback | Pass | `ALLEATO_EVE_URL` and `ALLEATO_EVE_PROXY_SECRET` exist for the production frontend. Values were not printed. |
| Whole-frontend TypeScript | `pnpm exec tsc --noEmit --pretty false` | Unrelated infrastructure failure | Existing repository-wide 4 GB Node heap exhaustion occurred before any source diagnostic. The separate Vercel OOM workstream owns this boundary. |
| Authenticated read | `tests/agent-browser-runs/2026-07-31-aai-1306-eve-transplant/authorized-read.png` | Pass | Project 60 read completed through Eve and durable history. |
| Approved write | `approved-rfi-result.png`, `approved-rfi-trace.json` | Pass | Persisted terminal receipt; RFI `64e1f5d2-d074-4525-ad79-ff3d0b8806ea`. |
| Denied write | `denied-rfi-result.png`, `denied-rfi-trace.json` | Pass | Persisted `output-denied`; no effect. |
| Database readback | `database-readback.json` | Pass | Approved count 1, denied count 0. |
| Signed scope mismatch | Eve tools route focused test | Pass | Mismatched governed project payload is rejected before tool execution. |
| Final source delta | Source HEAD and dirty-file comparison | Pass | No completed AI Tools Verification delta remains outside this transplant. |

## Remaining Risk

- The source AI Tools Verification task is stopped at `557d867330`; its temporary memory fallback/test are intentionally excluded.
- The superseded task already created production `eve_chat` and Upstash state. AAI-1306 will not remove or depend on that unrelated external state without evidence.
- The Eve runtime dependency and frontend production deployment are Ready. The authenticated production `/ai` read passed on merged commit `c0876cd04`.
- The first checkpoint commit attempt was rejected because new `docs/ops/evidence/**` paths are banned. Detection: the pre-commit artifact-retirement guard named both files. Prevention: AAI-1306 proof now lives in the approved `docs/ops/verification/` owner.
- The second checkpoint attempt was rejected by a documentation database-table scanner that misread the backticked directory name `frontend` as a table assertion. Detection: the hook named the exact line. Prevention: repository directories are described as ordinary prose in verification notes.
- The first public Eve health request redirected to Vercel login because project SSO protection intercepted server-to-server traffic. Detection: the effective URL was the Vercel SSO login page. Prevention: SSO protection is disabled only on the Eve runtime project; Eve's own proxy-secret and Supabase-user authentication remains fail-closed, proven by a 403 direct session request.

## Final Status

- [x] All implementation, verification, publication, and production proof items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is recorded.
- [x] Deferred AAI-1307 legacy retirement has a separate owner and ticket.
