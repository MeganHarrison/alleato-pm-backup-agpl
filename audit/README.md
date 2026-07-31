# Alleato PM — Audit Tripwire

Tamper-evident monitoring of the **production** Alleato PM databases, living in this
private, sole-access repo so the watcher and its evidence sit outside the shared
production repo (where a co-admin could edit or delete them).

## What it does

Every run captures a structural snapshot of each production database (tables, columns,
row counts), diffs it against the previous snapshot, and commits both. The commit
history is the append-only, tamper-evident trail: *what* changed and *when*.

A **destructive** change — a dropped table, a removed column, or a row count that
craters — fails the scheduled job (which emails the repo owner) and opens an issue.

This exists because on 2026-07-23 a batch of production deletions unlinked ~2,500
documents with no record of what pointed where. The tripwire makes that class of event
loud and recoverable.

> **Attribution note.** The production DB records `changed_by = null` for any
> service-role or SQL-editor change (how AI tooling writes to the DB), so DB-level
> auditing proves *what* changed and *when* — not whose hand did it. The value here is
> a timestamped baseline: proof the schema was healthy up to a moment, so a later break
> can be pinned to a change outside your own work.

## Layout

```
audit/
  scripts/
    schema-snapshot.mjs   read-only snapshot of one database
    schema-diff.mjs       diff two snapshots → drift report (exit 1 on critical/high)
    run-tripwire.mjs      one scheduled cycle over all watched DBs
  baselines/              sealed first baselines (2026-07-24)
  snapshots/<label>/      every snapshot, committed over time
  reports/                per-run drift reports
```

## Run manually

```bash
cd audit
npm install
PM_DATABASE_URL="postgresql://…"  RAG_DATABASE_URL="postgresql://…"  npm run tripwire
```

Or one database at a time:

```bash
node scripts/schema-snapshot.mjs --url "$PM_DATABASE_URL" --label pm-app --out snapshots/pm-app
node scripts/schema-diff.mjs --old snapshots/pm-app/<old>.json --new snapshots/pm-app/<new>.json
```

## Scheduling (GitHub Actions)

`.github/workflows/tripwire.yml` runs twice daily. It needs two repo secrets:

- `PM_DATABASE_URL` — production PM APP read connection string
- `RAG_DATABASE_URL` — production RAG read connection string

**Use a read-only database role**, not the service key. In the production Supabase SQL
editor:

```sql
create role audit_readonly login password '<pick-a-strong-password>';
grant connect on database postgres to audit_readonly;
grant usage on schema public to audit_readonly;
grant select on all tables in schema public to audit_readonly;
alter default privileges in schema public grant select on tables to audit_readonly;
```

Then build the connection string with that role and set it as the secret. A read-only
role means these credentials can never modify production, even if the repo is compromised.

## Tuning

`schema-diff.mjs` flags a row-count drop as HIGH when it exceeds **25%** or **500 rows**
(whichever comes first). Override per run: `--drop-pct 10 --drop-abs 200`.
