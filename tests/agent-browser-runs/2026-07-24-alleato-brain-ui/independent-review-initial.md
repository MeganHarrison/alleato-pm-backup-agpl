# Initial independent review

Decision: NEEDS REWORK

The high-risk review identified five blocking gaps:

1. Server pagination and sorting changed only client state.
2. Legacy mapped Meetings/Tasks were still hidden by base-table RLS for
   ordinary staff.
3. Files outside `category=knowledge` could not use the signed source endpoint.
4. External source URLs were not scheme-validated at the UI boundary.
5. Upload and data-access regression coverage was incomplete.

Resolution:

- Page, sort, and page-size handlers now write the route query parameters.
- Migration `20260724090000` supplies the transition RLS boundary and its live
  attacker fixture.
- The signed-URL route now authorizes every RLS-visible document category.
- Root-relative and HTTP(S) are the only accepted direct source targets.
- Focused coverage now includes authorization ordering/failures, mapped query
  construction, URL state, historical upload guardrails, branch stamping,
  cleanup, unsafe links, and non-knowledge source access.
