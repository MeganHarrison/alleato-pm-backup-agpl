# Alleato System Map

Last verified: 2026-07-28

This is the current runtime-ownership map. It intentionally documents only
active owners; retired comparison runtimes and migration scaffolding do not
belong in the source tree.

## Runtime ownership

```text
Alleato PM
├── frontend/                         Next.js product on Vercel
│   ├── pages and shared UI
│   ├── authenticated app APIs
│   └── Eve transport and tool bridge
├── agents/alleato-assistant/        only interactive Assistant runtime
│   ├── one Eve root agent
│   ├── six executive skills
│   ├── request-scoped tools
│   └── Eve channel/auth boundary
├── backend/                          FastAPI operational services on Render
│   ├── ingestion and source sync
│   ├── OCR, parsing, chunking, embeddings
│   ├── project-intelligence compilers
│   └── active workflow-specific services
└── supabase/                         data contract
    ├── app records and RLS
    ├── assistant history and durable turns
    ├── RAG records and pgvector RPCs
    └── migrations
```

## Decision table

| Work | Canonical owner |
| --- | --- |
| Page, form, table, modal, or product workflow | `frontend/src/app/**`, `frontend/src/components/**`, `frontend/src/features/**` |
| User-authenticated application read/write | `frontend/src/app/api/**` plus shared services |
| Interactive Alleato AI reasoning, skill selection, and tool use | `agents/alleato-assistant/**` |
| Assistant browser transport and authenticated tool catalog | `frontend/src/app/api/ai-assistant/eve/**` |
| Shared Assistant client state and rendering | `frontend/src/hooks/use-alleato-eve-chat.ts`, `frontend/src/components/ai-assistant/**` |
| Fireflies, Graph, OneDrive, OCR, embeddings, backfills, or scheduled processing | `backend/src/services/**` |
| Schema, RLS, RPC, enum, or table change | `supabase/migrations/**` plus generated database types |

## Interactive Assistant

The product has one interactive generation owner: Eve.

```text
/ai or Ask Alleato
  -> useAlleatoEveChat
  -> /api/ai-assistant/eve/proxy/**
  -> agents/alleato-assistant
  -> /api/ai-assistant/eve/tools
  -> existing authenticated application services
  -> Eve stream
  -> chat-history projection
```

There is no runtime selector and no fallback generator. A failure at the Eve,
tool, provider, permission, or persistence boundary returns a structured error;
the request is not rerouted to another model loop.

The root agent lives at `agents/alleato-assistant/agent/agent.ts`. Executive
specialization is implemented as Markdown skills under
`agents/alleato-assistant/agent/skills/`, not separate CFO/COO/CRO/CHRO/CMO/VP
agent runtimes.

Important boundaries:

- `agents/alleato-assistant/agent/channels/eve.ts` validates the signed-in user.
- `frontend/src/app/api/ai-assistant/eve/proxy/[...path]/route.ts` authenticates
  browser traffic and bridges durable turn state.
- `frontend/src/app/api/ai-assistant/eve/tools/route.ts` exposes the
  request-scoped tool catalog with surface, project, permission, and effect
  constraints.
- `frontend/src/lib/ai/eve-runtime/**` adapts the canonical application tool
  registry for Eve.
- `frontend/src/app/api/ai-assistant/messages/[sessionId]/route.ts` projects
  completed Eve messages into application chat history. It does not generate.

## Tools and skills

Use a skill when adding expertise, analysis procedure, evidence requirements, or
answer format. Use a tool when Eve needs a new deterministic capability to read
or change application state.

```text
User question
  -> root instructions classify the job
  -> Eve loads the relevant skill
  -> Eve chooses only the tools needed for that skill
  -> tools execute under the signed-in user's permissions
  -> Eve synthesizes one evidence-backed answer
```

Write tools must keep preview, confirmation, validation, audit, and permission
checks in deterministic application code. Model output never directly mutates a
table.

## Backend operational services

Render remains the owner for work that must continue independently of a browser:
source synchronization, ingestion, OCR, parsing, chunking, embeddings, scheduled
jobs, large backfills, and project-intelligence compilation.

Some backend workflow services use agent libraries internally. They are active
workflow implementations, not selectable Assistant personalities and not
fallbacks for `/ai`. If Eve needs one, it must be reached through a named,
authenticated tool with a bounded request/response contract.

ASRS and other dedicated AI product endpoints remain separate active features.
They do not answer `/ai` turns.

## Supabase

Supabase owns shared data contracts:

- authenticated app data and relationships;
- assistant conversations, messages, and durable turn receipts;
- RAG metadata, chunks, and vector search;
- migrations, RLS, RPCs, and generated TypeScript types.

Database behavior is incomplete until the migration is applied and the remote
ledger verifies it.

## How to add Assistant functionality

1. Decide whether the change is behavior or capability.
2. Add behavior to the closest existing Eve skill; create a skill only when the
   procedure is genuinely distinct.
3. Add deterministic data/action capability to the canonical application tool
   registry and Eve adapter.
4. Preserve auth, project scope, surface policy, effect metadata, approval, and
   audit contracts.
5. Add a focused test and a real authenticated browser proof.
6. Run `npm run verify:eve-only-runtime` so no parallel generator is introduced.

## Failure-loud contract

- Runtime startup failures identify Eve.
- Tool failures identify the tool and failed application boundary.
- Permission failures identify the missing scope without leaking secrets.
- Persistence failures do not present an untracked answer as successful.
- Unsupported durable cancellation returns
  `EVE_DURABLE_CANCEL_UNAVAILABLE`; it does not falsify turn state.
- Source-backed answers expose tool/evidence steps in the conversation trace.

## Current source index

- `docs/architecture/AI-ASSISTANT-ARCHITECTURE-REFERENCE.md`
- `docs/architecture/AI-ASSISTANT-GENERATION-OWNERSHIP-AUDIT.md`
- `docs/architecture/AGENT-SDK-MAP.md`
- `docs/architecture/PROJECT-MAP.md`
- `docs/architecture/SYSTEM-MAP.md`
- `docs/architecture/tables.yaml`
