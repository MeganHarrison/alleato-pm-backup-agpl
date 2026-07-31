#!/usr/bin/env node
/**
 * Repo-control guardrail.
 *
 * This does two things:
 * 1. Fails on tracked top-level paths that are not classified in the repo
 *    control map.
 * 2. Reports existing artifact debt and blocks retired Liveblocks paths so
 *    agents do not mistake those paths for live product code.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const strict = process.argv.includes("--strict");
const liveblocksOnly = process.argv.includes("--liveblocks-only");

const TOP_LEVEL_CLASSIFICATIONS = new Map([
  [".agents", "agent tooling"],
  [".claude", "agent tooling"],
  [".codex", "agent tooling"],
  [".coderabbit.yaml", "repo config"],
  [".dockerignore", "repo config"],
  [".env.example", "repo config"],
  [".eslintignore", "repo config"],
  [".extract-design-system", "generated artifact"],
  [".gemini", "agent tooling"],
  [".gitattributes", "repo config"],
  [".github", "repo config"],
  [".gitignore", "repo config"],
  [".husky", "repo config"],
  [".impeccable", "agent/design tooling"],
  [".lintstagedrc.js", "repo config"],
  [".markdownlint-cli2.jsonc", "repo config"],
  [".mcp.json", "agent tooling"],
  [".playwright-mcp", "test/tooling config"],
  [".snaplet", "database seed tooling"],
  [".superdesign", "agent/design tooling"],
  [".superpowers", "agent tooling"],
  [".vercelignore", "deployment config"],
  [".vscode", "editor config"],
  ["AGENTS.md", "agent instructions"],
  ["CLAUDE.md", "agent instructions"],
  ["CONTRIBUTING.md", "repo documentation"],
  ["CONTEXT.md", "domain glossary / architecture vocabulary"],
  ["CONTEXT-MAP.md", "repo documentation"],
  ["DESIGN.md", "design documentation"],
  ["PRODUCT.md", "product documentation"],
  ["README.md", "repo documentation"],
  ["WORKING_CONTEXT.md", "repo documentation"],
  ["_bmad", "agent tooling"],
  ["agents", "agent tooling"],
  ["ai-icon.png", "asset"],
  ["backend", "live product runtime"],
  ["claude-memory-compiler-main", "active agent hook dependency"],
  ["design-system", "generated artifact"],
  ["docs", "documentation/control plane"],
  ["docs-site", "external documentation workspace link"],
  ["frontend", "live product runtime"],
  ["infrastructure", "deployment infrastructure"],
  ["logs", "local/generated output"],
  ["node_modules", "dependency install output"],
  ["package-lock.json", "package manager lockfile"],
  ["package.json", "package manifest"],
  ["pnpm-lock.yaml", "package manager lockfile"],
  ["pnpm-workspace.yaml", "package workspace config"],
  ["project-intelligence", "live intelligence runtime"],
  ["render.yaml", "deployment config"],
  ["scripts", "live operational tooling"],
  ["sitemap-grouped.png", "generated visual artifact"],
  ["skills", "agent tooling"],
  ["skills-lock.json", "agent tooling lockfile"],
  ["supabase", "database control plane"],
  ["teams-app", "live integration surface"],
  ["tests", "verification source/evidence"],
  ["tmp", "local/generated output"],
]);

const ARTIFACT_ROOTS = [
  {
    path: "verify-output",
    canonical:
      "local/generated verification output; enforce retention or move outside repo",
    failIfPresent: true,
  },
  {
    path: "tests/agent-browser-runs",
    canonical: "canonical browser evidence sink; keep recent runs only",
  },
  {
    path: "frontend/tests/agent-browser-runs",
    canonical: "duplicate browser evidence sink; stop writing here",
    failIfPresent: true,
  },
  {
    path: "frontend/e2e-screenshots",
    canonical: "legacy screenshot sink; migrate/delete after evidence review",
    failIfPresent: true,
  },
  {
    path: "frontend/tests/e2e-screenshots",
    canonical: "legacy screenshot sink; migrate/delete after evidence review",
    failIfPresent: true,
  },
  {
    path: "frontend/tests/screenshots",
    canonical: "legacy screenshot sink; tracked files currently exist",
    failIfPresent: true,
  },
  {
    path: "e2e-screenshots",
    canonical: "empty legacy screenshot sink; safe delete if still empty",
    failIfPresent: true,
  },
  {
    path: ".extract-design-system",
    canonical: "generated design extraction output",
    failIfPresent: true,
  },
  {
    path: "design-system",
    canonical: "generated starter token output",
    failIfPresent: true,
  },
  {
    path: "docs/index",
    canonical:
      "retired generated docs index; use docs/alleato-os-docs navigation and docs/README.md",
    failIfPresent: true,
  },
  {
    path: "docs/pages-directory.md",
    canonical:
      "retired generated page inventory; use docs/architecture/PROJECT-MAP.md or docs-site reference/routes",
    failIfPresent: true,
  },
  {
    path: "docs/infographic.png",
    canonical:
      "loose docs image artifact; keep only docs-site images that are linked from pages",
    failIfPresent: true,
  },
  {
    path: "docs/infographic2.png",
    canonical:
      "loose docs image artifact; keep only docs-site images that are linked from pages",
    failIfPresent: true,
  },
  {
    path: "docs/alleato-os-docs/index",
    canonical: "retired docs-site copy of the old generated index",
    failIfPresent: true,
  },
  {
    path: "scripts/adversarial-harness/workspace",
    canonical: "local adversarial-harness runtime workspace",
    failIfPresent: true,
  },
  {
    path: "scripts/adversarial-harness/node_modules",
    canonical: "local sandbox dependencies; reinstall when needed",
    failIfPresent: true,
  },
  {
    path: "scripts/mcp-servers/procore-knowledge/node_modules",
    canonical: "local MCP server dependencies; reinstall when needed",
    failIfPresent: true,
  },
  {
    path: "scripts/playwright-crawl/node_modules",
    canonical: "local crawl toolkit dependencies; reinstall when needed",
    failIfPresent: true,
  },
  {
    path: "scripts/__pycache__",
    canonical: "Python runtime cache",
    failIfPresent: true,
  },
  {
    path: "scripts/ingestion/__pycache__",
    canonical: "Python runtime cache",
    failIfPresent: true,
  },
  {
    path: "scripts/verify/__pycache__",
    canonical: "Python runtime cache",
    failIfPresent: true,
  },
  {
    path: "scripts/change-events-crawl/html",
    canonical: "retired crawl HTML evidence; use tmp/evidence if retained",
    failIfPresent: true,
  },
  {
    path: "scripts/change-events-crawl/screenshots",
    canonical: "retired crawl screenshots; use tmp/evidence if retained",
    failIfPresent: true,
  },
  {
    path: "scripts/change-events-crawl/crawl-report.md",
    canonical: "retired crawl report; use tmp/evidence if retained",
    failIfPresent: true,
  },
  {
    path: "scripts/playwright-crawl/outputs",
    canonical: "runtime crawl output; do not store under scripts",
    failIfPresent: true,
  },
  {
    path: "scripts/visual-audit/output",
    canonical: "runtime visual audit output; do not store under scripts",
    failIfPresent: true,
  },
  {
    path: "scripts/apply-budget-migration.mjs",
    canonical:
      "deleted unsafe/stale root migration helper; use supabase migrations and npm run db:push",
    failIfPresent: true,
  },
  {
    path: "scripts/apply-migration-pg.js",
    canonical:
      "deleted stale root migration helper; use supabase migrations and npm run db:push",
    failIfPresent: true,
  },
  {
    path: "scripts/apply-migration.js",
    canonical:
      "deleted stale root migration helper; use supabase migrations and npm run db:push",
    failIfPresent: true,
  },
  {
    path: "scripts/apply-permissions-fix.js",
    canonical:
      "deleted stale root permissions helper; use migrations or maintained ops scripts",
    failIfPresent: true,
  },
  {
    path: "scripts/apply-permissions-fix.mjs",
    canonical:
      "deleted stale root permissions helper; use migrations or maintained ops scripts",
    failIfPresent: true,
  },
  {
    path: "scripts/apply-storage-rls-migration.sh",
    canonical:
      "deleted stale root storage RLS helper; use supabase migrations and npm run db:push",
    failIfPresent: true,
  },
  {
    path: "scripts/create-drawing-tables.js",
    canonical:
      "deleted unsafe/stale drawing table helper; use supabase migrations",
    failIfPresent: true,
  },
  {
    path: "scripts/fix-mcp-and-create-tables.js",
    canonical:
      "deleted unsafe/stale drawing table helper; use supabase migrations",
    failIfPresent: true,
  },
  {
    path: "scripts/misc/check-tables.ts",
    canonical:
      "deleted unsafe hardcoded service-role table checker; use maintained env-backed database audits",
    failIfPresent: true,
  },
];

const ARCHIVED_DOCS_TOP_LEVEL_ROOTS = [
  ".archive",
  "PRPs",
  "alleato-templates",
  "api",
  "asrs",
  "briefs",
  "caching",
  "change-order-process",
  "codebase-map",
  "codex",
  "context",
  "deployment",
  "development",
  "documentation",
  "engineering",
  "features",
  "help",
  "implementation-workflow",
  "integrations",
  "issues",
  "memories",
  "onboarding",
  "permissions",
  "procore-reference",
  "project-overview",
  "projects",
  "scheduling",
  "scratch-notes",
  "typescript-errors",
];

for (const root of ARCHIVED_DOCS_TOP_LEVEL_ROOTS) {
  ARTIFACT_ROOTS.push({
    path: `docs/${root}`,
    canonical: "external historical-doc storage; do not retain an in-repository archive copy",
    failIfPresent: true,
  });
}

const LIVEBLOCKS_ROOTS = [
  "frontend/src/app/api/liveblocks",
  "frontend/src/app/api/liveblocks-auth",
  "frontend/src/lib/liveblocks",
  "frontend/src/components/providers/liveblocks-app-provider.tsx",
  "frontend/liveblocks.config.ts",
  "frontend/liveblocks-otp.mjs",
  "tools/liveblocks-mcp-server",
];

const LIVEBLOCKS_ACTIVE_PATH_PREFIXES = [
  "frontend/src/",
  "frontend/scripts/",
  "frontend/next.config.ts",
  "frontend/package.json",
  "frontend/pnpm-lock.yaml",
  "tests/",
  "tools/",
];

const LIVEBLOCKS_RUNTIME_PATTERN =
  /@liveblocks\/|LiveblocksProvider|LIVEBLOCKS_[A-Z_]+|\/api\/liveblocks(?:\/|\b)|\.lb-(?:composer|thread|floating|inbox)/;

const FORBIDDEN_SCRIPT_SECRET_PATTERNS = [
  {
    label: "Supabase JWT literal",
    pattern:
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*InJvbGUiOiJ(?:zZXJ2aWNlX3JvbGUi|hbm9u)I[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/,
  },
  {
    label: "Supabase sb_secret literal",
    pattern: /sb_secret_[A-Za-z0-9_-]+/,
  },
];

// Public docs are owned by The-Alleato-Group/alleato-docs-site. This product
// repository deliberately does not retain a competing in-repo docs-site copy.
const DOCS_SITE_REQUIRED = [];

const SCRIPT_ROOT_FILES = new Map([
  [".mcp.json", "config"],
  ["README.md", "config"],
  ["ROOT-SCRIPTS.md", "config"],
  ["api-smoke-contracts.mjs", "package-owned"],
  ["api-smoke-test-cron.sh", "live-operator"],
  ["api-smoke-test.sh", "live-operator"],
  ["audit-council-data-coverage.ts", "live-operator"],
  ["audit-pattern-c-attachments.mjs", "live-operator"],
  ["audit-toast-surface.mjs", "package-owned"],
  ["backfill-brandon-tasks.mjs", "package-owned"],
  ["backfill-fireflies-transcript-chunks-from-storage.mjs", "package-owned"],
  ["backfill-recent-meeting-chunks.mjs", "package-owned"],
  ["build-playwright-dashboard.cjs", "package-owned"],
  ["cache-example.ts", "reference"],
  ["cache-monitor.ts", "package-owned"],
  ["capture-app-page-screenshots.mjs", "live verification tooling"],
  ["check-changed-route-guardrails.mjs", "package-owned"],
  ["check-db-types-current.mjs", "package-owned"],
  ["check-design-system.sh", "live-guardrail"],
  ["check-estimate-template-contract.mjs", "package-owned"],
  ["check-no-module-level-server-init.mjs", "live-guardrail"],
  ["check-no-new-any.mjs", "live-guardrail"],
  ["check-no-new-unsafe-patterns.mjs", "live-guardrail"],
  ["check-route-conflicts.sh", "package-owned"],
  ["check-server-prerender-safety.mjs", "live-guardrail"],
  ["check-zod-coverage.mjs", "live-guardrail"],
  ["claude-cache-helper.ts", "live-operator"],
  ["crawl-procore-docs.py", "live-operator"],
  ["crawl-procore-support-docs.mjs", "live-operator"],
  ["db-push.sh", "migration-helper"],
  ["design-review-financial.ts", "live-operator"],
  ["design-token-codemod.js", "live-operator"],
  ["fix-md040.mjs", "live-operator"],
  ["fix-teams-attribution.py", "backfill-helper"],
  ["generate-daily-brief.mts", "live-operator"],
  ["generate-db-types.mjs", "package-owned"],
  ["generate-playwright-skill-prompt.cjs", "package-owned"],
  ["generate-playwright-skill-prompts-batch.cjs", "package-owned"],
  ["guardrail-route-debt-baseline.txt", "reference"],
  ["init.sh", "live-operator"],
  ["inspect-acumatica-invoice.mjs", "live-operator"],
  ["inspect-acumatica-vendor.mjs", "live-operator"],
  ["migrate-to-guardrails.mjs", "live-operator"],
  ["noblesville-company-lookup.txt", "reference"],
  ["package.json", "config"],
  ["parity-audit.mjs", "live-guardrail"],
  ["postdeploy-verify.sh", "package-owned"],
  ["predeploy-quality-gate.sh", "package-owned"],
  ["procore-docs-query.js", "live-operator"],
  ["project-acumatica-change-orders.py", "live-operator"],
  ["project-acumatica-commitments.py", "live-operator"],
  ["run-ap-sync.mjs", "live-operator"],
  ["run-enrichment.mjs", "live-operator"],
  ["send-teams-proactive.mjs", "live-operator"],
  ["set-admin.mjs", "live-operator"],
  ["sync-acumatica-invoices.mjs", "live-operator"],
  ["sync-acumatica-payments.mjs", "live-operator"],
  ["sync-acumatica-vendors.mjs", "live-operator"],
  ["validate-markdown-location.cjs", "live-guardrail"],
  ["validate-runtime-config.mjs", "package-owned"],
  ["verify-api-routes.sh", "live-guardrail"],
  ["verify-cache-setup.ts", "package-owned"],
  ["verify-phase1-fixes.sh", "live-guardrail"],
  ["wait-for-http.js", "live-operator"],
]);

const SCRIPT_CONTROL_REQUIRED = [
  "scripts/README.md",
  "scripts/ROOT-SCRIPTS.md",
];

const SCRIPT_CATEGORY_CLASSIFICATIONS = new Map([
  ["__tests__", "script tests"],
  ["adversarial-harness", "tool sandbox"],
  ["agent-browser", "live verification tooling"],
  ["acumatica", "live ERP integration tooling"],
  ["ai", "live AI tooling"],
  ["architecture", "architecture tooling"],
  ["asrs", "live ASRS tooling"],
  ["archive", "archived script helpers"],
  ["audits", "live guardrails/audits"],
  ["build", "live build helpers"],
  ["changelog", "release documentation tooling"],
  ["change-events-crawl", "legacy crawl toolkit"],
  ["cli", "live operator CLI helpers"],
  ["codemods", "live code transformation tooling"],
  ["data", "reference data"],
  ["database", "live database tooling"],
  ["db", "live database verification"],
  ["dev", "live local dev startup"],
  ["dev-bridge", "tool sandbox"],
  ["dev-tools", "live generated inventory tooling"],
  ["docs", "live docs generation/validation"],
  ["design-benchmark", "design verification tooling"],
  ["examples", "reference examples"],
  ["feature-tracker", "historical tracker/tool sandbox"],
  ["ingestion", "live RAG/source ingestion helpers"],
  ["jobplanner", "import/reconcile helpers"],
  ["hooks", "repository hook tooling"],
  ["knowledge", "live knowledge tooling"],
  ["langfuse", "live eval dataset tooling"],
  ["lint-staged", "live lint-staged helpers"],
  ["mcp-servers", "local MCP tooling"],
  ["misc", "legacy miscellaneous scripts"],
  ["monitoring", "legacy monitoring helpers"],
  ["ops", "live operational commands"],
  ["repair", "repair tooling"],
  ["perf", "live performance checks"],
  ["playwright-crawl", "Procore crawl toolkit"],
  ["seed-db", "live seed/fixture tooling"],
  ["templates", "live reusable templates"],
  ["testing", "test support"],
  ["tutorials", "tutorial tooling"],
  ["verification", "verification tooling"],
  ["verify", "live verification scripts"],
  ["visual-audit", "visual audit toolkit"],
]);

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

function trackedFiles() {
  return git(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .filter((file) => existsSync(join(REPO_ROOT, file)));
}

function trackedCountUnder(prefix, files) {
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return files.filter((file) => file === prefix || file.startsWith(normalized))
    .length;
}

function fileCountUnder(relativePath) {
  const absolute = join(REPO_ROOT, relativePath);
  if (!existsSync(absolute)) return 0;
  let count = 0;
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = statSync(current);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      count += 1;
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const entry of readdirSync(current)) {
      stack.push(join(current, entry));
    }
  }
  return count;
}

function topLevel(file) {
  const slash = file.indexOf("/");
  return slash === -1 ? file : file.slice(0, slash);
}

const files = trackedFiles();
const trackedTopLevels = Array.from(new Set(files.map(topLevel))).sort();
const unknownTopLevels = trackedTopLevels.filter(
  (name) => !TOP_LEVEL_CLASSIFICATIONS.has(name),
);
const trackedScriptCategories = Array.from(
  new Set(
    files
      .filter((file) => file.startsWith("scripts/"))
      .map((file) => file.split("/"))
      .filter((parts) => parts.length >= 3)
      .map((parts) => parts[1]),
  ),
).sort();
const unknownScriptCategories = trackedScriptCategories.filter(
  (category) => !SCRIPT_CATEGORY_CLASSIFICATIONS.has(category),
);
const trackedScriptRootFiles = files
  .filter((file) => file.startsWith("scripts/"))
  .map((file) => file.split("/"))
  .filter((parts) => parts.length === 2)
  .map((parts) => parts[1])
  .sort();
const unknownScriptRootFiles = trackedScriptRootFiles.filter(
  (file) => !SCRIPT_ROOT_FILES.has(file),
);
const missingDocsSiteFiles = DOCS_SITE_REQUIRED.filter(
  (file) => !existsSync(join(REPO_ROOT, file)),
);
const missingScriptControlFiles = SCRIPT_CONTROL_REQUIRED.filter(
  (file) => !existsSync(join(REPO_ROOT, file)),
);

const artifactDebt = ARTIFACT_ROOTS.map((root) => ({
  ...root,
  tracked: trackedCountUnder(root.path, files),
  files: fileCountUnder(root.path),
})).filter((root) => root.tracked > 0 || root.files > 0);
const forbiddenArtifactDebt = artifactDebt.filter((root) => root.failIfPresent);

const liveblocksFiles = files.filter((file) => {
  if (!existsSync(join(REPO_ROOT, file))) return false;
  const isActivePath = LIVEBLOCKS_ACTIVE_PATH_PREFIXES.some(
    (prefix) => file === prefix || file.startsWith(prefix),
  );
  return (
    (isActivePath && file.toLowerCase().includes("liveblocks")) ||
    LIVEBLOCKS_ROOTS.some(
      (root) => file === root || file.startsWith(`${root}/`),
    )
  );
});

const liveblocksReferences = files
  .filter((file) =>
    LIVEBLOCKS_ACTIVE_PATH_PREFIXES.some(
      (prefix) => file === prefix || file.startsWith(prefix),
    ),
  )
  .filter((file) => existsSync(join(REPO_ROOT, file)))
  .filter((file) => {
    try {
      return LIVEBLOCKS_RUNTIME_PATTERN.test(
        readFileSync(join(REPO_ROOT, file), "utf8"),
      );
    } catch {
      return false;
    }
  });

const packageJson = existsSync(join(REPO_ROOT, "frontend/package.json"))
  ? execFileSync(
      "node",
      [
        "-e",
        "const p=require('./frontend/package.json'); console.log(Object.keys({...p.dependencies,...p.devDependencies}).filter(k=>k.startsWith('@liveblocks/')).join('\\n'))",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
  : [];

if (liveblocksOnly) {
  const findings = [
    ...liveblocksFiles,
    ...liveblocksReferences,
    ...packageJson.map((dependency) => `frontend/package.json:${dependency}`),
  ];

  if (findings.length > 0) {
    console.error("ERROR: Liveblocks is retired from the live codebase.");
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }

  console.log(
    "repo-control: Liveblocks runtime, route, config, and dependency guard passed",
  );
  process.exit(0);
}

const scriptSecretFindings = files
  .filter((file) => file.startsWith("scripts/"))
  .filter((file) => file !== "scripts/audits/check-repo-control.mjs")
  .flatMap((file) => {
    const absolute = join(REPO_ROOT, file);
    let content = "";
    try {
      content = readFileSync(absolute, "utf8");
    } catch {
      return [];
    }
    return FORBIDDEN_SCRIPT_SECRET_PATTERNS.filter(({ pattern }) =>
      pattern.test(content),
    ).map(({ label }) => ({ file, label }));
  });

console.log("repo-control: tracked top-level classifications");
for (const name of trackedTopLevels) {
  console.log(
    `  ${name}: ${TOP_LEVEL_CLASSIFICATIONS.get(name) || "UNCLASSIFIED"}`,
  );
}

if (artifactDebt.length > 0) {
  console.log("");
  console.log("repo-control: artifact/generated path debt");
  for (const root of artifactDebt) {
    console.log(
      `  ${root.path}: ${root.files} files on disk, ${root.tracked} tracked - ${root.canonical}`,
    );
  }
}

if (trackedScriptCategories.length > 0) {
  console.log("");
  console.log("repo-control: tracked scripts category classifications");
  for (const name of trackedScriptCategories) {
    console.log(
      `  scripts/${name}: ${SCRIPT_CATEGORY_CLASSIFICATIONS.get(name) || "UNCLASSIFIED"}`,
    );
  }
}

if (trackedScriptRootFiles.length > 0) {
  console.log("");
  console.log("repo-control: tracked root scripts classifications");
  for (const name of trackedScriptRootFiles) {
    console.log(
      `  scripts/${name}: ${SCRIPT_ROOT_FILES.get(name) || "UNCLASSIFIED"}`,
    );
  }
}

if (
  liveblocksFiles.length > 0 ||
  liveblocksReferences.length > 0 ||
  packageJson.length > 0
) {
  console.log("");
  console.log("repo-control: retired Liveblocks paths detected");
  console.log(`  tracked Liveblocks-related files: ${liveblocksFiles.length}`);
  console.log(`  active runtime references: ${liveblocksReferences.length}`);
  console.log(`  @liveblocks dependencies: ${packageJson.length}`);
  for (const file of liveblocksFiles) {
    console.log(`    ${file}`);
  }
  for (const dependency of packageJson) {
    console.log(`    ${dependency}`);
  }
  for (const file of liveblocksReferences) {
    console.log(`    ${file}`);
  }
}

if (scriptSecretFindings.length > 0) {
  console.log("");
  console.log("repo-control: hardcoded script secrets detected");
  for (const finding of scriptSecretFindings) {
    console.log(`  ${finding.file}: ${finding.label}`);
  }
}

if (unknownTopLevels.length > 0) {
  console.error("");
  console.error("ERROR: unclassified tracked top-level paths:");
  for (const name of unknownTopLevels) {
    console.error(`  ${name}`);
  }
  console.error("");
  console.error(
    "Classify the path in docs/ops/repo-control/README.md and scripts/audits/check-repo-control.mjs.",
  );
  process.exit(1);
}

if (unknownScriptCategories.length > 0) {
  console.error("");
  console.error("ERROR: unclassified tracked scripts categories:");
  for (const name of unknownScriptCategories) {
    console.error(`  scripts/${name}`);
  }
  console.error("");
  console.error(
    "Classify the category in scripts/README.md and scripts/audits/check-repo-control.mjs.",
  );
  process.exit(1);
}

if (unknownScriptRootFiles.length > 0) {
  console.error("");
  console.error("ERROR: unclassified tracked root scripts:");
  for (const name of unknownScriptRootFiles) {
    console.error(`  scripts/${name}`);
  }
  console.error("");
  console.error(
    "Classify the root script in scripts/ROOT-SCRIPTS.md and scripts/audits/check-repo-control.mjs, or move it under an owner folder.",
  );
  process.exit(1);
}

if (missingDocsSiteFiles.length > 0) {
  console.error("");
  console.error("ERROR: required docs source-of-truth files are missing:");
  for (const file of missingDocsSiteFiles) {
    console.error(`  ${file}`);
  }
  console.error("");
  console.error(
    "docs/alleato-os-docs is the canonical current docs site. Restore the docs-site files or update the guard intentionally.",
  );
  process.exit(1);
}

if (missingScriptControlFiles.length > 0) {
  console.error("");
  console.error("ERROR: required scripts control files are missing:");
  for (const file of missingScriptControlFiles) {
    console.error(`  ${file}`);
  }
  console.error("");
  console.error(
    "Restore the scripts source-of-truth files or update the guard intentionally.",
  );
  process.exit(1);
}

if (forbiddenArtifactDebt.length > 0) {
  console.error("");
  console.error("ERROR: deprecated generated artifact roots are present:");
  for (const root of forbiddenArtifactDebt) {
    console.error(
      `  ${root.path}: ${root.files} files on disk, ${root.tracked} tracked`,
    );
  }
  console.error("");
  console.error(
    "These roots were removed from the live checkout because they confuse source-of-truth discovery.",
  );
  console.error(
    "Move required evidence to tests/agent-browser-runs or tmp/evidence, then delete the generated root.",
  );
  process.exit(1);
}

if (
  liveblocksFiles.length > 0 ||
  liveblocksReferences.length > 0 ||
  packageJson.length > 0
) {
  console.error("");
  console.error("ERROR: Liveblocks is retired from the live codebase.");
  console.error("Use Supabase/Velt collaboration paths instead.");
  process.exit(1);
}

if (scriptSecretFindings.length > 0) {
  console.error("");
  console.error(
    "ERROR: hardcoded Supabase key literals are present under scripts/.",
  );
  console.error(
    "Use environment variables or provider-managed credentials; do not commit literal provider keys.",
  );
  process.exit(1);
}

if (
  strict &&
  (artifactDebt.length > 0 ||
    liveblocksFiles.length > 0 ||
    liveblocksReferences.length > 0 ||
    packageJson.length > 0)
) {
  console.error("");
  console.error("ERROR: repo-control strict mode found cleanup debt.");
  process.exit(1);
}

console.log("");
console.log(
  strict
    ? "repo-control: strict mode passed"
    : "repo-control: passed classification check; cleanup debt reported above",
);
