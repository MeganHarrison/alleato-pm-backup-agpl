#!/usr/bin/env node
/**
 * Build a browsable static site from docs/user-guide/guides/**.
 * Output: docs/user-guide/_site/index.html  (single self-contained file).
 *
 *   node scripts/docs/build-user-guide-site.mjs
 *
 * Deploy the folder anywhere static (e.g. `vercel deploy docs/user-guide/_site`).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const GUIDES = join(ROOT, "docs", "user-guide", "guides");
const REGISTRY = JSON.parse(readFileSync(join(__dirname, "user-guide-registry.json"), "utf8"));
const OUT_DIR = join(ROOT, "docs", "user-guide", "_site");

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const DOMAINS = [
  ["financials", "Financials"],
  ["project-management", "Project management"],
  ["communication", "Documents & communication"],
  ["ai", "AI features"],
  ["reporting", "Reporting & dashboards"],
  ["other", "Other"],
];

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim();
  }
  return { fm, body: m[2] };
}

/** Rewrite relative .md links to hash routes, given the current tool slug. */
function rewriteLinks(html, tool) {
  return html.replace(/href="([^"]+\.md)(#[^"]*)?"/g, (_, href) => {
    let id;
    if (href === "index.md") id = tool;
    else if (href.startsWith("../")) {
      const parts = href.replace(/^\.\.\//, "").split("/");
      const other = parts[0];
      const file = parts[1] || "index.md";
      id = file === "index.md" ? other : `${other}/${file.replace(/\.md$/, "")}`;
    } else id = `${tool}/${href.replace(/\.md$/, "")}`;
    return `href="#/${id}"`;
  });
}

function articleId(tool, file) {
  return file === "index.md" ? tool : `${tool}/${file.replace(/\.md$/, "")}`;
}

function build() {
  const titleBySlug = Object.fromEntries(REGISTRY.tools.map((t) => [t.slug, t.title]));
  const domainBySlug = Object.fromEntries(REGISTRY.tools.map((t) => [t.slug, t.domain || "other"]));
  const order = REGISTRY.tools.map((t) => t.slug);

  // discover tool folders
  const folders = readdirSync(GUIDES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  // registry order first, then any extras (e.g. ai-assistant) alphabetically
  const tools = [...order.filter((s) => folders.includes(s)), ...folders.filter((s) => !order.includes(s)).sort()];

  const articles = {}; // id -> {title, html, verified, tool, isHub}
  const navByDomain = {}; // domain -> [{slug, title, tasks:[{id,title}]}]

  for (const tool of tools) {
    const dir = join(GUIDES, tool);
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    if (!files.includes("index.md")) continue;

    // hub first, then tasks; read hub to get its task ordering via the "What you can do" list
    const ordered = ["index.md", ...files.filter((f) => f !== "index.md").sort()];
    const tasks = [];
    for (const file of ordered) {
      const raw = readFileSync(join(dir, file), "utf8");
      const { fm, body } = parseFrontmatter(raw);
      const id = articleId(tool, file);
      const html = rewriteLinks(md.render(body), tool);
      const verified = (fm.last_verified && fm.last_verified !== "TBD") || false;
      const title = fm.title || file.replace(/\.md$/, "");
      articles[id] = { title, html, verified, tool, isHub: file === "index.md" };
      if (file !== "index.md") tasks.push({ id, title });
    }

    const domain = domainBySlug[tool] || "other";
    (navByDomain[domain] ??= []).push({
      slug: tool,
      title: titleBySlug[tool] || articles[tool].title,
      verified: articles[tool].verified,
      tasks,
    });
  }

  // build nav structure in domain order
  const nav = DOMAINS.filter(([d]) => navByDomain[d]?.length).map(([d, label]) => ({
    label,
    tools: navByDomain[d],
  }));

  const totalArticles = Object.keys(articles).length;
  const verifiedCount = Object.values(articles).filter((a) => a.verified).length;

  const dataJson = JSON.stringify({ articles, nav, totalArticles, verifiedCount });
  const html = PAGE(dataJson);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "index.html"), html);
  // vercel: treat as static, no build
  writeFileSync(join(OUT_DIR, "vercel.json"), JSON.stringify({ cleanUrls: true }, null, 2));
  console.log(`Built site: ${join("docs/user-guide/_site", "index.html")}`);
  console.log(`  ${tools.length} tools · ${totalArticles} articles · ${verifiedCount} verified`);
}

