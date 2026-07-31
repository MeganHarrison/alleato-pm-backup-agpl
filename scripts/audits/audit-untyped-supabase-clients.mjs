#!/usr/bin/env node
/**
 * Audit: Untyped Supabase Clients
 *
 * Finds every `createClient(...)` call / factory where the result is NOT
 * typed with the `Database` generic (i.e. `SupabaseClient<Database>` or a
 * `createClient<Database>()` call). This is the root-cause class that allows
 * phantom-table queries to slip past TypeScript.
 *
 * Output:
 *   <file>:<line>\t<kind>\t<line content>
 *
 * Kinds:
 *   - untyped-call           — `createClient(...)` without <Database>
 *   - untyped-return-type    — function returning SupabaseClient without <Database>
 *   - untyped-variable-type  — `: SupabaseClient` without `<Database>`
 *
 * Exit 0 always.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_ROOT = path.join(REPO_ROOT, "frontend", "src");

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "__generated__",
  "__tests__",
]);

const EXT_OK = new Set([".ts", ".tsx"]);

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && EXT_OK.has(path.extname(entry.name))) yield full;
  }
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

/** Heuristic: file imports something named createClient from a supabase module. */
function fileImportsSupabaseCreateClient(src) {
  // Matches `import { ..., createClient, ... } from "@supabase/ssr"` or "@supabase/supabase-js"
  // or from "@/lib/supabase/..."
  const importRe =
    /import[\s\S]{0,200}\bcreateClient\b[\s\S]{0,200}from\s+["']([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const source = m[1];
    if (
      source.startsWith("@supabase/") ||
      source.includes("/supabase/") ||
      source.endsWith("/supabase") ||
      source === "@/lib/supabase/client" ||
      source === "@/lib/supabase/server" ||
      source === "@/lib/supabase/admin"
    ) {
      return true;
    }
  }
  return false;
}

async function main() {
  const violations = [];

  for await (const file of walk(SCAN_ROOT)) {
    let src;
    try {
      src = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    const rel = path.relative(REPO_ROOT, file);

    // Skip the supabase client factory files themselves — those DEFINE the typed
    // createClient and are expected to reference the Database generic in their body.
    // We still want to audit them but only for their exported signatures.
    // Simpler: don't skip — just look for the violation patterns.

    const hasSupabaseImport = fileImportsSupabaseCreateClient(src);

    const lines = src.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCommentLine(line)) continue;

      // 1) Untyped `createClient(` calls — only flag when the file imports a Supabase createClient.
      //    We flag `createClient(` without a `<` immediately after.
      if (hasSupabaseImport) {
        const callRe = /\bcreateClient\s*(<[^>]*>)?\s*\(/g;
        let m;
        while ((m = callRe.exec(line)) !== null) {
          const generic = m[1]; // undefined or like "<Database>"
          if (!generic) {
            violations.push({
              file: rel,
              line: i + 1,
              kind: "untyped-call",
              text: line.trim(),
            });
          } else if (!/Database\b/.test(generic)) {
            violations.push({
              file: rel,
              line: i + 1,
              kind: "untyped-call-wrong-generic",
              text: line.trim(),
            });
          }
        }
      }

      // 2) Function return type `SupabaseClient` without `<Database>`.
      //    Example: `function getServer(): SupabaseClient { ... }`
      //    Also `Promise<SupabaseClient>`, `=> SupabaseClient`, `: SupabaseClient,`
      const retRe = /\bSupabaseClient\b(\s*<[^>]*>)?/g;
      let rm;
      while ((rm = retRe.exec(line)) !== null) {
        const generic = rm[1];
        if (!generic) {
          // false positive guard: type import lines
          if (/^\s*(import|export)\b/.test(line)) continue;
          violations.push({
            file: rel,
            line: i + 1,
            kind: "untyped-SupabaseClient",
            text: line.trim(),
          });
        } else if (!/Database\b/.test(generic)) {
          if (/^\s*(import|export)\b/.test(line)) continue;
          violations.push({
            file: rel,
            line: i + 1,
            kind: "untyped-SupabaseClient-wrong-generic",
            text: line.trim(),
          });
        }
      }
    }
  }

  for (const v of violations) {
    const text = v.text.length > 240 ? v.text.slice(0, 240) + "…" : v.text;
    process.stdout.write(`${v.file}:${v.line}\t${v.kind}\t${text}\n`);
  }

  // Summary
  const byKind = new Map();
  for (const v of violations)
    byKind.set(v.kind, (byKind.get(v.kind) || 0) + 1);
  process.stderr.write(`\n--- SUMMARY ---\n`);
  process.stderr.write(`Total: ${violations.length}\n`);
  for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    process.stderr.write(`  ${k}: ${n}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${err?.stack || err}\n`);
  process.exit(0);
});
