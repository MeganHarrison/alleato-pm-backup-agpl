-- Test if RLS policy would allow insert for test user
-- This simulates what happens when the test user tries to create a budget view

SELECT
  'Test user auth.uid() simulation' AS test_name,
  au.id AS auth_user_id,
  au.email,
  pu.project_id,
  pu.role,
  -- Simulate the RLS policy check
  EXISTS (
    SELECT 1 FROM projects p
    JOIN project_users pu2 ON p.id = pu2.project_id
    WHERE p.id = 67
      AND pu2.user_id = au.id
  ) AS would_pass_rls_check
FROM auth.users au
LEFT JOIN project_users pu ON pu.user_id = au.id AND pu.project_id = 67
WHERE au.email = 'test@example.com';
