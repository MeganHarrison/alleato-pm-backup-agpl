-- Fix: submittal_linked_drawings_access policy had with_check=null,
-- causing PostgreSQL to use USING clause for INSERT — blocking users
-- whose auth_user_id is not in project_directory_memberships for the project.
-- Add explicit WITH CHECK mirroring the USING clause.
ALTER POLICY submittal_linked_drawings_access ON public.submittal_linked_drawings
  USING (
    submittal_id IN (
      SELECT submittals.id
      FROM submittals
      WHERE submittals.project_id IN (
        SELECT pdm.project_id
        FROM project_directory_memberships pdm
        JOIN people p ON p.id = pdm.person_id
        WHERE p.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    submittal_id IN (
      SELECT submittals.id
      FROM submittals
      WHERE submittals.project_id IN (
        SELECT pdm.project_id
        FROM project_directory_memberships pdm
        JOIN people p ON p.id = pdm.person_id
        WHERE p.auth_user_id = auth.uid()
      )
    )
  );
