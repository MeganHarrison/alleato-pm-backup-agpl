// Build a self-contained, offline HTML viewer of ALL app documentation, sourced
// entirely from the training_docs DB (stable source of truth — disk tutorial
// folders are a moving target while captures run).
//   - Docs with steps render as illustrated walkthroughs; screenshots + walkthrough
//     videos are downloaded from Supabase storage into ./assets so it works offline.
//   - All other docs render from body_markdown.
// One index.html, grouped by tool category. Openable via file:// — no server.
// Run: node scripts/tutorials/build-viewer.mjs
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const ROOT = "/Users/meganharrison/Documents/alleato-pm";
const OUT = join(ROOT, "docs/tutorials-viewer");
const require = createRequire(join(ROOT, "x.js"));
const { createClient } = require(join(ROOT, "frontend/node_modules/@supabase/supabase-js"));
const { marked } = await import(join(ROOT, "frontend/node_modules/marked/lib/marked.esm.js"));

const CATEGORY_ORDER = [
  "Projects", "Budget", "Prime Contracts", "Commitments", "Change Events", "Change Orders",
  "Schedule", "Meetings", "RFIs and Submittals", "Documents and Drawings", "Directory and People",
  "AI Assistant", "Estimates", "Direct Costs", "Invoicing", "Field Operations", "Integrations",
  "Settings and Permissions", "Subcontractors", "Training Docs", "Other",
];

