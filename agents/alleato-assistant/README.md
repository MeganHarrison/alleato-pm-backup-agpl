# Alleato Assistant

Eve is the sole generation runtime for the Alleato AI Assistant. Eve is one
authenticated assistant identity; financial, operations, risk, people,
business-development, and marketing behavior is loaded as skills rather than
separate agents.

## Security boundary

- Browser requests authenticate with a Supabase bearer token.
- `x-alleato-assistant-surface` is required and must be either
  `ai_assistant` or `ask_alleato`.
- Optional `x-alleato-project-id` is accepted only when it is a positive integer
  and the signed-in user can read that project through Supabase RLS.
- Only the verified assistant surface and, when supplied, verified project ID
  are stored in Eve auth attributes.
- Production data tools are fetched from
  `ALLEATO_APP_URL/api/ai-assistant/eve/tools?surface=<verified-surface>` for
  each authenticated session.
- The app-owned bridge is the read-only allowlist boundary. It does not
  advertise write or external-delivery tools to Eve.
- Tool execution returns through the same authenticated bridge with the bearer
  token, verified surface, and optional verified project context.
- Eve's shell, file, arbitrary-network, web-search, and todo built-ins are
  disabled. Eve 0.22.6 rejects `disableTool()` for its documented `agent`
  built-in, so this package replaces that slug with a fail-closed tool that
  cannot dispatch a child session. `load_skill` and `ask_question` remain
  available.

The catalog response is:

```json
{
  "surface": "ai_assistant",
  "projectId": 43,
  "tools": [
    {
      "name": "getProjectBudget",
      "description": "Read the project budget.",
      "inputSchema": { "type": "object" }
    }
  ]
}
```

When no project is selected, Eve omits `x-alleato-project-id`, requires the
catalog to return `"projectId": null`, and loads only the unscoped tools the
bridge advertises (for example, project resolution).

Execute a tool by posting
`{ "surface": "<verified-surface>", "toolName": "<name>", "input": { ... } }`
to the same endpoint. A successful response is
`{ "toolName": "<name>", "projectId": 43, "result": <json> }`; `projectId` is
`null` for an unscoped turn. Eve rejects catalog and execution responses whose
surface, project, or tool identity does not match the verified session context.

## Commands

```bash
pnpm --dir agents/alleato-assistant install
pnpm --dir agents/alleato-assistant info
pnpm --dir agents/alleato-assistant typecheck
pnpm --dir agents/alleato-assistant test:auth
pnpm --dir agents/alleato-assistant build
```

`pnpm --dir agents/alleato-assistant eval` runs the real configured model. It
does not enable a mock model or regex router. The executive-skill suite covers
positive, confusing-neighbor, collision, and negative prompts and asserts on
Eve `load_skill` tool events.

For a deterministic protocol-only check:

```bash
pnpm --dir agents/alleato-assistant eval:protocol
```

That command creates a temporary Eve project with the dedicated mock agent in
`protocol/mock-agent.ts` and local `just-bash` sandbox, runs the same event
assertions, and removes the temporary project. Mock routing never enters the
production `agent/agent.ts`.

Run `info` after changing authored files to confirm Eve discovers the expected
skills, dynamic tool resolver, disabled built-ins, and authenticated channel.
