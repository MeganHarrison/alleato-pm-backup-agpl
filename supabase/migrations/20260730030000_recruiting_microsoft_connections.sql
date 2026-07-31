begin;

create table if not exists public.recruiting_microsoft_connections (
  person_id uuid primary key references public.people(id) on delete cascade,
  tenant_id text not null,
  microsoft_user_id text not null,
  email text not null,
  display_name text,
  granted_scopes text[] not null default '{}',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiting_microsoft_connection_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  event_type text not null check (event_type in ('connected', 'reconnected', 'disconnected')),
  capability text check (capability in ('mail', 'calendar', 'all')),
  email text,
  occurred_at timestamptz not null default now()
);

alter table public.recruiting_microsoft_connections enable row level security;
alter table public.recruiting_microsoft_connection_events enable row level security;

revoke all on table public.recruiting_microsoft_connections from public, anon, authenticated;
revoke all on table public.recruiting_microsoft_connection_events from public, anon, authenticated;

create or replace function public.recruiting_get_microsoft_connection_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_recruiting_person_id();
  v_connection public.recruiting_microsoft_connections%rowtype;
begin
  if v_actor is null or public.current_recruiting_role() is null then
    raise exception 'Recruiting access is required.' using errcode = '42501';
  end if;

  select *
  into v_connection
  from public.recruiting_microsoft_connections
  where person_id = v_actor;

  if not found then
    return jsonb_build_object(
      'connected', false,
      'email', null,
      'displayName', null,
      'scopes', '[]'::jsonb,
      'mailConnected', false,
      'calendarConnected', false,
      'connectedAt', null,
      'lastVerifiedAt', null
    );
  end if;

  return jsonb_build_object(
    'connected', true,
    'email', v_connection.email,
    'displayName', v_connection.display_name,
    'scopes', to_jsonb(v_connection.granted_scopes),
    'mailConnected', 'Mail.Send' = any(v_connection.granted_scopes),
    'calendarConnected', 'Calendars.ReadWrite' = any(v_connection.granted_scopes),
    'connectedAt', v_connection.connected_at,
    'lastVerifiedAt', v_connection.last_verified_at
  );
end;
$$;

create or replace function public.recruiting_get_microsoft_connection_secret()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_recruiting_person_id();
  v_connection public.recruiting_microsoft_connections%rowtype;
begin
  if v_actor is null or public.current_recruiting_role() is null then
    raise exception 'Recruiting access is required.' using errcode = '42501';
  end if;

  select *
  into v_connection
  from public.recruiting_microsoft_connections
  where person_id = v_actor;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'accessTokenCiphertext', v_connection.access_token_ciphertext,
    'refreshTokenCiphertext', v_connection.refresh_token_ciphertext,
    'expiresAt', v_connection.access_token_expires_at,
    'scopes', to_jsonb(v_connection.granted_scopes)
  );
end;
$$;

create or replace function public.recruiting_upsert_microsoft_connection(
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
  v_actor uuid := public.current_recruiting_person_id();
  v_existed boolean;
begin
  if v_actor is null or public.current_recruiting_role() is null then
    raise exception 'Recruiting access is required.' using errcode = '42501';
  end if;
  if p_capability not in ('mail', 'calendar', 'all') then
    raise exception 'Invalid Microsoft connection capability.' using errcode = '22023';
  end if;
  if nullif(btrim(p_email), '') is null
    or nullif(btrim(p_tenant_id), '') is null
    or nullif(btrim(p_microsoft_user_id), '') is null then
    raise exception 'Microsoft identity metadata is incomplete.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.recruiting_microsoft_connections where person_id = v_actor
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
    v_actor,
    btrim(p_tenant_id),
    btrim(p_microsoft_user_id),
    lower(btrim(p_email)),
    nullif(btrim(p_display_name), ''),
    coalesce(p_granted_scopes, '{}'),
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
    v_actor,
    case when v_existed then 'reconnected' else 'connected' end,
    p_capability,
    lower(btrim(p_email))
  );

  return public.recruiting_get_microsoft_connection_status();
end;
$$;

create or replace function public.recruiting_disconnect_microsoft_connection()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_recruiting_person_id();
  v_email text;
begin
  if v_actor is null
    or public.current_recruiting_role() not in ('recruiter', 'recruiting_admin') then
    raise exception 'Recruiting write access is required.' using errcode = '42501';
  end if;

  delete from public.recruiting_microsoft_connections
  where person_id = v_actor
  returning email into v_email;

  if v_email is null then
    return false;
  end if;

  insert into public.recruiting_microsoft_connection_events (
    person_id, event_type, email
  )
  values (v_actor, 'disconnected', v_email);
  return true;
end;
$$;

create or replace function public.recruiting_refresh_microsoft_connection_tokens(
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
declare
  v_actor uuid := public.current_recruiting_person_id();
begin
  if v_actor is null or public.current_recruiting_role() is null then
    raise exception 'Recruiting access is required.' using errcode = '42501';
  end if;

  update public.recruiting_microsoft_connections
  set
    access_token_ciphertext = p_access_token_ciphertext,
    refresh_token_ciphertext = p_refresh_token_ciphertext,
    access_token_expires_at = p_access_token_expires_at,
    granted_scopes = coalesce(p_granted_scopes, granted_scopes),
    last_verified_at = now(),
    updated_at = now()
  where person_id = v_actor;
  return found;
end;
$$;

revoke all on function public.recruiting_get_microsoft_connection_status() from public, anon;
revoke all on function public.recruiting_get_microsoft_connection_secret()
from public, anon, authenticated;
revoke all on function public.recruiting_upsert_microsoft_connection(
  text, text, text, text, text[], text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.recruiting_disconnect_microsoft_connection() from public, anon;
revoke all on function public.recruiting_refresh_microsoft_connection_tokens(
  text, text, timestamptz, text[]
) from public, anon, authenticated;

grant execute on function public.recruiting_get_microsoft_connection_status() to authenticated;
grant execute on function public.recruiting_disconnect_microsoft_connection() to authenticated;

commit;
