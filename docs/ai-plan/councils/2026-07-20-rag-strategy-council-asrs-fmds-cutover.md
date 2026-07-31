# RAG Strategy Council: ASRS FMDS 2026 Chat Cutover

Date: 2026-07-20
Status: Ready for first implementation slice
Council question: What is the lowest-risk way to make canonical AI chat answer ASRS/FMDS questions exclusively from the versioned April 2026 corpus and reviewed evaluator without replacing the assistant architecture?

## Executive Decision

Extend the existing retrieval planner with one typed `fmdsEvidence` source and register two read-only ASRS tools: revision-scoped evidence search and reviewed deterministic evaluation. For an FMDS-domain plan, expose only those ASRS tools and inject a bounded evidence contract that requires edition/page/table/figure citations and Pending Review labels. Do not change providers, replace the strategist, activate the corpus, add a second chat route, or use generic project RAG as fallback.

## Evidence Packet

| Evidence | Source | What it proves | Gap |
|---|---|---|---|
| Canonical chat route | `frontend/src/app/api/ai-assistant/chat/route.ts` and `handler-v2.ts` | All chat turns already pass through one retrieval planner, system-context assembler, strategist tool factory, trace, and persistence seam. | No FMDS-specific plan or source exists. |
| Retrieval architecture | `frontend/src/lib/ai/retrieval/{planner,executor,types,system-prompt}.ts` | Typed sources can be preloaded and fail visibly through warnings/context without a new route. | FMDS evidence renderer and dependency are absent. |
| AI SDK tool contract | `frontend/node_modules/ai/docs/02-foundations/04-tools.mdx` | Function tools use descriptions, Zod input schemas, and automatic execution; the existing multi-step loop already supports them. | Tool selection alone would not guarantee source isolation. |
| Tool ownership | `frontend/src/lib/ai/{orchestrator,tool-registry}.ts` | Tool factories are registry-filtered and traced; new tools need explicit policy metadata and factory ownership. | No ASRS factory is registered. |
| Versioned data owner | `frontend/src/lib/fmds/asrs-rest.server.ts` and ASRS migrations | The dedicated project exposes staging/active revision-scoped match RPCs with 3072-dimension embeddings. | Live retrieval health still needs readback. |
| Deterministic owner | `frontend/src/lib/fmds/asrs-estimator.server.ts` | Reviewed Batch 1 calculations already produce typed Verified/Pending Review results with citations. | Complete configuration/head-count coverage is intentionally incomplete. |

## Role Positions

### Repo Architect

Position: Reuse the canonical planner, executor, prompt assembler, strategist factory, tool registry, and persistence trace. Add no route and no parallel assistant.

Evidence: `handleChatV2` already preloads typed retrieval context, filters registered tools, runs the AI SDK loop, and persists `retrieval_plan` plus `tool_trace` metadata.

Risk in the other strategies: A standalone FM chat endpoint or raw vector shortcut would duplicate authentication, persistence, model policy, and debugging ownership.

Minimum viable next step: Add one source contract and one registered factory.

Guardrail required: Architecture verifier must fail if FMDS tools bypass the registry or the canonical chat route.

Confidence: High.

### RAG Architect

Position: Pin every search to exactly one eligible revision and return chunk citations plus same-page table/figure candidates with review status. Do not search `fmds_active_chunks` while the 2026 revision is staging; call the staging RPC with its UUID.

Evidence: The ASRS schema already separates `match_staging_fmds_chunks(revision_id, ...)` from `match_active_fmds_chunks(...)` and keys chunks/tables/figures to `revision_id`.

Risk in the other strategies: Generic project semantic search can mix source families and editions and cannot communicate FMDS review state.

Minimum viable next step: Build a typed server search result containing corpus identity, evidence coverage, citations, tables, figures, and answer policy.

Guardrail required: Tests must reject mismatched revision IDs, empty evidence presented as success, and any legacy table token in the ASRS source implementation.

Confidence: High.

### AI SDK And Provider Specialist

Position: Add provider-portable function tools with Zod schemas to the existing `streamText` multi-step loop; no provider/model change is necessary.

Evidence: Local AI SDK documentation defines function tools as description + `inputSchema` + `execute`; `handler-v2.ts` already attaches tools, approval policy, `stepCountIs(6)`, telemetry, and tool-call trace aggregation.

Risk in the other strategies: Relying only on the model to choose from the entire strategist tool set could invoke web or generic semantic search before the ASRS source.

Minimum viable next step: Register the tools and restrict visible tools to the ASRS factory for an FMDS-domain plan.

Guardrail required: A handler/tool-selection contract proves unrelated tools are not visible for an FMDS plan.

Confidence: High.

### Failure-Mode Reviewer

Position: Fail closed when credentials, revision, embedding generation, RPC matching, or evidence are missing; keep unreviewed extraction as Pending Review and never convert absence into a confident answer.

