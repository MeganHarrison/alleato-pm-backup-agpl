-- App admins (user_profiles.is_admin, surfaced via current_is_app_admin())
-- should be able to see and manage punch items for EVERY project, regardless of
-- project_directory_memberships. Previously the punch_items policies only
-- granted access to directory members, so admins saw nothing on projects they
-- were not explicitly added to (e.g. Noblesville/25125, which has zero members).
--
-- This mirrors the admin bypass already present on document_metadata,
-- conversations, etc. via the same current_is_app_admin() helper.

DROP POLICY IF EXISTS punch_items_select_policy ON public.punch_items;
CREATE POLICY punch_items_select_policy ON public.punch_items FOR SELECT
USING (
  public.current_is_app_admin()
  OR (
    (EXISTS ( SELECT 1
       FROM ((project_directory_memberships pdm
         JOIN people p ON ((p.id = pdm.person_id)))
         JOIN users_auth ua ON ((ua.person_id = p.id)))
      WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = ( SELECT auth.uid() AS uid)))))
    AND ((NOT is_private) OR (EXISTS ( SELECT 1
       FROM ((project_directory_memberships pdm
         JOIN people p ON ((p.id = pdm.person_id)))
         JOIN users_auth ua ON ((ua.person_id = p.id)))
      WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = ( SELECT auth.uid() AS uid)) AND (pdm.role = ANY (ARRAY['admin'::text, 'Project Admin'::text, 'Project Manager'::text]))))))
  )
);

DROP POLICY IF EXISTS punch_items_insert_policy ON public.punch_items;
CREATE POLICY punch_items_insert_policy ON public.punch_items FOR INSERT
WITH CHECK (
  public.current_is_app_admin()
  OR (EXISTS ( SELECT 1
     FROM ((project_directory_memberships pdm
       JOIN people p ON ((p.id = pdm.person_id)))
       JOIN users_auth ua ON ((ua.person_id = p.id)))
    WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = ( SELECT auth.uid() AS uid)))))
);

DROP POLICY IF EXISTS punch_items_update_policy ON public.punch_items;
CREATE POLICY punch_items_update_policy ON public.punch_items FOR UPDATE
USING (
  public.current_is_app_admin()
  OR (EXISTS ( SELECT 1
     FROM ((project_directory_memberships pdm
       JOIN people p ON ((p.id = pdm.person_id)))
       JOIN users_auth ua ON ((ua.person_id = p.id)))
    WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = ( SELECT auth.uid() AS uid)))))
);

DROP POLICY IF EXISTS punch_items_delete_policy ON public.punch_items;
CREATE POLICY punch_items_delete_policy ON public.punch_items FOR DELETE
USING (
  public.current_is_app_admin()
  OR (EXISTS ( SELECT 1
     FROM ((project_directory_memberships pdm
       JOIN people p ON ((p.id = pdm.person_id)))
       JOIN users_auth ua ON ((ua.person_id = p.id)))
    WHERE ((pdm.project_id = punch_items.project_id) AND (ua.auth_user_id = ( SELECT auth.uid() AS uid)))))
);
