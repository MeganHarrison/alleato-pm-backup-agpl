#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[key] = value;
    if (value !== "true") i += 1;
  }
  return args;
}

function getToolDirs(prpRoot) {
  if (!fs.existsSync(prpRoot)) return [];
  const skip = new Set(["_shared", "_archive", "template-structure", "agent"]);
  return fs
    .readdirSync(prpRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !skip.has(name))
    .filter((name) => {
      const dirPath = path.join(prpRoot, name);
      const files = fs.readdirSync(dirPath);
      return files.some((f) => /^index\.mdx?$/i.test(f)) || files.length > 0;
    })
    .sort();
}

function runGenerator(rootDir, options, tool) {
  const args = [path.join(rootDir, "scripts", "generate-playwright-skill-prompt.cjs"), "--tool", tool];
  if (options.projectId) args.push("--projectId", options.projectId);
  if (options.baseUrl) args.push("--baseUrl", options.baseUrl);
  if (options.focus) args.push("--focus", options.focus);

  const result = spawnSync("node", args, {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return {
      tool,
      ok: false,
      error: result.stderr || result.stdout || `exit ${result.status}`,
    };
  }

  try {
    const jsonStart = result.stdout.indexOf("{");
    const json = JSON.parse(result.stdout.slice(jsonStart));
    return { tool, ok: true, ...json };
  } catch {
    return { tool, ok: false, error: "Unable to parse generator output." };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const prpRoot = args.prpRoot || path.join(rootDir, "PRPs");
  const projectId = args.projectId || "67";
  const baseUrl = args.baseUrl || "http://localhost:3000";
  const focus = args.focus || "CRUD, validation, and financial integrity checks";

  const tools = args.tools
    ? args.tools.split(",").map((v) => v.trim()).filter(Boolean)
    : getToolDirs(prpRoot);

  if (tools.length === 0) {
    console.error("No PRP tool folders found.");
    process.exit(1);
  }

  const results = tools.map((tool) => runGenerator(rootDir, { projectId, baseUrl, focus }, tool));
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalTools: results.length,
    successCount: ok.length,
    failureCount: failed.length,
    tools: results,
  };

  const outDir = path.join(rootDir, "output", "playwright", "prompts");
  fs.mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(
    outDir,
    `manifest-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ manifestPath, total: results.length, success: ok.length, failed: failed.length }, null, 2));
  if (failed.length > 0) {
    failed.forEach((f) => console.error(`[${f.tool}] ${f.error}`));
    process.exit(2);
  }
}

main();
