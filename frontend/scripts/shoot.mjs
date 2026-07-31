/**
 * shoot.mjs — one-command authenticated screenshots of the running app.
 *
 * Every real page requires login, so this handles auth for you: it signs in
 * once via the Supabase API using the test creds in .env (the same mechanism as
 * tests/auth.setup.ts — no UI login, no manual password entry), caches the
 * session in tests/.auth/user.json, and reuses it on later runs.
 *
 * Usage (from frontend/):
 *   npm run shoot -- /training
 *   npm run shoot -- /training /876/budget --full
 *   npm run shoot -- /training --mobile --out=training-mobile
 *   npm run shoot -- /training --base=http://localhost:3001
 *
 * Flags:
 *   --full          capture the full scrollable height (handles the app's
 *                   inner scroll container, not just the viewport)
 *   --mobile        375x812 viewport instead of 1440x900
 *   --out=<name>    base filename (defaults to a slug of the route)
 *   --base=<url>    dev server origin (default http://localhost:3000)
 *
 * Output: frontend/verify-output/shots/<name>.png  (verify-output is gitignored)
 */

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "..");

// Worktrees don't get the gitignored .env files. If they're missing here, copy
// them from the main checkout (…/<repo>/frontend) so both this script AND the
// dev server can authenticate. This is why screenshots "just work" everywhere.
function ensureEnvFiles() {
  const marker = `${path.sep}.claude${path.sep}worktrees${path.sep}`;
  const idx = FRONTEND.indexOf(marker);
  if (idx === -1) return; // not a worktree
  const mainFrontend = path.join(FRONTEND.slice(0, idx), "frontend");
  for (const name of [".env", ".env.local"]) {
    const dst = path.join(FRONTEND, name);
    const src = path.join(mainFrontend, name);
    if (!fs.existsSync(dst) && fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`[shoot] copied ${name} from main checkout`);
    }
  }
}

ensureEnvFiles();
dotenv.config({ path: path.join(FRONTEND, ".env.local"), override: false });
dotenv.config({ path: path.join(FRONTEND, ".env"), override: false });

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    }),
);
const routes = args.filter((a) => !a.startsWith("--"));
if (routes.length === 0) routes.push("/training");

const BASE = flags.base || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const OUT = path.join(FRONTEND, "verify-output", "shots");
const AUTH_FILE = path.join(FRONTEND, "tests", ".auth", "user.json");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anon) {
  console.error(
    "[shoot] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add frontend/.env(.local) or run from a checkout that has them.",
  );
  process.exit(1);
}
const email = process.env.TEST_USER_1 ?? "test1@mail.com";
const password = process.env.TEST_PASSWORD_1 ?? "test12026!!!";
const ref = (supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/) ?? [])[1] ?? "lgveqfnpkxvzbnnwuled";

function slug(route) {
  return route.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
}

async function freshCookie() {
  const supabase = createClient(supabaseUrl, anon);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("sign-in failed: " + (error?.message ?? "no session"));
  const s = data.session;
  const json = JSON.stringify({
    access_token: s.access_token, token_type: s.token_type, expires_in: s.expires_in,
    expires_at: s.expires_at, refresh_token: s.refresh_token, user: s.user, weak_password: null,
  });
  return {
    name: `sb-${ref}-auth-token`,
    value: "base64-" + Buffer.from(json).toString("base64"),
    domain: new URL(BASE).hostname,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 3600,
    httpOnly: false,
    secure: BASE.startsWith("https:"),
    sameSite: "Lax",
  };
}

(async () => {
  const cookie = await freshCookie();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: flags.mobile ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    reducedMotion: flags.reduce ? "reduce" : "no-preference",
  });
  await context.addCookies([cookie]);
  await context.storageState({ path: AUTH_FILE });

  const page = await context.newPage();
  const saved = [];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const url = route.startsWith("http") ? route : `${BASE}${route.startsWith("/") ? "" : "/"}${route}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    if (new URL(page.url()).pathname.startsWith("/auth/login")) {
      throw new Error(`redirected to login at ${route} — auth cookie rejected`);
    }
    await page.waitForTimeout(1500); // let client animation/data settle

    let clip;
    if (flags.full) {
      // Grow the viewport to the inner scroll container's height so a single
      // shot captures everything (the app scrolls an inner div, not window).
      const h = await page.evaluate(() => {
        let el = document.body, max = document.documentElement.scrollHeight;
        document.querySelectorAll("*").forEach((n) => {
          const cs = getComputedStyle(n);
          if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > max) max = n.scrollHeight;
        });
        return Math.min(max, 6000);
      });
      await page.setViewportSize({ width: flags.mobile ? 375 : 1440, height: h });
      await page.waitForTimeout(400);
    }

    const name = (routes.length === 1 && flags.out ? flags.out : slug(route)) + ".png";
    const file = path.join(OUT, name);
    await page.screenshot({ path: file, fullPage: Boolean(flags.full), clip });
    saved.push(file);
    console.log(`[shoot] ${route} -> ${file}`);
  }

  await browser.close();
  console.log("[shoot] done:\n" + saved.join("\n"));
})().catch((e) => {
  console.error("[shoot] FAIL", e.message);
  process.exit(1);
});
