---
name: alleato-rag-implementation
description: Build and fix the Alleato AI assistant's retrieval and project-intelligence behavior using the repo's real AI SDK, Supabase, and packet-first architecture. Use when the user says "fix the RAG", "improve assistant answers", "source lookup is wrong", "tool calling is random", "packet-first", "project intelligence", or asks for AI assistant retrieval/tool routing work in alleato-pm.
argument-hint: <goal or failing behavior>
---

# Alleato RAG Implementation

This skill is for `alleato-pm` only.

It exists because generic RAG guidance is not enough for this repo and often pushes work in the wrong direction.

The live problem is usually not "RAG" in the abstract. It is one of these:

1. Intent routing is wrong.
2. Tool/provider behavior is wrong.
3. Packet-first advisor logic is missing or stale.
4. Source-specific lookup is falling through to a generic answer.
5. Ingestion, project attribution, embeddings, or retrieval health is degraded.

## Mandatory Framing

- Use the `ai-sdk` skill first for any AI SDK or provider behavior.
- Treat `frontend/node_modules/ai/docs/` as the source of truth for SDK behavior.
- Do not replace the current assistant stack with a generic LangChain/LangGraph/Pinecone design.
- Do not assume the model is the problem before validating provider/tool behavior.
- Do not treat raw vector search as the primary experience for project questions.
- Do not ship silent failures. If `finishReason`, tool calls, retrieval, or packet freshness is bad, surface it explicitly.

## This Repo's Actual Architecture

Primary route and AI surfaces:

- `frontend/src/app/api/ai-assistant/chat/route.ts`
- `frontend/src/lib/ai/provider-routing.ts`
- `frontend/src/lib/ai/providers.ts`
- `frontend/src/lib/ai/intent-router.ts`
- `frontend/src/lib/ai/detect-rag-request.ts`
- `frontend/src/lib/ai/intelligence/packet-service.ts`
- `frontend/src/lib/ai/intelligence/advisor-synthesis.ts`
- `frontend/src/lib/ai/tools/`

Primary assistant modes:

- `project briefing / advisor`: packet-first for client project intelligence
- `source_lookup`: exact evidence from meetings, email, Teams, docs
- `app_help`: product/help guidance
- `general`: only after the above are ruled out

Primary storage model:

- `intelligence_targets`
- `intelligence_packets`
- `intelligence_packet_cards`
- `insight_cards`
- `insight_card_evidence`
- `document_metadata`
- `document_chunks`
- `chat_history`
- `ai_memories`
- `document_attribution_candidates`

Embedding baseline:

- Model: `text-embedding-3-large`
- Dimensions: `3072`
- Reference: `frontend/scripts/backfill-conversation-embeddings.ts`

## When To Use This Skill

Use this skill when the user asks to:

- fix AI assistant answers
- fix source lookup or evidence lookup
- stop random tool execution
- improve project intelligence
- debug packet-first behavior
- debug retrieval quality over meetings, email, Teams, or documents
- improve AI response quality, grounding, or confidence

## Escalate To RAG Strategy Council

Use `rag-strategy-council` before implementation when:

- the user asks for consensus, expert debate, or the best strategy
- a prior RAG/assistant fix did not hold
- the failure could be in multiple layers at once
- the proposed change would affect provider/tool routing, packet-first behavior, source-specific lookup, or retrieval architecture
- the fix needs a durable implementation sequence instead of one patch

The council report belongs under `docs/ai-plan/councils/`. Treat it as the source of truth for the next implementation slice.

Do not use this skill for:

- a generic greenfield RAG tutorial
- switching to Pinecone/Weaviate/Chroma unless the user explicitly wants a new architecture
- replacing AI SDK without validation evidence

## First 30 Minutes Checklist

1. Read the AI SDK docs you need from `frontend/node_modules/ai/docs/`.
2. Inspect the live route:
   - `frontend/src/app/api/ai-assistant/chat/route.ts`
3. Inspect routing and provider decisions:
   - `frontend/src/lib/ai/intent-router.ts`
   - `frontend/src/lib/ai/provider-routing.ts`
   - `frontend/src/lib/ai/detect-rag-request.ts`
4. Inspect packet logic:
   - `frontend/src/lib/ai/intelligence/packet-service.ts`
   - `frontend/src/lib/ai/intelligence/advisor-synthesis.ts`
5. Run the smallest relevant verifier before editing if the failure is unclear.
6. Only after root cause is evidenced should you edit code.

## Default Diagnosis Order

Work top-down. Do not jump straight to embeddings.

### 1. Intent routing

Ask:

- Should this request be `source_lookup`?
- Should it be packet-first project briefing?
- Is it falling into a generic or wrong intent bucket?

Check:

- `frontend/src/lib/ai/intent-router.ts`
- `frontend/src/app/api/ai-assistant/chat/route.ts`
- persisted metadata in assistant responses when available

### 2. Provider and tool-calling behavior

Ask:

- Did the model actually get tools?
- Were tool calls executed?
- Did the provider return empty output, `finishReason: "other"`, or no final text?

Check:

- `frontend/src/lib/ai/provider-routing.ts`
- `frontend/src/lib/ai/providers.ts`
- `scripts/verify/verify_ai_tool_calling_provider_matrix.mjs`

