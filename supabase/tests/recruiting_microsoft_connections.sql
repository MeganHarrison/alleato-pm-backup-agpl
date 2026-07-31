begin;

set local search_path = public, extensions;

select plan(14);

select has_table('public'::name, 'recruiting_microsoft_connections'::name);
select has_table(
  'public'::name,
  'recruiting_microsoft_connection_events'::name
);
select has_function(
  'public',
  'recruiting_get_microsoft_connection_status',
  array[]::text[]
);
select has_function(
  'public',
  'recruiting_disconnect_microsoft_connection',
  array[]::text[]
);
select has_function(
  'public',
  'recruiting_admin_get_microsoft_connection_secret',
  array['uuid']
);
select ok(
  to_regprocedure('public.recruiting_get_microsoft_connection_secret()') is null,
  'the authenticated token-secret RPC no longer exists'
);
select ok(
  to_regprocedure(
    'public.recruiting_upsert_microsoft_connection(text,text,text,text,text[],text,text,timestamptz,text)'
  ) is null,
  'the authenticated connection-upsert RPC no longer exists'
);
select ok(
  to_regprocedure(
    'public.recruiting_refresh_microsoft_connection_tokens(text,text,timestamptz,text[])'
  ) is null,
  'the authenticated token-refresh RPC no longer exists'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.recruiting_microsoft_connections',
    'select'
  ),
  'authenticated cannot read encrypted Microsoft token rows directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.recruiting_admin_get_microsoft_connection_secret(uuid)',
    'execute'
  ),
  'authenticated cannot execute the backend token-secret function'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.recruiting_admin_get_microsoft_connection_secret(uuid)',
    'execute'
  ),
  'service role can execute the backend token-secret function'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.recruiting_get_microsoft_connection_status()',
    'execute'
  ),
  'authenticated recruiting users can read their safe connection status'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'recruiting_microsoft_connections_identity_uidx'
  ),
  'a Microsoft identity can be connected to only one recruiting person'
);
select ok(
  position(
    'recruiting_admin' in pg_get_functiondef(
      'public.recruiting_disconnect_microsoft_connection()'::regprocedure
    )
  ) > 0
  and position(
    'recruiter' in pg_get_functiondef(
      'public.recruiting_disconnect_microsoft_connection()'::regprocedure
    )
  ) > 0,
  'disconnect enforces a recruiting write role inside the database function'
);

select * from finish();
rollback;
