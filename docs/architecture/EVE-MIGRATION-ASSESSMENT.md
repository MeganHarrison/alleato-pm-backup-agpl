# Eve Migration Assessment

Last verified: 2026-07-05

This is a surface-by-surface recommendation for where Eve should and should not be used in the current Alleato architecture.

## Recommendation summary

| Surface | Current stack | Recommendation | Why |
| --- | --- | --- | --- |
| Ask Alleato main in-app assistant | Next.js + AI SDK v6 + custom `ToolLoopAgent` orchestration | **Keep on current AI SDK stack for now** | This is the primary product surface, already deeply integrated with the frontend streaming contract, tool registry, preview cards, MCP bridge, and retrieval pipeline. A move to Eve here would be a major architecture migration, not a small framework swap. |
| Frontend strategist/specialist orchestration | AI SDK `ToolLoopAgent` in frontend | **Candidate for selective Eve migration later** | The orchestration concerns are real, but this should only move after a deliberate UI/streaming contract migration plan exists. |
| Frontend Procore docs chat | Next.js + AI SDK stream route | **Keep on current AI SDK stack** | This is a narrow streaming RAG endpoint, not a durable workflow problem. Eve adds little here. |
| Frontend MCP tool bridge | `@ai-sdk/mcp` | **Keep on current AI SDK stack** | This is already a clean adapter layer for the chat assistant. No clear Eve benefit. |
| AI Assistant change-event intake workflow | Next.js + AI SDK widget stream + `createChangeEvent` preview/write tool | **Keep on current AI SDK stack; optionally consult backend Deep Agents for evidence** | The user-facing flow is an interactive, turn-by-turn product workflow with live draft state, widget rendering, and preview-first write confirmation. Eve would be too coarse as the primary runtime here; Deep Agents fit only as delegated evidence/research helpers, not as the owner of the form/create loop. |
| Alleato App Expert Eve Lab under `agents/app-expert-eve-lab/` | Eve + AI SDK v7 | **Keep on Eve as an experimental comparison surface** | It is already the correct runtime family for a standalone durable agent package, but it should remain clearly distinct from the production backend App Expert. |
| Backend research agent | Python `deepagents` runtime | **Keep as backend agent runtime** | This is already a durable/backend-style agent with subagents, memory, filesystem backend, and mixed public/internal research tools. |
| Backend app expert | Python `deepagents` runtime | **Keep as backend agent runtime** | Strong fit for skill-driven, read-only, evidence-based delegated work behind a bridge endpoint. |
| Backend docs research agent | Python `deepagents` runtime | **Keep as backend agent runtime** | This is already a focused docs-first delegated agent with its own workspace and MCP-style docs search workflow. |
| Backend Microsoft executive assistant | Python `deepagents` runtime | **Keep as backend agent runtime** | Good fit for delegated operator work with skills, approvals-by-policy, and mailbox-scoped context. |
| Backend content builder | Python `deepagents` runtime | **Keep as backend agent runtime** | Strong fit for durable workspace outputs, packaged skills, subagents, and artifact generation. |
| Backend LLM wiki | Python `deepagents` runtime | **Keep as backend agent runtime** | Durable filesystem workspace plus ingest/query modes already matches the problem well. |
| Backend project intelligence synthesis | Python intelligence pipeline, not deepagents | **Keep as custom backend pipeline** | This is bounded synthesis over structured and RAG data, not an open-ended agent workflow. |

## Bottom line

If the question is "Should Alleato move to Eve?", the answer is:

- **Not as a repo-wide replacement for the current app assistant stack.**
- **Yes as a durable-agent runtime where the problem is actually long-running, workspace-based, skill-based, or subagent-heavy.**

In practice, that means:

- keep the main chat product on AI SDK for now
- keep the backend delegated agent services on their current deep-agent runtime
- keep the standalone `agents/app-expert-eve-lab/` App Expert Eve Lab on Eve
- evaluate only a **future migration of the strategist/orchestrator layer**, not a wholesale rewrite

## Why the main app assistant should stay where it is for now

