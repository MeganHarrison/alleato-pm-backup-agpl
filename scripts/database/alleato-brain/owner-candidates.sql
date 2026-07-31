SELECT
  id,
  concat_ws(' ', first_name, last_name) AS name,
  email,
  job_title,
  status
FROM public.people
WHERE status = 'active'
  AND (
    lower(coalesce(person_type, '')) = 'internal'
    OR lower(coalesce(email, '')) LIKE '%@alleatogroup.com'
  )
ORDER BY name, email;
