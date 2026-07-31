# Project Role Membership Synchronization Handoff

Status: Blocked/Deferred — live database fix awaits authenticated visual proof.
Owner: Codex
Task: `project-role-membership-sync`
Delivery lane: High-risk

## Observed Boundary

The Project Directory role editor writes `project_role_members`; User Management and RLS read active `project_directory_memberships`. The two writes were not synchronized.

Live readback initially found 37 role assignments without active directory memberships across 9 projects. The reported authenticated employee had two such assignments. The post-repair invariant is 33 authenticated internal role assignments and zero missing active directory memberships.

## Planned Ownership

- `supabase/migrations/20260730224500_sync_project_role_memberships.sql`
  - database trigger for future role assignments
  - idempotent historical repair
  - initial role-to-membership repair
  - external contacts excluded from automatic product access
- `supabase/migrations/20260731003000_harden_project_role_membership_sync.sql`
  - exact template matching plus two explicit Project Manager aliases
  - delayed-auth-link reconciliation from `people` and `users_auth`
  - auto-managed template ownership that preserves intentional manual changes
  - fail-loud Read Only fallback preflight
- `supabase/migrations/20260731003500_fix_project_role_auth_link_trigger_dispatch.sql`
  - repairs the delayed-auth-link trigger dispatch discovered by a rollbacked live test
- `supabase/migrations/20260731004000_reconcile_legacy_project_role_memberships.sql`
  - introduces auto-managed lifecycle reconciliation for newly role-driven access
- `supabase/migrations/20260731004500_preserve_legacy_role_membership_templates.sql`
  - removes timestamp-based provenance inference from the first repair
  - preserves historical repaired memberships as explicit administrator-controlled access
- `supabase/migrations/20260731005000_complete_project_role_membership_lifecycle.sql`
  - deactivates only marker-owned access when the last same-project role is removed
  - handles project-role member moves before creating the new project's access
  - resets the local synchronization flag before a later same-transaction administrator template override

## Verification Required

- [x] Migration ledger confirms versions `20260730224500` through `20260731005000` are applied.
- [x] Database readback finds zero missing active memberships for authenticated internal role assignees.
- [x] Rollbacked live tests prove create/reactivate/deactivate, last-role removal, role moves, explicit template preservation, and roster-only contacts.
- [ ] Authenticated User Management and Project Directory screenshots show the repaired state (blocked; see constraint below).
- [x] Independent review passed: no critical/high correctness or security issue remains.

## Known Constraint

Supabase CLI type generation is unavailable to the current credential (`LegacyGenTypesUnexpectedStatusError`); this migration changes functions/triggers only and relies on the checked-in generated table types plus live schema readback.

## Visual Verification Blocker

The configured production identity could not reach either required proof route: `/user-management` redirected to `access-denied?reason=admin-dashboard-allowlist` and `/1144/directory` redirected to `access-denied?reason=no-project-access`. A scoped temporary membership used only to diagnose the latter was removed immediately. This feature does not alter unrelated route allowlists or elevated test-account permissions.

- Cause: the available production visual-test identity is blocked by existing route-level authorization.
- Detection gap: no designated test identity currently has both User Management and the reported-project access needed for visual acceptance.
- Prevention: maintain a designated, production-safe visual-test identity for protected admin and project routes.
- Next owner action: authenticate with an identity already permitted by both gates and capture final desktop route screenshots after publication.

## Independent Review and Residual Policy Note

The final focused migration-chain review passed. The only non-blocking note is that, if several roles remain on the same project after one is removed, the current deterministic selection is the oldest remaining assignment. Product policy can later replace that with explicit privilege precedence if needed.

The standard migration verifier remains blocked by unrelated duplicate local migration version `20260729190000` (`20260729190000_authoritative_schedule_cascade_mutation.sql` and `20260729190000_relax_training_growth_evidence.sql`). Direct remote-ledger verification confirmed all six task migrations are applied.
