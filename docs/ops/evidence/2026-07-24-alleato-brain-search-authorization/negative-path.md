# Negative-path evidence

- Finance has zero active memberships and is absent from a non-admin scope.
- A Finance row retaining legacy `project_id=60` is rejected because its
  `business_area_id=3` label takes precedence.
- A malformed branch label such as the string `"3"` is rejected instead of
  falling back to project authorization.
- A Business Area row is rejected from a pinned-project search even when it
  retains the same legacy project ID.
- An indexed project email or Teams row remains blocked for non-admins even
  when its project is otherwise authorized.
- Non-admin source-specific retrieval never opens live Microsoft Graph email
  or Teams data.
- Failed authorization-profile or branch-membership reads reject scope loading
  with a named error.

Durable coverage:

- `frontend/src/lib/ai/tools/__tests__/business-area-retrieval.test.ts`
- `frontend/src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts`
- `frontend/src/lib/ai/tools/__tests__/business-area-communication-reachability.test.ts`
