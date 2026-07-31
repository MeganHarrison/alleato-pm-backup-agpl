-- ALL-52: prevent CRM writers from supplying system-managed lead fields.
begin;

revoke insert on public.crm_leads from authenticated;
grant insert (
  organization_name,
  contact_name,
  contact_email,
  contact_phone,
  source,
  notes,
  owner_person_id
) on public.crm_leads to authenticated;

commit;
