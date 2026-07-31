# Task: Dedicated ASRS Intelligence Workspace

Status: Complete
Owner: Codex SROOT-ASRS-1243
Created: 2026-07-21
Task ID: AAI-1243
Linear Issue: [AAI-1243](https://linear.app/megankharrison/issue/AAI-1243/build-a-dedicated-asrs-intelligence-chat-and-corpus-workspace)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT-ASRS-1243-dedicated-asrs-workspace.md`

## Objective

Make `/asrs` the dedicated, conflict-free ASRS intelligence workspace with revision-scoped chat, searchable tables/figures, and source-linked review details.

## Scope

- Owned chat surface: `/asrs`, `/api/asrs/chat`, ASRS conversation namespace, shared chat configuration seams, and focused policy tests.
- Owned corpus UI: `/asrs/tables`, `/asrs/figures`, exact detail routes, source PDF/evidence links, notes, and review state.
- Owned compatibility: preserve `/ai` FMDS answers and existing `/fm-global` routes while making `/asrs` canonical.
- Explicit exclusions: corpus activation, new embeddings, estimator head-count rules, pricing/BOM logic, legacy route deletion, and unrelated general-chat architecture debt.
- Guardrail addition: the evaluator RPC must return its actual revision identity so the application can reject cross-revision drift rather than trusting a caller-supplied ID.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project, one eligible FMDS0834 revision, `searchFmdsEvidence`, and `evaluateAsrsConfiguration`.
- Existing shared primitives/services: `RagChatPage`, `ChatArea`, `DefaultChatTransport`, `getLanguageModel`, `createAsrsIntelligenceTools`, `GenericConfigUnifiedTable`, `PageShell`, `PageTabs`, and existing FMDS detail/review adapters.
- Deprecated or parallel paths: legacy FM tables and generic project RAG are forbidden for ASRS conclusions; `/fm-global` remains compatibility-only in this slice.

Verification contract: Required

## Attention Brief

- Primary user: estimator or engineer checking FMDS requirements for an ASRS configuration.
- Primary job: ask a grounded question or inspect the exact table/figure evidence that controls it.
- Primary decision: which reviewed FMDS requirement applies and what remains Pending Review.
- Tier 1: chat answer, revision identity, citation, review status, and exact evidence.
- Tier 2: searchable/filterable table and figure directories with row navigation.
- Tier 3: extraction confidence, review history, and candidate diagnostics inside detail views.
- Hide until requested: raw vector metadata, internal UUIDs, provider traces, and extraction diagnostics.
- Remove: project picker, council mode, general assistant links, decorative orb, dashboards, KPI cards, duplicate CTAs, and generic source fallbacks.
- Primary action: ask an ASRS/FMDS question.
- Failure-loudly behavior: name the missing session, credential, corpus, retrieval, provider, evidence, or persistence dependency and stop the conclusion.

## Acceptance Criteria

- [x] `/asrs` is a dedicated chat route using `/api/asrs/chat`, not the general `/api/ai-assistant/chat` endpoint.
- [x] ASRS chat sessions are namespaced and cannot appear in or be loaded by the general chat surface.
- [x] Every ASRS turn prefetches one revision-scoped FMDS evidence set and exposes only reviewed ASRS tools.
- [x] Missing session ownership, ASRS metadata, credentials, revision data, evidence, provider output, or persistence fails specifically and visibly.
- [x] `/asrs/tables` and `/asrs/figures` use the unified table with search, required filters, compact columns, export, and row navigation.
- [x] Table and figure detail routes show authoritative evidence, source PDF page, candidate/review state, history, and notes/review action where applicable.
- [x] Main `/ai` FMDS compatibility remains intact without controlling the dedicated ASRS experience.

## Implementation Checklist

- [x] Files/modules to change are listed before edits in the writer lease and council report.
- [x] Inline RAG council decision exists before product-code edits.
- [x] Shared chat abstractions own surface configuration rather than copied JSX.
- [x] Dedicated server handler owns mandatory evidence, tools, citations, persistence, and surface authorization.
- [x] Errors are specific and actionable.
- [x] Scoped evaluator RPC returns actual revision identity; application validates it against the turn revision.
- [x] Migration `20260722035924` is applied to the dedicated ASRS project and verified in the remote ledger.

## Integration and Verification

- [x] Focused ASRS chat/session/policy/component tests pass.
- [x] `npm run check:routes` passes.
- [x] Source-specific RAG verifier remains valid.
- [x] Authenticated desktop and mobile `/asrs` chat proof shows a cited answer.
- [x] Authenticated table/figure directory and detail proof shows filters, navigation, source evidence, and review state.
- [x] Screenshot artifacts are attached to AAI-1243.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: wrong conversation surface, missing ASRS credentials/revision/evidence, provider error or empty output, unavailable source image/PDF, or persistence failure.
- Detection path: API status/error, streaming error part, persisted `surface=asrs` metadata, focused tests, live browser answer, and exact detail-route screenshots.
- Recovery path: repair the named dependency and retry the same route; never substitute generic project RAG, legacy FM data, another revision, or model memory.

## Incident Learning

- Failure fingerprint: `rag.native-coverage-hides-structured-gaps`
- Root cause: read-time surface filtering and caller-side revision pinning existed, but the two write/execution boundaries did not independently prove ownership and revision identity.
- Detection gap: prior verification checked ASRS reads and search revision isolation, but did not negatively test the general write handler or evaluator-returned revision drift.
- Prevention: pre-execution conversation ownership enforcement; database-returned evaluator identity; exact eligible-revision queries; app and tool drift rejection; focused negative-path tests.
- Guardrail evidence: `chat-surface-seam.test.ts`, `asrs-estimator.server.test.ts`, `asrs-intelligence.test.ts`, remote migration ledger, and live cross-surface 404 readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1243, this task file, council report, writer lease, and handoff | Pass | Full workflow and acceptance gates recorded before implementation. |
| AI SDK source | `frontend/node_modules/ai/docs/04-ai-sdk-ui/21-transport.mdx`; `03-chatbot-message-persistence.mdx` | Pass | Confirms custom endpoint transport and UI-message persistence pattern. |
| Focused regression | 11 Jest suites / 41 tests | Pass | Surface ownership, exact revision pinning, evaluator drift, Pending Review preservation, and FMDS routing passed. |
| Static quality | targeted ESLint; `npm run typecheck:changed`; `npm run check:routes`; `git diff --check` | Pass | No task-owned lint, changed-type, route, or whitespace failures. |
| Database migration | `20260722035924_return_fmds_evaluator_revision_identity.sql` | Pass | Local/remote ledgers match; security-invoker; service-role only. |
| Live database readback | `docs/ops/evidence/2026-07-21-dedicated-asrs-workspace/database-readback.md` | Pass | Returned revision equals requested revision; 250 gpm / 60 min result. |
| Authenticated runtime | `docs/ops/evidence/2026-07-21-dedicated-asrs-workspace/runtime-verification.md` | Pass | Dedicated answer persisted; general endpoint rejected ASRS session with 404 and wrote nothing. |
| Visual proof | `docs/ops/evidence/2026-07-21-dedicated-asrs-workspace/*.png` | Pass | Desktop/mobile chat, directories, and table/figure review controls captured. |
| Linear screenshots | AAI-1243 attachments and screenshot comments | Pass | Current route and review surfaces are viewable from the task. |

## Remaining Risk

- Corpus activation and deterministic estimator expansion remain separate governed tasks.
- FMDS0834 remains intentionally `staging`; Pending Review items are preserved rather than promoted into verified calculations.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
