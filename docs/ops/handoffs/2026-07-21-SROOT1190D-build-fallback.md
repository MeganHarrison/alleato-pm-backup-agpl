# Handoff: 2026-07-21 — Production Build Fallback Repair

## Intake Block

1) Session ID: SROOT1190D
2) Task ID: AAI-1190
3) Linear issue: AAI-1190
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk
5) Current status: Complete — Vercel Turbopack endpoint-write failure now reaches the existing retry and webpack fallback.
6) Files changed (absolute paths): `frontend/scripts/build/run-production-build.mjs`; this handoff.
7) Commands run and outcome (pass/fail counts): PASS canonical production build completed locally; Vercel logs reproduced `TurbopackInternalError: Failed to write app endpoint` and proved the prior case-sensitive matcher missed it.
8) Evidence artifacts (screenshot/video/report/log paths): Vercel deployment `dpl_C29aMZvqURZkVvkPmQoyQkq8wQqd` build log; local canonical `frontend/.next/BUILD_ID` output.
9) Top 3 findings (frontend-visible issues first): no product code failure; production delivery stopped because the fallback matcher was case-sensitive; fallback now fails over to webpack rather than leaving the release blocked.
10) Recommended next action (one line): allow the next `main` deployment to execute the corrected fallback and then run AAI-1190 browser acceptance.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT1190D-build-fallback.md`
12) Migration ledger evidence: not applicable.
13) Task file: `docs/ops/tasks/2026-07-21-aai-1190-submittal-risk.md`

## Linear Updates

- Delivery guardrail repair accompanies AAI-1190 deployment verification.
# Follow-up: Vercel compiled all schedule code after the heap/output configuration fix, then the live monitor terminated the transient 8 GB Webpack `.next/cache` before final output inspection. The monitor now excludes only that compiler cache; a successful build removes the cache before the final full output-boundary and nested-output checks. Red/green regression coverage is in `build-output-boundary.test.mjs` (9/9 pass with the canonical dependency symlink used only for test setup).
