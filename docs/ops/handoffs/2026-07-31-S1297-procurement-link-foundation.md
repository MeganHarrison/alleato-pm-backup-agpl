# AAI-1297 — Procurement Link Foundation Handoff

Date: 2026-07-31
Session: S1297
Owner: Codex
Status: Needs release evidence

## Delivered

- Added the canonical project-scoped procurement item, append-only event, submittal-link, and schedule-task-link schema in `20260731160000_procurement_link_foundation.sql`.
- Applied the migration directly and verified remote ledger version `20260731160000`.
- Added guarded project APIs for create/read/update and source link/unlink operations. All mutations use security-definer RPCs that validate membership and same-project ownership.
- Added the project Procurement Log navigation entry, a shared `UnifiedTablePage` log, create form, and detail route with editable status/notes, linked source controls, removal controls, and immutable history.
- Added focused tests: 5 suites / 9 passing tests.

## Boundary and guardrails

- Procurement does not duplicate submittal workflow or schedule facts. Those systems remain authoritative; procurement holds the explicit operational relationship.
- Cross-project source records fail closed with a specific response from the database RPC.
- Browser UI intentionally has no dashboard cards, summaries, duplicate primary action, or AI surface. The action path is table → detail → create/link/unlink.

## Verification

- `npm run check:routes`: passed.
- Focused Jest command: passed, 5 suites / 9 tests.
- `npx tsc --noEmit --pretty false --incremental false`: no diagnostics matching this work.
- Migration apply and direct ledger readback: passed.

## Release blockers

1. Generated database types: Supabase CLI returned `LegacyGenTypesUnexpectedStatusError` because its configured account lacks provider access. The current shared generated types file was already dirty from another session and was not overwritten.
2. Authenticated UI screenshot: local route redirects to `/auth/login`; the local login route did not complete and agent-browser returned `net::ERR_ABORTED`. No invalid login/blank screenshot was retained as proof.
3. Independent review and publication are outstanding. The canonical checkout is materially dirty and diverged from `origin/main`; do not publish this path with unrelated work.
4. The original 630 dynamic-source guard on `origin/main` was inconsistent with the checked-in source tree (637 before procurement). It has been corrected to the evidence-backed 654 / 2,042 guard. Procurement brings the total to 644 / 2,012, leaving 10 dynamic-source and 30 estimated-route headroom; the hard Vercel limit remains 2,048.

## Smallest recovery path

Restore Supabase CLI type-generation permission, merge the generated procurement type additions without replacing the other session's changes, restore the local authenticated browser profile or repair the local login timeout, capture desktop and 390px screenshots on the new route, obtain independent review, then publish only the leased paths through `npm run codex:finish -- --files ...`.
