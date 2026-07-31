# Handoff: 2026-07-31 - Plane template migration

## Intake Block

1) Session ID: SPLANEMIG0731
2) Task ID: AAI-PLANE-MIGRATION
3) Linear issue: Unavailable; no Linear connector is callable in this session.
4) Linear URL: N/A
5) Current status: In Progress
6) Files changed (absolute paths): Plane feature/API owners under
   `C:/Users/KimiClaw/Desktop/project-management/frontend/src/features/plane-*`
   and `frontend/src/app/api/plane-*`, `frontend/next.config.ts`, six matching
   migration definitions, two Plane notices, and this task/handoff.
7) Commands run and outcome (pass/fail counts): 39 focused tests passed;
   route gate passed; task-scoped whitespace gate passed; lease audit passed.
8) Evidence artifacts (screenshot/video/report/log paths):
   `C:/Users/KimiClaw/Desktop/project-management/tests/agent-browser-runs/2026-07-31T22-55-05-691Z-plane-migration-preflight`
9) Top 3 findings (frontend-visible issues first):
   - The target already has a partial Plane release and the correct legacy Tasks fallback owner.
   - Production uses Supabase `lgveqfnpkxvzbnnwuled`, so duplicate migrations are forbidden.
   - The completed backup release contains eleven missing Plane feature/API owners plus navigation fixes.
10) Recommended next action (one line): Publish the verified batch once, then run the authenticated 16-route production matrix.
11) Handoff file path: `docs/ops/handoffs/2026-07-31-SPLANEMIG0731-plane-template-migration.md`
12) Migration ledger evidence: Production ledger confirms versions
    `20260731231000` through `20260731231500` are applied. The standard verifier
    is blocked by an unrelated duplicate local version `20260729190000`; no
    Plane migration was reapplied.

## Linear Updates

- Kickoff comment: Unavailable; no Linear connector is callable in this session.
- Milestone comments: N/A
- Completion/blocker comment: Pending

## Current Status

Implementation, focused contracts, route validation, schema readback, and lease
audit pass. The canonical writer lease owns only Plane, licensing, task,
handoff, migration-definition, and rewrite paths; unrelated dirty files remain
untouched. Production release and authenticated visual proof remain.

## Exact Next Step

Publish the coherent batch after the exact public source revision and Vercel
source environment value are prepared, then run the production smoke matrix.

## Known Pitfalls

- Do not replace legacy Tasks when `planeSurface` is absent.
- Do not create physical Plane page route trees; rewrites must dispatch through Tasks.
- Do not reapply the already-live Plane migrations.
- Do not overwrite the unrelated dirty app sidebar.
- Do not publish before the exact corresponding-source revision exists.
- Do not publish the stale local `next.config.ts`; it was refreshed from current
  `origin/main` before the Plane rewrites were reapplied.

## Resume Commands

```powershell
cd C:\Users\KimiClaw\Desktop\project-management
node scripts/ops/checkout-session-gate.mjs audit --session SPLANEMIG0731
git status --short
```

## Evidence

- Authenticated preflight:
  `tests/agent-browser-runs/2026-07-31T22-55-05-691Z-plane-migration-preflight`.
- Production bundle names Supabase project `lgveqfnpkxvzbnnwuled` and does not
  contain the alternate project reference.
- Production REST readback returned HTTP 200 for Plane modules, cycles, workspace
  items, Stickies, artifacts, Tasks, and Outlook intake tables.
- Seven focused Jest suites passed 30 tests; workspace-shell Vitest passed 3;
  Stickies Vitest passed 6; route and task-scoped whitespace gates passed.

## Failure and Recovery

- Supabase type generation failed because the configured legacy CLI token has
  an invalid format. The redirected error was detected immediately and the
  tracked type file was restored byte-for-byte from Git.
- Prevention: generate to a temporary path and replace the tracked type file
  only after the CLI exits successfully.
