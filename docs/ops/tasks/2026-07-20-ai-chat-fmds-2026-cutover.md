# Task: Cut Over AI Chat to the 2026 FMDS Corpus

Status: Complete
Owner: Codex S203
Created: 2026-07-20
Task ID: AAI-1207
Linear Issue: [AAI-1207](https://linear.app/megankharrison/issue/AAI-1207/cut-over-ai-chat-retrieval-to-the-versioned-2026-fmds-corpus)
Related Handoff: `docs/ops/handoffs/2026-07-20-S203-ai-chat-fmds-2026-cutover.md`

## Objective

Make the canonical Alleato AI chat answer FMDS 8-34/ASRS questions from the dedicated, revision-scoped April 2026 corpus and reviewed Batch 1 evaluator, with edition/page/table/figure citations and explicit Pending Review states.

## Scope

- Owned routing surface: typed ASRS/FMDS domain classification in the existing retrieval planner.
- Owned retrieval surface: a dedicated ASRS server adapter for revision-scoped vector evidence plus applicable table/figure candidates.
- Owned AI SDK surface: registered read-only ASRS evidence and deterministic evaluation tools exposed through the canonical strategist factory.
- Owned synthesis surface: bounded FMDS evidence context, citation/review instructions, and ASRS-only tool visibility for this domain plan.
- Owned verification: focused planner, executor, system-prompt, registry/tool, live retrieval/evaluator, and authenticated browser chat evidence.
- Explicit exclusions: corpus activation, human review decisions, new engineering rules, legacy-table deletion, a new chat UI, or a replacement assistant architecture.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project `vqnnvpnoitqhijkztyhq`, latest eligible `fmds_corpus_revisions` row, revision-scoped match RPCs, reviewed tables/figures, and `evaluate_fmds_batch1_rules`.
- Existing shared primitives/services: `planRetrieval`, `executeRetrievalPlan`, `assembleSystemPromptFromContext`, `createStrategistTools`, `GLOBAL_ASSISTANT_TOOL_REGISTRY`, `requestAsrsJson`, `embed`, and `evaluateAsrsConfiguration`.
- Deprecated or parallel paths: legacy `fm_global_tables`, `fm_global_figures`, `fm_text_chunks`, `fm_table_vectors`, and generic project semantic search for FMDS answers.

Verification contract: Required

## Attention Brief

- Primary user: estimator or engineer asking the existing AI chat about an ASRS configuration or FMDS requirement.
- Primary job: identify the governing reviewed requirements, tables, figures, assumptions, and unresolved items.
- Primary decision: what is supported now and what still requires engineering review.
- Tier 1: answer, status, exact corpus revision, source citations, and applicable table/figure identifiers.
- Tier 2: similarity, retrieval coverage, and review reasons in trace/debug metadata.
- Hidden until requested: embeddings, raw RPC payloads, internal UUIDs, and extraction diagnostics.
- Removal candidates: generic project RAG, web search, and legacy FM Global tools for an FMDS-domain turn.
- Primary action: ask an ASRS/FMDS question in the existing chat.
- Failure-loudly behavior: return a named ASRS retrieval/evaluator error and no engineering conclusion when revision evidence is unavailable.

## Acceptance Criteria

- [x] A typed domain contract routes ASRS/FMDS engineering questions without prompt-specific phrase patches.
- [x] Retrieval is pinned to one eligible revision and cannot blend editions.
- [x] Retrieved evidence includes edition, page, section/clause, similarity, and applicable table/figure review status.
- [x] The chat can call the reviewed Batch 1 evaluator with typed inputs and preserve Verified/Pending Review results.
- [x] ASRS-domain turns cannot silently fall back to legacy FM tables, generic project RAG, or web search.
- [x] Missing credentials, revision data, embeddings, evidence, or evaluator inputs fail specifically and visibly.
- [x] The existing chat UI displays a source-linked answer and persists route/tool trace metadata.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Inline RAG strategy council report exists before implementation.
- [x] Add typed FMDS domain detection plus planner/executor/context contracts.
- [x] Add revision-scoped evidence retrieval and table/figure candidate mapping.
- [x] Add registered read-only AI SDK tools and ASRS-only tool visibility for ASRS plans.
- [x] Add bounded FMDS system context with fail-closed synthesis rules.
- [x] Add focused regression/eval coverage.
- [x] Post kickoff, milestone, evidence, and handoff updates to AAI-1207.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Live ASRS retrieval and deterministic evaluator readbacks pass.
- [x] Authenticated browser chat produces a cited 2026 answer and explicit Pending Review output.
- [x] Desktop and mobile blocker screenshots are attached to AAI-1207.
- [x] The source-specific RAG verifier passes; unrelated shared chat-architecture debt is named below.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main` and the remote commit was read back.

## Failure-Loudly Contract

- Cause surfaced as: missing ASRS credentials, missing/unsupported corpus revision, embedding failure, empty revision-scoped evidence, invalid evaluator input, evaluator failure, or incomplete reviewed coverage.
- Detection path: typed tool result/error, retrieval warning, persisted `retrieval_plan` and tool trace, focused tests, live readback, and browser answer.
- Recovery path: repair the named environment/data/review input, then rerun the same question; do not substitute another corpus or inference path.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; this is a planned source-ownership cutover rather than a diagnosed production incident.
- Detection gap: the existing chat tool registry has no dedicated FMDS revision/evaluator source contract.
- Prevention: typed domain plan, edition-pinned evidence, restricted tools, and regression prompts that reject generic/legacy fallbacks.
- Guardrail evidence: Pending implementation.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1207, this task file, S203 handoff, council report, and control-plane claim | Pass | Full workflow and verification gates recorded before product-code edits. |
| Focused regression suite | `pnpm exec jest --runInBand ...` | Pass | 10 suites / 142 tests across routing, executor, bounded prompt, revision isolation, registry, tools, policy, and stream errors. |
| Targeted lint | `pnpm exec eslint <task-owned TS files>` | Pass | No lint findings. |
| Source-specific RAG guard | `npm run rag:verify:source-specific` | Pass | Dedicated source contract remains valid. |
| Live corpus readback | ASRS Supabase service-role query | Pass | Revision `65306e47-c25a-4397-92a0-c44c03903d0f`, FMDS0834 `2026-04`, 122 pages, 225/225 embedded chunks, 58 tables, 61 figures, and 9 reviewed rule cards. |
| Authenticated routing trace | `/ai?session=7f17a614-49a3-4faf-bd08-16d9a1504465` plus persisted `chat_history.metadata` | Pass | `source_lookup`, reason `asrs_fmds_revision_scoped_evidence`, source `fmdsEvidence`, and `fmdsToolPolicy.genericFallbackAllowed=false`. |
| Provider proof | Live Vercel AI Gateway `generateText` smoke and authenticated `/ai` requests | Pass | The replacement BYOK Gateway key is installed for local, Development, Preview, and Production; a direct smoke returned `OK` from `openai/gpt-5.4`, and both browser prompts completed. |
| Failure-loudly UI | `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/provider-blocked-actionable-desktop.png` and mobile equivalent | Pass | Canonical authenticated `/ai` surface saves the question and names the provider quota/billing blocker instead of showing generic copy. Both screenshots are attached to AAI-1207. |
| Chat architecture guard | `npm run rag:verify:chat-architecture` | Existing failure | Unrelated repo debt: legacy write tools still contain tool-level `needsApproval`, and Ask Alleato has not adopted the shared read-only surface contract. No task-owned FMDS tool is a write/action tool. |
| Full TypeScript | `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit --pretty false` | Existing failure | Pre-existing errors in `handler-v2.ts` `.message`-on-string sites outside this diff and existing `retrieval/deps.ts` RPC option/source-union sites. |
| Changed-file typecheck script | `npm run typecheck:changed` | Unavailable | Root package has no `typecheck:changed` script; focused Jest, ESLint, and delegated full TypeScript were used instead. |
| Historical implementation publication | `git push origin feat/asrs-intelligence` plus local/remote SHA readback | Pass | Original implementation commit `75e6e5c148b8646d1ea54bfba407f60201fbbc95`; the consolidated cutover source is now present on `origin/main`. |
| Supported-answer browser proof | `/ai?session=473d4379-2f8a-4fd8-b81d-1982a53d30bf` | Pass | Answered 250 gpm (950 L/min) for 60 minutes and cited FMDS0834 revision 2026-04, Table 2.1.4.5.4, PDF page 12. |
| Pending Review browser proof | Same persisted chat session | Pass | Refused to infer a complete head count without controlling geometry/configuration inputs, named the result Pending Review, and cited the applicable reviewed 2026 tables, figure, section, and pages. |
| Clickable source guardrail | `pnpm exec jest --runInBand src/components/ai-assistant/__tests__/assistant-widget-renderer.test.tsx` | Pass | 1 suite / 12 tests. Relative first-party FMDS routes render as links; protocol-relative external URLs remain blocked. |
| Frontend screenshot evidence | `docs/ops/evidence/2026-07-20-ai-chat-fmds-2026-cutover/fmds-clickable-citations.png`; `pending-review-proof.png` | Pass | Canonical authenticated `/ai` proof shows the cited answer, clickable FMDS evidence, and explicit Pending Review behavior. |
| Main publication | `origin/main` readback | Pass | Clickable citation fix published in `a420fcd5e17ef7c88286ca76081e372e4c241cc5`; task closeout and screenshot evidence published in `655ec32b3f3aefc910a92a2dae860155264c8d16`. |

## Remaining Risk

- Only reviewed deterministic rules can be Verified; complete head count/configuration/full-compliance outputs remain Pending Review until all controlling inputs and corresponding reviewed rule ownership are available.
- Corpus activation remains intentionally outside this task. The chat is pinned to the latest eligible revision-scoped staging or active corpus and does not blend editions; promotion to `active` is a separate operational decision.
- Provider health can regress independently of retrieval. The specific saved-question provider error and persisted trace remain the recovery guardrail.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
