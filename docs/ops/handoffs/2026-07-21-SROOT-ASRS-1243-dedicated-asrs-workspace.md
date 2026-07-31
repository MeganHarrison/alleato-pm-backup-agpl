# Handoff: 2026-07-21 — Dedicated ASRS Intelligence Workspace

## Intake Block

1) Session ID: SROOT-ASRS-1243
2) Task ID: AAI-1243
3) Linear issue: AAI-1243
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1243/build-a-dedicated-asrs-intelligence-chat-and-corpus-workspace
5) Current status: Accepted and Published — implementation, remote migration, focused verification, authenticated browser proof, screenshots, independent approval, exact-file publication, and production deployment readback pass.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/app/api/asrs/chat/route.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/ai/tools/asrs-intelligence.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/asrs-estimator.server.ts`, `/Users/meganharrison/Documents/github/project-management/frontend/src/lib/fmds/fmds-chat.server.ts`, focused tests, `/Users/meganharrison/Documents/github/project-management/infrastructure/asrs-supabase/supabase/migrations/20260722035924_return_fmds_evaluator_revision_identity.sql`, and task/handoff/evidence/control-plane records.
7) Commands run and outcome (pass/fail counts): 11 focused Jest suites / 41 tests pass; targeted ESLint passes; changed-code `any` guard passes; `npm run check:routes` passes; `git diff --check` passes; authenticated `/asrs` question/answer passes; cross-surface general POST returns the expected 404 and writes zero messages; live database evaluator returns the exact requested revision and 250 gpm / 60 minutes.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-21-dedicated-asrs-workspace/` contains complete desktop/mobile chat screenshots, table/figure directory and review screenshots, `runtime-verification.md`, `database-readback.md`, `independent-review.md`, and the verification contract files. Current screenshots are attached to AAI-1243.
9) Top 3 findings (frontend-visible issues first): `/asrs` now provides the requested dedicated chat plus table/figure review workspace; the general write handler previously lacked a surface authorization check; the evaluator previously normalized with the requested revision instead of proving the revision returned by the database.
10) Recommended next action (one line): continue governed table/figure review and estimator-rule expansion without activating the staging corpus until those separate gates pass.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT-ASRS-1243-dedicated-asrs-workspace.md`
12) Migration ledger evidence: ASRS migration `20260722035924_return_fmds_evaluator_revision_identity.sql` is present in both Local and Remote; live function readback proves security-invoker, service-role-only execution, identical requested/returned revision IDs, and the reviewed deterministic result.

Task file: `docs/ops/tasks/2026-07-21-dedicated-asrs-workspace.md`
Verification manifest: `docs/ops/evidence/2026-07-21-dedicated-asrs-workspace/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-21-dedicated-asrs-workspace/verification-result.json`

## Scope Boundary

This task owns the dedicated ASRS chat/session boundary, revision-scoped FMDS
retrieval and evaluator seam, and tables/figures review UI. It does not activate
the staging corpus, approve pending engineering interpretations, add head-count
rules, or implement pricing/BOM calculations.

## Cause, Detection Gap, and Prevention

- Cause: read-time surface filtering and caller-side revision pinning existed,
  but the general write handler and evaluator response did not independently
  prove ownership and revision identity.
- Detection gap: prior checks covered ASRS reads and search revision isolation,
  but omitted a negative general-write test and evaluator-returned drift test.
- Prevention: pre-execution conversation ownership check, exact eligible-revision
  queries, scoped RPC returning database revision identity, application/tool
  drift rejection, and focused negative-path tests.

## Verification Summary

- Pass: dedicated `/asrs` route uses `/api/asrs/chat` and ASRS-only tools.
- Pass: general `/ai` cannot load or append to the verified ASRS session.
- Pass: the current turn pins retrieval and evaluation to one eligible
  FMDS0834 revision; database and application reject drift.
- Pass: deterministic live answer is 250 gpm (950 L/min) for 60 minutes from
  Table 2.1.4.5.4, PDF page 12, with all unsupported outputs Pending Review.
- Pass: table/figure directories and detail review workflows are visibly proven.
- Pass: independent reviewer `fmds_quick_verdict` returned APPROVED.

## Noise Gate

- Pass: one primary job and action, with Chat / Tables / Figures as the only
  top-level controls.
- Removed/avoided: project picker behavior, council mode, decorative orb,
  dashboard KPIs, duplicate CTAs, and raw extraction metadata in the primary
  chat flow.
- Guardrail: shared workspace/table/detail primitives own the UI; ASRS-specific
  behavior is configuration and server policy rather than copied JSX.

## Known Pitfalls / Deferred Work

- FMDS0834 remains `staging`; this task does not authorize corpus activation.
- Pending Review means the rule is not safe to present as verified engineering
  output. The UI and RAG response preserve that state.
- Complete head-count, configuration, and compliance calculations remain a
  separate governed estimator expansion.

## Linear Updates

- Kickoff comment: `6bc33ea4-8de9-481e-b86e-ccd38e15e91f`.
- Initial screenshot comment: `f2761f21-c5a3-4833-adcd-e89657064792`.
- Current attachments include desktop/mobile deterministic chat, figures
  directory, table review controls, and figure review controls.
- Refreshed desktop attachment: `82fbe020-931e-4c50-8ef9-1787fe974125`.
- Refreshed mobile attachment: `f4559848-ef3b-40d2-a331-1b9145d96e68`.
- Refreshed screenshot comment: `1009381a-7719-4e85-aae3-2742e48dfe30`.
- Final completion comment records the published commit and production deployment.

## Publication Readback

- Implementation checkpoint: `3c46fde451e9ba46ec07e21940c06007268670a0`
- Published branch: `origin/main`
- Local/remote equality: verified after duplicate replay was skipped because the rebased patch already existed upstream
- Vercel deployment: `dpl_4mvJig8eYf1B1x7jWpedLhbqJ3y4`, Ready, production, cloned `main` commit `3c46fde`
- Canonical route: `https://projects.alleatogroup.com/asrs` returns the expected authenticated login redirect for an unauthenticated request
- Linear status: ready for Done
