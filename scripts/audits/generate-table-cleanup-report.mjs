#!/usr/bin/env node

/**
 * Table Cleanup Candidate Report
 *
 * Reads the generated DB inventory and buckets every table into risk tiers for
 * decommissioning, using three independent signals already computed by
 * `npm run db:inventory`:
 *
 *   - code refs  = count of `.from("table")` reads/writes in app code
 *   - rows       = live Postgres row-count estimate
 *   - status     = hand-authored lifecycle in tables.yaml
 *
 * IMPORTANT: "code refs" is a literal `.from()` grep. A table with 0 refs can
 * still be reached via an RPC, a generic attachment helper that builds the table
 * name dynamically, backend Python, cron scripts, or FK cascades. 0-refs is the
 * CANDIDATE filter, never the verdict. Every drop must be confirmed per-table.
 *
 * Output: docs/architecture/TABLE-CLEANUP-CANDIDATES.md
 * Usage:  node scripts/audits/generate-table-cleanup-report.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..");

const inventoryPath = path.join(
  repoRoot,
  "frontend/src/components/dev-tools/db-inventory.generated.json",
);
const outPath = path.join(repoRoot, "docs/architecture/TABLE-CLEANUP-CANDIDATES.md");

const data = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const tables = data.tables;

const refs = (t) => t.references.writes.length + t.references.reads.length;
const rows = (t) => t.liveStats?.approxRows || 0;

// Attachment/link tables are frequently reached through a shared, dynamic helper
// that never shows up in a `.from()` grep — treat them as "needs judgment".
const isDynamicAttachment = (t) =>
  /_documents$/.test(t.name) || /_links$/.test(t.name);

const tierA = []; // dead/dormant, 0 refs, 0 rows, not a dynamic attachment table
const tierB = []; // 0 refs + 0 rows, needs judgment: live status OR attachment-name pattern
const tierC = []; // dormant/dead, 0 refs, but HAS rows — stale data, archive first
const keep = []; // has refs OR live with rows — not a candidate

for (const t of tables) {
  const r = refs(t);
  const n = rows(t);
  const empty = r === 0 && n === 0;
  if (empty && ["dead", "dormant"].includes(t.status) && !isDynamicAttachment(t)) {
    tierA.push(t);
  } else if (empty && (["live", "live-empty"].includes(t.status) || isDynamicAttachment(t))) {
    // Live-but-empty tables AND attachment-pattern tables (any status) need
    // per-table judgment before dropping — the attachment ones are frequently
    // reached through a dynamic helper that never appears in a `.from()` grep.
    // Without this branch, a dormant/dead attachment table would fall through to
    // `keep` and vanish from the report entirely.
    tierB.push(t);
  } else if (r === 0 && n > 0 && ["dormant", "dead"].includes(t.status)) {
    tierC.push(t);
  } else {
    keep.push(t);
  }
}

const fmtRow = (t) =>
  `| \`${t.name}\` | ${t.db} | ${t.domain} | ${t.status} | ${rows(t)} | ${refs(t)} | ${(t.purpose || "").replace(/\|/g, "\\|").slice(0, 90)} |`;

const byName = (a, b) => a.name.localeCompare(b.name);
const byRowsDesc = (a, b) => rows(b) - rows(a);

const generatedAt = data.generatedAt || "(see inventory)";

const md = `# Table Cleanup Candidates

> **AUTO-GENERATED** by \`scripts/audits/generate-table-cleanup-report.mjs\`.
> Source: \`frontend/src/components/dev-tools/db-inventory.generated.json\`
> (regenerate the underlying inventory with \`npm run db:inventory\`, then re-run this script).
> Inventory generated at: ${generatedAt}

This report ranks every table as a decommission candidate using three independent
signals: **code refs** (\`.from("table")\` reads/writes in app code), **rows** (live
row estimate), and **status** (lifecycle in \`tables.yaml\`).

## ⚠️ Read this before dropping anything

"Code refs" is a literal \`.from()\` grep of \`frontend\`, \`backend\`, and \`alleato-ai\`.
A table with **0 refs can still be in use** via:

- an RPC / Postgres function,
- a **generic attachment helper** that builds the table name dynamically (this is why
  \`*_documents\` / \`*_links\` tables show 0 refs but are live),
- a **view or materialized view** that reads the table (the grep does not parse view
  definitions — e.g. \`payment_transactions\` shows 0 code refs but is the \`FROM\` source
  of the live \`contract_financial_summary\` / \`_mv\` views),
- backend Python or one-off cron scripts,
- FK cascade targets.

So **0 refs is the candidate filter, not the verdict.** Confirm each table before dropping.

> **Before renaming or dropping any candidate, run
> \`node scripts/audits/scan-table-drop-dependencies.mjs\`** — it checks each table for view /
> materialized-view / FK / PostgREST-embed / dynamic-map / script dependencies that the
> code-ref count cannot see. A soft-drop rename is OID-safe (views/FKs follow the rename),
> but a name-resolved ref (embed, dynamic \`.from\`, raw-SQL script) breaks on rename, and
> \`DROP ... CASCADE\` silently drops dependent views.

### Recommended safe process

1. **This report** — review the tiers below.
2. **Soft-drop (reversible):** rename candidate → \`zz_deprecated_<name>\` (or move to a
   \`graveyard\` schema). Nothing is lost; rollback is an instant rename-back.
3. **Hard drop:** after a grace period with no errors/Sentry hits, a real \`DROP\` migration.
4. For **Tier C** (tables that still hold rows), archive the rows first (dump to storage
   or a \`*_archive\` table) before dropping.

## Summary

| Tier | Definition | Count |
|---|---|---:|
| **A — safest** | \`dead\`/\`dormant\`, 0 refs, 0 rows, not a dynamic attachment table | ${tierA.length} |
| **B — needs judgment** | 0 refs + 0 rows AND (\`live\`/\`live-empty\` status **or** an attachment-name pattern \`*_documents\`/\`*_links\`) | ${tierB.length} |
| **C — stale data** | \`dormant\`/\`dead\`, 0 refs, but **has rows** (archive before drop) | ${tierC.length} |
| Keep | has refs, or live with data — not a candidate | ${keep.length} |
| **Total tables** | | ${tables.length} |

---

## Tier A — safest to remove (${tierA.length})

Empty, no code references, already flagged \`dead\`/\`dormant\`. Nothing to lose.
Recommended: soft-drop the whole set in one reversible migration.

| Table | DB | Domain | Status | Rows | Refs | Purpose |
|---|---|---|---|---:|---:|---|
${tierA.sort(byName).map(fmtRow).join("\n")}

---

## Tier B — needs per-table judgment (${tierB.length})

0 \`.from()\` refs and 0 rows, but either marked \`live\`/\`live-empty\` **or** matching an
attachment-name pattern (\`*_documents\` / \`*_links\`) regardless of status. **Do not
bulk-drop.** The attachment/link tables are frequently reached through a shared dynamic
helper that never appears in a \`.from()\` grep, so they can be in active use despite 0
refs. Verify each before touching.

| Table | DB | Domain | Status | Rows | Refs | Purpose |
|---|---|---|---|---:|---:|---|
${tierB.sort(byName).map(fmtRow).join("\n")}

---

## Tier C — stale data, archive before dropping (${tierC.length})

No readers/writers in code, but the table still holds rows. Dropping loses data, so
archive first. Sorted by row count (most data at risk first).

| Table | DB | Domain | Status | Rows | Refs | Purpose |
|---|---|---|---|---:|---:|---|
${tierC.sort(byRowsDesc).map(fmtRow).join("\n")}
`;

fs.writeFileSync(outPath, md, "utf8");
console.log(`[table-cleanup] wrote ${path.relative(repoRoot, outPath)}`);
console.log(
  `[table-cleanup] Tier A=${tierA.length}  Tier B=${tierB.length}  Tier C=${tierC.length}  Keep=${keep.length}  Total=${tables.length}`,
);
