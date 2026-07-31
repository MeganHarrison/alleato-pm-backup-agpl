# Linked Supabase Mutation Probe Output

Date: 2026-07-22
Command: `npx.cmd --yes supabase@latest db query --linked --file docs/ops/evidence/2026-07-22-schedule-resources/mutation-probes.sql`
Exit code: `0`

The rollback-only probe script returned this final row after every fail-loud assertion completed:

```json
{
  "assignment_snapshot_truncate": "rejected",
  "assignment_snapshot_update": "rejected",
  "authenticated_direct_dml": "rejected",
  "cross_project_task": "rejected",
  "inactive_membership": "rejected",
  "inactive_person": "rejected",
  "non_manager_rpc": "rejected",
  "resource_snapshot_update": "rejected",
  "transactional_cleanup": "rolled_back"
}
```

Each scenario raises an exception if the prohibited action unexpectedly succeeds. The owner-level snapshot probes insert temporary rows, exercise the actual immutable triggers for update and truncate, and roll the transaction back. The identity and eligibility probes create temporary active/inactive people and memberships and also roll back.
