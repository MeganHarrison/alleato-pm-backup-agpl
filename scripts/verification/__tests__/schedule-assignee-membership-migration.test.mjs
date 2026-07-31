import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migration = path.join(
  repoRoot,
  "supabase/migrations/20260722132000_require_active_schedule_assignee_membership.sql",
);

test("schedule assignment rejects a person without active membership in the task project", () => {
  assert.equal(existsSync(migration), true, "the schedule-assignment membership migration must exist");
  const sql = readFileSync(migration, "utf8");
  assert.match(sql, /before insert or update of project_id, assignee_person_id on public\.schedule_tasks/i);
  assert.match(sql, /from public\.project_directory_memberships/i);
  assert.match(sql, /pdm\.project_id = new\.project_id/i);
  assert.match(sql, /pdm\.person_id = new\.assignee_person_id/i);
  assert.match(sql, /pdm\.status = 'active'/i);
  assert.match(sql, /SCHEDULE_ASSIGNEE_NOT_ACTIVE_PROJECT_MEMBER/i);
});
