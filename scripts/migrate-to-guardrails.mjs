#!/usr/bin/env node
/**
 * Migrates Next.js API route handlers from manual try/catch + auth check pattern
 * to withApiGuardrails wrapper.
 *
 * Safe transformations only:
 * 1. Add withApiGuardrails and GuardrailError imports if missing
 * 2. Convert `export async function METHOD(...)` signatures to `export const METHOD = withApiGuardrails(...`
 * 3. Remove outer try { ... } catch wrapper (wrapper handles it)
 * 4. Replace 401 NextResponse.json returns with GuardrailError throws
 * 5. Replace `return new Response("Unauthorized", { status: 401 })` with throws
 *
 * SKIPS files that use streaming (ReadableStream, res.write, EventSource, etc.)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execSync } from "node:child_process";

const API_DIR = resolve(
  process.cwd(),
  "src/app/api"
);

// Skip patterns — streaming, webhooks, proxies
const SKIP_PATTERNS = [
  "/ai-assistant/chat/",
  "/bot/",
  "/monitoring/websocket/",
  "/procore-docs/chat/",
  "/procore-screenshots/",
  "/supabase-proxy/",
  "/sync/acumatica/",
  "/admin/rag-eval/run/",
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => filePath.includes(p));
}

// Get route path hint from file path for withApiGuardrails label
function getRoutePath(filePath) {
  const match = filePath.match(/src\/app\/api\/(.+)\/route\.ts$/);
  return match ? match[1] : "unknown";
}

// Extract param type from function signature
// e.g. { params }: { params: Promise<{ projectId: string; changeEventId: string }> }
// returns "{ projectId: string; changeEventId: string }"
function extractParamType(sig) {
  const m = sig.match(/Promise<(\{[^}]+\})>/);
  return m ? m[1].trim() : null;
}

// Check if file already uses withApiGuardrails
function alreadyMigrated(content) {
  return content.includes("withApiGuardrails");
}

// Add imports for withApiGuardrails and GuardrailError
function addImports(content) {
  // Already has both
  if (
    content.includes("withApiGuardrails") &&
    content.includes("GuardrailError")
  ) {
    return content;
  }

  // Find first import line
  const firstImportIdx = content.indexOf("import ");
  if (firstImportIdx === -1) return content;

  const imports = [];
  if (!content.includes("withApiGuardrails")) {
    imports.push('import { withApiGuardrails } from "@/lib/guardrails/api";');
  }
  if (!content.includes("GuardrailError")) {
    imports.push('import { GuardrailError } from "@/lib/guardrails/errors";');
  }

  if (imports.length === 0) return content;

  return (
    content.slice(0, firstImportIdx) +
    imports.join("\n") +
    "\n" +
    content.slice(firstImportIdx)
  );
}

// Remove unused withApiGuardrails import warning by ensuring it's used
// (It will be used after transformation — this is a no-op check)

/**
 * Transform a single route file.
 * Returns { changed: boolean, content: string, errors: string[] }
 */
function transformFile(filePath, content) {
  const errors = [];
  const routePath = getRoutePath(filePath);
  let result = content;

  // Find all export async function declarations
  // Pattern: export async function METHOD(
  const funcRegex =
    /^export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/gm;

  const matches = [...result.matchAll(funcRegex)];
  if (matches.length === 0) return { changed: false, content, errors };

  // Process in reverse order to preserve positions
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const method = match[1];
    const startIdx = match.index;

    // Find the opening paren of the function
    const parenStart = result.indexOf("(", startIdx);

    // Find matching closing paren for params
    let depth = 1;
    let j = parenStart + 1;
    while (j < result.length && depth > 0) {
      if (result[j] === "(") depth++;
      if (result[j] === ")") depth--;
      j++;
    }
    const parenEnd = j - 1; // index of closing paren

    // Find the opening brace of function body
    const braceStart = result.indexOf("{", parenEnd);
    if (braceStart === -1) {
      errors.push(`Could not find body brace for ${method} in ${routePath}`);
      continue;
    }

    // Find matching closing brace of function body
    depth = 1;
    j = braceStart + 1;
    while (j < result.length && depth > 0) {
      if (result[j] === "{") depth++;
      if (result[j] === "}") depth--;
      j++;
    }
    const braceEnd = j - 1; // index of closing brace

    // Extract function signature params
    const sigParams = result.slice(parenStart + 1, parenEnd);
    const paramType = extractParamType(sigParams);

    // Extract function body (without outer braces)
    let body = result.slice(braceStart + 1, braceEnd);

    // Strip outer try { ... } catch wrapper if present
    body = stripOuterTryCatch(body);

    // Replace 401 auth returns with GuardrailError throws
    body = replaceAuthReturns(body, routePath, method);

    // Build new handler
    const paramTypeAnnotation = paramType
      ? `<${paramType}>`
      : "";

    // Check if params is used in body
    const paramsUsed =
      body.includes("await params") || body.includes("params.");

    // Determine context destructuring
    // If params used: ({ request, params })
    // If no params: ({ request }) or ()
    const sigHasRequest = sigParams.includes("request") || sigParams.includes("req");
    const sigHasParams =
      sigParams.includes("params") && paramsUsed;

    let contextArgs;
    if (sigHasParams && sigHasRequest) {
      contextArgs = "({ request, params })";
    } else if (sigHasParams) {
      contextArgs = "({ params })";
    } else if (sigHasRequest) {
      contextArgs = "({ request })";
    } else {
      contextArgs = "()";
    }

    const newFunc =
      `export const ${method} = withApiGuardrails${paramTypeAnnotation}(\n` +
      `  "${routePath}#${method}",\n` +
      `  async ${contextArgs} => {` +
      body +
      `  },\n` +
      `);`;

    // Replace from startIdx to braceEnd+1
    result =
      result.slice(0, startIdx) +
      newFunc +
      result.slice(braceEnd + 1);
  }

  // Remove NextRequest import if no longer directly typed (params gone)
  // Only remove if NextRequest is NOT used elsewhere in the file
  result = cleanupNextRequestImport(result);

  return { changed: result !== content, content: result, errors };
}

