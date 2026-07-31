# Service data-owner readback

The existing secure PM service client successfully selected the production `tasks` table during localization: 915 rows returned and no database error.

This proves the table and service-role connection are healthy. No RLS policy or schema mutation is required; the repair changes the API route to use the same server-only data owner after it has authenticated and scoped the request.
