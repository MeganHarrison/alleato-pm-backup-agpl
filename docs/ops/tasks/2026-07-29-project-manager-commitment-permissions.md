# Task: Project Manager Commitment Permissions

Status: Complete
Owner: Codex
Created: 2026-07-29
Task ID: PM-PERMISSIONS-20260729
Linear Issue: Not used; this is a single-session production correction requested directly by Brandon.
Related Handoff:
`docs/ops/handoffs/2026-07-29-SROOT-project-manager-commitment-permissions.md`

## Objective

Every employee assigned the Project Manager permission template can open the
projects covered by that template and create or edit commitments.

## Scope

- Unify project access checks across the project layout, project shell/API
  authorization, and project portfolio visibility.
- Treat direct active directory membership, project-role membership, and a
  company-wide template as valid project access sources.
- Preserve direct project-template precedence over a company-wide template.
- Update every existing Project Manager permission template so Commitments is
  Write.
- Exclude unrelated role levels and unrelated permission modules.

## Source of Truth

- Canonical runtime/data owner: PM App Supabase permission tables and Next.js
  server authorization.
- Existing shared primitives/services:
  `frontend/src/lib/supabase/auth-guard.ts`,
  `frontend/src/app/(main)/[projectId]/layout.tsx`,
  `frontend/src/app/api/projects/route.ts`,
  `frontend/src/lib/permissions.ts`.
- Deprecated or parallel paths: The duplicated membership queries in the
  layout and API guard will be replaced by the shared resolver.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A role-only project-team member can load the project shell.
- [x] A company-wide permission-template holder can see and open every project.
- [x] A direct project template overrides a company-wide template.
- [x] Users without a directory membership, project role, or company template
  remain denied.
- [x] Inactive people remain denied even if stale role or company-template
  assignments still exist.
- [x] All company- and project-scoped templates named `Project Manager` grant
  `commitments` read and write.
- [x] Existing non-Commitments Project Manager permissions remain unchanged.
- [x] Permission query failures deny access and surface a specific server error.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
  handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a named project-access lookup failure, or an explicit 403
  when no access source exists.
- Detection path: focused resolver tests, project-route tests, migration
  readback, and authenticated browser verification.
- Recovery path: repair the failed permission assignment/query or restore the
  previous template rules from the migration's documented rollback query.

## Incident Learning

- Failure fingerprint: `auth.project-access-source-drift`
- Root cause: Project-team roles, company-wide templates, the project layout,
  and API guards used different definitions of project access. Separately, the
  Commitments module was added after the Project Manager templates were seeded,
  leaving it at None.
- Detection gap: No contract test required the same access result across all
  authorization entry points or asserted new modules were added to role
  templates.
- Prevention: One resolver plus regression tests and a migration readback.
- Guardrail evidence: 40 focused tests, targeted ESLint, independent frontend
  and database review, live template/policy readback, and a Kebba-principal
  database permission check.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Complete | Scope, verification, deployment, and closeout evidence are recorded. |
| Fault localization | Project Team source, layout guard, API guard, live User Management | Confirmed | Role membership was accepted by the layout but rejected by the API guard; Project Manager Commitments was None. |
| Focused regression suite | `npm.cmd --prefix frontend run test:unit -- --runTestsByPath ... --runInBand` | Pass | Reconciled latest-main candidate passed 3 suites and 40 tests, including inactive-person denial, cross-platform migration assertions, and every SOV policy. |
| Targeted lint | Frontend-local ESLint over seven task-owned TypeScript files | Pass | No findings. |
| TypeScript task-file scan | Incremental `tsc --noEmit` filtered to task-owned files | Pass | No task-owned diagnostics; the full repository check remains red on unrelated existing files. |
| Migration ledger | `db:migrations:verify-applied` for `20260730023000` and `20260730024500` | Pass | Both exact versions exist locally and remotely. |
| Live template readback | PM App `permission_templates` query | Pass | Company and project Project Manager templates both return `["read","write"]` for Commitments. |
| Live RLS readback | PM App `pg_policies` query | Pass | All 12 subcontract, purchase-order, and SOV CRUD policies use the module-permission helper; the four SOV policies retain the prime-contract membership branch. |
| Kebba principal proof | Authenticated-role transaction calling permission helpers for project 1144 | Pass | Kebba is active; Commitments read, write, and private visibility all returned true. |
| Independent frontend review | `/root/billing_review` | Approved | Review caught and verified fixes for the embedded-filter alias and both inactive-person access paths. |
| Independent database review | `/root/billing_db_review` | Approved | Review caught and verified module-level authorization for all commitment SOV policies. |
| Browser preflight | `npm run verify:browser -- --help` | Blocked | Auth setup lacks `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in this checkout; no false browser claim made. |
| All-user production access audit | Transactional production evaluation of `current_has_project_access` for every eligible auth-linked person/project pair | Pass | 2,826 of 2,826 pairs passed across 33 people and 91 projects; 0 helper failures and 0 active assigned people missing an auth link. |
| Project Manager production audit | Transactional production evaluation of access and Commitments read/write for every active Project Manager role pair | Pass | 10 of 10 assignments across 7 people passed project access, Commitments read, and Commitments write; both Project Manager templates are valid. |
| Live database state | Migration ledger and helper/policy readback | Pass | Employee fix `20260731010000`, Project Manager module fix `20260730023000`, and role-grant fix `20260731001500` are applied; billing periods and commitment inserts use the shared authorization helpers. |
| Production frontend deployment | Vercel deployment `dpl_F9vpvyvhKcQnpWP4UeCkVtzZw3NP` | Pass | Canonical GitHub-main commit `2efac2cca` is `READY` and owns `projects.alleatogroup.com`. |
| Andrew authenticated browser proof | `C:\Users\Brandon\.codex\visualizations\2026\07\30\019fb542-2d4e-7b62-ad9f-0f725506227f\andrew-billing-periods-live.png` | Pass | Andrew sees BP-001 as 1 row, sees 2 commitment rows, and can open the Subcontract form with 19 controls and no permission error. |
| Repository typecheck | `node scripts/run-typecheck-bounded.mjs` | Unrelated failure | Existing diagnostics across admin, AI, scheduling, CRM, recruiting, and other non-task files; no task-owned diagnostic in the focused scan. |
| Full migration-clean gate | `npm.cmd run db:migrations:verify-clean` | Unrelated failure | Existing remote-only migration history drift; exact task migration passes the applied-version gate. |

## Remaining Risk

- None for the requested Project Manager access paths. The temporary Andrew
  verification session was revoked after the live checks.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
  next action.
