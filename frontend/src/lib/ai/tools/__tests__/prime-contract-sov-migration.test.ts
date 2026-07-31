import { readFileSync } from "fs";
import { join } from "path";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260722173000_atomic_ai_prime_contract_sov_edits.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("Prime Contract SOV database authorization contract", () => {
  it("trusts only an active service-linked identity and keeps project access governed", () => {
    expect(migrationSql).toContain("and p.status = 'active'");
    expect(migrationSql).toContain(
      "join public.users_auth ua on ua.auth_user_id = up.id",
    );
    expect(migrationSql).toContain("select public.current_is_app_admin()");
    expect(migrationSql).toContain(
      "grant select on table public.users_auth to authenticated",
    );
    expect(migrationSql).not.toContain(
      "create policy users_auth_insert_verified_self",
    );
  });

  it("allows governed directory writes without template privilege escalation", () => {
    expect(migrationSql).toContain(
      "create policy project_directory_memberships_insert",
    );
    expect(migrationSql).toContain(
      "create policy project_directory_memberships_update",
    );
    expect(migrationSql).toContain(
      "create policy project_directory_memberships_delete",
    );
    expect(migrationSql).toContain(
      "current_can_assign_project_permission_template",
    );
    expect(migrationSql).toContain("target_company_template.person_id = person_id");
    expect(migrationSql).toContain("project_id, 'directory', 'write'");
    expect(migrationSql).toContain(
      "project_membership_identity_reassignment_guard",
    );
    expect(migrationSql).toContain(
      "PROJECT_MEMBERSHIP_IDENTITY_OR_TEMPLATE_INVALID",
    );
    expect(migrationSql).toContain("create policy people_update_governed");
    expect(migrationSql).toContain(
      "revoke all on table public.people from anon, authenticated",
    );
    expect(migrationSql).toContain("people_identity_update_guard");
    expect(migrationSql).toContain(
      "PEOPLE_IDENTITY_FIELDS_REQUIRE_APP_ADMIN",
    );
    expect(migrationSql).toContain(
      "create policy user_module_permissions_write",
    );
    expect(migrationSql).toContain(
      "create policy user_granular_permission_overrides_write",
    );
    expect(migrationSql).toContain(
      "grant select, insert, update, delete\non table public.project_directory_memberships to authenticated",
    );
    expect(migrationSql).toContain(
      "revoke all on table public.project_directory_memberships\nfrom anon, authenticated",
    );
  });

  it("keeps the atomic write and audit ledger on service-only boundaries", () => {
    expect(migrationSql).toContain(
      "create or replace function public.ai_edit_draft_prime_contract_sov",
    );
    expect(migrationSql).toContain("message = 'AI_SOV_USER_UNAVAILABLE'");
    expect(migrationSql).toContain(
      "revoke all on function public.ai_edit_draft_prime_contract_sov",
    );
    expect(migrationSql).toContain(
      "to service_role",
    );
    expect(migrationSql).toContain(
      "revoke all on table public.ai_tool_write_audits from anon, authenticated",
    );
    expect(migrationSql).toContain("contract_line_items_parent_write_lock");
    expect(migrationSql).toContain(
      "prime_contract_financial_history_delete_guard",
    );
    expect(migrationSql).toContain(
      "prime_contract_payment_app_parent_lock",
    );
    expect(migrationSql).toContain("prime_contract_payment_parent_lock");
  });
});
