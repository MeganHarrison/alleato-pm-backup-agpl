# Agent SDK Map

Last verified: 2026-07-05

This file answers one narrow question: which SDK/runtime builds each agent surface in this repo.

## Short answer

- The main in-app AI assistant is built on **Vercel AI SDK v6**.
- The separate `agents/app-expert-eve-lab/` workspace is the **Alleato App Expert Eve Lab**, built on **Eve** with **AI SDK v7** in that package.
- The backend "deep agent" and specialist services are **not** the frontend AI SDK stack. They are custom Python backends that the frontend calls through bridge endpoints.

## Surface map

| Surface | Primary runtime | SDK / package | Entry points | Notes |
| --- | --- | --- | --- | --- |
| In-app AI assistant chat | Next.js frontend | `ai` v6 + `@ai-sdk/openai` + `@ai-sdk/mcp` + `@ai-sdk/react` | `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, `frontend/src/lib/ai/orchestrator.ts`, `frontend/src/lib/ai/providers.ts` | Main Strategist + specialist consult flow. |
| Procore docs chat | Next.js frontend | `ai` v6 | `frontend/src/app/api/procore-docs/chat/route.ts` | Separate streaming RAG chat surface, same AI SDK family. |
| Frontend tool layer | Next.js frontend | `ai` v6 tools API | `frontend/src/lib/ai/tools/*.ts` | Read/write tools defined with `tool(...)`. |
| Frontend MCP bridge | Next.js frontend | `@ai-sdk/mcp` | `frontend/src/lib/ai/tools/mcp-tools.ts` | Pulls remote MCP tools into the assistant tool registry. |
| Alleato App Expert Eve Lab | Eve runtime | `eve` + `ai` v7 | `agents/app-expert-eve-lab/agent/agent.ts`, `agents/app-expert-eve-lab/agent/channels/eve.ts` | Experimental standalone app-help comparison surface, separate from the production backend App Expert and the main app assistant. |
| Backend research / app-expert / docs research agents | FastAPI backend | Custom Python agent runtimes | `backend/src/services/agents/**`, `backend/src/api/main.py` | Frontend reaches these through bridge endpoints; this is a different stack than the frontend AI SDK assistant. |
| Backend project intelligence synthesis | FastAPI backend | Custom Python intelligence pipeline | `backend/src/services/intelligence/project_intelligence.py` | AI-powered synthesis, but not the frontend AI SDK agent loop. |

## Evidence

### 1. Main assistant uses Vercel AI SDK v6

Frontend dependencies:

- `frontend/package.json` declares `@ai-sdk/devtools`, `@ai-sdk/mcp`, `@ai-sdk/openai`, `@ai-sdk/react` and `ai` v6.
- `package.json` at repo root also includes `ai` v6 for shared repo tooling.

Runtime imports:

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` imports `streamText`, `createUIMessageStream`, and `createUIMessageStreamResponse` from `"ai"`.
- `frontend/src/lib/ai/providers.ts` uses `createOpenAI` from `@ai-sdk/openai`.
- `frontend/src/lib/ai/orchestrator.ts` imports `ToolLoopAgent`, `stepCountIs`, and `tool` from `"ai"`.

Architecture shape:

- The Strategist runs in the chat route and can call specialist consult tools.
- Specialists are instantiated as `ToolLoopAgent` instances with bounded step counts.
- MCP tools are loaded through `createMCPClient(...)` in `frontend/src/lib/ai/tools/mcp-tools.ts`.

### 2. The separate `agents/app-expert-eve-lab/` package is the Eve Lab, not the same app assistant runtime

Package/runtime:

- `agents/app-expert-eve-lab/package.json` is named `alleato-app-expert-eve-lab` and declares `eve` and `ai` v7.
- `agents/app-expert-eve-lab/agent/agent.ts` defines the agent with `defineAgent(...)` from `"eve"`.
- `agents/app-expert-eve-lab/agent/channels/eve.ts` defines delivery/auth with `eveChannel(...)`.
- `agents/app-expert-eve-lab/agent/instructions.md` identifies the agent as an experimental read-only App Expert lab, not the production App Expert wired into the app assistant.

Implication:

- This package is part of the same repo, but it is a distinct agent runtime from the main in-app assistant and from the backend App Expert.
- It is on a newer AI SDK major version than the frontend app.

### 3. Backend deep-agent surfaces are bridged, not native frontend AI SDK agents

Frontend bridge:

- `frontend/src/lib/ai/deep-agent-bridge.ts` calls backend endpoints like `/api/intelligence/research` and `/api/intelligence/app-expert`.
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` imports that bridge and labels those paths as `render-backend-deep-agents-v1`.

Backend runtime:

- `backend/src/api/main.py` exposes `/api/intelligence/research`, `/api/intelligence/app-expert`, and `/api/intelligence/deep-agent/docs-research`.
- `backend/src/services/agents/research_agent/agent.py` is the current deep research runtime.
- `backend/src/services/agents/app_expert/agent.py` is the app-expert backend runtime.
- `backend/src/services/intelligence/project_intelligence.py` is the rolling project-intelligence synthesis layer.
- `backend/src/services/ai_transport.py` shows the backend provider path centered on the Vercel AI Gateway base URL, but the backend runtime itself is Python, not the frontend `ToolLoopAgent` stack.

## Current version split

| Area | Current package version |
| --- | --- |
| Frontend assistant | `ai@^6.0.175` |
| Frontend provider layer | `@ai-sdk/openai@^3.0.25` |
| Frontend React bindings | `@ai-sdk/react@^3.0.177` |
| Frontend MCP layer | `@ai-sdk/mcp@^1.0.36` |
| Repo root shared package | `ai@^6.0.134` |
| Standalone `agents/app-expert-eve-lab/` package | `ai@^7.0.0` + `eve@^0.17.1` |

## Practical interpretation

- If someone asks "what SDK powers Ask Alleato in the app?", the answer is **Vercel AI SDK v6**.
- If someone asks "what powers the separate repo-level App Expert Eve Lab under `agents/app-expert-eve-lab/`?", the answer is **Eve + AI SDK v7**.
- If someone asks "are the backend deep agents the same SDK as the frontend assistant?", the answer is **no**. The frontend assistant can call them, but they are separate Python runtimes behind backend endpoints.

## Risk to watch

The repo currently spans multiple agent stacks and AI SDK major versions:

- frontend assistant on AI SDK v6
- repo root package on AI SDK v6
- standalone `agents/app-expert-eve-lab/` App Expert Eve Lab on AI SDK v7
- backend agent services on custom Python runtimes

That split is not inherently wrong, but it raises migration and maintenance risk whenever agent contracts, streaming behavior, or tool schemas need to be shared across surfaces.
