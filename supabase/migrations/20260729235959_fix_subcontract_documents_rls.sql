-- Allow authenticated project members to manage documents linked to subcontracts.
--
-- subcontract_documents previously passed the unsupported entity discriminator
-- `subcontract` to user_can_access_entity(). That helper deliberately denies
-- unknown entity types, so all four policies denied every non-admin user.
-- Subcontracts are already exposed through commitments_unified with the same UUID
-- and project_id, making the governed `commitment` access path authoritative here.

drop policy if exists "subcontract_documents_select"
  on public.subcontract_documents;
create policy "subcontract_documents_select"
  on public.subcontract_documents
  for select
  to authenticated
  using (
    public.user_can_access_entity('commitment', subcontract_id::text)
  );

drop policy if exists "subcontract_documents_insert"
  on public.subcontract_documents;
create policy "subcontract_documents_insert"
  on public.subcontract_documents
  for insert
  to authenticated
  with check (
    public.user_can_access_entity('commitment', subcontract_id::text)
  );

drop policy if exists "subcontract_documents_update"
  on public.subcontract_documents;
create policy "subcontract_documents_update"
  on public.subcontract_documents
  for update
  to authenticated
  using (
    public.user_can_access_entity('commitment', subcontract_id::text)
  )
  with check (
    public.user_can_access_entity('commitment', subcontract_id::text)
  );

drop policy if exists "subcontract_documents_delete"
  on public.subcontract_documents;
create policy "subcontract_documents_delete"
  on public.subcontract_documents
  for delete
  to authenticated
  using (
    public.user_can_access_entity('commitment', subcontract_id::text)
  );

comment on table public.subcontract_documents is
  'Pattern C junction linking document_metadata to subcontracts. Access follows the commitments_unified project-membership path.';