function env() {
  const e = {};
  for (const f of [".env", ".env.local", "frontend/.env.local"]) {
    try {
      for (const line of readFileSync(join(ROOT, f), "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !e[m[1]]) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
  return e;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slugId = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const ext = (p, fallback) => { const m = /\.([a-z0-9]+)$/i.exec(p || ""); return m ? m[1].toLowerCase() : fallback; };

const e = env();
const svc = createClient(
  e.NEXT_PUBLIC_SUPABASE_URL || e.SUPABASE_URL,
  e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const { data: rows, error } = await svc
  .from("training_docs")
  .select("slug,title,summary,body_markdown,status,metadata,training_doc_steps(step_order,title,instruction_markdown,expected_result,screenshot_asset_id),training_doc_assets(id,asset_type,storage_bucket,storage_path,step_order)")
  .order("title", { ascending: true });
if (error) { console.error(error.message); process.exit(1); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });

async function download(bucket, path, destAbs) {
  const { data, error } = await svc.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return false;
  const res = await fetch(data.signedUrl);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destAbs, buf);
  return true;
}

function renderMarkdown(title, body) {
  const cleaned = body
    .replace(/^\s*#\s+.*\r?\n/, (m) => (m.toLowerCase().includes(title.toLowerCase().slice(0, 12)) ? "" : m))
    .replace(/^\s*\[Watch the recorded workflow\][^\n]*\n/gim, "")
    .replace(/^##\s+Walkthrough Video\s*\n/gim, "");
  return `<div class="prose">${marked.parse(cleaned)}</div>`;
}

const byCat = new Map();
let illustrated = 0, articles = 0, skipped = 0, imgCount = 0, vidCount = 0;

for (const row of rows) {
  const steps = (row.training_doc_steps ?? []).slice().sort((a, b) => a.step_order - b.step_order);
  const assetsById = new Map((row.training_doc_assets ?? []).map((a) => [a.id, a]));
  const hasSteps = steps.length > 0;
  const hasBody = (row.body_markdown ?? "").trim().length > 0;
  if (!hasSteps && !hasBody) { skipped++; continue; }

  const cat = (typeof row.metadata?.appToolCategory === "string" && row.metadata.appToolCategory.trim()) || "Other";
  const catKey = CATEGORY_ORDER.includes(cat) ? cat : "Other";
  const id = slugId(row.slug);
  const draft = row.status !== "published";

  const assetDir = join(OUT, "assets", row.slug);
  let madeDir = false;
  const ensureDir = () => { if (!madeDir) { mkdirSync(assetDir, { recursive: true }); madeDir = true; } };

  const parts = [
    `<article id="${id}" class="doc">`,
    `<div class="doc-meta"><span class="doc-cat">${esc(catKey)}</span>`,
    hasSteps ? `<span class="tag tag-tut">Illustrated</span>` : "",
    draft ? `<span class="tag tag-draft">Draft in app</span>` : `<span class="tag tag-live">Live</span>`,
    `</div>`,
    `<h1>${esc(row.title)}</h1>`,
    row.summary ? `<p class="lead">${esc(row.summary)}</p>` : "",
  ];

  if (hasSteps) {
    illustrated++;
    // Walkthrough video (step_order 0 / asset_type video)
    const vid = (row.training_doc_assets ?? []).find((a) => a.asset_type === "video");
    if (vid) {
      ensureDir();
      const name = `walkthrough.${ext(vid.storage_path, "webm")}`;
      if (await download(vid.storage_bucket, vid.storage_path, join(assetDir, name))) {
        parts.push(`<video class="walkthrough" controls preload="metadata" src="assets/${row.slug}/${name}"></video>`);
        vidCount++;
      }
    }
    let n = 0;
    for (const step of steps) {
      n++;
      parts.push(`<section class="step"><h2><span class="num">${n}</span>${esc(step.title || `Step ${n}`)}</h2>`);
      const asset = step.screenshot_asset_id ? assetsById.get(step.screenshot_asset_id) : null;
      if (asset) {
        ensureDir();
        const name = `step-${String(n).padStart(2, "0")}.${ext(asset.storage_path, "png")}`;
        if (await download(asset.storage_bucket, asset.storage_path, join(assetDir, name))) {
          parts.push(`<img loading="lazy" src="assets/${row.slug}/${name}" alt="${esc(step.title || "")}">`);
          imgCount++;
        }
      }
      if (step.instruction_markdown) parts.push(`<div class="prose">${marked.parse(step.instruction_markdown)}</div>`);
      if (step.expected_result) parts.push(`<p class="expected"><span>Expected</span> ${esc(step.expected_result)}</p>`);
      parts.push(`</section>`);
    }
  } else {
    articles++;
    parts.push(renderMarkdown(row.title, row.body_markdown));
  }

  parts.push(`</article>`);
  if (!byCat.has(catKey)) byCat.set(catKey, []);
  byCat.get(catKey).push({ id, title: row.title, draft, html: parts.join("\n") });
}

const nav = [], body = [];
for (const cat of CATEGORY_ORDER) {
  const items = (byCat.get(cat) ?? []).sort((a, b) => a.title.localeCompare(b.title));
  if (!items.length) continue;
  nav.push(`<div class="nav-group"><div class="nav-cat">${esc(cat)} <span>${items.length}</span></div>`);
  for (const it of items) {
    nav.push(`<a href="#${it.id}" class="nav-link">${esc(it.title)}${it.draft ? '<span class="dot" title="Draft in app"></span>' : ""}</a>`);
    body.push(it.html);
  }
  nav.push(`</div>`);
}

const total = illustrated + articles;
const today = new Date().toISOString().slice(0, 10);
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alleato — Documentation</title>
<style>
  :root{--bg:#0e0f12;--panel:#16181d;--card:#1b1e24;--line:#2a2e37;--text:#e7e9ee;--muted:#9aa1ad;--accent:#ff6a1a;--accent-soft:#3a220f;--green:#3fb950;--amber:#d9a441;}
  *{box-sizing:border-box;} body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  a{color:inherit;text-decoration:none;}
  .layout{display:grid;grid-template-columns:300px 1fr;min-height:100vh;}
  aside{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;background:var(--panel);border-right:1px solid var(--line);padding:22px 14px;}
  .brand{font-weight:700;font-size:16px;margin:4px 8px 2px;} .brand span{color:var(--accent);}
  .sub{color:var(--muted);font-size:12px;margin:0 8px 18px;}
  .nav-group{margin-bottom:14px;}
  .nav-cat{display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:var(--muted);margin:0 8px 6px;}
  .nav-cat span{opacity:.6;}
  .nav-link{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;color:var(--text);font-size:13px;}
  .nav-link:hover{background:var(--card);}
  .dot{width:6px;height:6px;border-radius:50%;background:var(--amber);flex:none;}
  main{padding:38px 52px 140px;max-width:920px;}
  .hero{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:20px;}
  .hero h1{margin:0 0 6px;font-size:26px;} .hero p{margin:0;color:var(--muted);}
  .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:12px;}
  .legend b{font-weight:600;}
  .doc{padding:32px 0;border-bottom:1px solid var(--line);scroll-margin-top:14px;}
  .doc-meta{display:flex;gap:8px;align-items:center;margin-bottom:12px;}
  .doc-cat{text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:var(--accent);background:var(--accent-soft);border-radius:20px;padding:3px 10px;}
  .tag{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;border-radius:20px;padding:3px 9px;border:1px solid var(--line);}
  .tag-tut{color:#8ab4ff;} .tag-live{color:var(--green);} .tag-draft{color:var(--amber);}
  .doc h1{font-size:23px;margin:0 0 8px;} .lead{color:var(--muted);margin:0 0 18px;font-size:15.5px;}
  .walkthrough{width:100%;border-radius:12px;border:1px solid var(--line);background:#000;margin-bottom:12px;}
  .step{margin:24px 0;} .step h2{font-size:16.5px;display:flex;align-items:center;gap:12px;margin:0 0 12px;}
  .num{flex:none;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#111;font-size:13px;font-weight:700;display:grid;place-items:center;}
  .step img{width:100%;border-radius:10px;border:1px solid var(--line);display:block;margin:0 0 12px;}
  .expected{background:var(--card);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;padding:9px 14px;font-size:14px;}
  .expected span{color:var(--accent);font-weight:600;margin-right:6px;}
  .prose h1{font-size:22px;margin:22px 0 10px;} .prose h2{font-size:18px;margin:24px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px;}
  .prose h3{font-size:15.5px;margin:18px 0 6px;} .prose p{margin:0 0 12px;} .prose ul,.prose ol{margin:0 0 12px;padding-left:22px;} .prose li{margin:3px 0;}
  .prose a{color:var(--accent);} .prose img{max-width:100%;border-radius:8px;border:1px solid var(--line);}
  .prose table{border-collapse:collapse;width:100%;margin:0 0 14px;font-size:13.5px;} .prose th,.prose td{border:1px solid var(--line);padding:7px 10px;text-align:left;} .prose th{background:var(--card);}
  .prose blockquote{border-left:3px solid var(--line);margin:0 0 12px;padding:2px 14px;color:var(--muted);}
  code{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
  .prose pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;margin:0 0 14px;} .prose pre code{border:0;background:none;padding:0;}
  @media (max-width:820px){.layout{grid-template-columns:1fr;}aside{position:static;height:auto;}main{padding:26px 18px 80px;}}
</style></head>
<body><div class="layout">
  <aside>
    <div class="brand">Alleato <span>Docs</span></div>
    <div class="sub">${total} documents · ${illustrated} illustrated</div>
    ${nav.join("\n    ")}
  </aside>
  <main>
    <div class="hero">
      <h1>App Documentation</h1>
      <p>Every guide and reference article, offline. Generated ${today}.</p>
      <div class="legend">
        <span><b style="color:var(--green)">Live</b> — published in the app</span>
        <span><b style="color:var(--amber)">Draft in app</b> — written &amp; complete, not yet published</span>
        <span><b style="color:#8ab4ff">Illustrated</b> — has screenshots</span>
      </div>
    </div>
    ${body.join("\n\n")}
  </main>
</div></body></html>`;

writeFileSync(join(OUT, "index.html"), html);
console.log(`Built ${total} documents → ${join(OUT, "index.html")}`);
console.log(`  illustrated: ${illustrated}  (screenshots downloaded: ${imgCount}, videos: ${vidCount})`);
console.log(`  articles: ${articles}`);
console.log(`  skipped (no content): ${skipped}`);