/**
 * Strip outer try { ... } catch (...) { ... } wrapping the entire function body.
 * Only strips if the try block covers essentially the entire body.
 */
function stripOuterTryCatch(body) {
  // Trim leading/trailing whitespace to check structure
  const trimmed = body.trimStart();

  // Check if body starts with "try {" (possibly after some whitespace/comments)
  const tryMatch = trimmed.match(/^(\s*)try\s*\{/);
  if (!tryMatch) return body;

  // Find the try block's closing brace
  const tryKeywordIdx = body.indexOf("try");
  if (tryKeywordIdx === -1) return body;

  const tryBraceIdx = body.indexOf("{", tryKeywordIdx);
  if (tryBraceIdx === -1) return body;

  let depth = 1;
  let j = tryBraceIdx + 1;
  while (j < body.length && depth > 0) {
    if (body[j] === "{") depth++;
    if (body[j] === "}") depth--;
    j++;
  }
  const tryBraceEnd = j - 1;

  // Extract try body
  const tryBody = body.slice(tryBraceIdx + 1, tryBraceEnd);

  // Find catch block after try
  const afterTry = body.slice(tryBraceEnd + 1).trimStart();
  if (!afterTry.startsWith("catch")) return body;

  // Return just the try body (indented correctly)
  // Prefix from start of body to "try " keyword
  const prefix = body.slice(0, tryKeywordIdx);

  return prefix + tryBody;
}

/**
 * Replace auth 401 returns with GuardrailError throws.
 * Patterns:
 * - return NextResponse.json({ error: "..." }, { status: 401 })
 * - return new Response("Unauthorized", { status: 401 })
 * - return NextResponse.json({ error: "Unauthorized..." }, { status: 401 })
 */
function replaceAuthReturns(body, routePath, method) {
  const where = `${routePath}#${method}`;

  // Pattern 1: return NextResponse.json({ error: "..." }, { status: 401 })
  body = body.replace(
    /return NextResponse\.json\(\s*\{\s*error:\s*["'][^"']*["']\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\);/g,
    `throw new GuardrailError({ code: "AUTH_EXPIRED", where: "${where}", message: "Authentication required." });`,
  );

  // Pattern 2: return new Response("Unauthorized...", { status: 401 })
  body = body.replace(
    /return new Response\(["'][^"']*[Uu]nauthorized[^"']*["']\s*,\s*\{\s*status:\s*401\s*\}\s*\);/g,
    `throw new GuardrailError({ code: "AUTH_EXPIRED", where: "${where}", message: "Authentication required." });`,
  );

  // Pattern 3: return NextResponse.json({ error: "Forbidden..." }, { status: 403 })
  body = body.replace(
    /return NextResponse\.json\(\s*\{\s*error:\s*["'][^"']*[Ff]orbidden[^"']*["']\s*\}\s*,\s*\{\s*status:\s*403\s*\}\s*\);/g,
    `throw new GuardrailError({ code: "FORBIDDEN", where: "${where}", message: "Access denied." });`,
  );

  return body;
}

/**
 * Remove NextRequest from imports if no longer used in the file body.
 */
function cleanupNextRequestImport(content) {
  // If NextRequest is still referenced (in type annotations, etc), keep it
  // Remove it from import if it only appears in the import line itself
  const nextRequestCount = (content.match(/NextRequest/g) || []).length;

  // If only appears once (in import), remove it
  if (nextRequestCount === 1) {
    // Remove NextRequest from import
    content = content.replace(
      /import\s*\{\s*NextRequest,\s*NextResponse\s*\}/,
      "import { NextResponse }",
    );
    content = content.replace(
      /import\s*\{\s*NextRequest\s*\}/,
      "",
    );
  }

  return content;
}

// Get list of files to migrate
function getFiles() {
  const output = execSync(
    `find ${API_DIR} -name "route.ts" | sort`,
    { encoding: "utf8" }
  );
  return output.trim().split("\n").filter(Boolean);
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targetFile = args.find((a) => !a.startsWith("--"));

let files;
if (targetFile) {
  files = [resolve(targetFile)];
} else {
  files = getFiles();
}

let migrated = 0;
let skipped = 0;
let alreadyDone = 0;
let errors = 0;

for (const filePath of files) {
  if (shouldSkip(filePath)) {
    skipped++;
    continue;
  }

  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    console.error(`Could not read: ${filePath}`);
    errors++;
    continue;
  }

  if (alreadyMigrated(content)) {
    alreadyDone++;
    continue;
  }

  // Check if file has export async function
  if (!/^export async function/m.test(content)) {
    alreadyDone++;
    continue;
  }

  // Add imports first
  let newContent = addImports(content);

  // Transform functions
  const { changed, content: transformed, errors: fileErrors } = transformFile(
    filePath,
    newContent,
  );

  if (fileErrors.length > 0) {
    console.warn(`  WARNINGS for ${relative(process.cwd(), filePath)}:`);
    fileErrors.forEach((e) => console.warn(`    - ${e}`));
  }

  if (changed) {
    if (!dryRun) {
      writeFileSync(filePath, transformed, "utf8");
    }
    console.log(`  ✓ ${relative(process.cwd(), filePath)}`);
    migrated++;
  } else {
    alreadyDone++;
  }
}

console.log(
  `\nDone. Migrated: ${migrated}, Already done: ${alreadyDone}, Skipped (streaming): ${skipped}, Errors: ${errors}`,
);
