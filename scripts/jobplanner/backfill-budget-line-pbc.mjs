#!/usr/bin/env node

/**
 * BACKFILL budget_lines.project_budget_code_id (the empty bridge).
 *
 * WHY: change-event / direct-cost EDIT FORMS resolve a saved budget_line_id back to a
 * dropdown option through budget_lines.project_budget_code_id. That column is unpopulated
 * on JP-imported projects, so standalone (non-commitment) lines show "Select budget code..."
 * in the form even when the underlying budget_line_id is correct.
 *
 * The natural key (cost_code_id, cost_type_id [, sub_job]) is shared by budget_lines and
 * project_budget_codes and is UNIQUE per project. For each budget_line whose bridge is null:
 *   - exactly one ACTIVE project_budget_codes match  -> link it.
 *   - no project_budget_codes at all                 -> create one (same shape the change-
 *     request importer's resolveBudgetCode uses: sub_job_id null, description_mode
 *     'concatenated', upsert on uq_project_budget_code) then link it.
 *   - more than one active match                      -> SKIP + report (never guess).
 *
 * Verified before writing (project 25125): 0 ambiguous matches, and this key-match
 * reproduces every already-populated bridge value exactly.
 *
 * DRY-RUN by default. --apply executes inside a transaction. Idempotent.
 *
 * Usage:
 *   node scripts/jobplanner/backfill-budget-line-pbc.mjs --app=25125
 *   node scripts/jobplanner/backfill-budget-line-pbc.mjs --app=25125 --apply
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const { Client } = frontendRequire("pg");

const APPLY = process.argv.includes("--apply");
const argValue = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const APP_PROJECT_ID = argValue("app", null);
if (!APP_PROJECT_ID) { console.error("Required: --app=<appProjectId>"); process.exit(1); }

function databaseUrl() {
  for (const p of [".env", ".env.local", "frontend/.env.local"]) {
    try {
      const m = fs.readFileSync(path.join(repoRoot, p), "utf8").match(/^DATABASE_URL=(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "").replace(/[?&]sslmode=[^&]*/, "");
    } catch { /* ignore missing file */ }
  }
  throw new Error("DATABASE_URL not found in .env / .env.local / frontend/.env.local");
}

async function main() {
  const c = new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  await c.connect();

  // budget_lines whose bridge is null, with their exactly-one active pbc match (if any).
  // pbc.description convention (verified live) = the cost code's canonical title
  // (cost_codes.title), NOT the budget_line "<name> - <type>" label.
  const { rows } = await c.query(
    `select bl.id, bl.cost_code_id, bl.cost_type_id, bl.sub_job_id,
            coalesce(cc.title, bl.description) as pbc_description,
            act.pbc_id, act.n_active
     from budget_lines bl
     left join cost_codes cc on cc.id = bl.cost_code_id
     left join lateral (
       select min(p.id::text) pbc_id, count(*) n_active
       from project_budget_codes p
       where p.project_id = $1 and p.cost_code_id = bl.cost_code_id
         and p.cost_type_id = bl.cost_type_id and p.is_active = true
         and (p.sub_job_id is not distinct from bl.sub_job_id)
     ) act on true
     where bl.project_id = $1 and bl.project_budget_code_id is null`,
    [APP_PROJECT_ID],
  );

  const toLink = rows.filter((r) => Number(r.n_active) === 1);
  const toCreate = rows.filter((r) => Number(r.n_active) === 0);
  const ambiguous = rows.filter((r) => Number(r.n_active) > 1);

  console.log(`\n=== budget_lines.project_budget_code_id backfill  app ${APP_PROJECT_ID}  (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`null bridges: ${rows.length}  |  link-existing: ${toLink.length}  |  create-pbc+link: ${toCreate.length}  |  ambiguous(skip): ${ambiguous.length}`);
  if (ambiguous.length) {
    console.log("\n-- ambiguous (skipped, >1 active pbc) --");
    console.table(ambiguous.map((r) => ({ cc: r.cost_code_id, ct: r.cost_type_id, n: r.n_active })));
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes. --apply would link ${toLink.length} + create ${toCreate.length} budget codes then link them.`);
    await c.end();
    return;
  }

  await c.query("BEGIN");
  try {
    let linked = 0, created = 0;
    for (const r of toLink) {
      await c.query(`update budget_lines set project_budget_code_id = $1 where id = $2`, [r.pbc_id, r.id]);
      linked++;
    }
    for (const r of toCreate) {
      // create the pbc (idempotent on uq_project_budget_code), then link
      const ins = await c.query(
        `insert into project_budget_codes (project_id, sub_job_id, cost_code_id, cost_type_id, description, description_mode)
         values ($1, $2, $3, $4, $5, 'concatenated')
         on conflict (project_id, sub_job_key, cost_code_id, cost_type_id)
         do update set is_active = true
         returning id`,
        [APP_PROJECT_ID, r.sub_job_id, r.cost_code_id, r.cost_type_id, r.pbc_description],
      );
      const pbcId = ins.rows[0].id;
      await c.query(`update budget_lines set project_budget_code_id = $1 where id = $2`, [pbcId, r.id]);
      created++;
    }
    await c.query("COMMIT");
    console.log(`\nAPPLIED: linked-existing=${linked}, created+linked=${created}, total bridges filled=${linked + created}.`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
