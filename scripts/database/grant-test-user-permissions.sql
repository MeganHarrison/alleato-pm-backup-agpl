-- Grant test user permissions for project 67 directory module
-- First, check if the user exists and get their person_id
WITH test_user AS (
  SELECT
    ua.auth_user_id,
    p.id as person_id,
    p.email
  FROM people p
  JOIN users_auth ua ON p.id = ua.person_id
  WHERE p.email = 'test1@mail.com'
  LIMIT 1
),
-- Create or get permission template with directory admin access
permission_template AS (
  INSERT INTO permission_templates (
    name,
    description,
    scope,
    rules_json
  )
  VALUES (
    'Project Admin',
    'Full admin access to all project modules',
    'project',
    '{
      "directory": ["read", "write", "admin"],
      "budget": ["read", "write", "admin"],
      "contracts": ["read", "write", "admin"],
      "documents": ["read", "write", "admin"],
      "schedule": ["read", "write", "admin"],
      "submittals": ["read", "write", "admin"],
      "rfis": ["read", "write", "admin"],
      "change_orders": ["read", "write", "admin"]
    }'::jsonb
  )
  ON CONFLICT (name, scope)
  DO UPDATE SET rules_json = EXCLUDED.rules_json
  RETURNING id
)
-- Update or insert project directory membership with proper permissions
INSERT INTO project_directory_memberships (
  project_id,
  person_id,
  permission_template_id,
  status,
  created_at,
  updated_at
)
SELECT
  67 as project_id,
  tu.person_id,
  pt.id as permission_template_id,
  'active' as status,
  NOW() as created_at,
  NOW() as updated_at
FROM test_user tu
CROSS JOIN permission_template pt
ON CONFLICT (project_id, person_id)
DO UPDATE SET
  permission_template_id = EXCLUDED.permission_template_id,
  status = 'active',
  updated_at = NOW();

-- Verify the permissions were granted
SELECT
  pdm.*,
  p.email,
  pt.name as template_name,
  pt.rules_json
FROM project_directory_memberships pdm
JOIN people p ON pdm.person_id = p.id
LEFT JOIN permission_templates pt ON pdm.permission_template_id = pt.id
WHERE pdm.project_id = 67
  AND p.email = 'test1@mail.com';