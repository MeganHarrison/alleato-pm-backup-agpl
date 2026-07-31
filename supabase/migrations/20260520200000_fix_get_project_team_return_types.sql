-- Fix get_project_team type mismatch.
-- people.* and companies.name are text, but the RPC declared varchar return columns,
-- causing "structure of query does not match function result type" on every call.
-- Effect: the project Home page silently fell back to empty team data even when
-- project_role_members had rows. Reported via admin feedback 69bfa1d9.

DROP FUNCTION IF EXISTS public.get_project_team(integer);

CREATE OR REPLACE FUNCTION public.get_project_team(p_project_id integer)
RETURNS TABLE (
  id uuid,
  role text,
  person_id uuid,
  first_name text,
  last_name text,
  full_name text,
  email text,
  company_name text,
  phone_office text,
  phone_mobile text
)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    prm.id,
    pr.role_name::text AS role,
    p.id AS person_id,
    p.first_name,
    p.last_name,
    CONCAT(p.first_name, ' ', p.last_name) AS full_name,
    p.email,
    c.name AS company_name,
    p.phone_business AS phone_office,
    p.phone_mobile
  FROM project_roles pr
  JOIN project_role_members prm ON prm.project_role_id = pr.id
  JOIN people p ON p.id = prm.person_id
  LEFT JOIN companies c ON c.id = p.company_id
  WHERE pr.project_id = p_project_id
  ORDER BY pr.display_order, p.last_name, p.first_name;
END;
$function$;
