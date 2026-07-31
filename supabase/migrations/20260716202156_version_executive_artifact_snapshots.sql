begin;

alter table public.executive_artifact_versions
  add column if not exists snapshot_hash text;

alter table public.executive_artifact_versions disable trigger executive_artifact_versions_immutable;
update public.executive_artifact_versions
set snapshot_hash = encode(digest(
  coalesce(state_snapshot::text, '') || '|' ||
  coalesce(attention_snapshot::text, '') || '|' ||
  coalesce(conflict_snapshot::text, ''),
  'sha256'
), 'hex')
where snapshot_hash is null;
alter table public.executive_artifact_versions enable trigger executive_artifact_versions_immutable;

alter table public.executive_artifact_versions
  alter column snapshot_hash set not null;

alter table public.executive_artifact_versions
  drop constraint if exists executive_artifact_versions_artifact_kind_packet_id_key;

create unique index if not exists executive_artifact_versions_snapshot_identity_idx
  on public.executive_artifact_versions(artifact_kind, packet_id, snapshot_hash);

comment on column public.executive_artifact_versions.snapshot_hash is
  'SHA-256 of the immutable governed state, attention, and conflict snapshots; a changed live state issues a distinct version.';

commit;
