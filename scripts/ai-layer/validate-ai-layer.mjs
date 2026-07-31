#!/usr/bin/env node
// AI-layer validation harness.
//
// Ported from the "AI Layer" reference implementation
// (coleam00/helpline, tooling/validate/validate_all.py) and adapted to this
// repo. It verifies that the AI layer ITSELF is wired correctly — hooks resolve
// to files that exist, no foreign machine paths have rotted into the config,
// .mcp.json parses, the reflection hook is wired and its recursion guard works,
// and every hook script compiles. This is the guardrail against AI-layer rot.
//
// Run: `npm run ai-layer:validate`  (or `node scripts/ai-layer/validate-ai-layer.mjs`)
// Exit code 0 only if there are no failures; 1 otherwise.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const results = [];
const record = (status, name, detail) => results.push({ status, name, detail });
const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";

function readJson(relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) return { ok: false, error: "missing" };
  try {
    return { ok: true, raw: readFileSync(abs, "utf8"), json: JSON.parse(readFileSync(abs, "utf8")) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const settings = readJson(".claude/settings.json");

// 1. settings.json parses.
if (settings.ok) record(PASS, "settings.json parses", ".claude/settings.json is valid JSON");
else record(FAIL, "settings.json parses", `.claude/settings.json — ${settings.error}`);

// Collect every hook command string.
const hookCommands = [];
if (settings.ok && settings.json.hooks) {
  for (const [event, groups] of Object.entries(settings.json.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        if (hook.command) hookCommands.push({ event, command: hook.command });
      }
    }
  }
}

// 2. No foreign machine paths inside executable hook commands (the Mac-path rot).
const foreignInHooks = hookCommands.filter((h) => /\/Users\/[^/]+\//.test(h.command));
if (foreignInHooks.length === 0) {
  record(PASS, "no foreign paths in hooks", "all hook commands are machine-portable");
} else {
  record(
    FAIL,
    "no foreign paths in hooks",
    `${foreignInHooks.length} hook command(s) reference /Users/*: ${foreignInHooks.map((h) => h.event).join(", ")}`,
  );
}

// 2b. Foreign paths anywhere else in settings (permissions etc.) — warn only.
if (settings.ok) {
  const foreignCount = (settings.raw.match(/\/Users\/[^/"]+\//g) || []).length;
  if (foreignCount === 0) record(PASS, "no stale paths in settings", "no /Users/* paths anywhere in settings.json");
  else record(WARN, "no stale paths in settings", `${foreignCount} /Users/* reference(s) remain (likely stale permission entries)`);
}

// 3. Every file/dir a hook command references actually exists.
function resolveTokens(command) {
  const found = new Set();
  // ${CLAUDE_PROJECT_DIR:-$PWD}/rel/path  and  $PWD/rel/path
  const varRe = /\$\{?CLAUDE_PROJECT_DIR[^}]*\}?\/([A-Za-z0-9._/\-\[\]]+)/g;
  const pwdRe = /\$PWD\/([A-Za-z0-9._/\-\[\]]+)/g;
  const absRe = /(?:^|["'\s=])(\/(?:home|Users|opt|etc)\/[A-Za-z0-9._/\-\[\]]+)/g;
  const dirFlagRe = /--directory\s+(\S+)/g;
  let m;
  while ((m = varRe.exec(command))) found.add(join(repoRoot, m[1].replace(/["'].*$/, "")));
  while ((m = pwdRe.exec(command))) found.add(join(repoRoot, m[1].replace(/["'].*$/, "")));
  while ((m = absRe.exec(command))) found.add(m[1].replace(/["'].*$/, ""));
  while ((m = dirFlagRe.exec(command))) {
    const d = m[1].replace(/\$\{?CLAUDE_PROJECT_DIR[^}]*\}?/, repoRoot).replace(/\$PWD/, repoRoot);
    found.add(d);
  }
  // Only keep things that look like a real path (have an extension or a slash segment).
  return [...found].filter((p) => /\.(mjs|js|py|md|json|cjs|ts)$/.test(p) || /claude-memory-compiler/.test(p));
}

const missingRefs = [];
for (const { event, command } of hookCommands) {
  for (const path of resolveTokens(command)) {
    // Skip references already guarded by `[ -f ... ]` (intentionally optional).
    const guarded = command.includes("[ -f") || command.includes("&& cat") || command.includes("]");
    if (!existsSync(path)) missingRefs.push({ event, path, guarded });
  }
}
const hardMissing = missingRefs.filter((r) => !r.guarded);
if (hardMissing.length === 0) {
  record(PASS, "hook file references resolve", `${hookCommands.length} hook command(s) checked, all required paths exist`);
} else {
  record(
    FAIL,
    "hook file references resolve",
    hardMissing.map((r) => `[${r.event}] missing ${r.path}`).join("; "),
  );
}
if (missingRefs.some((r) => r.guarded)) {
  const g = missingRefs.filter((r) => r.guarded);
  record(WARN, "optional hook references", `${g.length} guarded reference(s) point at missing files: ${g.map((r) => r.path).join(", ")}`);
}

// 4. .mcp.json parses.
const mcp = readJson(".mcp.json");
if (mcp.ok) record(PASS, ".mcp.json parses", `${Object.keys(mcp.json.mcpServers || {}).length} MCP server(s) declared`);
else record(mcp.error === "missing" ? WARN : FAIL, ".mcp.json parses", `.mcp.json — ${mcp.error}`);

// 5. CLAUDE.md + gate rules present.
record(existsSync(join(repoRoot, "CLAUDE.md")) ? PASS : FAIL, "CLAUDE.md present", "repo-root CLAUDE.md");
const expectedGates = ["DEBUGGING-GATE.md", "DESIGN-SYSTEM-GATE.md", "RESPONSE-FORMAT-CONTRACT.md"];
const missingGates = expectedGates.filter((g) => !existsSync(join(repoRoot, ".claude", "rules", g)));
record(missingGates.length === 0 ? PASS : FAIL, "gate rules present", missingGates.length ? `missing: ${missingGates.join(", ")}` : `${expectedGates.length} core gates found`);

// 6. Reflection hook wired + compiles.
const reflectPath = join(repoRoot, "scripts", "hooks", "reflect-claude-md.mjs");
const stopWired = settings.ok && Boolean(settings.json.hooks?.Stop) && JSON.stringify(settings.json.hooks.Stop).includes("reflect-claude-md");
if (!existsSync(reflectPath)) {
  record(FAIL, "reflection hook wired", "scripts/hooks/reflect-claude-md.mjs missing");
} else if (!stopWired) {
  record(FAIL, "reflection hook wired", "reflect-claude-md.mjs exists but no Stop hook references it in settings.json");
} else {
  try {
    execFileSync("node", ["--check", reflectPath], { cwd: repoRoot });
    record(PASS, "reflection hook wired", "Stop hook → reflect-claude-md.mjs, compiles clean");
  } catch (err) {
    record(FAIL, "reflection hook wired", `syntax error: ${err.message}`);
  }
}

// 7. Reflection recursion guard works (lock → fast no-op, no review written).
if (existsSync(reflectPath)) {
  const before = existsSync(join(repoRoot, ".claude", "claude-md-review.md"))
    ? statSync(join(repoRoot, ".claude", "claude-md-review.md")).mtimeMs
    : 0;
  try {
    execFileSync("node", [reflectPath], {
      cwd: repoRoot,
      env: { ...process.env, ALLEATO_REFLECT_LOCK: "1" },
      timeout: 10_000,
    });
    const after = existsSync(join(repoRoot, ".claude", "claude-md-review.md"))
      ? statSync(join(repoRoot, ".claude", "claude-md-review.md")).mtimeMs
      : 0;
    record(after === before ? PASS : FAIL, "reflection recursion guard", after === before ? "lock set → no-op, no review written" : "lock set but review file changed");
  } catch (err) {
    record(FAIL, "reflection recursion guard", `guarded run failed: ${err.message}`);
  }
}

// 8. Every hook script compiles.
function listFiles(dir, exts) {
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return [];
  try {
    return execFileSync("ls", ["-1", abs], { encoding: "utf8" })
      .split("\n")
      .filter((n) => exts.some((e) => n.endsWith(e)))
      .map((n) => join(abs, n));
  } catch {
    return [];
  }
}
const mjsHooks = [...listFiles("scripts/hooks", [".mjs", ".js", ".cjs"])];
const pyHooks = [...listFiles(".claude/hooks", [".py"]), ...listFiles("scripts/hooks", [".py"])];
let compileFails = [];
for (const f of mjsHooks) {
  try {
    execFileSync("node", ["--check", f]);
  } catch {
    compileFails.push(f);
  }
}
for (const f of pyHooks) {
  try {
    execFileSync("python3", ["-m", "py_compile", f]);
  } catch {
    compileFails.push(f);
  }
}
record(
  compileFails.length === 0 ? PASS : FAIL,
  "hook scripts compile",
  compileFails.length ? `failed: ${compileFails.join(", ")}` : `${mjsHooks.length + pyHooks.length} hook script(s) compile clean`,
);

// 9. .claudeignore present.
record(existsSync(join(repoRoot, ".claudeignore")) ? PASS : WARN, ".claudeignore present", ".claudeignore scopes agent search");

// 10. Subagents present.
const agentCount = listFiles(".claude/agents", [".md"]).length;
record(agentCount > 0 ? PASS : WARN, "subagents present", `${agentCount} subagent definition(s) in .claude/agents`);

// ---- Report ----
const counts = { PASS: 0, WARN: 0, FAIL: 0 };
for (const r of results) counts[r.status]++;

const icon = (s) => (s === PASS ? "✅" : s === WARN ? "⚠️ " : "❌");
console.log("\nAI-layer validation\n===================");
for (const r of results) console.log(`${icon(r.status)} [${r.status}] ${r.name} — ${r.detail}`);
console.log(`\n${counts.PASS} passed · ${counts.WARN} warnings · ${counts.FAIL} failed`);

const md = [
  `# AI-layer validation — ${new Date().toISOString()}`,
  "",
  "| Status | Check | Detail |",
  "|--------|-------|--------|",
  ...results.map((r) => `| ${r.status} | ${r.name} | ${r.detail.replace(/\|/g, "\\|")} |`),
  "",
  `**${counts.PASS} passed · ${counts.WARN} warnings · ${counts.FAIL} failed**`,
  "",
].join("\n");
writeFileSync(join(repoRoot, ".claude", "ai-layer-validation.md"), md, "utf8");

process.exit(counts.FAIL > 0 ? 1 : 0);
