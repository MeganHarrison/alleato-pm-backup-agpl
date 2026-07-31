-- Script to verify budget views exist for project 67
-- Run this to diagnose budget views test failures

-- 1. Check if project 67 exists
SELECT
  id,
  name,
  created_at
FROM projects
WHERE id = 67;

-- 2. Check if test user is in project_users for project 67
SELECT
  pu.id,
  pu.user_id,
  pu.project_id,
  pu.role,
  u.email,
  pu.assigned_at
FROM project_users pu
JOIN users u ON u.id = pu.user_id
WHERE pu.project_id = 67
  AND u.email = 'test@example.com';

-- 3. Check if any budget views exist for project 67
SELECT
  id,
  project_id,
  name,
  description,
  is_default,
  is_system,
  created_by,
  created_at
FROM budget_views
WHERE project_id = 67
ORDER BY is_default DESC, created_at;

-- 4. Check budget view columns for project 67 views
SELECT
  bv.name AS view_name,
  bvc.column_key,
  bvc.display_name,
  bvc.display_order,
  bvc.is_visible,
  bvc.is_locked
FROM budget_view_columns bvc
JOIN budget_views bv ON bvc.view_id = bv.id
WHERE bv.project_id = 67
ORDER BY bv.name, bvc.display_order;

-- 5. Test RLS policy - simulate what the API would see
-- This requires running as the test user, so we'll show what the policy checks
SELECT
  bv.id,
  bv.name,
  bv.is_default,
  bv.is_system,
  -- Check if test user would have access via RLS policy
  EXISTS (
    SELECT 1 FROM projects p
    JOIN project_users pu ON p.id = pu.project_id
    JOIN auth.users au ON pu.user_id = au.id
    WHERE p.id = bv.project_id
      AND au.email = 'test@example.com'
  ) AS test_user_has_access
FROM budget_views bv
WHERE bv.project_id = 67;
