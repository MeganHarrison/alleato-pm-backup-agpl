import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20260731200000_create_plane_workspace_items.sql",
);

describe("Plane workspace items migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");

  it("creates one user/workspace/entity record with deterministic indexes", () => {
    expect(sql).toContain(
      "create table if not exists public.user_workspace_items",
    );
    expect(sql).toContain("user_id uuid not null references auth.users(id)");
    expect(sql).toContain("project_id bigint references public.projects(id)");
    expect(sql).toContain("constraint user_workspace_items_unique_entity");
    expect(sql).toContain("user_workspace_items_favorites_order_idx");
    expect(sql).toContain("user_workspace_items_recents_order_idx");
    expect(sql).toContain("created_at desc,\n    id asc");
    expect(sql).toContain("last_accessed_at desc,\n    id asc");
    expect(sql).toContain("position(E'\\\\' in href) = 0");
    expect(sql).toContain("href !~ '[[:cntrl:]]'");
  });

  it("prevents ownership and entity-scope reassignment", () => {
    expect(sql).toContain("guard_user_workspace_item_scope");
    for (const column of [
      "user_id",
      "workspace_key",
      "project_id",
      "item_kind",
      "entity_type",
      "entity_identifier",
    ]) {
      expect(sql).toContain(`new.${column} is distinct from old.${column}`);
    }
  });

  it("enables forced RLS and grants no anon table access", () => {
    expect(sql).toContain(
      "alter table public.user_workspace_items enable row level security",
    );
    expect(sql).toContain(
      "alter table public.user_workspace_items force row level security",
    );
    expect(sql).toContain(
      "revoke all on table public.user_workspace_items from anon",
    );
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain(
      "public.current_has_plane_workspace_entity_access(\n      project_id,\n      entity_type",
    );
    expect(sql).toContain("public.current_has_project_access(p_project_id)");
    expect(sql).toContain(
      "public.current_has_project_module_permission(\n      p_project_id,\n      v_module,\n      'read'",
    );
    expect(sql).toContain("when 'prime_contract' then 'contracts'");
    expect(sql).toContain("security definer\nset search_path = ''");
  });

  it("pins copied code to AGPL attribution", () => {
    expect(sql).toContain(
      "Copyright (c) 2023-present Plane Software, Inc. and contributors",
    );
    expect(sql).toContain("SPDX-License-Identifier: AGPL-3.0-only");
  });
});
