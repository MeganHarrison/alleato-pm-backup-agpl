---
name: rag-strategy-council
description: Run a structured multi-agent strategy debate before implementing recurring or high-risk Alleato RAG, AI assistant, packet-first project intelligence, source lookup, AI SDK provider/tool-calling, or retrieval architecture changes. Use this when the user asks for consensus, expert debate, "best strategy", "stop fixing RAG forever", "RAG council", "agents debate", or when a RAG fix has failed more than once.
argument-hint: <failing behavior, strategy question, or proposed RAG change>
---

# RAG Strategy Council

Use this skill when the right answer is not "patch the first suspicious file." The goal is to force expert disagreement, evidence collection, and a consensus implementation sequence before changing the Alleato AI assistant.

This skill is repo-specific. It must be used with `alleato-rag-implementation` for Alleato retrieval/project-intelligence behavior. Use the `ai-sdk` skill whenever the council touches AI SDK, AI Gateway, model IDs, provider routing, streaming, tool calling, structured output, or embeddings.

## What This Produces

Create a council report under:

```text
docs/ai-plan/councils/YYYY-MM-DD-rag-strategy-council-<topic>.md
```

Use `templates/council-report.md` as the starting structure.

The report is the deliverable unless the user explicitly asks to proceed into implementation. Do not let the debate disappear into chat.

## When To Run A Council

Run this before implementation when any of these are true:

- A RAG/assistant fix has failed before or the user says prior fixes did not hold.
- The issue could sit in multiple layers: intent routing, provider/tool behavior, packet freshness, source lookup, ingestion, attribution, embeddings, or prompt synthesis.
- The user asks for consensus, top expertise, a strategy debate, or a durable plan.
- A proposed fix would change the assistant architecture, provider path, packet-first behavior, eval gates, or ingestion/vectorization pipeline.
- You are tempted to blame embeddings first.

Do not run a council for a narrow, evidenced bug with an obvious local fix. Use the normal `alleato-rag-implementation` checklist instead.

## Council Roles

Use five roles. If sub-agents are available and the user asked for debate/consensus, spawn them in parallel with bounded read-only scopes. If sub-agents are unavailable, simulate the same roles in the main thread but clearly mark that it was an inline council.

### 1. Repo Architect

Defends the current Alleato architecture.

Focus:
- packet-first project intelligence
- current chat route and intent router
- existing packet, source lookup, tool, and eval surfaces
- what should be reused instead of rebuilt

Required evidence:
- relevant files
- existing verifier commands
- current guardrails that already exist

### 2. RAG Architect

Challenges retrieval quality and source-grounding.

Focus:
- chunking and metadata quality
- hybrid retrieval, reranking, and filtering
- source-specific lookup behavior
- evaluation coverage
- attribution and project linkage

Required evidence:
- likely retrieval failure layer
- metrics or verifier gaps
- proposed retrieval changes only after routing/provider/packet causes are ruled out

### 3. AI SDK And Provider Specialist

Checks whether the model/provider path can actually do the expected work.

Focus:
- AI SDK docs from `frontend/node_modules/ai/docs/` or provider package docs
- AI Gateway versus direct provider behavior
- tool calling availability
- `finishReason`, empty output, streaming behavior, and tool traces
- model IDs and provider matrix checks

Required evidence:
- exact docs/source references used
- provider/tool matrix command when relevant
- whether the failure is caused before retrieval is even reached

### 4. Failure-Mode Reviewer

Argues how the proposed fix could still fail.

Focus:
- silent fallbacks
- stale packet paths
- generic answer fallthrough
- missing metadata
- weak evals that pass while behavior is still bad
- operational degradation in ingestion/vectorization

Required evidence:
- detection gap
- fail-loud requirement
- guardrail or verifier that prevents recurrence

### 5. Product Advisor

Judges whether the strategy creates the right user experience.

Focus:
- project advisor behavior, not chunk dumps
- exact evidence when the user asks for source lookup
- confidence and freshness language
- whether the answer helps Megan/Brandon make decisions
- whether output belongs in chat, a durable packet, or a normal app page

Required evidence:
- representative user prompts
- success/failure examples
- acceptance criteria stated in plain English

## Operating Protocol

### 1. Frame The Question

Write the exact council question in one sentence.

Examples:

- "Why does source lookup keep returning generic project answers instead of exact meeting/email evidence?"
- "What is the lowest-risk strategy for making packet-first project intelligence reliable without replacing the assistant stack?"
- "Should we change retrieval, provider/tool routing, or packet compilation first?"

### 2. Build An Evidence Packet First

Before opinions, gather the smallest relevant evidence packet:

- failing prompt(s), route, project, and expected behavior
- relevant files from the Alleato RAG skill
- recent verifier results, if already available
- relevant live DB counts or health checks when the failure may be data-side
- AI SDK docs/source excerpts when provider/tool behavior is in scope

Do not run long checks in the main thread. Delegate expensive verification to a cheaper sub-agent and ask for a compact pass/fail report.

### 3. Dispatch Role Briefs

Each role must answer this structure:

```text
Role:
Position:
Evidence:
Risk in the other strategies:
Minimum viable next step:
Guardrail required:
Confidence:
```

Keep each role bounded. The point is disagreement and evidence, not five essays.

### 4. Force Disagreement

After initial positions, identify:

- where roles agree
- where roles disagree
- which disagreement can be resolved by a targeted verifier or DB query
- which disagreement is a product judgment

Do not average the opinions. Prefer the strategy with the strongest evidence, smallest blast radius, and best recurrence guardrail.

### 5. Synthesize The Decision

The main agent writes the final decision, including:

- confirmed root-cause layer, or the first layer to disprove
- implementation sequence
- verification gates
- fail-loud behavior
- what not to change yet
- follow-up issues if the work spans multiple owners

### 6. Stop Before Code Unless Asked

If the user asked for a strategy, stop at the report.

If the user asked to implement after the council, implement only the first agreed slice and add the guardrail before moving to the next layer.

## Required Output Sections

Every council report must include:

1. Executive decision
2. Council question
3. Evidence packet
4. Role positions
5. Disagreements and resolution
6. Consensus implementation sequence
7. Verification gates
8. Fail-loud and recurrence guardrails
9. Open questions
10. Recommended next step

## Default Verification Menu

Start narrow. Do not run the full suite unless the council decides it is necessary.

```bash
npm run rag:verify:chat-architecture
npm run rag:verify:source-specific
node scripts/verify/verify_ai_tool_calling_provider_matrix.mjs
node scripts/verify/verify_ai_intelligence_packet_contract.mjs
node scripts/verify/verify_ai_advisor_quality.mjs
npm run rag:verify:eval-suite:case -- <case-id>
npm run rag:verify:meetings
npm run rag:verify:render-ai
```

Long-running commands belong in a cheaper verification sub-agent with a compact report:

```text
pass/fail:
command:
concise error lines:
likely owner files:
related to current task or unrelated repo debt:
```

## Anti-Patterns

Do not:

- treat council mode as a prettier chat answer
- let agents vote without evidence
- implement a retrieval rewrite before checking intent/provider/packet behavior
- declare consensus when the roles simply repeated the same assumption
- skip the report file
- make "HTTP 200" the success metric
- let a verifier fail silently or remain optional when it protects the chosen strategy

## Done Criteria

The council is complete when:

- the report exists under `docs/ai-plan/councils/`
- each role gave a position with evidence and a guardrail
- disagreements are explicitly resolved or left as named open questions
- the recommended implementation sequence is ordered by risk and dependency
- at least one recurrence-prevention guardrail is named for the first implementation slice
