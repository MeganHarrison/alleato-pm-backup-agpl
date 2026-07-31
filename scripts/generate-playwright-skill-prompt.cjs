#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

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

function walkFiles(rootDir, fileList = []) {
  if (!fs.existsSync(rootDir)) return fileList;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function uniq(items) {
  return [...new Set(items)];
}

function normalizeToken(token) {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildToolTokens(tool) {
  const raw = tool.toLowerCase().trim();
  const variants = [raw, raw.replace(/-/g, "_"), raw.replace(/_/g, "-")];
  if (raw.endsWith("s")) variants.push(raw.slice(0, -1));
  return uniq(variants.flatMap((v) => [v, normalizeToken(v)]));
}

function pathMatchesTokens(filePath, tokens) {
  const lowerPath = filePath.toLowerCase();
  const normalizedPath = normalizeToken(lowerPath);
  return tokens.some((token) => {
    if (!token) return false;
    if (token.includes("-") || token.includes("_")) return lowerPath.includes(token);
    return normalizedPath.includes(token);
  });
}

function toBullets(paths) {
  if (paths.length === 0) return "- (none found)";
  return paths.map((p) => `- ${p}`).join("\n");
}

function selectPriorityFiles(prpDir) {
  const preferredOrder = [
    "forms",
    "ui",
    "prime-contracts-page",
    "tasks",
    "status",
    "plans",
    "api-endpoints",
    "schema",
    "sitemap",
  ];
  const files = walkFiles(prpDir).filter((f) => /\.(md|mdx)$/i.test(f));
  return files.sort((a, b) => {
    const aRank = preferredOrder.findIndex((key) => a.toLowerCase().includes(key));
    const bRank = preferredOrder.findIndex((key) => b.toLowerCase().includes(key));
    const ar = aRank === -1 ? preferredOrder.length : aRank;
    const br = bRank === -1 ? preferredOrder.length : bRank;
    return ar - br || a.localeCompare(b);
  });
}

function findToolFiles(baseDir, tokens, maxCount, extRegex) {
  const all = walkFiles(baseDir).filter((file) => extRegex.test(file));
  return all.filter((file) => pathMatchesTokens(file, tokens)).slice(0, maxCount);
}

function extractSelectorHints(testFiles) {
  const hints = [];
  const regex = /(data-testid=["'`][^"'`]+["'`]|getByTestId\(["'`][^"'`]+["'`]\))/g;
  for (const testFile of testFiles.slice(0, 12)) {
    const content = fs.readFileSync(testFile, "utf8");
    const matches = content.match(regex) || [];
    for (const match of matches.slice(0, 30)) hints.push(match);
  }
  return uniq(hints).slice(0, 16);
}

function buildFlowBullets(tool) {
  const label = tool.replace(/-/g, " ");
  return [
    `1) Navigate to /{projectId}/${tool} (or /{projectId}/${tool}/new for create-first flows).`,
    "2) Verify default state and required controls render.",
    "3) Trigger validation errors with empty/invalid submit and verify blocking behavior.",
    `4) Create a new ${label} record with unique timestamped values.`,
    "5) Verify key derived values/totals in UI when applicable.",
    "6) Submit and verify redirect to detail/list URL with created identifier.",
    "7) Verify persisted data from UI or API response payload where possible.",
    "8) Record any not-testable assertions with explicit reason and blocker."
  ].map((line) => `- ${line}`).join("\n");
}

function writeOutput(outputPath, content) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const tool = args.tool;
  if (!tool) {
    console.error("Missing required arg: --tool <tool-slug>");
    process.exit(1);
  }

  const baseUrl = args.baseUrl || "http://localhost:3000";
  const projectId = args.projectId || "67";
  const testFocus = args.focus || "CRUD, validation, and financial integrity checks";
  const prpDir = args.prp || path.join(cwd, "PRPs", tool);
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactDir =
    args.artifactDir ||
    path.join(cwd, "output", "playwright", `${tool}-workflow`, "runs", `{iso-timestamp}`);
  const outputPath =
    args.output ||
    path.join(cwd, "output", "playwright", "prompts", `${tool}-playwright-skill-prompt-${iso}.md`);

  const tokens = buildToolTokens(tool);
  const prpFiles = selectPriorityFiles(prpDir).slice(0, 10);
  const e2eTests = findToolFiles(
    path.join(cwd, "frontend", "tests"),
    tokens,
    12,
    /\.(spec|test)\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  );
  const artifacts = [
    ...findToolFiles(path.join(cwd, "docs"), tokens, 10, /\.(png|jpg|jpeg|webp|html|json|md)$/i),
    ...findToolFiles(path.join(cwd, "scripts", "screenshot-capture", "outputs"), tokens, 10, /\.(png|html|json|md)$/i),
    ...findToolFiles(path.join(cwd, "output"), tokens, 10, /\.(png|html|json|md)$/i),
  ].slice(0, 16);

  const referenceFiles = uniq([...prpFiles, ...e2eTests.slice(0, 8), ...artifacts.slice(0, 6)]);
  const selectorHints = extractSelectorHints(e2eTests);

  const templatePath = path.join(cwd, "scripts", "templates", "playwright-skill-prompt-template.md");
  const template = fs.readFileSync(templatePath, "utf8");
  const populated = template
    .replaceAll("{{TOOL_NAME}}", tool)
    .replaceAll("{{TEST_FOCUS}}", testFocus)
    .replaceAll("{{BASE_URL}}", baseUrl)
    .replaceAll("{{PROJECT_ID}}", projectId)
    .replaceAll("{{REFERENCE_CONTEXT_BULLETS}}", toBullets(referenceFiles))
    .replaceAll("{{TEST_FLOW_BULLETS}}", buildFlowBullets(tool))
    .replaceAll("{{SELECTOR_HINTS_BULLETS}}", toBullets(selectorHints))
    .replaceAll("{{ARTIFACT_DIR}}", artifactDir)
    .replaceAll("{{DATE_ISO}}", iso);

  writeOutput(outputPath, populated);

  const details = {
    tool,
    prpDir,
    references: referenceFiles.length,
    tests: e2eTests.length,
    artifacts: artifacts.length,
    outputPath,
  };
  console.log(JSON.stringify(details, null, 2));
}

main();