The main app assistant is not just "an agent." It is a tightly integrated product surface with several frontend-specific contracts:

- streaming response handling through the Next.js route
- AI SDK UI message shaping
- preview-first write tools and confirmation cards
- MCP tool discovery and exposure rules
- retrieval planning and context assembly
- strategist-to-specialist consult flow inside the same frontend assistant stack

Current evidence:

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` is the main streamed chat route.
- `frontend/src/lib/ai/orchestrator.ts` runs the strategist/specialist flow with `ToolLoopAgent`.
- `frontend/src/lib/ai/providers.ts` provides the AI SDK provider wiring.
- `frontend/src/lib/ai/tools/mcp-tools.ts` bridges MCP tools into the current assistant.

This means a migration to Eve for the main assistant would require replacing or adapting:

- the streaming/UI message contract
- the tool call and preview rendering contract
- the current strategist consult pattern
- MCP exposure and tracing behavior
- likely a large portion of the retrieval-to-response path

That is a real architecture project. It is not justified just because Eve is conceptually "closer" to an agent OS.

## Why the backend delegated agents should stay on their current runtime

The backend delegated agents already have the traits that make an agent framework valuable:

- explicit orchestrator names
- packaged memory and skills
- filesystem-backed workspaces
- subagents
- fail-loud prompts
- typed request/response contracts
- endpoint isolation from the main chat UI

### Research agent

`backend/src/services/agents/research_agent/agent.py`

Fit:

- uses `deepagents.create_deep_agent`
- declares subagents including public web and internal research roles
- supports optional durable memory middleware
- is explicitly research-only and read-only

Assessment:

- **Keep as backend agent runtime**
- This is already the kind of delegated, long-running, multi-tool research workload that should not be collapsed into the frontend chat loop.

### App expert

`backend/src/services/agents/app_expert/agent.py`

Fit:

- packaged memory plus skills
- curated artifact-first workflow
- route/help/source-file evidence extraction
- read-only delegated behavior

Assessment:

- **Keep as backend agent runtime**
- This is a good specialist endpoint behind the main strategist, not something that needs to move into the UI-layer agent loop.

### Docs research

`backend/src/services/agents/docs_research_agent/agent.py`

Fit:

- dedicated workspace
- docs MCP search-first behavior
- evidence/citation discipline
- isolated output area

Assessment:

- **Keep as backend agent runtime**
- This is exactly the kind of specialist agent that benefits from isolation.

### Microsoft executive assistant

`backend/src/services/agents/microsoft_executive_assistant/agent.py`

Fit:

- mailbox-scoped runtime
- skills and packaged memory
- explicit hard guardrails around drafts vs sends
- delegated operator workflow

Assessment:

- **Keep as backend agent runtime**
- This surface has side-effect risk and domain-specific behavior; keeping it behind a backend boundary is correct.

### Content builder

`backend/src/services/agents/content_builder/agent.py`

Fit:

- durable workspace outputs
- generated artifacts
- subagent-based research
- optional image generation
- skill-driven workflow

Assessment:

- **Keep as backend agent runtime**
- Strong fit for a durable agent runtime; weak fit for the main chat orchestrator.

### LLM wiki

`backend/src/services/agents/llm_wiki/agent.py`

Fit:

- persistent wiki workspace model
- ingest and query/review modes
- filesystem permissions
- artifact durability concerns

Assessment:

- **Keep as backend agent runtime**
- This is operationally closer to a durable research workspace than to an interactive chat assistant.

## Why project intelligence synthesis should not be forced into Eve

`backend/src/services/intelligence/project_intelligence.py`

This service is a bounded synthesis pipeline:

- load prior packet
- compute delta window
- load new evidence
- build deterministic structured snapshot
- perform one synthesis pass
- write one packet

That is a pipeline/compiler shape, not an agent-OS shape.

Assessment:

- **Keep as custom backend pipeline**
- Do not migrate this just to make the stack look uniform.

## The one real Eve candidate inside the main app

The main place where Eve could become valuable later is the **strategist/orchestrator layer** now living in:

- `frontend/src/lib/ai/orchestrator.ts`
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`

