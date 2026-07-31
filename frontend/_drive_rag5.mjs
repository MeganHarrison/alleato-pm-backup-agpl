import { chromium } from '@playwright/test';
const SCRATCH = process.env.SCRATCH;
const EMAIL = process.env.E2E_EMAIL, PASS = process.env.E2E_PASS;
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
let captured = null;
ctx.on('response', async (r) => {
  if (r.url().includes('/api/admin/source-sync/status')) {
    try { captured = { status: r.status(), body: await r.text() }; } catch {}
  }
});
await page.goto('http://localhost:3001/login', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 }).catch(()=>{});
await page.fill('input[type="email"], input[name="email"]', EMAIL).catch(()=>{});
await page.fill('input[type="password"], input[name="password"]', PASS).catch(()=>{});
await page.click('button[type="submit"], button:has-text("Sign in")').catch(()=>{});
// poll for session by checking we can reach a logged-in route
let loggedIn=false;
for (let t=0;t<20;t++){
  await page.waitForTimeout(2000);
  const u = new URL(page.url()).pathname;
  if (!/\/(login|auth)/.test(u)) { loggedIn=true; break; }
}
console.log('LOGGED_IN:', loggedIn, 'URL:', page.url());

let ok=false;
for (let i=0;i<5 && !ok;i++){
  captured=null;
  await page.goto('http://localhost:3001/rag', { waitUntil:'networkidle', timeout:60000 }).catch(()=>{});
  await page.waitForTimeout(4000);
  if (captured) {
    let d; try { d=JSON.parse(captured.body); } catch {}
    const p = d?.pipeline || {};
    const sv = p.unconfiguredGraphSubscriptions;
    console.log(`RUN ${i}: http=${captured.status} routeStatus=${d?.status} pipelineKeys=${Object.keys(p).length} unconfiguredGraphSubscriptions=${sv} (${typeof sv})`);
    if (captured.status===200 && typeof sv==='number') ok=true;
    else if (captured.status===200) { /* warm-retry */ }
  } else console.log(`RUN ${i}: no status call`);
}
const bodyText = await page.evaluate(()=>document.body.innerText);
console.log('HAS_FAILED_MARKER:', bodyText.includes('Failed to load RAG health'));
console.log('PANEL_RENDERED:', /RAG Health/i.test(bodyText));
await page.screenshot({ path: SCRATCH+'/rag_page.png', fullPage:true });
console.log('WARM_SCALAR_CONFIRMED:', ok);
await browser.close();
