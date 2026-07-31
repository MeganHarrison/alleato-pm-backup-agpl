#!/usr/bin/env node
/**
 * Dev Bridge — Annotation Watcher
 *
 * Run this in any terminal to watch for in-app annotations from Megan
 * and bring them into Claude Code's context.
 *
 * Usage (run from anywhere):
 *   npx tsx /Users/meganharrison/Documents/alleato-pm/scripts/dev-bridge/watch-annotations.ts
 *
 * What it does every 30 seconds:
 * 1. Polls GET /api/dev/annotate for open annotations
 * 2. Prints each new one to the terminal with full context
 * 3. Claude Code reads it, opens agent-browser to the page, diagnoses, replies
 *
 * Uses fetch (built into Node 18+) to call the running dev server.
 * No external dependencies — works from any directory.
 *
 * Environment: reads from .env walking up from this file's location.
 * Required: NEXT_PUBLIC_APP_URL (defaults to http://localhost:3000)
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// --- Env loader (no dotenv dependency needed) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findAndLoadEnv(startDir: string): Record<string, string> {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      console.log(`   Loaded env from: ${candidate}`);
      return parseEnvFile(candidate);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.warn("   ⚠️  No .env file found — using existing environment variables");
  return {};
}

function parseEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = readFileSync(path, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
    if (!process.env[key]) process.env[key] = val;
  }
  return env;
}

findAndLoadEnv(__dirname);

// --- Config ---
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const POLL_MS = 30_000;

type Annotation = {
  id: string;
  route: string;
  comment: string;
  status: string;
  created_at: string;
  screenshot_url: string | null;
  element_selector: string | null;
  component_hint: string | null;
};

const knownIds = new Set<string>();

async function fetchOpen(): Promise<Annotation[]> {
  try {
    const res = await fetch(`${APP_URL}/api/dev/annotate?status=open`);
    if (!res.ok) {
      console.error(`   Poll failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const { annotations } = await res.json() as { annotations: Annotation[] };
    return annotations ?? [];
  } catch (e) {
    console.error(`   Poll error (is dev server running?):`, (e as Error).message);
    return [];
  }
}

async function postReply(id: string, reply: string): Promise<void> {
  try {
    const res = await fetch(`${APP_URL}/api/dev/annotate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reply, status: "replied" }),
    });
    if (res.ok) {
      console.log(`   ✅ Reply posted for ${id}`);
    } else {
      console.error(`   Failed to post reply: ${res.status}`);
    }
  } catch (e) {
    console.error(`   Reply error:`, (e as Error).message);
  }
}

function formatAnnotation(a: Annotation): string {
  return [
    `┌─ NEW ANNOTATION ─────────────────────────────────`,
    `│ ID:       ${a.id}`,
    `│ Route:    ${a.route}`,
    `│ Page URL: ${APP_URL}${a.route}`,
    `│ Comment:  ${a.comment}`,
    a.element_selector ? `│ Element:  ${a.element_selector}` : null,
    a.component_hint   ? `│ Hint:     ${a.component_hint}` : null,
    a.screenshot_url   ? `│ Screenshot: ${a.screenshot_url}` : null,
    `│ Time:     ${new Date(a.created_at).toLocaleString()}`,
    `└───────────────────────────────────────────────────`,
    ``,
    `→ Open page:  agent-browser open ${APP_URL}${a.route}`,
    `→ Post reply: await postReply("${a.id}", "your diagnosis here")`,
    ``,
  ].filter(Boolean).join("\n");
}

async function poll(): Promise<void> {
  const annotations = await fetchOpen();
  const fresh = annotations.filter(a => !knownIds.has(a.id));
  if (fresh.length === 0) return;

  console.log(`\n🔔 ${fresh.length} new annotation(s) — ${new Date().toLocaleTimeString()}\n`);
  for (const a of fresh) {
    knownIds.add(a.id);
    console.log(formatAnnotation(a));
  }
}

// Export for Claude Code to call directly in this terminal session
(globalThis as any).postReply = postReply;

async function main(): Promise<void> {
  console.log(`\n🤖 Dev Bridge watcher started`);
  console.log(`   App URL:  ${APP_URL}`);
  console.log(`   Polling every ${POLL_MS / 1000}s`);
  console.log(`   Waiting for annotations...\n`);

  await poll();
  setInterval(poll, POLL_MS);
}

main().catch(console.error);
