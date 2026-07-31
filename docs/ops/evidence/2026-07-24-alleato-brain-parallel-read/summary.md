# Alleato Brain parallel-read evidence

Date: 2026-07-24
Task: ALL-11-PARALLEL-READ
Delivery lane: High-risk

## Result

The transition read boundary is live. Active internal staff can read mapped
legacy Meetings and Tasks for unrestricted Business Areas without inheriting
fake-project membership. Finance remains restricted to app administrators and
exact active Finance members, even when the principal is temporarily made a
member of the Finance fake project.

Records whose direct Business Area disagrees with the permanent project mapping
fail closed. External or orphaned authenticated identities do not receive the
company-wide transition read policy.

The existing signed document endpoint remains authenticated and RLS-bound. It
now opens any `document_metadata` category already visible to the caller and
rejects non-HTTP(S) source URLs.

## Guardrails

- Fixed `search_path=''` on all new security-definer helpers.
- Execute revoked from `PUBLIC` and `anon`.
- Restrictive Meetings/Tasks policies compose with older permissive project
  policies.
- Live negative-path fixture runs in a transaction and always rolls back.
- Exact migration application requires the version-matching
  `ALLEATO_BRAIN_APPLY` confirmation value.
