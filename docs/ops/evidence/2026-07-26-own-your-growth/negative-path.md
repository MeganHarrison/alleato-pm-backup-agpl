# Negative-path evidence

Focused route, server, client, and linked SQL checks cover the
failure-loudly boundaries:

- unauthenticated page access redirects to `/auth/login`;
- unauthenticated API save returns the specific `AUTH_EXPIRED` recovery path;
- out-of-range scores fail request validation with HTTP 400 before mutation;
- substituted skill identifiers fail the server's canonical skill-library
  precondition before upsert; duplicate/missing identifiers are independently
  rejected by request/schema and database contracts;
- a next-check-in date that does not equal the chosen 30/60/90-day cadence is
  rejected;
- an incomplete top-four focus plan is rejected by the server boundary, and the
  database trigger independently rejects tampered focus flags;
- direct focus-rank tampering raises a database check violation;
- direct canonical-description or contradictory cadence tampering raises a
  database check violation;
- a different authenticated user reads and updates zero rows and cannot insert
  a row for the owner through RLS.

The client retains the draft and shows the API recovery message on a failed
save; no local-storage fallback can falsely report persisted state.
