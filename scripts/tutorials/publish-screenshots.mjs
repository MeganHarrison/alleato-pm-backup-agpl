// Wire captured per-step screenshots into the help/training-docs MDX.
// For each tutorial manifest, copy its step screenshots into the docs-site
// images folder and insert each after the matching "## N." step (replacing the
// earlier per-screen shots). manifest.steps[i] -> the i-th "## N." step.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const PM = "/Users/meganharrison/Documents/alleato-pm";
const TUT = join(PM, "docs/tutorials");
const DOCS = "/Users/meganharrison/Documents/github/alleato-os/apps/docs";
const TD = join(DOCS, "help/training-docs");

// find all manifest.json under docs/tutorials/<module>/<slug>/
function findManifests(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const moduleDir = join(dir, e.name);
    for (const s of readdirSync(moduleDir, { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const mf = join(moduleDir, s.name, "manifest.json");
      if (existsSync(mf)) out.push({ manifestPath: mf, dir: join(moduleDir, s.name) });
    }
  }
  return out;
}

let updated = 0, skipped = 0;
for (const { manifestPath, dir } of findManifests(TUT)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const slug = manifest.slug;
  const mdxPath = join(TD, `${slug}.mdx`);
  if (!existsSync(mdxPath)) { skipped++; continue; }

  // copy screenshots into the docs-site images folder
  const imgRel = `images/help/training-docs/${slug}`;
  mkdirSync(join(DOCS, imgRel), { recursive: true });
  const stepImgs = manifest.steps.map((step) => {
    const file = basename(step.screenshot);
    copyFileSync(join(dir, step.screenshot), join(DOCS, imgRel, file));
    return { file, title: step.title };
  });

  // rewrite the MDX: drop old image lines, insert per-step shots after each step
  let lines = readFileSync(mdxPath, "utf8").split("\n");
  lines = lines.filter((l) => !/^!\[.*\]\(\/images\/help\/training-docs\//.test(l.trim()));

  // locate the "## N." step headings in order
  const stepIdx = [];
  lines.forEach((l, i) => { if (/^## \d+\. /.test(l)) stepIdx.push(i); });

  // build insertions: step k -> after that step's "Expected result:" line
  const inserts = [];
  for (let k = 0; k < stepIdx.length && k < stepImgs.length; k++) {
    const start = stepIdx[k];
    const end = k + 1 < stepIdx.length ? stepIdx[k + 1] : lines.length;
    let er = -1;
    for (let i = start; i < end; i++) if (lines[i].startsWith("Expected result:")) er = i;
    const at = er !== -1 ? er + 1 : end;
    const img = stepImgs[k];
    inserts.push({ at, block: `\n![${img.title}](/${imgRel}/${img.file})\n` });
  }
  inserts.sort((a, b) => b.at - a.at);
  for (const ins of inserts) lines.splice(ins.at, 0, ins.block);
  writeFileSync(mdxPath, lines.join("\n"));
  console.log(`  ${slug}: ${inserts.length} step screenshots`);
  updated++;
}
console.log(`\nDone: ${updated} docs updated, ${skipped} manifests had no matching MDX.`);
