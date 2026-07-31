# Alleato System Map

Last verified: 2026-07-06

This guide explains how the main Alleato PM layers fit together and how to decide where new work belongs. It is written for evaluating efficiency: which runtime owns which job, where duplication is risky, and where Vercel's newer agent-stack capabilities may simplify future work.

## The Short Version

Alleato PM is not one application runtime. It is a product app, an operational backend, a database, and several agent surfaces that should not be treated as interchangeable.

```text
User-facing product
  frontend/ Next.js on Vercel
  pages, forms, tables, auth-aware API routes, AI chat streaming

Operational backend
  backend/ FastAPI on Render
  ingestion, Fireflies, Microsoft Graph, OCR, embeddings, scheduled jobs

Database and search source of truth
  Supabase
  app records, auth, migrations, RAG chunks, pgvector RPC functions

Product AI runtime
  frontend/src/app/api/ai-assistant/chat/**
  frontend/src/lib/ai/**
  AI SDK streaming, tools, RAG retrieval, prompt assembly, memory, traces

Backend specialist agents
  backend/src/services/agents/**
  Python app-expert, research, docs-research, Microsoft executive assistant, and intelligence services

Standalone agent workspaces
  agents/**
  Eve app-help agent plus separate maintainer/triage agents
```

## Decision Rules

| If the work is... | Put it here | Why |
| --- | --- | --- |
| A page, table, form, modal, route UI, or user workflow | `frontend/src/app/**`, `frontend/src/components/**`, `frontend/src/features/**` | The Next.js frontend owns the user experience and protected app routes. |
| A user-triggered app read/write with Supabase auth | `frontend/src/app/api/**` plus `frontend/src/lib/**` helpers | App API routes can enforce user auth, shape responses for UI, and fail loudly through shared guardrails. |
| A schema, table, RPC, RLS, or enum change | `supabase/migrations/**` and generated `frontend/src/types/database.types.ts` | Database shape is the contract. Generated types must match it before code depends on it. |
| Fireflies, Graph, OneDrive, OCR, embedding, scheduled backfill, source freshness, or long-running ingestion | `backend/src/services/**` on Render | The FastAPI backend owns operational processing that is not tied to one browser request. |
| Product AI chat, tool calling, RAG answer generation, memory, AI UI streaming | `frontend/src/app/api/ai-assistant/chat/**` and `frontend/src/lib/ai/**` | The active in-app assistant runs through Next.js and AI SDK primitives. |
| A backend specialist answer that needs Python ingestion/intelligence context | `backend/src/services/agents/**` plus a frontend bridge | These are separate backend runtimes; the frontend calls them, it does not host them. |
| A read-only documentation-grounded app expert or external operational assistant | `agents/**` | These are separate agent workspaces, not the main product assistant. |
| A multi-step process that must pause, resume, wait for approval, or survive deploys | Consider Vercel Workflows or Eve | Durable execution is the product value; do not hand-roll state machines unless the app already owns the workflow. |
| A third-party action that should use short-lived delegated credentials | Consider Vercel Connect | Connect is useful when provider tokens should be scoped and issued at runtime instead of stored as long-lived env vars. |
| Running agent-generated or untrusted code | Consider Vercel Sandbox | Sandbox is for isolated command/code execution, not normal app business logic. |

## Frontend: Product Runtime

Primary folders:

- `frontend/src/app/**`: Next.js App Router pages and API routes.
- `frontend/src/components/**`: shared UI, layout, and domain components.
- `frontend/src/features/**`: feature-specific client/table/view logic.
- `frontend/src/hooks/**`: React hooks for client data and state.
- `frontend/src/lib/**`: shared server/client helpers, services, schemas, guardrails, and AI runtime code.

Use the frontend when the work is directly user-facing or when an API route exists to serve the app shell. The frontend should not become a background processing engine. If a request may run for minutes, fan out across source systems, or retry independently from a browser session, it likely belongs in the backend or a durable workflow.

Important AI files in the frontend:

