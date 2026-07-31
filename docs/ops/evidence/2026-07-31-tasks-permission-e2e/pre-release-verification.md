# Pre-release verification

- Reproduced against production before the change: authenticated `GET /api/tasks?scope=mine` returned HTTP 500 with `permission denied for table tasks`.
- Localized the first mismatch to the API route's RLS-bound query-client selection; authenticated session and service-role connectivity both succeeded.
- Focused regression suite passed after the route uses the canonical `serviceDb` data owner.
- Production browser verification remains required after the release deployment is Ready.
