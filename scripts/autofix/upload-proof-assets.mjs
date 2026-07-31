#!/usr/bin/env node
/**
 * Upload visual-proof screenshots to Supabase Storage so they render inline in
 * GitHub PR comments (raw URLs from a private repo do not render; a public
 * bucket with an unguessable per-run path does — same model as GitHub's own
 * user-images uploads).
 *
 * Reads <PROOF_OUTPUT_DIR>/manifest.json (from capture-visual-proof.mjs),
 * uploads every captured PNG to the `autofix-proof` bucket under an
 * unguessable path, and rewrites manifest.json with a `publicUrl` per entry.
 *
 * Inputs (env):
 *   SUPABASE_URL               – Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY  – service role key, used only server-side here (required)
 *   PROOF_OUTPUT_DIR           – directory holding manifest.json + PNGs (default: proof-output)
 *   PROOF_UPLOAD_PREFIX        – path prefix inside the bucket, e.g. "pr-123" (default: "adhoc")
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BUCKET = "autofix-proof";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function ensureBucket(supabaseUrl, serviceKey) {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 400/409 mean the bucket already exists — anything else is a real failure.
  if (!response.ok && response.status !== 400 && response.status !== 409) {
    throw new Error(`Creating bucket ${BUCKET} failed: ${response.status} ${await response.text()}`);
  }
}

async function uploadPng(supabaseUrl, serviceKey, objectPath, filePath) {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
      body: fs.readFileSync(filePath),
    },
  );
  if (!response.ok) {
    throw new Error(`Upload of ${objectPath} failed: ${response.status} ${await response.text()}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function main() {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const outputDir = process.env.PROOF_OUTPUT_DIR || "proof-output";
  const prefix = process.env.PROOF_UPLOAD_PREFIX || "adhoc";

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  const captured = manifest.routes.filter((entry) => entry.ok);
  if (captured.length === 0) {
    console.log("No successful captures to upload.");
    return;
  }

  await ensureBucket(supabaseUrl, serviceKey);

  // Unguessable per-run path segment: the bucket is public, the URLs are not enumerable.
  const runSegment = crypto.randomUUID();
  for (const entry of captured) {
    entry.publicUrl = await uploadPng(
      supabaseUrl,
      serviceKey,
      `${prefix}/${runSegment}/${entry.file}`,
      path.join(outputDir, entry.file),
    );
    console.log(`Uploaded ${entry.file}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Uploaded ${captured.length} screenshot(s); manifest updated with public URLs.`);
}

main().catch((error) => {
  console.error(`Proof asset upload failed: ${error.message}`);
  process.exit(1);
});
