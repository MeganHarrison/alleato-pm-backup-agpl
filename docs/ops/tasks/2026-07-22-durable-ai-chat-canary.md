# Durable AI chat canary

Delivery lane: High-risk

## Objective

Create an isolated AI chat at `/ai-workflow` that runs each turn through Vercel Workflow, reuses Alleato's canonical prompt/model/tool owners, survives a browser refresh, and cannot duplicate a submitted turn.

The current `/ai` implementation stays unchanged during the canary. If the canary passes user validation, the follow-up cutover must remove the replaced implementation so only one production assistant remains.

## Source pattern

The control flow is adapted from the copied Vercel examples in `ai-sdk-workflow-patterns/workflows/`: a deterministic workflow orchestrates explicit steps, while the AI and tool work runs inside a step with full Node.js access. Runtime tool implementations are not copied; the canary imports the existing Alleato registry.

## Acceptance contract

- [x] `/ai-workflow` is a separate authenticated route and `/ai` has no product-code changes.
- [x] The canary creates and loads only conversations marked `surface: durable_ai`.
- [x] A submitted message creates exactly one durable turn, even if the POST is repeated with the same client message ID.
- [x] The workflow streams AI SDK UI messages and returns an `x-workflow-run-id` header.
- [x] Refreshing during a run reconnects to that run without resubmitting the user message.
- [x] The workflow imports the canonical strategist prompt, model provider, registered tools, action tools, and configured MCP tools.
- [x] Action tools retain their existing approval contracts and the generation step is not automatically retried after an external side effect.
- [x] Failures expose the workflow run ID and failing stage, and are persisted in the turn ledger.
- [x] Focused route, ownership, idempotency, and reconnection tests pass.
- [x] `npm run check:routes` passes.
- [x] Authenticated desktop and mobile browser evidence proves one normal response and one real tool call.
- [x] An independent reviewer returns no unresolved high-severity issue.
- [ ] Preview deployment evidence identifies the exact branch commit.

## Noise gate

- Primary user: an authenticated Alleato operator.
- Primary job: ask an operational question and execute governed actions without losing the response when the connection drops.
- Primary decision: whether the durable runtime is reliable enough to replace the current assistant.
- Tier 1: conversation, composer, tool/approval output, and explicit error state.
- Tier 2: project scope and compact workflow status.
- Hidden until requested: run ID and reconnect detail.
- Removal candidates: dashboards, KPI cards, helper panels, duplicate actions, decorative wrappers, and copied tool implementations.
- Primary action: send a message.
- Failure-loudly behavior: show the run ID and stage, preserve the user message, and make refresh reconnect instead of submit again.

## Implementation checklist

- [x] Configure Workflow SDK and exclude internal workflow routes from auth middleware/proxy.
- [x] Add a durable-turn ledger migration and apply it to the linked Supabase project.
- [x] Add the isolated conversation/messages APIs.
- [x] Add the single-turn workflow, start API, reconnect API, and status API.
- [x] Add the separate chat client/page using shared chat UI primitives.
- [x] Add focused automated tests.
- [ ] Capture browser and release evidence. Browser proof is complete; preview release is pending.

## Evidence

- Migration ledger evidence: remote migration `20260722175451_create_durable_ai_turns` is applied on project `lgveqfnpkxvzbnnwuled`; remote table/index readback and generated `durable_ai_turns` types succeeded.
- Targeted checks: durable Jest 17/17 across contract and executable runtime suites; targeted ESLint passed; `npm run check:routes` passed; `git diff --check` passed; Workflow validate/build passed with 12 steps and 1 workflow. The repo-wide TypeScript check still reports existing errors, with no diagnostic in a new canary file.
- Browser evidence: authenticated run `wrun_01KY5H0AVPDR65QZRYH660FGGT` called `Get Portfolio Overview` once and completed after a mid-run refresh. Database readback showed one ledger turn and two persisted rows (one user, one assistant). Normal-response run `wrun_01KY5K8X534VM2B2DWAKSS3F2A` returned `durable chat ready`; forcing a completed-run reconnect returned HTTP 204, did not replay the answer, and cleared the stored run marker. Evidence: `docs/ops/evidence/durable-ai-chat/desktop-tool-response-fixed.png`, `mobile-tool-response-fixed.png`, `refresh-reconnect-trace.zip`, and `completed-reconnect-no-replay-trace.zip`. Mobile viewport was 390px wide with `scrollWidth === innerWidth`.
- Independent review: PASS with no remaining findings and zero unresolved high-severity issues after executable route/workflow race tests were added.
- Release evidence: pending.

## Debugging record

- Localized boundary: Supabase contained one completed turn and the Workflow raw stream contained one tool call/response, while the live React tree repeated the same chunks and remained streaming.
- Root cause: the client changed `resume` from false to true after receiving the live POST run header, attaching a second reader; separately, the workflow released its writer lock without closing the stream.
- Durable fix: resume is fixed from the run ID present at component mount, completed reconnect returns HTTP 204, the workflow explicitly closes success/failure streams, approval continuations have deterministic cumulative keys, accepted starts use a reclaimable CAS lease, competing runs must claim the ledger before tools, and conversation bootstrap uses a client-generated idempotency key under React Strict Mode.
- Regression guardrail: focused source contracts and executable route/workflow tests pin one-reader semantics, explicit stream closure, completed-run no-replay, duplicate-turn uniqueness, start-lease recovery, competing-run rejection before tools, pre-claim failure ownership, stream-close warning consistency, user-link terminal failure, idempotent conversation creation, authenticated reconnect ownership, and Workflow callback routing.

## Noise-gate result

Pass. The canary reuses the canonical `ChatArea` and existing prompt/model/tool owners. It adds no dashboard, metric cards, helper panels, copied tool implementations, nested cards, or duplicate primary actions. The remaining risk is deployment-runtime behavior, covered by the pending preview proof.