Why this is the only serious candidate:

- it owns specialist routing
- it accumulates growing tool inventory and policy logic
- it increasingly resembles a durable control plane rather than a simple chat route

Why it should still wait:

- current UI and preview contracts are already product-critical
- the main assistant is entangled with retrieval, widgets, MCP, and tool traces
- migrating the orchestrator first would likely force a larger assistant protocol migration

Recommendation:

- **Candidate for later migration only if one of these becomes painful enough to justify it:**
- multi-turn durable execution across long-lived sessions
- resumable approvals/workflows inside the main product assistant
- repeated pressure to move strategist logic out of the request/response route
- duplicated orchestration semantics across frontend AI SDK and backend deep-agent services

## Change-event assistant workflow decision

The conversational change-event flow should stay owned by the main AI Assistant
stack for now.

Use the **AI SDK / frontend assistant path** for:

- intent routing from chat into `change_event_write`
- live intake widgets such as `change_event_workflow`
- turn-by-turn draft updates visible to the user
- preview-first `createChangeEvent confirmed=false`
- explicit user confirmation before `confirmed=true`
- trace/debug metadata that explains why the final preview is or is not ready

Use **backend Deep Agents** only as delegated support when the change event needs
evidence that does not fit a single lightweight retrieval pass, such as:

- researching related RFIs, meetings, drawings, emails, Teams messages, specs,
  daily logs, or project history
- summarizing evidence gaps and source confidence
- preparing a broader project-risk or change-exposure packet

Do **not** make Eve the primary runtime for this workflow yet. Eve is a better
fit for standalone durable agents, scheduled maintainers, webhook/channel
agents, approval workflows outside the product chat, or experimental comparison
surfaces. The change-event assistant is currently a product UI workflow with a
native write tool and custom React cards, so moving it to Eve would require a
larger streaming/UI/tool-contract migration without solving the immediate
problem of bad intake, missing state, or poor tool selection.

Recommended architecture:

1. Frontend chat route owns the conversational product contract.
2. Shared workflow model owns draft/checklist/readiness state.
3. `createChangeEvent` remains the only write owner for change-event creation.
4. Backend Deep Agents can attach evidence packets, but cannot bypass preview
   and confirmation.
5. Debug console should show the routing decision, workflow state, retrieval
   sources, delegated deep-agent calls, and final write-tool readiness.

## Practical decision framework

Use **AI SDK-first** when the surface is:

- a chat/product UI
- a streaming endpoint
- a narrow tool-calling assistant
- tightly coupled to custom frontend rendering

Use **durable agent runtime/Eve-style runtime** when the surface is:

- long-running
- subagent-heavy
- workspace/artifact based
- skill/memory driven
- asynchronous or resumable
- safer behind a backend boundary

## My recommendation for Alleato

### Keep

- Ask Alleato main chat on current AI SDK stack
- Procore docs chat on current AI SDK stack
- frontend MCP bridge on current AI SDK stack
- backend research/app-expert/docs-research/Microsoft/content-builder/LLM-wiki on their current backend agent runtime
- project intelligence synthesis as a custom backend compiler/pipeline
- standalone `agents/app-expert-eve-lab/` package on Eve

### Evaluate later

- migrating the **main strategist/orchestrator** into an Eve-backed runtime only if the current frontend route becomes an operational bottleneck

### Do not do

- do not attempt a repo-wide "standardize everything on Eve" project
- do not rewrite narrow AI SDK chat endpoints just for stack purity
- do not collapse the backend specialist agents back into the frontend assistant loop

## Biggest architectural risk right now

The main risk is not "wrong framework choice." The risk is **split orchestration semantics**:

- frontend AI SDK strategist/orchestrator
- backend deep-agent specialists
- standalone Eve package

If this causes drift, the fix is not an immediate rewrite. The first fix is to standardize:

- shared agent taxonomy
- tool ownership boundaries
- approval semantics
- trace/event naming
- handoff contracts between strategist and delegated specialists

Only after that should a runtime consolidation be considered.
