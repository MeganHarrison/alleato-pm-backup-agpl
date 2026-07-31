# Project Creation Attribution Verification

Status: PASS

## Database readback

- Remote migration ledger contains `20260722155223`, `20260722155508`, and `20260722164000`.
- Live view coverage: 120 current projects, 120 current-project log rows, 0 missing current projects, 0 mislabeled `legacy_unknown` projects, and 152 total retained creation events.
- Access grants: `anon=false`, `authenticated=false`, `service_role=true`.
- Project 1145 `GW Excel Playground` is retained after deletion with `created_by=null`, `created_via=legacy_unknown`, `creation_run_id=legacy-audit:0e6672d8-79e6-4562-81a1-b26b5a0cdf42`, and `attribution_status=legacy_gap`.
- Project 1146 is the current Acumatica-synced record and carries source/run evidence without a guessed human actor.
- Transactional trigger probes rejected missing attribution and attempted attribution rewrites with PostgreSQL `23514` messages.

## Automated checks

- Focused frontend Jest: 6 suites, 33 tests passed.
- Backend Acumatica attribution regression: 1 test passed.
- Targeted ESLint: 0 errors. Eight existing bootstrap response `any` warnings are unchanged.
- Surface complexity audit: both changed project-creation UI files passed.
- Repository typecheck remains red from unrelated existing modules; the delegated verifier found zero diagnostics in the project-creation attribution/log slice.

## Authenticated browser proof

- Desktop: the search returns the current Acumatica event and retained legacy gap; the current link navigates to `/1146/home`.
- Mobile: distinct record cards preserve project, actor, created time, source, and attribution status.
- The shared table owner provides search, filters, column controls, export, responsive cards, and no edit/delete/bulk actions.
- Noise gate: PASS. Source and status were combined into one evidence column, malformed serialized legacy metadata is suppressed, and no summary cards, duplicate actions, or decorative wrappers were added.

## Negative path

The original project 1145 has no trustworthy human actor evidence. The system keeps `Not captured`, `Legacy unknown`, and `Legacy gap`; it does not infer a person from service-role or integration fallback accounts.
