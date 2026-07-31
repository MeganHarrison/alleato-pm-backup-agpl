-- RFI subcontractor response system: structured responses + magic-link tokens.
--
-- Powers two no-login response channels that both write to `rfi_responses`:
--   1. Web  — a public /respond/rfi/<token> page (no app account needed)
--   2. Email — reply-to ingestion (recipient replies to the RFI email)
--
-- `rfi_response_tokens` authorizes ONE recipient to respond to ONE RFI without
-- logging in. The same token is embedded in the magic-link URL and in the email
-- reply plus-address, so either channel resolves to the same recipient + RFI.

create table if not exists public.rfi_responses (
  id uuid primary key default gen_random_uuid(),
  rfi_id uuid not null references public.rfis(id) on delete cascade,
  project_id integer not null,
  responder_name text,
  responder_email text,
  responder_person_id uuid references public.people(id) on delete set null,
  body text not null,
  source text not null default 'web',
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rfi_responses_source_check check (source in ('web', 'email', 'app')),
  constraint rfi_responses_body_not_blank check (length(btrim(body)) > 0)
);
create index if not exists rfi_responses_rfi_id_idx on public.rfi_responses (rfi_id);
create index if not exists rfi_responses_project_id_idx on public.rfi_responses (project_id);

create table if not exists public.rfi_response_tokens (
  token text primary key,
  rfi_id uuid not null references public.rfis(id) on delete cascade,
  project_id integer not null,
  recipient_name text,
  recipient_email text not null,
  recipient_person_id uuid references public.people(id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rfi_response_tokens_rfi_id_idx on public.rfi_response_tokens (rfi_id);

alter table public.rfi_responses enable row level security;
alter table public.rfi_response_tokens enable row level security;

-- App reads/writes go through the service role (API routes). Authenticated users
-- may read responses; the public response endpoint uses the service client only
-- after validating a token server-side. Tokens have NO authenticated/anon policy,
-- so they are reachable solely via the service role.
create policy "rfi_responses_auth_select" on public.rfi_responses
  for select to authenticated using (true);
