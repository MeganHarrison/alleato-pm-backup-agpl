# S178 — Restricted executive views

## Intake

1) Session ID: S178
2) Task ID: AAI-1108
Task file: `docs/ops/tasks/2026-07-16-restricted-executive-views.md`
Verification manifest: `docs/ops/evidence/2026-07-16-restricted-executive-views/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-16-restricted-executive-views/verification-result.json`
3) Linear issue: AAI-1108
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1108/add-restricted-executive-views-without-forking-the-operating-model
5) Current status: Accepted
6) Files changed (absolute paths): `frontend/src/lib/permissions-shared.ts`, `frontend/src/lib/app-capabilities.ts` consumer contract, `frontend/src/lib/executive/executive-visibility.ts`, executive API/page consumers, `supabase/migrations/20260716210609_add_executive_detail_capability.sql`, task/handoff/evidence.
7) Scope: Role-sensitive executive visibility over existing state, evidence, lineage, health, actions, and artifacts; no parallel model or report.
8) Non-goals: Monthly review (AAI-1107), project-local writers, and unrelated executive action redesign.
9) Canonical owner: Shared capability policy and governed executive artifact readers.
10) Verification: Focused policy/route tests, authenticated canonical-route screenshot, independent review, verification contract.
11) Provider impact: No provider configuration planned.
12) Migration ledger evidence: Remote `supabase_migrations.schema_migrations` records version `20260716210609` / `add_executive_detail_capability`; exact local/remote verifier passed.
13) Commands run and outcome (pass/fail counts): Pass — migration ledger verifier; focused Jest 6 suites / 12 tests; changed-file ESLint; route conflict check; changed-type guard; verification contract.
14) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-16-restricted-executive-views/summary-role-daily-brief.png`; `summary-role-weekly-review.png`; `summary-role-api-readback.json`; `independent-review.md`.
15) Recommended next action (one line): Publish only the isolated AAI-1108 policy/evidence files; AAI-1107 issuance-atomicity repair remains independently blocked.

## Implementation Notes

Implemented a two-tier capability boundary: `view_executive_briefing` permits only the constrained summary representation; `view_executive_details` is required by the shared server policy before reading claims, source excerpts/URLs, named actions, lineage, health detail, historic packets, portfolio detail, and artifacts. Existing templates that already grant briefing received detail through the idempotent migration, preserving existing full-detail access; administrators can remove detail to define summary-only roles. Published at `948be725a`.

Independent security review found a deep-read candidate action leak. It was repaired by applying the same policy to the central review SSR route and candidate PATCH route. The reviewer also found the independently-owned AAI-1107 monthly review page/API still needs the shared detail policy; this was escalated to the leader rather than edited across ownership boundaries.

## Evidence

- `npm run db:migrations:verify-applied -- supabase/migrations/20260716210609_add_executive_detail_capability.sql` — pass.
- Focused Jest — 6 suites, 12 tests pass.
- Changed-file ESLint — pass.
- `npm run check:routes` — pass.
- Browser detail-role proof: `docs/ops/evidence/2026-07-16-restricted-executive-views/detail-role-daily-brief.png`, visually reviewed.
- Genuine summary-only proof: temporary non-admin principal with the sole `view_executive_briefing` flag rendered the redacted `/daily-brief` and `/weekly-operating-review` views. Its `/api/executive/artifacts/daily` request returned `403 FORBIDDEN` before reader data. Screenshot attached to Linear AAI-1108 as `b0184d2c-3d3a-4c1f-a916-9bb0c5c431d8`; temporary template/person/profile/link/Auth user/local session removal was read back as complete.

## Commands run and outcome

- Pass: Supabase migration ledger verifier for `20260716210609`.
- Pass: focused Jest 6 suites / 12 tests; changed-file ESLint; `npm run check:routes`; frontend changed-type guard.
- Pass: `npm run verify:contract -- --manifest docs/ops/evidence/2026-07-16-restricted-executive-views/verification-manifest.json --result docs/ops/evidence/2026-07-16-restricted-executive-views/verification-result.json --root .`.

## Evidence artifacts

- `docs/ops/evidence/2026-07-16-restricted-executive-views/summary-role-daily-brief.png`
- `docs/ops/evidence/2026-07-16-restricted-executive-views/summary-role-weekly-review.png`
- `docs/ops/evidence/2026-07-16-restricted-executive-views/summary-role-api-readback.json`
- `docs/ops/evidence/2026-07-16-restricted-executive-views/independent-review.md`

## Linear Updates

Kickoff posted to Linear comment `8b6ce3a3-fcef-474b-a9ae-b27efbda51e4`. Security milestone `833a6292-4936-4d99-a4b2-8fa90f48bacc`; viewable summary-role screenshot attachment `b0184d2c-3d3a-4c1f-a916-9bb0c5c431d8`. Closeout remains pending task verification contract and publication.

## Risks and next step

No AAI-1108 security boundary risk remains after independent combined review and live summary-role proof. AAI-1107 has a separate issuance-audit atomicity defect; it must be fixed before monthly publish but does not invalidate the shared restricted-view proof.

## Recommended next action

Publish the isolated AAI-1108 capability policy and evidence; retain the AAI-1107 issuance-audit repair as a separate monthly-review blocker.
