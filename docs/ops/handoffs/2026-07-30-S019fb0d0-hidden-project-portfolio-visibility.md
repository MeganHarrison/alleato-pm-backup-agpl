# Hidden project portfolio visibility handoff

## Scope and owner

- Session: `S019fb0d0`
- Owner: Megan Harrison
- Delivery lane: High-risk
- Workspace exception: current `origin/main` worktree, because the canonical checkout has diverged local/remote history plus unrelated active edits and cannot safely fast-forward or publish this task.
- Owned paths: `frontend/src/app/api/projects/route.ts`, `frontend/src/app/api/projects/__tests__/route.test.ts`, `frontend/src/lib/auth/owner.ts`, and the paired task/evidence files.

## Observed boundary

- `public.projects` retains the target records with `archived = false`; their existing links therefore remain intact.
- The canonical employee portfolio fetches `/api/projects?archived=false`.
- That route returns every active phase to its owner, so `phase = 'Hidden'` alone does not hide a record.
- AI tool guardrails derive project access independently from memberships/admin scope and do not filter by phase; a portfolio-only API rule preserves retained data access.

## Intended change

- Restrict `phase = 'Hidden'` in the portfolio API to Megan's owner identity only.
- Restore and set the approved eight project records to `Hidden`; leave the three explicit exclusions untouched.

## Verification status

- The production guard is Ready on Vercel from `a5ac6af1fc7bae67e5ba8e79be4cf551d6bba195`.
- Focused route contract passes: 24 tests prove that employees and Brandon exclude Hidden projects while Megan retains portfolio access.
- Targeted ESLint passes for the changed production route, owner access helper, and its test.
- The precise database update changed exactly eight records to `phase = 'Hidden'`, `archived = false`, `archived_at = null`, and `archived_by = null`; the three requested exclusions were read back unchanged. The eight projects retain 2,263 linked `document_metadata` records.
- Independent review is approved in `docs/ops/evidence/2026-07-30-hidden-project-portfolio-visibility/independent-review.md`.

## Deferred verification

- Status: `Blocked/Deferred` only for the mandatory authenticated screenshot.
- Cause: every current saved owner browser state redirects to `/auth/login`.
- Detection gap: production browser authentication is not durable across sessions.
- Prevention: refresh the saved owner browser state before the next protected-route release verification.
- Next action: sign into `https://projects.alleatogroup.com/` as Megan, capture the portfolio route showing the retained Hidden projects, and append the artifact to this task's verification result.
