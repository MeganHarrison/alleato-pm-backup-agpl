# PM APP Supabase Pool Incident - 2026-06-08

## Summary

PM APP became intermittently unreachable through both PostgREST and the session pooler while the AI Database remained reachable. The RAG database split did protect the high-churn `document_chunks` storage path, but it did not protect PM APP from background scheduler jobs that still read and write app-owned catalog/control-plane tables.

The immediate recurrence cause was provider configuration drift on the Render web service:

- `alleato-backend` had `DISABLE_SCHEDULER` missing.
- Graph sync flags were live-enabled on the web service.
- Compiler, source-health recompute, Fireflies backlog, and task extraction flags were missing, and those default to enabled in `backend/src/services/scheduler.py`.
- `APP_DB_PRESSURE_GUARD_REQUIRED` was missing from the web service, so web-hosted background work did not fail closed before touching PM APP.

## Evidence

Commands run during the incident:

```bash
npm run verify:live-db-incident -- --minutes=60
```

Important output:

```text
Render Web Scheduler Flags
DISABLE_SCHEDULER=<missing>
GRAPH_SYNC_ENABLED=true
GRAPH_SYNC_OUTLOOK=true
GRAPH_SYNC_TEAMS=true
GRAPH_SYNC_TEAMS_DM=true
GRAPH_SYNC_ONEDRIVE=true
INTELLIGENCE_COMPILER_ENABLED=<missing>
SOURCE_SYNC_HEALTH_RECOMPUTE_ENABLED=<missing>
FIREFLIES_PIPELINE_BACKLOG_ENABLED=<missing>
TASK_EXTRACTION_ENABLED=<missing>
```

Supavisor logged repeated PM APP pool checkout failures:

```text
ClientHandler: (ECHECKOUTTIMEOUT) unable to check out connection from the pool after 15000ms in Session mode
```

PostgREST was also unable to reach PM APP during the failure window:

```text
Failed to load the schema cache ...
FATAL: the database system is not accepting connections
DETAIL: Hot standby mode is disabled.
```

Postgres logs show a database startup window around `2026-06-08 20:15:38 UTC`:

```text
2026-06-08 20:15:38.628 UTC FATAL pgbouncer the database system is starting up
2026-06-08 20:15:39.291 UTC FATAL authenticator the database system is not accepting connections
2026-06-08 20:16:04.549 UTC LOG pgbouncer connection authorized
```

Immediately after recovery, PostgREST logged repeated app-table write errors:

```text
duplicate key value violates unique constraint "intelligence_targets_slug_key"
```

That error family points at intelligence target creation/upsert contention or non-idempotent target insert paths, not normal user traffic.

## Why The Split Did Not Prevent This

The split moved RAG-heavy tables such as `document_chunks` into the AI Database. It did not move PM APP-owned tables that background jobs still need:

- `document_metadata`
- `intelligence_targets`
- packet/compiler queue state
- source sync health/system alert rows
- task extraction outputs
- Graph sync state/catalog records

Those app-owned rows are intentionally still in PM APP because the product reads them. Therefore any background worker that still runs from the web service can saturate PM APP even if embeddings and chunks write to AI Database.

## Fixed During This Incident

Provider-level Render env was updated for `alleato-backend`:

```text
APP_DB_PRESSURE_GUARD_REQUIRED=true
DISABLE_SCHEDULER=true
GRAPH_SYNC_ENABLED=false
GRAPH_SYNC_OUTLOOK=false
GRAPH_SYNC_TEAMS=false
GRAPH_SYNC_TEAMS_DM=false
GRAPH_SYNC_ONEDRIVE=false
INTELLIGENCE_COMPILER_ENABLED=false
SOURCE_SYNC_HEALTH_RECOMPUTE_ENABLED=false
FIREFLIES_PIPELINE_BACKLOG_ENABLED=false
TASK_EXTRACTION_ENABLED=false
```

A backend redeploy was triggered so the running process picks up the env:

```text
Render deploy dep-d8jig8i8qa3s73fat74g created at 2026-06-08T20:37:54Z
```

Post-fix verification:

```bash
npm run verify:live-db-incident -- --minutes=10
```

Result:

```text
Render Web Scheduler Flags:
APP_DB_PRESSURE_GUARD_REQUIRED=true
DISABLE_SCHEDULER=true
GRAPH_SYNC_ENABLED=false
GRAPH_SYNC_OUTLOOK=false
GRAPH_SYNC_TEAMS=false
GRAPH_SYNC_TEAMS_DM=false
GRAPH_SYNC_ONEDRIVE=false
INTELLIGENCE_COMPILER_ENABLED=false
SOURCE_SYNC_HEALTH_RECOMPUTE_ENABLED=false
FIREFLIES_PIPELINE_BACKLOG_ENABLED=false
TASK_EXTRACTION_ENABLED=false

Supabase Health:
db=ACTIVE_HEALTHY
pooler=ACTIVE_HEALTHY
rest=ACTIVE_HEALTHY

Supavisor Pool Failures Last 10m: none
Connection Count: sessions=21
Live DB incident verifier: PASS
```

Repo guardrails were also tightened:

- `backend/render.yaml` now includes explicit web `APP_DB_PRESSURE_GUARD_REQUIRED=true`.
- `render.yaml` now includes explicit web `APP_DB_PRESSURE_GUARD_REQUIRED=true`.
- Web scheduler flags in both Render blueprints are quoted strings, avoiding YAML boolean/provider drift.
- `scripts/verify/verify-live-db-incident.mjs` now checks `APP_DB_PRESSURE_GUARD_REQUIRED=true` on the web service.
- RAG direct SQL scripts now use `prepare: false` on RAG Postgres connections so they are compatible with Supabase transaction pooler mode.

## Detection Gap

The prior fix existed in repo intent but did not hold in provider state:

- The blueprint declared web scheduler-disabled intent.
- Live Render env did not match the blueprint.
- The incident verifier checked scheduler flags, but it was not blocking deploys/provider drift continuously.
- `APP_DB_PRESSURE_GUARD_REQUIRED` was not checked for the web service by `verify-live-db-incident`.

This allowed the same class of issue to recur even after the architecture split.

## Prevention

Required prevention rules:

1. The web service must be API-only in production.
2. Background work must run only as named Render cron services.
3. Every cron that touches PM APP must set `APP_DB_PRESSURE_GUARD_REQUIRED=true` and run the app DB pressure guard before work starts.
4. Provider read-back must be treated as the source of truth after every Render env/blueprint change.
5. `npm run verify:live-db-incident` must pass after deploy/env changes before claiming the incident is closed.
6. `npm run verify-render-web-scheduler-disabled` should be part of any backend deployment closeout.

## Future Skill Workflow

Use this sequence for future PM APP database incidents:

1. Do not restart first.
2. Run `npm run verify:live-db-incident -- --minutes=60`.
3. Read Render web scheduler flags and compare against the fail-closed set.
4. Query Supavisor logs for `ECHECKOUTTIMEOUT`, `maxclients`, and checkout delay messages.
5. Query PostgREST logs for schema cache and role-setting connection errors.
6. Query Postgres logs for startup, shutdown, `57P03`, connection slot, OOM, and duplicate-key patterns.
7. Identify whether PM APP or AI Database is affected; do not assume the split protects app-owned catalog/control-plane tables.
8. Fix provider drift directly through Render/Supabase APIs.
9. Redeploy the affected service if env changes require process restart.
10. Read back provider env and rerun the incident verifier.
