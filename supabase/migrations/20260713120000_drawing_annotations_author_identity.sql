-- The canonical drawing API authorizes against the app identity resolved by
-- verifyProjectAccess. Do not require that identity to exist in auth.users:
-- SSO-backed users can legitimately have no matching Supabase Auth row.
ALTER TABLE drawing_annotations
  DROP CONSTRAINT IF EXISTS drawing_annotations_created_by_fkey;
