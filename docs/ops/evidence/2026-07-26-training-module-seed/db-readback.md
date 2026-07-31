# T3 (ALL-17) — Live Database Readback Evidence

Project: PM APP (`lgveqfnpkxvzbnnwuled`), via Supabase MCP `execute_sql`.

## Row counts

Query:

```sql
select
  (select count(*) from public.training_role) as role_count,
  (select count(*) from public.training_topic) as topic_count,
  (select count(*) from public.training_resource) as resource_count,
  (select count(*) from public.training_resource where status = 'published') as published_count,
  (select count(*) from public.training_resource where status = 'review') as review_count,
  (select count(distinct url) from public.training_resource) as distinct_url_count,
  (select count(*) from public.training_resource_role) as resource_role_link_count;
```

Result:

```json
{"role_count":6,"topic_count":27,"resource_count":91,"published_count":67,"review_count":24,"distinct_url_count":91,"resource_role_link_count":264}
```

Matches `scripts/training/source/resources.json`'s `meta.counts` exactly:
`{"total":91,"published":67,"review":24,"archived":0,"roles":6,"topics":27}`
(plus 264 role-tag links, one per `resources[].roleSlugs` entry across all
91 resources). `distinct_url_count == resource_count` confirms no duplicate
URLs reached the table — the one genuine duplicate in the raw 92-item source
(`seed-1`/`seed-77`) was caught by `dedupeByUrl` before the seed ran, not by
the database's unique constraint after the fact.

## Migration ledger

Query:

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;
```

Result:

```json
[{"version":"20260726195538","name":"seed_training_resource_library"},{"version":"20260726143515","name":"create_training_resource_library"},{"version":"20260724194500","name":"catalog_ai_content_creation_features"}]
```

Confirms the seed migration applied immediately after the T2 schema
migration, and before any unrelated later migration.
