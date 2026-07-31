# AI Spend Control

Status: Active containment with known coverage debt
Canonical registry: `config/ai-runtime-owners.json`
Tracked ledger: RAG `public.pipeline_model_usage`
Authoritative total: provider billing, not an application estimate

## What Failed

The repository had provider-routing documentation, but no complete spend
architecture. Usage accounting was split between:

- `chat_history.metadata.usage` for the final main-chat response; and
- `pipeline_model_usage` for four Python pipeline integrations.

Neither was a global ledger. Scheduled Deep Agents, domain packet compilation,
AI SDK helper calls, Realtime, speech, Eve agents, and direct provider calls
could spend without appearing in either product dashboard.

On 2026-07-24, PM APP inserts also invoked `pg_net` once per document through
`pipeline_config`. This generated thousands of queued `/api/pipeline/process`
requests. The endpoint accepted every request and added background work without
a durable bounded queue.

## Live Containment

| Control | Production state |
| --- | --- |
| `pipeline_url` | Disabled and read back |
| `fireflies_pipeline_url` | Disabled and read back |
| `alleato-microsoft-executive-assistant-check` | Suspended; unmetered `gpt-5.5` work cannot recur |
| `alleato-domain-packet-compiler` | Suspended; unmetered synthesis cannot recur |
| Tracked calls on `alleato-backend` | Gateway required; direct OpenAI credential blank-overridden; `$10/day` pipeline cap; deployment live |
| Graph, Fireflies, Teams, project synthesis crons | Gateway required; `$10/day` pipeline cap configured |

The database trigger remains capable of `pg_net` dispatch if a URL is
reintroduced. Both keys are therefore disabled, and the runtime registry makes
that legacy ownership visible. A follow-up migration must remove HTTP dispatch
from the trigger entirely and replace it with a leased transactional outbox.

## Executable Ownership Contract

`config/ai-runtime-owners.json` records, for every known production AI group:

- runtime and feature owner;
- trigger or schedule;
- model policy;
- source paths;
- tracking status;
- budget status;
- provider policy; and
- deployment state.

Run:

```bash
npm run verify:ai-spend-ownership
```

The check fails for missing registry fields, duplicate owners, missing files,
and new unregistered production AI callsites. Known active coverage debt,
including scheduled unmetered work, is emitted as a warning. Use `--strict` to
make every active coverage gap fail.

## Spend Report

Run:

```bash
ALLEATO_ENV_FILE=frontend/.env npm run ai:spend:report -- --days=7
```

The report aggregates the pipeline ledger by date, provider, model, and
operation and lists every active coverage gap. It deliberately prints
`authoritative_provider_total: null`: an incomplete internal ledger must never
masquerade as provider billing.

## Runtime Guard

Tracked background calls now:

1. read the daily ledger before provider work;
2. require a positive configured budget and governed model price in production;
3. fail closed when that ledger cannot be read unless the explicit emergency
   `PIPELINE_BUDGET_FAIL_OPEN=true` override is present;
4. record the actual route (`vercel_gateway` or `openai`) after failover;
5. attach Render service, instance, and deployment attribution; and
6. stop direct-provider failover when `AI_GATEWAY_REQUIRED=true`.

Some legacy backend files still instantiate the direct SDK or URL. A linked
Render environment group supplies an OpenAI key, so production blocks those
paths with an explicit blank service-level override. They must be migrated to
the metered transport before that override can ever be removed.

## Remaining Required Architecture

The current budget guard is a containment control, not a global hard cap.
Concurrent workers can all read the same pre-call total before any writes.
The durable design is:

1. an atomic database reservation RPC keyed by call/request ID;
2. a settlement RPC that records actual tokens, provider request ID, and
   uncertain outcomes;
3. metered transports for Python, AI SDK, Deep Agents, Eve, Realtime, and TTS;
4. a leased outbox replacing database-triggered HTTP;
5. provider billing reconciliation that fails red on unattributed spend; and
6. 50/75/90/100 percent alerts plus an emergency circuit breaker.

Until that ships, the two highest-risk unmetered schedules remain suspended and
the report explicitly identifies all active gaps.
