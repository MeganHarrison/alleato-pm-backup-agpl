# AI Assistant Generation Ownership Contract

Status: Current

Owner under test: `agents/alleato-assistant`

Interactive route under test: `/ai`

## Required result

The interactive assistant must resolve to one generation graph:

```text
/ai -> Eve proxy -> agents/alleato-assistant
```

No runtime assignment, canary percentage, cohort switch, rollback generator, or
fallback generation path is permitted.

## Ownership assertions

| Assertion | Required evidence |
| --- | --- |
| One browser route | `/ai` mounts the Eve client directly |
| One generator | Only `agents/alleato-assistant` generates interactive answers |
| One protocol boundary | Browser traffic reaches Eve through `/api/ai-assistant/eve/proxy/**` |
| Durable turns preserved | Proxy transitions use `frontend/src/lib/ai/assistant-turn` |
| Authentication preserved | User and project context are verified before Eve or tools receive them |
| Session resume preserved | Eve session events and application message history reload without changing owners |
| Structured failures preserved | Each failed boundary returns a specific actionable error |
| One UI namespace | Product pages and generated inventories advertise only `/ai` routes |

The `/api/ai-assistant/**` API namespace and `/ai-assistant-debug` admin route
do not violate the UI-route assertion.

## Canonical generation files

```text
agents/alleato-assistant/
├── agent/agent.ts
├── agent/channels/eve.ts
├── agent/instructions.md
├── agent/lib/auth.ts
├── agent/skills/*.md
└── agent/tools/production_read_tools.ts

frontend/src/
├── app/(main)/ai/page.tsx
├── app/api/ai-assistant/eve/proxy/[...path]/
├── app/api/ai-assistant/eve/tools/route.ts
├── hooks/use-alleato-eve-chat.ts
└── lib/ai/assistant-turn/
```

The canonical tool manifest and request-scoped registry are owned by
`frontend/src/lib/ai/eve-runtime/`. Migration comparison modules are not part
of the runtime.

## Route namespace assertions

Canonical product routes are rooted at `/ai`. Feature requests and marketing
are owned by:

```text
frontend/src/app/(main)/ai/feature-requests/
frontend/src/app/(main)/ai/marketing/
```

No second interactive-assistant route root or redirect namespace may exist or
be advertised.

## Falsification checks

The ownership contract fails if any check finds:

1. an interactive UI route outside the canonical `/ai` tree;
2. a product link to a removed assistant route namespace;
3. an interactive runtime type or branch with multiple generation owners;
4. a chat handler capable of producing an answer outside Eve;
5. a legacy strategist or executive specialist runtime;
6. a generated route inventory containing a removed UI route;
7. a launcher that starts a different interactive Eve agent;
8. a swallowed Eve/proxy/tool/persistence failure followed by another
   generation attempt.

## Verification boundary

Static checks prove that no second owner is represented in source. Focused
tests prove proxy, persistence, auth, session resume, and error contracts.
Authenticated browser verification must prove:

- a first message completes through Eve;
- a follow-up continues the same Eve session;
- refresh resumes the conversation;
- a project-risk question invokes a real tool and returns source-backed data;
- a forced boundary failure is shown as a structured error without fallback.

The task is not complete until all three evidence levels pass.