Evidence: `requestAsrsJson` already produces named credential/query errors, while the general executor currently converts rejected retrieval tasks into warnings and continues.

Risk in the other strategies: A warning plus the full strategist tool set can silently degrade into generic RAG or web search.

Minimum viable next step: Pair the retrieval warning with an FMDS-specific no-fallback prompt and ASRS-only tool visibility.

Guardrail required: Empty/failed FMDS retrieval test expects an explicit unavailable state and zero legacy/generic tool options.

Confidence: High.

### Product Advisor

Position: The answer must lead with the applicable requirement, show whether it is Verified or Pending Review, cite edition/page/table/figure, and plainly state what additional inputs or review are needed.

Evidence: The estimator already presents this status vocabulary and users explicitly rejected confusing extraction diagnostics and unsupported conclusions.

Risk in the other strategies: A chunk dump or raw extraction score does not tell an estimator which requirement applies or whether it is safe to use.

Minimum viable next step: Reuse the estimator response vocabulary in tool outputs and synthesis instructions.

Guardrail required: Browser/eval prompts cover a supported hose-demand case, an applicable table/figure request, an incomplete configuration, and an unavailable-source case.

Confidence: High.

## Disagreements And Resolution

| Disagreement | Positions | Resolution method | Decision |
|---|---|---|---|
| Tool-only versus planner-prefetched evidence | AI SDK specialist accepts tools; RAG architect requires deterministic source selection. | Existing planner/executor seam and source-isolation requirement. | Prefetch FMDS evidence and also expose the same search as a follow-up tool. |
| Full strategist tools versus domain-restricted tools | Repo architect prefers reuse; failure reviewer rejects fallback exposure. | Failure-loud requirement and regression contract. | Reuse strategist loop but restrict tool visibility to registered ASRS read tools for the FMDS plan. |
| Activate 2026 before chat use versus search staging explicitly | Product wants usable UI now; data governance requires review. | Existing staging RPC and activation gate. | Search the selected staging revision explicitly and label it; do not activate. |
| Let retrieved chunks drive calculations versus evaluator-only calculations | RAG architect can retrieve text; product/failure roles require deterministic ownership. | Existing reviewed Batch 1 evaluator contract. | Chunks explain and identify sources; only evaluator output may be labeled Verified calculation. |

## Consensus Implementation Sequence

1. Add failing typed-domain, planner, executor, prompt, registry, and ASRS tool tests.
2. Implement revision-scoped search with same-revision table/figure candidates and fail-closed output.
3. Register ASRS search/evaluation tools, restrict tool visibility on FMDS plans, and persist route/tool trace metadata.
4. Run live retrieval/evaluator readbacks and canonical desktop/mobile chat verification.
5. Leave corpus activation and additional deterministic rule coverage to separate reviewed work.

## Verification Gates

| Gate | Command or evidence | Required result | Owner layer |
|---|---|---|---|
| Typed routing | Focused planner/domain Jest cases | Paraphrases route to `fmdsEvidence`; PM/project-status negatives do not. | routing |
| Revision isolation | Focused ASRS search tests plus live readback | Every returned chunk/table/figure matches one revision UUID. | retrieval |
| Tool policy | Registry/orchestrator focused tests | Only ASRS read tools remain visible for an FMDS-domain plan. | provider/tool |
| Deterministic status | Evaluator tool tests and live case | Supported rule is Verified; unsupported outputs remain Pending Review. | product/evaluator |
| Fail closed | Empty/error retrieval tests | Specific unavailable result; no legacy/generic fallback path. | failure mode |
| Architecture | `npm run rag:verify:chat-architecture` | Pass with canonical route/trace ownership intact. | architecture |
| Source contract | `npm run rag:verify:source-specific` | Existing source-specific behavior remains passing. | retrieval regression |
| User flow | Authenticated `/ai` browser run and screenshots | Chat answer cites FMDS0834 2026-04 and displays Pending Review where required. | product |

## Fail-Loud And Recurrence Guardrails

- Cause: AI chat has no explicit FMDS source owner, so a domain question can fall into generic synthesis/tools.
- Detection gap: existing architecture/source-specific verifiers do not assert edition-isolated ASRS retrieval or evaluator use.
- Prevention step: typed `fmdsEvidence` plan, registered ASRS factory, domain-restricted tool set, revision-equality checks, and focused eval prompts.
- Fail-loud behavior: name the missing ASRS layer and stop the engineering conclusion; do not query a different corpus or source family.

## Open Questions

- Which additional tables/figures will become reviewed deterministic cards after this first integration slice?
- When all activation gates pass, should chat default to the active pointer while retaining an explicit revision override for audits?

## Recommended Next Step

Implement the first typed planner/search/tool slice on `feat/asrs-intelligence`, beginning with failing regression tests and a live revision/retrieval health readback.
