# Action log — Alleato Brain search authorization

Task: ALL-11
Session: SBRAINSEARCH
Date: 2026-07-24

## Changed boundary

- Added Business Area IDs to the canonical AI tool scope.
- Resolved unrestricted branches for all users and restricted branches only
  for admins or active branch members.
- Made branch metadata authoritative over retained comparison-mode project
  labels in semantic, category, fallback, and source-specific retrieval.
- Kept project-pinned searches from returning company-branch content.
- Allowed indexed email and Teams content only when it belongs to an
  authorized Business Area; project-scoped communications remain admin-only.
- Kept live Microsoft Graph mailbox/chat retrieval admin-only.
- Made authorization-link, profile, Business Area, membership, and project
  scope-query errors explicit.

## Review-driven corrections

1. The first implementation left the source-specific email/Teams path behind
   an obsolete blanket admin gate. It was replaced with indexed exact-scope
   authorization while live Graph remains admin-only.
2. Dedicated `searchEmails` and `searchTeamsMessages` wrappers still blocked
   all non-admins before reaching the shared authorization helper. The wrapper
   gates were removed only for indexed semantic search.
3. Removing those gates initially allowed project-scoped communications
   through document authorization. The shared and source-specific paths now
   require both document authorization and communication authorization.
4. Previously ignored authorization-scope query errors now throw named,
   actionable errors.

## Verification

- Focused authorization/source-specific tests: 15 passed.
- Caller reachability tests: 2 passed.
- Targeted ESLint: passed.
- Changed-file type debt gate: passed.
- Source-specific RAG contract: passed.
- Chat architecture contract: passed.
- Full repository typecheck remains red from pre-existing baseline errors;
  the same semantic-search input-schema errors are present on `origin/main`.
