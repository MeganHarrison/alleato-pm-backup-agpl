import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-meganharrison-Documents-alleato-pm/d2cbe9fb-eeda-4d74-8deb-e71a5b02547d/scratchpad";

// Pull test creds from env files.
function readEnv() {
  const files = ["../.env", ".env.local", ".env"];
  const env = {};
  for (const f of files) {
    try {
      for (const line of fs.readFileSync(f, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
  return env;
}
const env = readEnv();
const EMAIL = env.TEST_USER_1 || "test1@mail.com";
const PASS = env.TEST_PASSWORD_1 || "";
console.log("login as:", EMAIL, "pass set:", !!PASS);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto("http://localhost:3001/876/tasks", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1500);

// If redirected to login, sign in.
if (await page.locator('input[type="password"], input[placeholder="Enter your password"]').count()) {
  await page.fill('input[type="email"], input[placeholder="you@company.com"]', EMAIL);
  await page.fill('input[type="password"], input[placeholder="Enter your password"]', PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(5000);
}
console.log("after login url:", page.url());

// Save refreshed session for later.
await ctx.storageState({ path: "./tests/.auth/user.json" });

await page.goto("http://localhost:3001/876/tasks", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(9000);

// Open sidebar via header Comments button → "View page comments".
async function click(sel) { try { const el = page.locator(sel).first(); if (await el.count()) { await el.click({ timeout: 3000 }); return true; } } catch {} return false; }
await click('[aria-label="Comments"]');
await page.waitForTimeout(700);
await click('text=View page comments');
await page.waitForTimeout(3500);

await page.screenshot({ path: `${OUT}/velt-sidebar-authed.png`, fullPage: false });

const dump = await page.evaluate(() => {
  const lines = [], classes = {};
  function walk(node, depth, inSb) {
    if (!node || depth > 14) return;
    const tag = node.tagName ? node.tagName.toLowerCase() : "";
    const cls = typeof node.className === "string" ? node.className : (node.getAttribute ? node.getAttribute("class") || "" : "");
    const nowSb = inSb || tag === "velt-comments-sidebar";
    if (nowSb && (tag.startsWith("velt") || (cls && cls.toLowerCase().includes("velt")))) {
      lines.push(`${"  ".repeat(Math.min(depth,12))}${tag}${cls ? "."+cls.trim().split(/\s+/).join(".") : ""}`);
    }
    if (cls) cls.split(/\s+/).forEach(c => { if (c && c.toLowerCase().includes("velt")) classes[c]=(classes[c]||0)+1; });
    if (node.shadowRoot) for (const c of node.shadowRoot.children) walk(c, depth+1, nowSb);
    for (const c of node.children || []) walk(c, depth+1, nowSb);
  }
  walk(document.body, 0, false);
  return { tree: lines.slice(0, 260), classCount: Object.keys(classes).length, classes: Object.keys(classes).sort() };
});
fs.writeFileSync(`${OUT}/velt-sidebar-authed.json`, JSON.stringify(dump, null, 2));
console.log("TREE LINES:", dump.tree.length, "CLASSES:", dump.classCount);
console.log(dump.tree.join("\n"));
console.log("\nCLASSES:\n" + dump.classes.join("\n"));
await browser.close();
