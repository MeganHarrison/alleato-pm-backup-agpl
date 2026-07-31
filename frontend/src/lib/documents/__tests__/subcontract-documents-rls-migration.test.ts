import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20260729235959_fix_subcontract_documents_rls.sql",
);

describe("subcontract document RLS migration", () => {
  it("authorizes every subcontract_documents operation through the supported commitment access path", () => {
    const sql = readFileSync(migrationPath, "utf8")
      .replace(/\r\n/g, "\n")
      .toLowerCase();
    const commitmentAccess =
      String.raw`public\.user_can_access_entity\(\s*'commitment',\s*subcontract_id::text\s*\)`;

    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(
        `drop policy if exists "subcontract_documents_${operation}"`,
      );
      expect(sql).toContain(
        `create policy "subcontract_documents_${operation}"`,
      );
    }

    expect(sql).toMatch(
      new RegExp(
        String.raw`create policy "subcontract_documents_select"[\s\S]*?for select\s+to authenticated\s+using\s*\(\s*${commitmentAccess}\s*\)\s*;`,
      ),
    );
    expect(sql).toMatch(
      new RegExp(
        String.raw`create policy "subcontract_documents_insert"[\s\S]*?for insert\s+to authenticated\s+with check\s*\(\s*${commitmentAccess}\s*\)\s*;`,
      ),
    );
    expect(sql).toMatch(
      new RegExp(
        String.raw`create policy "subcontract_documents_update"[\s\S]*?for update\s+to authenticated\s+using\s*\(\s*${commitmentAccess}\s*\)\s+with check\s*\(\s*${commitmentAccess}\s*\)\s*;`,
      ),
    );
    expect(sql).toMatch(
      new RegExp(
        String.raw`create policy "subcontract_documents_delete"[\s\S]*?for delete\s+to authenticated\s+using\s*\(\s*${commitmentAccess}\s*\)\s*;`,
      ),
    );
    expect(sql).not.toContain("user_can_access_entity('subcontract'");
  });
});
