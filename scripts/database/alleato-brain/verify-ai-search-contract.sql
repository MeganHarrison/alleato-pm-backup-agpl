SELECT
  proname,
  pg_get_function_identity_arguments(function.oid) AS arguments,
  pg_get_function_result(function.oid) AS result_type
FROM pg_proc AS function
JOIN pg_namespace AS namespace
  ON namespace.oid = function.pronamespace
WHERE namespace.nspname = 'public'
  AND proname = 'search_document_chunks'
ORDER BY arguments;
