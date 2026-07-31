-- Keep the AI/RAG database metadata contract identical to the PM App database.
-- Deploy this file to the RAG project (`fqcvmfqldlewvbsuxdvz`), not via `supabase db push`.

create or replace function public.get_schema_explorer_metadata()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with public_tables as (
    select c.oid, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  ),
  table_metadata as (
    select
      t.relname as name,
      coalesce((
        select jsonb_agg(jsonb_build_object('name', a.attname, 'dataType', pg_catalog.format_type(a.atttypid, a.atttypmod), 'isNullable', not a.attnotnull, 'isPrimaryKey', pk_columns.attnum is not null) order by a.attnum)
        from pg_catalog.pg_attribute a
        left join lateral (
          select key_column.attnum
          from pg_catalog.pg_constraint pk
          cross join lateral unnest(pk.conkey) as key_column(attnum)
          where pk.conrelid = t.oid and pk.contype = 'p'
        ) pk_columns on pk_columns.attnum = a.attnum
        where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
      ), '[]'::jsonb) as columns,
      coalesce((
        select jsonb_agg(primary_key.attname order by primary_key.ordinality)
        from pg_catalog.pg_constraint pk
        cross join lateral unnest(pk.conkey) with ordinality as primary_key_column(attnum, ordinality)
        join pg_catalog.pg_attribute primary_key on primary_key.attrelid = pk.conrelid and primary_key.attnum = primary_key_column.attnum
        where pk.conrelid = t.oid and pk.contype = 'p'
      ), '[]'::jsonb) as primary_key_columns,
      coalesce((
        select jsonb_agg(jsonb_build_object('name', foreign_key.name, 'columns', foreign_key.columns, 'referencedSchema', foreign_key.referenced_schema, 'referencedTable', foreign_key.referenced_table, 'referencedColumns', foreign_key.referenced_columns) order by foreign_key.name)
        from (
          select fk.conname as name, jsonb_agg(source_column.attname order by key_column.ordinality) as columns, target_namespace.nspname as referenced_schema, target_table.relname as referenced_table, jsonb_agg(target_column.attname order by key_column.ordinality) as referenced_columns
          from pg_catalog.pg_constraint fk
          join pg_catalog.pg_class target_table on target_table.oid = fk.confrelid
          join pg_catalog.pg_namespace target_namespace on target_namespace.oid = target_table.relnamespace
          cross join lateral unnest(fk.conkey) with ordinality as key_column(attnum, ordinality)
          join pg_catalog.pg_attribute source_column on source_column.attrelid = fk.conrelid and source_column.attnum = key_column.attnum
          join lateral unnest(fk.confkey) with ordinality as referenced_key_column(attnum, ordinality) on referenced_key_column.ordinality = key_column.ordinality
          join pg_catalog.pg_attribute target_column on target_column.attrelid = fk.confrelid and target_column.attnum = referenced_key_column.attnum
          where fk.conrelid = t.oid and fk.contype = 'f'
          group by fk.oid, fk.conname, target_namespace.nspname, target_table.relname
        ) foreign_key
      ), '[]'::jsonb) as foreign_keys
    from public_tables t
  )
  select jsonb_build_object('schema', 'public', 'generatedAt', pg_catalog.clock_timestamp(), 'tables', coalesce(jsonb_agg(jsonb_build_object('name', name, 'columns', columns, 'primaryKeyColumns', primary_key_columns, 'foreignKeys', foreign_keys) order by name), '[]'::jsonb))
  from table_metadata;
$$;

revoke all on function public.get_schema_explorer_metadata() from public;
revoke all on function public.get_schema_explorer_metadata() from anon;
revoke all on function public.get_schema_explorer_metadata() from authenticated;
grant execute on function public.get_schema_explorer_metadata() to service_role;
