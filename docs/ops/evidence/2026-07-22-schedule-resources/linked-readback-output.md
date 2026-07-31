# Linked Supabase Readback Output

Date: 2026-07-22
Command: `npx.cmd --yes supabase@latest db query --linked --file docs/ops/evidence/2026-07-22-schedule-resources/readback.sql`
Exit code: `0`

The command returned this consolidated JSON row from the linked database:

```json
{
  "constraint_count": 22,
  "functions": [
    {
      "name": "create_schedule_revision_snapshot",
      "owner": "postgres",
      "security_definer": true,
      "config": ["search_path=\"\""],
      "anon_execute": false,
      "authenticated_execute": true,
      "service_role_execute": false
    },
    {
      "name": "replace_schedule_task_assignments",
      "owner": "postgres",
      "security_definer": true,
      "config": ["search_path=\"\""],
      "anon_execute": false,
      "authenticated_execute": true,
      "service_role_execute": false
    }
  ],
  "immutable_triggers": [
    {
      "table": "schedule_revision_assignment_snapshots",
      "trigger": "schedule_revision_assignment_snapshots_immutable",
      "definition": "CREATE TRIGGER schedule_revision_assignment_snapshots_immutable BEFORE DELETE OR UPDATE ON public.schedule_revision_assignment_snapshots FOR EACH ROW EXECUTE FUNCTION reject_schedule_snapshot_mutation()"
    },
    {
      "table": "schedule_revision_assignment_snapshots",
      "trigger": "schedule_revision_assignment_snapshots_no_truncate",
      "definition": "CREATE TRIGGER schedule_revision_assignment_snapshots_no_truncate BEFORE TRUNCATE ON public.schedule_revision_assignment_snapshots FOR EACH STATEMENT EXECUTE FUNCTION reject_schedule_snapshot_mutation()"
    },
    {
      "table": "schedule_revision_resource_snapshots",
      "trigger": "schedule_revision_resource_snapshots_immutable",
      "definition": "CREATE TRIGGER schedule_revision_resource_snapshots_immutable BEFORE DELETE OR UPDATE ON public.schedule_revision_resource_snapshots FOR EACH ROW EXECUTE FUNCTION reject_schedule_snapshot_mutation()"
    },
    {
      "table": "schedule_revision_resource_snapshots",
      "trigger": "schedule_revision_resource_snapshots_no_truncate",
      "definition": "CREATE TRIGGER schedule_revision_resource_snapshots_no_truncate BEFORE TRUNCATE ON public.schedule_revision_resource_snapshots FOR EACH STATEMENT EXECUTE FUNCTION reject_schedule_snapshot_mutation()"
    }
  ],
  "indexes": [
    "schedule_resources_created_by_idx",
    "schedule_resources_id_project_unique",
    "schedule_resources_person_idx",
    "schedule_resources_pkey",
    "schedule_resources_project_idx",
    "schedule_resources_project_person_unique",
    "schedule_task_assignments_created_by_idx",
    "schedule_task_assignments_pkey",
    "schedule_task_assignments_project_resource_idx",
    "schedule_task_assignments_project_task_idx",
    "schedule_task_assignments_resource_project_idx",
    "schedule_task_assignments_task_resource_unique",
    "schedule_task_assignments_updated_by_idx"
  ],
  "policies": [
    {
      "table": "schedule_resources",
      "policy": "schedule_resources_project_member_read",
      "roles": ["authenticated"],
      "command": "SELECT",
      "using": "(current_is_app_admin() OR current_is_project_member((project_id)::bigint))",
      "check": null
    },
    {
      "table": "schedule_revision_assignment_snapshots",
      "policy": "schedule_revision_assignment_snapshots_project_member_read",
      "roles": ["authenticated"],
      "command": "SELECT",
      "using": "EXISTS: revision id matches and current user is an app admin or project member",
      "check": null
    },
    {
      "table": "schedule_revision_resource_snapshots",
      "policy": "schedule_revision_resource_snapshots_project_member_read",
      "roles": ["authenticated"],
      "command": "SELECT",
      "using": "EXISTS: revision id matches and current user is an app admin or project member",
      "check": null
    },
    {
      "table": "schedule_task_assignments",
      "policy": "schedule_task_assignments_project_member_read",
      "roles": ["authenticated"],
      "command": "SELECT",
      "using": "(current_is_app_admin() OR current_is_project_member((project_id)::bigint))",
      "check": null
    }
  ],
  "privileges": {
    "authenticated_live_select": true,
    "authenticated_live_write": false,
    "authenticated_snapshot_select": true,
    "service_live_write": true,
    "service_snapshot_write": false
  },
  "tables": [
    {"table": "schedule_resources", "rls": true},
    {"table": "schedule_revision_assignment_snapshots", "rls": true},
    {"table": "schedule_revision_resource_snapshots", "rls": true},
    {"table": "schedule_task_assignments", "rls": true}
  ]
}
```

The unabridged function, constraint, index, policy, grant, trigger, and recent-revision queries remain in `readback.sql`; the JSON above preserves the release-significant linked result without CLI trust-boundary metadata.
