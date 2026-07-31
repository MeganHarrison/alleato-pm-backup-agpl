# DB Pressure Guard Buckets

Status: Published

Linear: AAI-720

Worktree: `/Users/meganharrison/.codex/worktrees/db-pressure-guard-buckets/alleato-pm`

## Objective

Refine the app DB pressure guard so it still fails closed for real unsafe app/database pressure, but does not block solely because normal Supabase platform/PostgREST idle baseline connections put raw `pg_stat_activity` totals near the current threshold.

## Root Cause

The guard currently blocks on raw `total_connections > 35`. Live inspection after the Graph sync block showed `total=34`, `active=1`, `idle_in_transaction=0`, with most connections from Supabase platform services and idle PostgREST pool sessions. A small cron/manual spike can cross the raw total threshold even when no app query pileup exists.

## Checklist

- [x] Create Linear issue and isolated worktree.
- [x] Add connection bucket classification to the DB pressure snapshot.
- [x] Keep fail-closed checks for active, idle-in-transaction, long-running active, and app/client pressure.
- [x] Stop raw total platform baseline from being the sole blocking reason.
- [x] Add a live/read-only verifier that reports bucketed connection pressure.
- [x] Add focused tests for platform baseline, app/client pressure, and diagnostic output.
- [x] Delegate typecheck/syntax/focused tests after edits.
- [x] Capture live evidence.
- [x] Update progress notes.
- [x] Publish to `origin/main` and close Linear.

## Evidence

- Live bucketed DB pressure snapshot and focused local test pass: [db-pressure-guard-buckets-aai-720.md](../evidence/2026-06-25-ai-rag-production-finalization/db-pressure-guard-buckets-aai-720.md)
- Delegated final verification passed: `14 passed`, Python compile passed, `verify:app-db-pressure` package script mapping passed.
- Published commits:
  - `1cfb8ca7a`
  - `3ca917e73`
- Linear AAI-720 marked Done.
