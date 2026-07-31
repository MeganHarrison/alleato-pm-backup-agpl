# AI Assistant Architecture Reference

Status: Current

Interactive route: `/ai`

Generation owner: `agents/alleato-assistant`

## Ownership contract

The interactive Alleato assistant has exactly one generation owner: the Eve
agent in `agents/alleato-assistant`.

The frontend does not select a runtime and does not fall back to another
generator. Startup, authentication, tool-catalog, streaming, and persistence
failures must be returned as structured errors from the boundary that failed.

The `/api/ai-assistant/**` prefix remains the application API namespace for Eve
proxying, durable messages, conversations, tools, feedback, memories, skills,
and workspace data. It is not a legacy UI route and must not be renamed as part
of the UI namespace consolidation.

## Request path

```text
GET /ai
  -> frontend Eve client
  -> /api/ai-assistant/eve/proxy/**
  -> agents/alleato-assistant
  -> authenticated request-scoped tool catalog
  -> /api/ai-assistant/eve/tools
  -> shared application tool implementations
```

There is no generation branch between `/ai` and Eve.

## Runtime boundaries

| Boundary | Owner | Responsibility |
| --- | --- | --- |
| Browser entry point | `frontend/src/app/(main)/ai/page.tsx` | Mount the interactive assistant |
| Eve client | `frontend/src/hooks/use-alleato-eve-chat.ts` | Connect to Eve, resume sessions, and persist completed messages |
| Proxy | `frontend/src/app/api/ai-assistant/eve/proxy/[...path]` | Authenticate forwarding, bridge durable turns, and preserve structured errors |
| Durable turn state | `frontend/src/lib/ai/assistant-turn` | Own turn state transitions, events, approvals, and persistence |
| Agent | `agents/alleato-assistant/agent/agent.ts` | Own model generation |
| Channel authentication | `agents/alleato-assistant/agent/channels/eve.ts` | Verify user, surface, project, turn, and session context |
| Instructions | `agents/alleato-assistant/agent/instructions.md` | Define evidence, citation, skill, and tool-use behavior |
| Tool bridge | `agents/alleato-assistant/agent/tools/production_read_tools.ts` | Load and execute the authenticated request-scoped catalog |
| Tool catalog API | `frontend/src/app/api/ai-assistant/eve/tools/route.ts` | Enforce user, project, surface, durable-turn, permission, and effect constraints |
| Tool registry | `frontend/src/lib/ai/eve-runtime` | Own the canonical 131-tool manifest and request-scoped catalog implementation |
| Tool implementations | `frontend/src/lib/ai/tools` | Read application data and perform approved application operations |

## Skills

Executive-specialist behavior is expressed as Markdown skills loaded by the
single Eve agent:

```text
agents/alleato-assistant/agent/skills/
├── business-development.md
├── financial-analysis.md
├── marketing-strategy.md
├── operations-review.md
├── people-capacity.md
└── risk-review.md
```

Skills provide domain instructions. They are not independent generation
runtimes and do not own conversations.

## Tool selection and authorization

Eve selects tools from the catalog returned for the authenticated request. The
catalog is derived from shared production tool definitions and filtered by:

- assistant surface;
- authenticated user;
- project access;
- durable turn identity;
- tool effect and permission metadata;
- provider availability.

The server owns these constraints. Browser input cannot grant project access,
write permission, delivery permission, or a different assistant surface.

The two ASRS tools remain owned by the dedicated ASRS product runtime and are
explicitly outside the Eve registry. This is a current ownership boundary, not
migration comparison metadata.

## Durable state

Eve session state and application conversation state are distinct:

- Eve owns protocol events and continuation state.
- `AssistantTurn` owns durable turn transitions and approval state.
- Application conversation/message APIs own reloadable chat history.

The proxy connects these stores without making the frontend a generation owner.
Refresh and resume must continue the same verified session and durable turn
contract.

## Canonical UI routes

```text
/ai
/ai/approvals
/ai/feature-requests
/ai/feature-requests/[requestId]
/ai/marketing
/ai/profile
/ai/skills
/ai/teach
```

Only the canonical `/ai` UI namespace is supported. `/ai-assistant-debug` is a
separate admin diagnostics route and is intentionally retained.

## Failure contract

The system must fail at the boundary that cannot complete:

- Eve unavailable: proxy returns an Eve connection/startup error.
- Authentication invalid: auth boundary returns an authentication error.
- Project forbidden: tool catalog returns a project-access error.
- Tool catalog invalid: catalog boundary names the invalid catalog or tool.
- Tool execution failed: tool result identifies the failed operation.
- Persistence failed: durable-turn or message boundary identifies the failed
  state transition.

No failure may be converted into a request to another generator.

## Source guardrail

Repository verification must reject:

- an interactive runtime selector;
- a fallback/canary generation branch;
- another interactive generation endpoint;
- a second interactive-assistant UI namespace;
- executive-specialist generation agents outside the canonical Eve root.
