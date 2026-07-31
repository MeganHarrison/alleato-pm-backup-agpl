#!/usr/bin/env node

/**
 * Import JobPlanner project photos into the app.
 *
 * Photos are binary files, so this DOWNLOADS each photo from JobPlanner and RE-UPLOADS it
 * to the app's Supabase storage (`project-files` bucket, path
 * `projects/{appId}/photos/jobplanner/{guid}.{ext}`), then inserts a `project_photos` row
 * pointing at the public URL. Idempotent on `project_photos.jobplanner_photo_guid`
 * (per-project unique) — re-runs skip photos already imported.
 *
 * The app's photos page reads `project_photos` (not the empty `photos` table).
 *
 * Usage:
 *   node scripts/jobplanner/import-photos.mjs --jp=4493 --app=795 --limit=25            # DRY RUN
 *   node scripts/jobplanner/import-photos.mjs --jp=4493 --app=795 --limit=25 --apply
 *   node scripts/jobplanner/import-photos.mjs --jp=4493 --app=795 --apply               # all photos
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : undefined; };
const JP = Number(arg("jp"));
const APP = Number(arg("app"));
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
// --new-only: import only photos NEWER than the newest one already imported for this
// project (for the nightly incremental sync — no backfill of the older tail). Bounded by
// a safety cap so a single run can never balloon.
const NEW_ONLY = process.argv.includes("--new-only");
const NEW_ONLY_CAP = 500;
if (!Number.isInteger(JP) || !Number.isInteger(APP)) { console.error("Usage: --jp=<id> --app=<id> [--limit=N | --new-only] [--apply]"); process.exit(1); }

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET = "project-files";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", heif: "image/heif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff" };
const extOf = (name) => (String(name).split(".").pop() || "").toLowerCase();
const mimeOf = (name) => MIME[extOf(name)] || "application/octet-stream";

async function jpJson(u) {
  const r = await fetch(`https://api.jobplanner.com${u}`, { headers: { ApiKey: JP_KEY, "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`JP ${u} -> ${r.status}`);
  return r.json();
}

async function main() {
  const all = await jpJson(`/projects/${JP}/photos`);
  const photos = (Array.isArray(all) ? all : []).filter((p) => !p.isFolder && p.url && p.guid);

  const { data: existingRows } = await sb.from("project_photos").select("jobplanner_photo_guid, date_taken").eq("project_id", APP).not("jobplanner_photo_guid", "is", null);
  const have = new Set((existingRows ?? []).map((r) => r.jobplanner_photo_guid));

  let todo;
  if (NEW_ONLY) {
    // Only photos uploaded AFTER the newest one already imported for this project.
    const newest = (existingRows ?? []).map((r) => r.date_taken).filter(Boolean).sort().pop();
    todo = photos
      .filter((p) => !have.has(p.guid) && (!newest || String(p.createdOn) > String(newest)))
      .slice(0, NEW_ONLY_CAP);
  } else {
    const slice = photos.slice(0, LIMIT === Infinity ? photos.length : LIMIT);
    todo = slice.filter((p) => !have.has(p.guid));
  }
  console.log(`JP ${JP} -> app ${APP}: ${photos.length} JP photos, ${have.size} already imported, ${todo.length} to import${NEW_ONLY ? " (new-only)" : LIMIT === Infinity ? "" : ` (limit ${LIMIT})`}.${APPLY ? "" : "  (DRY RUN)"}`);
  if (!APPLY) { for (const p of todo.slice(0, 5)) console.log(`  would import "${p.name}" (${(p.size / 1024).toFixed(0)}KB, ${String(p.createdOn).slice(0, 10)})`); if (todo.length > 5) console.log(`  … +${todo.length - 5} more`); return; }

  let ok = 0, failed = 0;
  for (const p of todo) {
    try {
      const res = await fetch(p.url, { headers: { ApiKey: JP_KEY, "User-Agent": UA } });
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = extOf(p.name) || "jpg";
      const storagePath = `projects/${APP}/photos/jobplanner/${p.guid}.${ext}`;
      const contentType = mimeOf(p.name);
      const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, buf, { contentType, upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);
      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
      const { error: insErr } = await sb.from("project_photos").insert({
        project_id: APP, jobplanner_photo_guid: p.guid,
        title: p.name, file_name: p.name, file_url: pub.publicUrl,
        file_size: p.size ?? buf.length, content_type: contentType,
        album: p.folder || "JobPlanner", date_taken: p.createdOn ?? null,
      });
      if (insErr) throw new Error(`insert: ${insErr.message}`);
      ok++;
    } catch (e) {
      failed++;
      console.error(`  ✗ "${p.name}": ${e.message}`);
    }
  }
  console.log(`\nAPPLIED: imported ${ok}, failed ${failed}, total project_photos for ${APP} now includes ${ok} new JobPlanner photos.`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
