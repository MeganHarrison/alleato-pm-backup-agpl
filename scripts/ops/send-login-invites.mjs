#!/usr/bin/env node
/**
 * Send login invites to every active Alleato employee who has not logged in yet.
 *
 * Mirrors the app's own invite path (frontend/src/lib/email/invite-links.ts +
 * services/inviteService.ts): it asks Supabase Auth for an action link and emails
 * it through Resend, sending each person the correct link for their account state:
 *
 *   - NO ACCOUNT              -> type "invite"   (creates the auth user + invite link)
 *   - ACCOUNT, never signed in -> type "recovery" (lets them set a password and get in)
 *   - already logged in        -> skipped
 *
 * SAFETY: dry-run by default. It prints exactly who would be emailed and what
 * kind of link each gets. Add --send to actually send.
 *
 * Usage:
 *   node scripts/ops/send-login-invites.mjs            # dry run (no emails)
 *   node scripts/ops/send-login-invites.mjs --send     # actually send
 *
 * Reads credentials from frontend/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *   EMAIL_FROM_ADDRESS (optional), NEXT_PUBLIC_APP_URL (optional)
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "frontend/.env.local") });

const SEND = process.argv.includes("--send");
/**
 * Optional allow-list. `--only=a@x.com,b@y.com` restricts the send to exactly
 * those emails (case-insensitive) and, because it is an explicit list, ignores
 * the person_type='employee' filter so any active person can be targeted.
 */
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const emails = arg
    .slice("--only=".length)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emails.length > 0 ? emails : null;
})();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = (process.env.EMAIL_FROM_ADDRESS ?? "Alleato <notifications@alleato.app>")
  .replace(/[\r\n\t]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim()
  ? new URL(process.env.NEXT_PUBLIC_APP_URL.trim()).origin
  : "https://projects.alleatogroup.com");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local");
  process.exit(1);
}
if (SEND && !RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is not set in frontend/.env.local (required to actually send)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Rebuild the app's /auth/confirm link from a Supabase action_link (see invite-links.ts). */
function buildConfirmUrl(actionLink, type, email) {
  const next = `/auth/update-password?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/")}`;
  let token;
  try {
    token = new URL(actionLink).searchParams.get("token");
  } catch {
    token = null;
  }
  if (!token) return actionLink;
  return `${APP_BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type}&next=${encodeURIComponent(next)}`;
}

function inviteEmailHtml({ firstName, acceptUrl }) {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;margin:0 0 16px">Your Alleato PM login is ready</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px">${hi}</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px">You've been given access to the Alleato project management system. Click below to set your password and log in.</p>
    <p style="margin:0 0 24px"><a href="${acceptUrl}" style="background:#1c1917;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-size:15px">Set up my login</a></p>
    <p style="font-size:13px;line-height:1.5;color:#57534e;margin:0 0 8px">Or paste this link into your browser:</p>
    <p style="font-size:12px;line-height:1.5;color:#57534e;word-break:break-all;margin:0 0 24px">${acceptUrl}</p>
    <p style="font-size:12px;color:#a8a29e;margin:0">This link expires in a few days. If you weren't expecting this, you can ignore it.</p>
  </div></body></html>`;
}

async function sendResend(to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  return res.json();
}

/** Load every auth user, mapped by lowercase email, so we can read login state. */
async function loadAuthUsersByEmail() {
  const map = new Map();
  let page = 1;
  // Paginate through all auth users (100 per page).
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u);
    }
    if (data.users.length < 100) break;
    page += 1;
  }
  return map;
}

async function main() {
  console.log(`\nMode: ${SEND ? "🚀 SEND (emails will go out)" : "🧪 DRY RUN (no emails) — add --send to send"}`);
  console.log(`From: ${EMAIL_FROM}`);
  console.log(`App:  ${APP_BASE_URL}\n`);

  // Active people. Normally scoped to person_type='employee'; when an explicit
  // --only allow-list is given we drop that filter and target those emails.
  let peopleQuery = supabase
    .from("people")
    .select("id, first_name, last_name, email, status, person_type")
    .eq("status", "active");
  if (!ONLY) {
    peopleQuery = peopleQuery.eq("person_type", "employee");
  }
  const { data: people, error } = await peopleQuery;
  if (error) {
    console.error("❌ Could not load people:", error.message);
    process.exit(1);
  }

  const authByEmail = await loadAuthUsersByEmail();

  const targets = [];
  for (const p of people) {
    if (!p.email) continue;
    if (ONLY && !ONLY.includes(p.email.toLowerCase())) continue; // outside allow-list
    const authUser = authByEmail.get(p.email.toLowerCase());
    if (authUser?.last_sign_in_at) continue; // already logged in — skip
    targets.push({
      person: p,
      linkType: authUser ? "recovery" : "invite", // existing account -> password link; none -> invite
    });
  }

  targets.sort((a, b) => (a.person.last_name || "").localeCompare(b.person.last_name || ""));

  if (targets.length === 0) {
    console.log("✅ Everyone active has already logged in. Nothing to send.");
    return;
  }

  console.log(`Found ${targets.length} active employee(s) who haven't logged in:\n`);

  const results = { sent: 0, failed: 0, skipped: 0 };
  for (const t of targets) {
    const name = `${t.person.first_name ?? ""} ${t.person.last_name ?? ""}`.trim() || t.person.email;
    const label = t.linkType === "invite" ? "new account (invite)" : "password setup link";

    if (!SEND) {
      console.log(`  • ${name} <${t.person.email}> — ${label}`);
      continue;
    }

    try {
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink(
        t.linkType === "invite"
          ? { type: "invite", email: t.person.email, options: { redirectTo: `${APP_BASE_URL}/auth/callback` } }
          : { type: "recovery", email: t.person.email }
      );
      if (linkErr || !linkData?.properties?.action_link) {
        throw new Error(linkErr?.message ?? "no action_link returned");
      }
      const acceptUrl = buildConfirmUrl(linkData.properties.action_link, t.linkType, t.person.email);
      await sendResend(
        t.person.email,
        "You're invited to the Alleato PM system",
        inviteEmailHtml({ firstName: t.person.first_name, acceptUrl })
      );
      results.sent += 1;
      console.log(`  ✅ ${name} <${t.person.email}> — ${label}`);
      await sleep(600); // stay under Resend rate limits
    } catch (e) {
      results.failed += 1;
      console.log(`  ❌ ${name} <${t.person.email}> — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Send a preview copy to the admin so they can see exactly what employees
  // receive. Skipped when an explicit --only allow-list is in effect.
  const PREVIEW_TO = "bclymer@alleatogroup.com";
  if (SEND && !ONLY) {
    try {
      const { data: linkData } = await supabase.auth.admin.generateLink({ type: "recovery", email: PREVIEW_TO });
      const previewUrl = linkData?.properties?.action_link
        ? buildConfirmUrl(linkData.properties.action_link, "recovery", PREVIEW_TO)
        : `${APP_BASE_URL}/auth/update-password`;
      await sendResend(
        PREVIEW_TO,
        "[PREVIEW] You're invited to the Alleato PM system",
        inviteEmailHtml({ firstName: "Brandon", acceptUrl: previewUrl })
      );
      console.log(`  📧 Preview copy sent to ${PREVIEW_TO}`);
    } catch (e) {
      console.log(`  ⚠️ Could not send preview copy: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (SEND) {
    console.log(`\nDone. Sent: ${results.sent}  Failed: ${results.failed}`);
  } else {
    console.log(`\nDry run only — no emails sent. Re-run with --send to send these ${targets.length} invite(s).`);
  }
}

main().catch((e) => {
  console.error("❌ Unexpected error:", e);
  process.exit(1);
});