### 3. Packet-first project intelligence

Ask:

- Did the route resolve the right project/target?
- Was the current packet loaded?
- Is the packet fresh, stale, partial, or missing?
- Did advisor synthesis produce a useful answer before raw retrieval fallback?

Check:

- `frontend/src/lib/ai/intelligence/packet-service.ts`
- `frontend/src/lib/ai/intelligence/advisor-synthesis.ts`
- `scripts/verify/verify_ai_intelligence_packet_contract.mjs`
- `scripts/verify/verify_ai_advisor_quality.mjs`

### 4. Source-specific retrieval

Ask:

- For meetings/email/Teams/docs requests, did the route use source-specific lookup?
- Are exact-source questions being answered by generic project summaries instead?

Check:

- `frontend/src/lib/ai/detect-rag-request.ts`
- `scripts/verify/verify_ai_source_specific_rag_contract.mjs`
- `docs/ai-plan/evals/assistant-eval-suite.json`

### 5. Ingestion, attribution, and embeddings

Ask:

- Are the underlying documents present?
- Are they assigned to the right project?
- Are summaries/chunks embedded?
- Are Teams attribution candidates piling up instead of resolving cleanly?

Check:

- `document_metadata`
- `document_chunks`
- `document_attribution_candidates`
- `scripts/verify/verify_meeting_vectorization_health.mjs`
- `scripts/verify/verify_graph_embedding_contract.mjs`

## Required Commands

Start with the narrowest command that matches the failure.

### Architecture and route sanity

```bash
npm run rag:verify:chat-architecture
```

### Source-specific retrieval contract

```bash
npm run rag:verify:source-specific
```

### Provider/tool-calling matrix

```bash
node scripts/verify/verify_ai_tool_calling_provider_matrix.mjs
```

### Packet contract

```bash
node scripts/verify/verify_ai_intelligence_packet_contract.mjs
```

### Advisor quality

```bash
node scripts/verify/verify_ai_advisor_quality.mjs
```

### Eval suite

```bash
npm run rag:verify:eval-suite
```

Run a single case when you know the failing scenario:

```bash
npm run rag:verify:eval-suite:case -- source-lookup-meetings
```

### Meeting/vector health

```bash
npm run rag:verify:meetings
```

### Render / AI Gateway health

```bash
npm run rag:verify:render-ai
```

## Long-Running Verification Rule

If the check is expensive, delegate it to a cheaper sub-agent. Main thread stays on implementation and targeted local checks.

Delegate these by default:

- full eval suite
- provider matrix across multiple models
- long ingestion/vector health checks
- browser dogfooding runs

The sub-agent report must return:

- pass/fail
- exact failing command
- concise error lines
- likely owner files
- current-task issue vs unrelated repo debt

## Database Rules

Before schema or DB code changes:

```bash
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts
```

Then verify:

- `projects.id` is `INTEGER`
- do not invent `document_chunks.id` if the generated type only exposes `chunk_id`
- keep packet metadata compact in `chat_history.metadata`

If you add a migration under `supabase/migrations/`, you own applying or explicitly deferring it and ledger-verifying it.

## Implementation Rules

### For project intelligence questions

- Resolve the target first.
- Load the current intelligence packet before raw retrieval.
- State freshness honestly.
- Synthesize the answer as an advisor read, not a chunk dump.
- Fall back to source lookup only when packet coverage is thin, stale, challenged, or the user asked for exact evidence.

### For source questions

- Route to `source_lookup`.
- Prefer exact-source tools and document hits.
- Answer with source-aware grounding, not a project-summary paraphrase.

### For financial questions

- Prefer structured financial tools and rows before vector chunks.
- Do not answer numeric questions from semantically similar text if structured data exists.

### For failure handling

- Treat `finishReason: "other"` plus empty output as an explicit failure.
- Persist enough metadata for diagnosis: intent, provider decision, tool trace, loop diagnostic.
- Never silently degrade without telling the user or metadata consumer what happened.

## Anti-Patterns

Do not:

- introduce a generic Pinecone/LangChain rewrite
- replace the assistant with raw vector search
- answer project questions from chunk snippets when a packet exists
- answer source-specific questions from a packet when the user asked for exact evidence
- blame embeddings first when intent or provider routing is broken
- declare success from HTTP 200 alone
- overfit fixes to one prompt without updating eval coverage

## Acceptance Criteria

A real fix usually means all of these are true:

- The route chooses the correct intent for the failing prompt.
- Provider/tool policy matches verified current capability.
- Project intelligence loads the right current packet when appropriate.
- Source lookup uses exact-source retrieval when appropriate.
- Assistant metadata explains what path was taken.
- The relevant verifier or eval case passes.
- If the failure was recurrent, a guardrail or test was added so it fails loudly next time.

## Best Reference Docs

- `docs/PRPs/alleato-ai-intelligence-system/prp-alleato-ai-intelligence-system.md`
- `docs/ai-plan/rag-pipeline/RAG-STRATEGY-2026-04-29/`
- `docs/ai-plan/evals/`
- `docs/features/FEATURE-INVENTORY.md`

## Default Deliverables

When using this skill, finish with:

1. code fix or verification result
2. exact files changed or inspected
3. what root cause was confirmed
4. what passed
5. what remains
6. the next highest-leverage step
