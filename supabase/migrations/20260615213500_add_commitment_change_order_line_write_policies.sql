-- Allow authenticated project members and app admins to manage line items for
-- commitment change orders. The parent commitment CO stores project scope, so
-- line-item write access is checked through contract_change_orders instead of
-- trusting client-provided context. App admins mirror requirePermission(), which
-- allows admins even when older imported projects do not yet have directory rows.

drop policy if exists "commitment_change_order_lines_insert_project_member"
  on public.commitment_change_order_lines;
drop policy if exists "commitment_change_order_lines_update_project_member"
  on public.commitment_change_order_lines;
drop policy if exists "commitment_change_order_lines_delete_project_member"
  on public.commitment_change_order_lines;

create policy "commitment_change_order_lines_insert_project_member"
  on public.commitment_change_order_lines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and (up.is_admin is true or up.is_developer is true)
    )
    or exists (
      select 1
      from public.contract_change_orders cco
      join public.project_directory_memberships pdm
        on pdm.project_id = cco.project_id
       and pdm.status = 'active'
      join public.users_auth ua
        on ua.person_id = pdm.person_id
      where cco.id = commitment_change_order_lines.commitment_change_order_id
        and ua.auth_user_id = (select auth.uid())
    )
  );

create policy "commitment_change_order_lines_update_project_member"
  on public.commitment_change_order_lines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and (up.is_admin is true or up.is_developer is true)
    )
    or exists (
      select 1
      from public.contract_change_orders cco
      join public.project_directory_memberships pdm
        on pdm.project_id = cco.project_id
       and pdm.status = 'active'
      join public.users_auth ua
        on ua.person_id = pdm.person_id
      where cco.id = commitment_change_order_lines.commitment_change_order_id
        and ua.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and (up.is_admin is true or up.is_developer is true)
    )
    or exists (
      select 1
      from public.contract_change_orders cco
      join public.project_directory_memberships pdm
        on pdm.project_id = cco.project_id
       and pdm.status = 'active'
      join public.users_auth ua
        on ua.person_id = pdm.person_id
      where cco.id = commitment_change_order_lines.commitment_change_order_id
        and ua.auth_user_id = (select auth.uid())
    )
  );

create policy "commitment_change_order_lines_delete_project_member"
  on public.commitment_change_order_lines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = (select auth.uid())
        and (up.is_admin is true or up.is_developer is true)
    )
    or exists (
      select 1
      from public.contract_change_orders cco
      join public.project_directory_memberships pdm
        on pdm.project_id = cco.project_id
       and pdm.status = 'active'
      join public.users_auth ua
        on ua.person_id = pdm.person_id
      where cco.id = commitment_change_order_lines.commitment_change_order_id
        and ua.auth_user_id = (select auth.uid())
    )
  );
