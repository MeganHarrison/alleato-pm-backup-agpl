# Eve Proxy Authentication Verification Proof

## Regression checks

| Check | Result |
| --- | --- |
| Proxy POST/stream contract | 15/15 passed |
| Eve auth and production-tool contract | 40/40 passed |
| Eve TypeScript check | Passed |
| Eve-only runtime guardrail | Passed |

The tests prove that ambient `Authorization` is stripped, the app injects the
authenticated token into a caller-nonforwardable internal header, Eve validates
the shared proxy secret before that token, and caller override, invalid
identity, invalid project, invalid surface, and invalid durable-turn paths fail
closed.

## Production deployments

| Boundary | Deployment | Result |
| --- | --- | --- |
| Eve runtime | `dpl_EE2e7krD39qfwN9VSSfTRKKB8pYD` | `READY`; production alias updated |
| Backup application | `dpl_5vxgALX7foWqspo745sQJ7NtB2Ud` | `READY`; canonical production build completed |

## Authenticated deployed lifecycle

The lifecycle probe created a temporary real Supabase user, profile, and owned
conversation, signed in, crossed the deployed application proxy and separate
Eve deployment, and observed:

```text
eve-start-status=202
eve-stream-status=200
eve-turn-completed=true
eve-stream-bytes=2374
temporary-data-cleanup=complete
```

Cleanup deleted the scoped `durable_ai_turns`, `chat_history`, `conversations`,
`user_profiles`, and Supabase Auth user. No secret value or temporary identity
is stored in this proof.
