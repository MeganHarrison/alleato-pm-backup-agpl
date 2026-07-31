begin;

create unique index if not exists recruiting_microsoft_connections_identity_uidx
on public.recruiting_microsoft_connections (tenant_id, microsoft_user_id);

revoke all on function public.recruiting_get_microsoft_connection_secret()
from authenticated;
revoke all on function public.recruiting_upsert_microsoft_connection(
  text, text, text, text, text[], text, text, timestamptz, text
) from authenticated;
revoke all on function public.recruiting_refresh_microsoft_connection_tokens(
  text, text, timestamptz, text[]
) from authenticated;

drop function public.recruiting_get_microsoft_connection_secret();
drop function public.recruiting_upsert_microsoft_connection(
  text, text, text, text, text[], text, text, timestamptz, text
);
drop function public.recruiting_refresh_microsoft_connection_tokens(
  text, text, timestamptz, text[]
);

create or replace function public.recruiting_admin_get_microsoft_connection_secret(
  p_person_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'accessTokenCiphertext', access_token_ciphertext,
    'refreshTokenCiphertext', refresh_token_ciphertext,
    'expiresAt', access_token_expires_at,
    'scopes', to_jsonb(granted_scopes)
  )
  from public.recruiting_microsoft_connections
  where person_id = p_person_id;
$$;

create or replace function public.recruiting_admin_upsert_microsoft_connection(
  p_person_id uuid,
  p_tenant_id text,
  p_microsoft_user_id text,
  p_email text,
  p_display_name text,
  p_granted_scopes text[],
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_access_token_expires_at timestamptz,
  p_capability text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existed boolean;
begin
  if p_person_id is null then
    raise exception 'Recruiting person is required.' using errcode = '22023';
  end if;
  if p_capability not in ('mail', 'calendar', 'all') then
    raise exception 'Invalid Microsoft connection capability.' using errcode = '22023';
  end if;
  if nullif(btrim(p_email), '') is null
    or lower(btrim(p_email)) not like '%@alleatogroup.com'
    or nullif(btrim(p_tenant_id), '') is null
    or nullif(btrim(p_microsoft_user_id), '') is null then
    raise exception 'Microsoft identity metadata is invalid.' using errcode = '22023';
  end if;
  if p_access_token_expires_at <= now()
    or p_access_token_expires_at > now() + interval '2 hours' then
    raise exception 'Microsoft token expiry is invalid.' using errcode = '22023';
  end if;
  if p_access_token_ciphertext not like 'v1.%'
    or p_refresh_token_ciphertext not like 'v1.%' then
    raise exception 'Microsoft token encryption format is invalid.' using errcode = '22023';
  end if;
  if not (
    'Mail.Send' = any(coalesce(p_granted_scopes, '{}'))
    or 'Calendars.ReadWrite' = any(coalesce(p_granted_scopes, '{}'))
  ) then
    raise exception 'Required Microsoft permissions are missing.' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.recruiting_microsoft_connections
    where person_id = p_person_id
  ) into v_existed;

  insert into public.recruiting_microsoft_connections (
    person_id,
    tenant_id,
    microsoft_user_id,
    email,
    display_name,
    granted_scopes,
    access_token_ciphertext,
    refresh_token_ciphertext,
    access_token_expires_at
  )
  values (
    p_person_id,
    btrim(p_tenant_id),
    btrim(p_microsoft_user_id),
    lower(btrim(p_email)),
    nullif(btrim(p_display_name), ''),
    p_granted_scopes,
    p_access_token_ciphertext,
    p_refresh_token_ciphertext,
    p_access_token_expires_at
  )
  on conflict (person_id) do update set
    tenant_id = excluded.tenant_id,
    microsoft_user_id = excluded.microsoft_user_id,
    email = excluded.email,
    display_name = excluded.display_name,
    granted_scopes = excluded.granted_scopes,
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    access_token_expires_at = excluded.access_token_expires_at,
    last_verified_at = now(),
    updated_at = now();

  insert into public.recruiting_microsoft_connection_events (
    person_id, event_type, capability, email
  )
  values (
    p_person_id,
    case when v_existed then 'reconnected' else 'connected' end,
    p_capability,
    lower(btrim(p_email))
  );

  return jsonb_build_object('saved', true);
end;
$$;

create or replace function public.recruiting_admin_refresh_microsoft_connection_tokens(
  p_person_id uuid,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_access_token_expires_at timestamptz,
  p_granted_scopes text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_person_id is null
    or p_access_token_ciphertext not like 'v1.%'
    or p_refresh_token_ciphertext not like 'v1.%'
    or p_access_token_expires_at <= now()
    or p_access_token_expires_at > now() + interval '2 hours' then
    raise exception 'Microsoft token refresh payload is invalid.' using errcode = '22023';
  end if;

  update public.recruiting_microsoft_connections
  set
    access_token_ciphertext = p_access_token_ciphertext,
    refresh_token_ciphertext = p_refresh_token_ciphertext,
    access_token_expires_at = p_access_token_expires_at,
    granted_scopes = coalesce(p_granted_scopes, granted_scopes),
    last_verified_at = now(),
    updated_at = now()
  where person_id = p_person_id;
  return found;
end;
$$;

revoke all on function public.recruiting_admin_get_microsoft_connection_secret(uuid)
from public, anon, authenticated;
revoke all on function public.recruiting_admin_upsert_microsoft_connection(
  uuid, text, text, text, text, text[], text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.recruiting_admin_refresh_microsoft_connection_tokens(
  uuid, text, text, timestamptz, text[]
) from public, anon, authenticated;

grant execute on function public.recruiting_admin_get_microsoft_connection_secret(uuid)
to service_role;
grant execute on function public.recruiting_admin_upsert_microsoft_connection(
  uuid, text, text, text, text, text[], text, text, timestamptz, text
) to service_role;
grant execute on function public.recruiting_admin_refresh_microsoft_connection_tokens(
  uuid, text, text, timestamptz, text[]
) to service_role;

commit;
