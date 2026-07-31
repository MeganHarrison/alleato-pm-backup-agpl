#!/usr/bin/env node
/**
 * Builds the self-contained AI showcase page.
 *
 * The published artifact must be ONE file with no external requests (the
 * artifact CSP blocks CDNs), so the GSAP bundle is inlined at build time from
 * node_modules rather than linked. Edit the body source, then re-run this.
 *
 *   node scripts/visuals/build-ai-showcase.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = resolve(root, "docs/ops/visuals/src/ai-showcase.body.html");

// The built page is a served asset, so it belongs in public/. `.html` is NOT in
// the middleware bypass matcher in `frontend/src/middleware.ts`, so this URL sits
// behind the app's auth — same as the existing alleato-ai-vision.html.
const OUT = resolve(root, "frontend/public/ai-showcase.html");
const MARKER = "<!--GSAP_BUNDLE-->";
const FONT_MARKER = "<!--FONT_FACE-->";

/**
 * Inter is the app's body face (DESIGN.md) and is SIL OFL, so it can be
 * embedded. It is inlined as a data URI because the artifact CSP blocks font
 * CDNs — a linked webfont would silently fall back.
 *
 * The brand display face (tungsten) is a LICENSED font and is deliberately NOT
 * embedded; the stylesheet lists it first so it renders wherever it is properly
 * installed, and falls back to a condensed stack elsewhere.
 */
const INTER_VARIABLE = "e4af272ccee01ff0-s.p.woff2"; // Inter var, latin subset, wght 100-900

/**
 * next/font writes hashed font files into whichever build dir is active, and the
 * dev server suffixes that dir with its port. Discover them instead of pinning a
 * path, so this does not silently fall back on another machine.
 */
function fontDirs() {
  const fe = resolve(root, "frontend");
  if (!existsSync(fe)) return [];
  return readdirSync(fe)
    .filter((d) => d === ".next" || d.startsWith(".next-dev"))
    .map((d) => resolve(fe, d, "static/media"))
    .filter(existsSync);
}

function interFace() {
  for (const dir of fontDirs()) {
    const file = resolve(dir, INTER_VARIABLE);
    if (!existsSync(file)) continue;
    const b64 = readFileSync(file).toString("base64");
    return `<style>
@font-face {
  font-family: "InterVar";
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url(data:font/woff2;base64,${b64}) format("woff2");
}
</style>`;
  }
  console.warn("⚠ Inter woff2 not found — the page will fall back to the system sans stack.");
  return "";
}

// Order matters: core first, then plugins.
const PLUGINS = ["gsap", "ScrollTrigger", "CustomEase", "SplitText", "DrawSVGPlugin"];

const CANDIDATE_DIRS = [
  "frontend/node_modules/gsap/dist",
  "frontend/node_modules/.pnpm/gsap@3.15.0/node_modules/gsap/dist",
  "node_modules/gsap/dist",
];

function gsapDir() {
  for (const d of CANDIDATE_DIRS) {
    const abs = resolve(root, d);
    if (existsSync(resolve(abs, "gsap.min.js"))) return abs;
  }
  throw new Error(
    `GSAP not found. Looked in:\n  ${CANDIDATE_DIRS.join("\n  ")}\n` +
      `Run \`pnpm install\` in frontend/, or add the correct path to CANDIDATE_DIRS.`
  );
}

/**
 * Compile-only syntax check. A truncated or concurrently-rewritten file in
 * node_modules must fail the build loudly, not ship a page whose scripts throw
 * at parse time (which is silent — the browser just skips the tag).
 */
function assertParses(code, label) {
  try {
    new Script(code, { filename: label });
  } catch (err) {
    throw new Error(`${label} is not valid JavaScript (${err.message}).\n` +
      `node_modules may have been rewritten mid-build — re-run \`pnpm install\` in frontend/ and try again.`);
  }
}

/** `</` inside inlined JS would end the <script> tag early. Escaping it is a no-op for the JS. */
const shield = (code) => code.replace(/<\/(?=[a-zA-Z!/])/g, "<\\/");

const dir = gsapDir();
const bundle = PLUGINS.map((name) => {
  const file = resolve(dir, `${name}.min.js`);
  if (!existsSync(file)) throw new Error(`Missing GSAP file: ${file}`);
  const code = readFileSync(file, "utf8");
  assertParses(code, `${name}.min.js`);
  return `<script>${shield(code)}</script>`;
}).join("\n");

const src = readFileSync(SRC, "utf8");
if (!src.includes(MARKER)) throw new Error(`Source is missing the ${MARKER} marker.`);

// A replacer FUNCTION is required here. Passing the bundle as a replacement
// string makes String.replace interpret `$&`, `$'`, "$`" and `$1`-`$9` inside
// it — and minified GSAP is full of `$`, which silently corrupts the output.
let out = src.replace(MARKER, () => bundle);
if (out.includes(FONT_MARKER)) out = out.replace(FONT_MARKER, () => interFace());

// Re-extract every script block from the finished page and prove each one parses.
const blocks = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (blocks.length !== PLUGINS.length + 1) {
  throw new Error(`Expected ${PLUGINS.length + 1} script blocks in the output, found ${blocks.length}.`);
}
blocks.forEach((b, i) => assertParses(b, `output block ${i} (${PLUGINS[i] ?? "page script"})`));

writeFileSync(OUT, out, "utf8");

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`✓ ${OUT}`);
console.log(`  GSAP from ${dir.replace(root + "/", "")}`);
console.log(`  bundle ${kb(bundle.length)} · page ${kb(out.length)}`);