- `frontend/src/app/api/ai-assistant/chat/route.ts`: public chat route wrapper, including max duration and guardrails.
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`: main in-app assistant handler.
- `frontend/src/lib/ai/provider-config.ts`: provider path selection, preferring Vercel AI Gateway when configured.
- `frontend/src/lib/ai/tools/**`: tool-calling surface for reads, writes, RAG, operational actions, and app help.
- `frontend/src/lib/ai/retrieval/**`: retrieval planning and execution.
- `frontend/src/lib/ai/orchestrator.ts`: strategist/specialist orchestration.

## Backend: Operational Engine

Primary folders:

- `backend/src/api/**`: FastAPI entry points and route registration.
- `backend/src/services/ingestion/**`: Fireflies and source ingestion logic.
- `backend/src/services/integrations/microsoft_graph/**`: Outlook, Teams, OneDrive, subscriptions, and embedding.
- `backend/src/services/integrations/azure/**`: Azure Document Intelligence integration.
- `backend/src/services/pipeline/**`: parsing, chunking, embedding, extraction, and document processing.
- `backend/src/services/intelligence/**`: project intelligence compilation and synthesis.
- `backend/src/services/agents/**`: backend specialist agent runtimes.
- `backend/src/services/scheduler.py`: scheduled job ownership.

The backend is the right home for work that continues even if nobody is looking at a page: syncing provider data, OCR, vectorization, scheduled health checks, source freshness, and large backfills. The current backend README states the backend does not own the production AI chat, user auth, or Procore-style product features; those are frontend/app concerns.

## Supabase: Contract Layer

Supabase is not just storage. It is the shared contract for:

- app records and auth-backed relationships;
- generated TypeScript DB types;
- migrations and migration ledger truth;
- pgvector-backed RAG tables;
- RPC functions used by the assistant and search flows.

Before writing database code, regenerate and inspect `frontend/src/types/database.types.ts`. If a migration changes behavior, the fix is not complete until the migration is applied or explicitly marked deferred with ledger evidence.

## Product AI Runtime: AI SDK in the App

The in-app assistant is an AI SDK-based Next.js runtime. Current installed AI SDK docs describe the AI SDK as a TypeScript toolkit for AI applications and agents across frameworks, with Core APIs for text, structured output, tools, streaming, and agents.

In this repo, use the AI SDK layer when the job is:

- responding to a user in chat;
- streaming UI text or tool progress;
- calling app tools with typed inputs;
- routing to RAG retrieval;
- producing structured output inside a request;
- previewing and confirming app writes.

Do not use the AI SDK route as a generic queue or ingestion worker. It is best for request/response and streaming interactions. If the job needs deterministic multi-step state, delayed continuation, or human approval over hours/days, evaluate Vercel Workflows or Eve.

Current local AI SDK references:

- `frontend/node_modules/ai/docs/00-introduction/index.mdx`
- `frontend/node_modules/ai/docs/03-agents/01-overview.mdx`
- `frontend/node_modules/ai/docs/03-agents/02-building-agents.mdx`

## Deep Agents: Backend Specialists

In Alleato PM, "deep agents" are backend specialist runtimes, not the same thing as the frontend AI SDK assistant.

Use backend deep-agent paths when:

- the work needs backend-only source processing context;
- the job depends on Python ingestion/intelligence services;
- the frontend should receive a compact result from a specialist service;
- the answer needs app-expert, docs-research, or research-agent behavior that already exists in `backend/src/services/agents/**`.

Do not move ordinary app writes into backend deep agents unless there is a clear ownership reason. User-confirmed product writes should generally stay in frontend API routes or shared services so they preserve auth, audit, validation, and UI feedback contracts.

Source pointers:

- `frontend/src/lib/ai/deep-agent-bridge.ts`
- `backend/src/services/agents/app_expert/agent.py`
- `backend/src/services/agents/research_agent/agent.py`
- `backend/src/services/agents/docs_research_agent/agent.py`
- `backend/src/services/agents/microsoft_executive_assistant/agent.py`

## App Expert Surfaces

There are two App Expert surfaces, and they should stay named differently so their responsibilities are obvious.

| Surface | Runtime | Name | User-facing role | Current owner |
| --- | --- | --- | --- | --- |
| Production in-app App Expert | FastAPI backend Deep Agents runtime | Backend App Expert | Answers app-help questions inside the main AI assistant through `app_help` retrieval. It should feel like the same Alleato AI personality to end users. | `backend/src/services/agents/app_expert/**`, reached by `frontend/src/lib/ai/deep-agent-bridge.ts` |
| Experimental Eve comparison agent | Eve + AI SDK v7 under `agents/app-expert-eve-lab/` | Alleato App Expert Eve Lab | Standalone read-only app-help lab for comparing Eve behavior against the production backend App Expert. It should not be treated as the system of record unless deliberately promoted. | `agents/app-expert-eve-lab/package.json`, `agents/app-expert-eve-lab/agent/agent.ts`, `agents/app-expert-eve-lab/agent/instructions.md`, `agents/app-expert-eve-lab/agent/tools/search_app_help.ts` |

The frontend AI assistant should expose one consistent personality. Users should not have to know whether an answer came from local AI SDK tools, backend App Expert, Microsoft Executive Assistant, RAG retrieval, or another specialist. The product contract is one assistant with traceable internal delegation.

The developer contract is different: internal tools should show which route, planner, retrieval packet, backend agent, model/provider path, tool calls, eval checks, and response-quality scores were used so bad answers can be debugged without guessing.

## Eve: Separate Agent Runtime

The `agents/app-expert-eve-lab/` workspace is the Alleato App Expert Eve Lab,
not the same runtime as Ask Alleato.

Current local source:

- `agents/app-expert-eve-lab/package.json`: declares `eve`, `@vercel/connect`, and `ai`; its package name is `alleato-app-expert-eve-lab`.
- `agents/app-expert-eve-lab/agent/agent.ts`: defines the agent with `defineAgent(...)`.
- `agents/app-expert-eve-lab/agent/instructions.md`: defines an experimental read-only App Expert lab.
- `scripts/dev/eve.sh`: runs Eve through the repo's Node 24 wrapper.

Use Eve when the desired product is an agent as its own unit: model, instructions, tools, skills, channels, evals, schedules, subagents, and approvals. Eve is a good fit for a documentation-grounded app expert, GitHub/Linear triage agent, Slack/Teams operational assistant, or long-running investigator.

Do not use Eve as a default replacement for:

- normal app pages;
- Supabase-backed CRUD routes;
- existing backend ingestion jobs;
- the current in-app AI chat unless you intentionally migrate the product assistant runtime.

## Vercel Agent-Stack Capabilities

These are useful, but they solve different problems.

| Capability | Use when | Avoid when |
| --- | --- | --- |
| AI SDK | You need TypeScript model calls, structured output, tool calling, streaming, or reusable in-app agents. | You need durable execution over hours/days or background ingestion. |
| AI Gateway | You want one provider path and model routing through Vercel-compatible model IDs. | You are debugging provider-specific behavior that requires direct provider APIs. |
| Workflows | A task must pause, resume, wait for hooks/approvals, retry steps, and survive deployments. | A normal request/response route or cron is enough. |
| Connect | Agents/services need runtime third-party tokens scoped to users, teams, projects, or environments. | A stable backend service credential is simpler and already secure enough. |
| Sandbox | Agent output or user code must run isolated from production systems. | You only need to call an API or update app records. |
| Eve | You are building a standalone agent with tools, skills, channels, evals, subagents, and approvals. | You are building a normal product screen or app API route. |

Official docs checked for this guide:

- [Vercel AI SDK](https://vercel.com/docs/ai-sdk)
- [Vercel Workflows](https://vercel.com/docs/workflows)
- [Vercel Connect](https://vercel.com/docs/connect)
- [Vercel Sandbox](https://vercel.com/docs/sandbox)
- [Eve launch/reference context](https://vercel.com/blog/introducing-eve)

## Common Confusions

### "Does Vercel replace Render?"

Not automatically. Vercel hosts the frontend and can run functions, workflows, and agent infrastructure. Render currently hosts the FastAPI backend that owns ingestion, Graph, OCR, embeddings, and scheduled operational jobs. Migrating backend jobs to Vercel should be a deliberate platform decision with runtime, timeout, credential, and observability proof.

### "Should every AI feature use Eve?"

No. Use the existing AI SDK assistant path for in-app chat/tool experiences. Use Eve when the agent is its own product/runtime with independent tools, channels, evals, schedules, or approvals.

### "Are deep agents and Eve the same?"

No. Backend deep agents are custom Python services behind the FastAPI backend. Eve is a TypeScript agent framework/workspace under `agents/app-expert-eve-lab/`. The frontend can call either, but they are different runtimes.

### "Why are there two App Experts?"

The production Backend App Expert was built to answer app-help questions inside the main AI assistant with generated sitemap, feature registry, curated help articles, runtime skills, evals, and backend traces. The Eve version is now named Alleato App Expert Eve Lab because it is a standalone comparison surface for learning whether Eve produces better app-help behavior. Keep both only while the lab has an explicit comparison purpose.

### "Should database writes happen from AI tools?"

Only through preview/confirm, validation, auth, and audit. The safer pattern is an AI tool that proposes a structured write, then app-owned API/service code executes it after confirmation. Do not let model output directly mutate tables without deterministic checks.

### "When should Workflows be introduced?"

Introduce Workflows when the current implementation is becoming a hand-rolled durable state machine: repeated polling, long sleeps, retries, approvals, webhooks, partial progress storage, or version-skew problems. Do not introduce Workflows just because a function has multiple steps.

## Efficiency Audit Checklist

Use this checklist when evaluating whether a feature is built efficiently:

- Is there one clear owner runtime for the workflow?
- Does the UI call a focused app API instead of knowing database details directly?
- Are long-running jobs outside browser request lifetimes?
- Are source-system credentials owned by the backend, Connect, or another explicit provider path?
- Are database contracts generated and checked before use?
- Are AI tools typed, auditable, and bounded by confirmation for writes?
- Does the failure mode produce a specific error, trace, health row, ledger entry, or verifier failure?
- Is the same behavior implemented in only one place?
- Does the runtime choice match the user-visible job rather than the novelty of the platform?

## Recommended Consolidation Path

1. Keep the existing frontend/backend boundary stable while documenting every active AI surface.
2. Create a single "AI runtime inventory" table that lists each assistant/agent, owner runtime, entry point, model/provider path, write permissions, and verification command.
3. Identify duplicate agent responsibilities before migrating anything to Eve or Workflows.
4. Pilot Vercel Workflows on one approval-gated, long-running process instead of the whole backend.
5. Pilot Vercel Connect on one third-party action where short-lived delegated tokens clearly reduce secret risk.
6. Keep Render-backed ingestion jobs on Render until a Vercel replacement proves equivalent scheduling, retries, logs, credentials, and cost behavior.

## AI Assistant Page Split

Alleato should have two AI assistant surfaces with the same underlying production assistant contract but different visibility.

| Page | Audience | Purpose | Should show |
| --- | --- | --- | --- |
| End-user assistant | PMs, executives, accounting, field/users | Ask questions, create drafts/previews, get project answers, perform approved actions. | Clean conversation, source links, confidence/freshness indicators, confirmation cards, recovery messages. |
| Developer/test console | Product, engineering, ops, AI maintainers | Debug bad answers and compare routing/agent behavior. | Intent classification, planner output, selected retrieval paths, tool trace, backend agent calls, model/provider path, prompt/context packet summary, source coverage, response-quality scores, eval case links, raw failure envelopes. |

The end-user page should not expose implementation complexity. It should feel like one consistent Alleato AI personality even when it delegates internally.

The developer/test console should make the hidden process inspectable. A bad response should be diagnosable by answering:

- Which intent did the router choose?
- Which retrieval path ran?
- Did Backend App Expert, Microsoft Executive Assistant, RAG, or local AI SDK tools answer?
- Which sources were used or missing?
- Which model/provider path ran?
- Which tool failed, timed out, or returned empty?
- Was there an eval case that should have caught this?
- Did the response violate source, freshness, or action-preview contracts?

This console should be separate from the production assistant UI, likely under an admin or development route, so debugging controls and raw traces do not add product noise for normal users.

## Failure-Loud Rules

- If an AI answer depends on RAG, the response path must expose source/citation or retrieval trace evidence.
- If an agent uses tools, tool calls must be visible in logs/traces/evals.
- If a workflow writes to the app, the write must be previewed, confirmed, validated, and audited.
- If an ingestion job skips work, the skip reason must be queryable.
- If a provider path changes, read back the provider configuration and run a targeted verifier.
- If a new runtime is introduced, document why the existing owner runtime is insufficient.
