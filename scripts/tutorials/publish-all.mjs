// Publish every captured tutorial into the in-app knowledge system (training_docs
// + steps + screenshot assets uploaded to storage). Writes to the PM APP DB, so
// docs go live on the app's /knowledge/app pages. Run from repo root.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const PM = "/Users/meganharrison/Documents/alleato-pm";
const TUT = join(PM, "docs/tutorials");

// module -> default app training category (must match app-help-content titles)
const CATEGORY = { commitments: "Commitments", budget: "Budget", rfis: "RFIs and Submittals" };
// per-slug overrides (change-management splits across categories)
const SLUG_CATEGORY = {
  "change-create-event": "Change Events",
  "change-create-commitment-pco": "Change Orders",
  "change-create-prime-pco": "Change Orders",
  "change-convert-pco": "Change Orders",
};

function manifests() {
  const out = [];
  for (const m of readdirSync(TUT, { withFileTypes: true })) {
    if (!m.isDirectory()) continue;
    for (const s of readdirSync(join(TUT, m.name), { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const mf = join(TUT, m.name, s.name, "manifest.json");
      if (existsSync(mf)) out.push(mf);
    }
  }
  return out;
}

const published = [];
for (const mf of manifests()) {
  const manifest = JSON.parse(readFileSync(mf, "utf8"));
  if (!manifest.steps?.length || manifest.steps.length < 2) { console.log(`skip (too few steps): ${manifest.slug}`); continue; }
  const category = SLUG_CATEGORY[manifest.slug] || CATEGORY[manifest.module] || "Commitments";
  const sourceRoute = manifest.steps[0]?.sourceUrl?.replace(/^https?:\/\/[^/]+/, "") || "/1034";
  const catSlug = category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  try {
    execFileSync("npx", [
      "tsx", "scripts/tutorials/publish-tutorial.ts", mf,
      "--app-tool-category", category,
      "--source-route", sourceRoute,
      "--title", manifest.title,
    ], { cwd: PM, stdio: ["ignore", "pipe", "pipe"] });
    const url = `/knowledge/app/${catSlug}/${manifest.slug}`;
    published.push({ slug: manifest.slug, category, url });
    console.log(`  ✓ ${manifest.slug}  → ${url}`);
  } catch (e) {
    console.log(`  ✗ ${manifest.slug}: ${String(e.stderr || e.message).slice(0, 160)}`);
  }
}
console.log(`\nPublished ${published.length} tutorials to the knowledge app.`);
console.log("Live (prod app):");
for (const p of published) console.log(`  https://projects.alleatogroup.com${p.url}`);
