# Task: Restore Backup Meetings Freshness

Status: Complete
Owner: Codex S20260730-MEETINGSENV
Created: 2026-07-30
Task ID: LOCAL-BACKUP-MEETINGS-SUPABASE-BINDING
Linear Issue: Not created; this is a single-session provider incident with no existing tracked issue.
Related Handoff: N/A; single-session work.

## Objective

Make `https://alleato-pm-backup.vercel.app/meetings` read the same current meeting data as the production Alleato PM deployment and prevent a future production build from silently targeting a stale Supabase project.

## Scope

- Own the backup Vercel project's main Supabase environment binding, production redeployment, runtime-config guardrail, focused regression test, and live meetings-route proof.
- Exclude Fireflies ingestion logic, meeting UI design, schema changes, RAG database ownership, and unrelated production/provider variables.

## Source of Truth

- Canonical runtime/data owner: Supabase project `lgveqfnpkxvzbnnwuled` and the production Alleato PM deployment at `projects.alleatogroup.com`.
- Existing shared primitives/services: `scripts/validate-runtime-config.mjs`, `frontend/package.json`, `frontend/src/app/(tables)/meetings/page.tsx`.
- Deprecated or parallel paths: Supabase project `lnnalnbmftuhiokyogsu` is not the canonical Alleato PM application data source.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The backup production deployment targets Supabase project `lgveqfnpkxvzbnnwuled` for its main application reads and authentication.
- [x] The live backup meetings route displays a meeting dated 2026-07-30, matching current canonical database freshness.
- [x] A production build fails loudly when the main Supabase URL or project-ref variables target another project.
- [x] The backup deployment is Ready and its exact production alias resolves to the corrected deployment.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No duplicate meetings query or page-local workaround is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Provider environment contract is read back after mutation.

Task-owned files:

- `scripts/validate-runtime-config.mjs`
- `scripts/verify/__tests__/validate-runtime-config.test.mjs`
- `frontend/package.json`
- `docs/ops/tasks/2026-07-30-backup-meetings-supabase-binding.md`

## Integration and Verification

- [x] Focused runtime-config regression tests pass.
- [x] The corrected Vercel environment variables are read back without exposing secret values.
- [x] Authenticated browser proof and screenshot show current meetings on the backup route.
- [x] Independent review passes.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: production build error naming every main Supabase variable whose project reference differs from the canonical Alleato PM project.
- Detection path: `node scripts/validate-runtime-config.mjs`, invoked by both the standard frontend `prebuild` lifecycle and the Vercel-owned `build:production` command.
- Recovery path: align the deployment's main Supabase URL, key, and project-ref variables, then rebuild and verify the live meetings date.

## Incident Learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: the backup Vercel project was configured against a stale, noncanonical Supabase project.
- Detection gap: production builds validated required variables but did not validate the identity of the Supabase project behind them.
- Prevention: fail production builds when the main Supabase URL or project-ref variables differ from the canonical project.
- Guardrail evidence: focused Node regression test plus a failed probe using the stale project reference.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before provider mutation. |
| Live route observation | `agent-browser --session meetings-debug open https://alleato-pm-backup.vercel.app/meetings` | Auth boundary observed | Unauthenticated browser redirected to `/auth/login?callbackUrl=%2Fmeetings`. |
| Database boundary | Service-role REST readback against both Supabase projects | Root cause confirmed | Backup project latest meeting: 2026-07-22. Canonical project latest meeting: 2026-07-30. |
| Deployment boundary | `npx vercel inspect https://alleato-pm-backup.vercel.app` and environment pull | Root cause confirmed | Backup is a separate personal Vercel project and its main Supabase URL targeted the stale project. |
| Provider mutation | Production-to-backup `vercel env run` sync for ten main Supabase/database variables | Pass | Values remained in provider-managed environment channels and were not printed. |
| Provider readback | Backup `vercel env run` safe host/ref projection plus `node scripts/validate-runtime-config.mjs --supabase-binding-only` | Pass | Both main Supabase URLs and project refs resolve to `lgveqfnpkxvzbnnwuled`; direct database connection identifies the same project; guardrail passed. |
| Focused regression | `node --test scripts/verify/__tests__/validate-runtime-config.test.mjs` | Pass | 8 tests passed: canonical binding, stale URL/ref failure, stale anon-key failure without secret leakage, canonical-ref override rejection, hidden BOM/whitespace rejection, unrelated production-debt isolation, local-build skip, and exact Vercel production-command ownership. |
| Independent review | Reviewer agent, initial review plus focused re-review | Pass | Initial key-binding gap was fixed; re-review passed. The remaining environment-override hardening note was also closed before publication. |
| Static syntax | `node --check scripts/validate-runtime-config.mjs` | Pass | Validator syntax is valid. |
| Authenticated runtime boundary | `agent-browser --session meetings-fixed open https://alleato-pm-backup.vercel.app/meetings` plus scoped Vercel runtime logs | Root cause confirmed | Auth succeeded, then the canonical query failed because a hidden U+FEFF byte preceded copied Supabase URL/key values. |
| Byte-clean provider repair | Production-to-backup Node UTF-8 stdin sync plus live binding-only validator | Pass | Ten main Supabase/database variables were rewritten without PowerShell BOM encoding; live validation passed. |
| Final production deployment | Vercel deployment `dpl_AuU71MuSD5ePDeWfL6YHbmKcwA7L`, commit `27304e09d8119af94d373245c252a9ffdb23849c` | Ready | The deployment owns the exact `alleato-pm-backup.vercel.app` production alias and passed the canonical Supabase build gate. |
| Authenticated browser proof | `agent-browser --session meetings-fixed open https://alleato-pm-backup.vercel.app/meetings` | Pass | The public alias returned the authenticated meetings table with multiple records dated Jul 30, 2026. |
| Screenshot | `C:\Users\KimiClaw\.codex\visualizations\2026\07\30\019fb3c0-3feb-7d22-aa05-04ffb6b7ff50\meetings-fixed-2026-07-30.png` | Pass | Current route proof shows six visible Jul 30, 2026 records. |
| Runtime readback | Vercel runtime logs scoped to `dpl_AuU71MuSD5ePDeWfL6YHbmKcwA7L` | Pass | Authenticated `GET /meetings` returned 200. A nonblocking RAG embedding-status auxiliary request still logs `Bad Request`; meeting freshness and rendering are unaffected. |

## Remaining Risk

- No known remaining risk to meeting freshness. The separate, nonblocking RAG embedding-status auxiliary query still logs `Bad Request`; it does not block the current meeting list, authentication, or data freshness and remains outside this provider-binding incident.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly deferred with ownership.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
