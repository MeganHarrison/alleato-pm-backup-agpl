# Agent SDK Map

Last verified: 2026-07-24

## Production AI Assistant

The in-app AI Assistant has one runtime: Vercel Eve.

```text
Next.js AI surfaces
├── /ai
├── floating AI widget
├── Ask Alleato
└── executive chat
        │
        ▼
frontend/src/hooks/use-alleato-eve-chat.ts
        │
        ▼
/eve/v1/* (mounted by withEve)
        │
        ▼
agents/alleato-assistant/
├── agent/agent.ts
├── agent/instructions.md
├── agent/channels/eve.ts
├── agent/tools/
└── agent/skills/
```

The browser attaches the signed-in Supabase access token to Eve requests. The
authored Eve channel validates that token with Supabase. `query_alleato` then
uses the same token so database reads remain subject to the user's RLS policy.

Completed Eve messages are persisted through
`POST /api/ai-assistant/messages/[sessionId]`. That route stores history only;
it does not run a model or provide a second assistant runtime.

## Executive behavior

Financial, operations, risk, people/capacity, business-development, and
marketing behavior live in Eve skill Markdown files under
`agents/alleato-assistant/agent/skills/`. They are procedures loaded by one Eve
identity, not delegated specialist agents.

## Runtime boundary

There is no alternate Assistant generator, runtime selector, comparison agent,
or rollback implementation in the product source. Teams proactive delivery is a
transport-only module at `frontend/src/lib/bot/teams-delivery.ts`; it does not
generate AI responses.

## Separate non-Assistant AI features

ASRS, Procore docs chat, document pipelines, and backend intelligence services
remain separate product features. They are not selectable fallbacks for Eve and
do not answer turns on the AI Assistant surfaces.
