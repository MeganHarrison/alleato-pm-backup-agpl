// Fast, repeatable Playwright auth for tutorial capture.
// Signs in the test user via the Supabase API and writes a storage-state JSON
// with the @supabase/ssr auth cookie. A fresh sign-in each run avoids the
// refresh-token rotation that invalidates a reused session. No browser/webServer.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/meganharrison/Documents/alleato-pm/frontend/package.json");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  readFileSync("/Users/meganharrison/Documents/alleato-pm/frontend/.env.local", "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const EMAIL = env.TEST_USER_1 || "test1@mail.com";
const PASSWORD = env.TEST_PASSWORD_1;
const projectRef = (URL.match(/https?:\/\/([^.]+)\./) || [])[1];
const AUTH_FILE = "/Users/meganharrison/Documents/alleato-pm/frontend/tests/.auth/user.json";

const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
const s = data.session;
const sessionJson = JSON.stringify({
  access_token: s.access_token, token_type: s.token_type, expires_in: s.expires_in,
  expires_at: s.expires_at, refresh_token: s.refresh_token, user: s.user, weak_password: null,
});
const cookieValue = `base64-${Buffer.from(sessionJson).toString("base64")}`;
const state = {
  cookies: [{
    name: `sb-${projectRef}-auth-token`, value: cookieValue,
    domain: "localhost", path: "/",
    expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    httpOnly: false, secure: false, sameSite: "Lax",
  }],
  origins: [],
};
mkdirSync("/Users/meganharrison/Documents/alleato-pm/frontend/tests/.auth", { recursive: true });
writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
console.log(`auth refreshed for ${EMAIL} (ref ${projectRef}); session expires_at ${s.expires_at}`);