function PAGE(dataJson) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Alleato — User Guide</title>
<style>
  :root{
    --bg:#ffffff; --fg:#1a1a1a; --muted:#6b7280; --line:#ececf1; --sidebar:#f7f7f8;
    --accent:#e8590c; --accent-soft:#fff4ec; --code:#f3f4f6; --maxw:760px;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;color:var(--fg);background:var(--bg)}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  .app{display:grid;grid-template-columns:288px 1fr;min-height:100vh}
  /* sidebar */
  aside{background:var(--sidebar);border-right:1px solid var(--line);position:sticky;top:0;height:100vh;overflow-y:auto;padding:20px 16px 60px}
  .brand{font-weight:700;font-size:15px;letter-spacing:-.01em;padding:6px 8px 2px;display:flex;align-items:center;gap:8px}
  .brand .dot{width:10px;height:10px;border-radius:3px;background:var(--accent)}
  .brand small{font-weight:500;color:var(--muted);font-size:12px}
  .search{width:100%;margin:14px 0 8px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:#fff}
  .group{margin-top:14px}
  .group h4{margin:0 0 4px;padding:0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .tool>button{all:unset;display:flex;align-items:center;gap:6px;width:100%;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:13.5px;color:#374151}
  .tool>button:hover{background:#ececed}
  .tool>button.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
  .tool .tasks{margin:2px 0 4px 14px;border-left:1px solid var(--line);padding-left:8px;display:none}
  .tool.open .tasks{display:block}
  .tool .tasks a{display:block;padding:4px 8px;border-radius:6px;font-size:13px;color:#4b5563}
  .tool .tasks a:hover{background:#ececed;text-decoration:none}
  .tool .tasks a.active{color:var(--accent);font-weight:600}
  .badge{font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:#fff}
  .badge.draft{color:#9a6700;background:#fff8e6;border-color:#f3e2b3}
  .badge.ok{color:#1a7f37;background:#eaf7ee;border-color:#bfe3c8}
  /* content */
  main{padding:40px 48px 120px;max-width:calc(var(--maxw) + 96px)}
  .crumb{font-size:12.5px;color:var(--muted);margin-bottom:10px}
  article{max-width:var(--maxw)}
  article h1{font-size:30px;letter-spacing:-.02em;margin:.2em 0 .5em}
  article h2{font-size:20px;letter-spacing:-.01em;margin:1.6em 0 .5em;padding-top:.4em}
  article h3{font-size:16px;margin:1.4em 0 .4em}
  article p{margin:.7em 0}
  article ul,article ol{margin:.6em 0;padding-left:1.3em}
  article li{margin:.3em 0}
  article blockquote{margin:1em 0;padding:.6em 1em;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;color:#333}
  article code{background:var(--code);padding:.12em .4em;border-radius:5px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  article table{border-collapse:collapse;width:100%;margin:1em 0;font-size:14px;display:block;overflow-x:auto}
  article th,article td{border:1px solid var(--line);padding:8px 11px;text-align:left;vertical-align:top}
  article th{background:var(--sidebar);font-weight:600}
  article tr:nth-child(even) td{background:#fcfcfd}
  .stat{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:var(--muted)}
  .empty{color:var(--muted);font-style:italic}
  @media(max-width:820px){.app{grid-template-columns:1fr}aside{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:24px}}
</style>
</head>
<body>
<div class="app">
  <aside>
    <div class="brand"><span class="dot"></span>Alleato <small>User Guide</small></div>
    <input class="search" id="search" placeholder="Filter tools…" />
    <div id="nav"></div>
    <div style="padding:14px 8px;margin-top:18px;border-top:1px solid var(--line)">
      <div class="stat" id="stats"></div>
    </div>
  </aside>
  <main>
    <div class="crumb" id="crumb"></div>
    <article id="content"></article>
  </main>
</div>
<script id="data" type="application/json">${dataJson}</script>
<script>
const DATA = JSON.parse(document.getElementById("data").textContent);
const navEl = document.getElementById("nav");
const contentEl = document.getElementById("content");
const crumbEl = document.getElementById("crumb");
document.getElementById("stats").textContent =
  DATA.totalArticles + " articles · " + DATA.verifiedCount + " verified · " + (DATA.totalArticles-DATA.verifiedCount) + " draft";

function badge(ok){ return ok ? '<span class="badge ok">verified</span>' : '<span class="badge draft">draft</span>'; }

function renderNav(filter){
  navEl.innerHTML = "";
  const f = (filter||"").toLowerCase();
  for(const group of DATA.nav){
    const tools = group.tools.filter(t => !f || t.title.toLowerCase().includes(f) || t.tasks.some(k=>k.title.toLowerCase().includes(f)));
    if(!tools.length) continue;
    const g = document.createElement("div"); g.className="group";
    g.innerHTML = "<h4>"+group.label+"</h4>";
    for(const t of tools){
      const wrap = document.createElement("div"); wrap.className="tool"; wrap.dataset.slug=t.slug;
      const btn = document.createElement("button");
      btn.innerHTML = '<span style="flex:1">'+t.title+'</span>'+badge(t.verified);
      btn.onclick = ()=>{ location.hash = "#/"+t.slug; };
      wrap.appendChild(btn);
      if(t.tasks.length){
        const tasks = document.createElement("div"); tasks.className="tasks";
        for(const k of t.tasks){
          const a = document.createElement("a"); a.href="#/"+k.id; a.textContent=k.title; a.dataset.id=k.id;
          tasks.appendChild(a);
        }
        wrap.appendChild(tasks);
      }
      g.appendChild(wrap);
    }
    navEl.appendChild(g);
  }
}

function route(){
  const id = decodeURIComponent(location.hash.replace(/^#\\//,"")) || DATA.nav[0].tools[0].slug;
  const art = DATA.articles[id];
  // active states
  document.querySelectorAll(".tool").forEach(el=>{
    const slug = el.dataset.slug;
    const inThis = id===slug || id.startsWith(slug+"/");
    el.classList.toggle("open", inThis);
    el.querySelector("button").classList.toggle("active", id===slug);
    el.querySelectorAll(".tasks a").forEach(a=>a.classList.toggle("active", a.dataset.id===id));
  });
  if(!art){ contentEl.innerHTML = '<p class="empty">Not found.</p>'; return; }
  const toolTitle = (DATA.nav.flatMap(g=>g.tools).find(t=>t.slug===art.tool)||{}).title || art.tool;
  crumbEl.innerHTML = art.isHub ? toolTitle : '<a href="#/'+art.tool+'">'+toolTitle+'</a> &rsaquo; '+art.title;
  contentEl.innerHTML = art.html + '<p style="margin-top:40px">'+badge(art.verified)+(art.verified?'':' &nbsp;<span class="empty">— steps & fields awaiting verification against the live app</span>')+'</p>';
  contentEl.scrollIntoView({block:"start"});
  window.scrollTo(0,0);
}

document.getElementById("search").addEventListener("input", e=>renderNav(e.target.value));
window.addEventListener("hashchange", route);
renderNav("");
route();
</script>
</body>
</html>`;
}

build();
